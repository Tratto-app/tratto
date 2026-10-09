-- Mails a proveedores con Firecrawl pago (pedido del fundador, 9/10/2026:
-- "le pongo 5.000 créditos ... usemos el máximo, que no quede un crédito").
--
-- growth_mkt_ajustes guarda los números que se pueden cambiar sin tocar código
-- (plan de Firecrawl, día de renovación, meta de mails y su rampa).
-- mkt_prospeccion_presupuesto() calcula cada día cuántos créditos se pueden
-- gastar (lo que queda del mes repartido en los días que faltan, así no sobra
-- ni falta) y la meta de mails de hoy: 70 la primera semana y después sube de a
-- 10 por semana hasta el máximo, solo si la cuenta de Gmail está sana
-- (rebotes y pedidos de baja bajos). La meta también queda limitada por lo que
-- alcanzan los créditos del día.

create table if not exists public.growth_mkt_ajustes (
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  clave text not null,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, clave)
);
alter table public.growth_mkt_ajustes enable row level security;
revoke all on public.growth_mkt_ajustes from anon, authenticated;

insert into public.growth_mkt_ajustes (workspace_id, clave, valor)
select public.crm_ws(), 'firecrawl', jsonb_build_object(
  'creditos_mes', 5000, 'dia_renovacion', 9, 'reserva_otros_usos', 400,
  'nota', 'Plan pago desde el 9/10/2026. reserva_otros_usos = radar de redes y otras búsquedas del equipo.')
where public.crm_ws() is not null
on conflict (workspace_id, clave) do nothing;

insert into public.growth_mkt_ajustes (workspace_id, clave, valor)
select public.crm_ws(), 'prospeccion', jsonb_build_object(
  'meta_base', 70, 'meta_maxima', 120, 'paso_semanal', 10, 'inicio_rampa', '2026-10-16',
  'creditos_por_mail_inicial', 1.4,
  'nota', 'Meta = mails que llegan. Sube de a 10 por semana desde inicio_rampa si rebotes < 3 % y pedidos de baja < 5 % en los últimos 7 días.')
where public.crm_ws() is not null
on conflict (workspace_id, clave) do nothing;

create or replace function mkt_prospeccion_presupuesto(p_ws uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid := coalesce(p_ws, public.crm_ws());
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  fc jsonb; pr jsonb;
  dia int; inicio date; fin date; dias_restantes int;
  disponible int; usado int; presupuesto int;
  semanas int; meta_rampa int; meta_creditos int; meta int;
  env7 int; reb7 int; no7 int; sana boolean;
  cpm numeric;
begin
  select valor into fc from public.growth_mkt_ajustes where workspace_id = ws and clave = 'firecrawl';
  select valor into pr from public.growth_mkt_ajustes where workspace_id = ws and clave = 'prospeccion';
  if fc is null or pr is null then return null; end if;

  -- Ciclo de facturación: del último día de renovación hasta el anterior al próximo.
  dia := least(greatest(coalesce((fc->>'dia_renovacion')::int, 1), 1), 28);
  inicio := make_date(extract(year from hoy)::int, extract(month from hoy)::int, dia);
  if inicio > hoy then inicio := (inicio - interval '1 month')::date; end if;
  fin := (inicio + interval '1 month')::date;
  dias_restantes := greatest(fin - hoy, 1);

  disponible := coalesce((fc->>'creditos_mes')::int, 0) - coalesce((fc->>'reserva_otros_usos')::int, 0);
  select coalesce(sum(coalesce((datos->>'creditos_firecrawl')::int, 0)), 0) into usado
    from public.growth_mkt_items
   where workspace_id = ws and datos->>'clave' = 'prospeccion_dia'
     and (datos->>'fecha')::date >= inicio and (datos->>'fecha')::date < hoy;
  presupuesto := greatest((disponible - usado) / dias_restantes, 0);

  -- Salud de los últimos 7 días (mails que salieron en esos días).
  select count(*), count(*) filter (where 'rebote' = any(tags)), count(*) filter (where consent = 'opt_out')
    into env7, reb7, no7
    from public.growth_prospects
   where workspace_id = ws and entrada = 'prospeccion'
     and contacted_at >= now() - interval '7 days';
  sana := env7 = 0 or (reb7::numeric / env7 < 0.03 and no7::numeric / env7 < 0.05);

  semanas := greatest(floor((hoy - coalesce((pr->>'inicio_rampa')::date, hoy)) / 7.0)::int + 1, 0);
  meta_rampa := case when sana
    then least(coalesce((pr->>'meta_base')::int, 70) + coalesce((pr->>'paso_semanal')::int, 0) * semanas,
               coalesce((pr->>'meta_maxima')::int, 70))
    else coalesce((pr->>'meta_base')::int, 70) end;

  -- Créditos por mail entregado, según las últimas 7 corridas (o el valor inicial).
  select sum((datos->>'creditos_firecrawl')::numeric) / nullif(sum((datos->>'entregados')::numeric), 0) into cpm
    from (select datos from public.growth_mkt_items
           where workspace_id = ws and datos->>'clave' = 'prospeccion_dia'
             and datos ? 'creditos_firecrawl' and datos ? 'entregados'
           order by (datos->>'fecha')::date desc limit 7) x;
  cpm := coalesce(cpm, (pr->>'creditos_por_mail_inicial')::numeric, 1.4);
  meta_creditos := floor(presupuesto / greatest(cpm, 0.5))::int;
  meta := least(meta_rampa, meta_creditos);

  return jsonb_build_object(
    'fecha', hoy, 'ciclo_inicio', inicio, 'ciclo_fin', fin - 1, 'dias_restantes', dias_restantes,
    'creditos_mes', fc->'creditos_mes', 'reserva_otros_usos', fc->'reserva_otros_usos',
    'usado_en_el_ciclo', usado, 'quedan', disponible - usado,
    'presupuesto_hoy', presupuesto,
    'creditos_por_mail', round(cpm, 2),
    'cuenta_sana', sana, 'enviados_7d', env7, 'rebotes_7d', reb7, 'bajas_7d', no7,
    'meta_rampa', meta_rampa, 'meta_por_creditos', meta_creditos, 'meta_hoy', meta);
end $$;

revoke all on function mkt_prospeccion_presupuesto(uuid) from public, anon, authenticated;
