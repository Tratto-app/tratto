-- Mails a proveedores: el fundador pidió (9/10/2026) "mandemos todos los mails
-- que podamos con esos 5.000" créditos. Con modo 'maximo', la meta de cada día
-- es lo que alcanzan los créditos del día (hasta meta_maxima, debajo del límite
-- diario de Gmail). Si la cuenta no está sana (rebotes de 7 días >= 3 % o
-- bajas >= 5 %), vuelve sola a meta_base (70) hasta que se recupere.
-- El costo por mail sale de las últimas 7 corridas, sin las marcadas con
-- datos.excluir_promedio (la del 9/10: créditos del plan gratis a la mañana y
-- lectura de la interfaz interna de BuscaOficios a la tarde, que no se repite),
-- y nunca menos de 1 crédito por mail.

update public.growth_mkt_ajustes
   set valor = valor || jsonb_build_object(
         'modo', 'maximo', 'meta_base', 70, 'meta_maxima', 300,
         'nota', 'Modo maximo (pedido del fundador 9/10/2026): la meta es lo que alcanzan los créditos del día, hasta 300 (debajo del límite diario de Gmail). Si rebotes de 7 días >= 3 % o bajas >= 5 %, vuelve a 70. Modo rampa: sube de a paso_semanal desde inicio_rampa.'),
       updated_at = now()
 where workspace_id = public.crm_ws() and clave = 'prospeccion';

create or replace function mkt_prospeccion_presupuesto(p_ws uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid := coalesce(p_ws, public.crm_ws());
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  fc jsonb; pr jsonb;
  dia int; inicio date; fin date; dias_restantes int;
  disponible int; usado int; presupuesto int;
  semanas int; meta_rampa int; meta_creditos int; meta int;
  base int; maxima int;
  env7 int; reb7 int; no7 int; sana boolean;
  cpm numeric;
begin
  select valor into fc from public.growth_mkt_ajustes where workspace_id = ws and clave = 'firecrawl';
  select valor into pr from public.growth_mkt_ajustes where workspace_id = ws and clave = 'prospeccion';
  if fc is null or pr is null then return null; end if;

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

  select count(*), count(*) filter (where 'rebote' = any(tags)), count(*) filter (where consent = 'opt_out')
    into env7, reb7, no7
    from public.growth_prospects
   where workspace_id = ws and entrada = 'prospeccion'
     and contacted_at >= now() - interval '7 days';
  sana := env7 = 0 or (reb7::numeric / env7 < 0.03 and no7::numeric / env7 < 0.05);

  base := coalesce((pr->>'meta_base')::int, 70);
  maxima := coalesce((pr->>'meta_maxima')::int, base);
  if not sana then
    meta_rampa := base;
  elsif pr->>'modo' = 'maximo' then
    meta_rampa := maxima;
  else
    semanas := greatest(floor((hoy - coalesce((pr->>'inicio_rampa')::date, hoy)) / 7.0)::int + 1, 0);
    meta_rampa := least(base + coalesce((pr->>'paso_semanal')::int, 0) * semanas, maxima);
  end if;

  select sum((datos->>'creditos_firecrawl')::numeric) / nullif(sum((datos->>'entregados')::numeric), 0) into cpm
    from (select datos from public.growth_mkt_items
           where workspace_id = ws and datos->>'clave' = 'prospeccion_dia'
             and datos ? 'creditos_firecrawl' and datos ? 'entregados'
             and coalesce(datos->>'excluir_promedio', 'false') <> 'true'
           order by (datos->>'fecha')::date desc limit 7) x;
  cpm := greatest(coalesce(cpm, (pr->>'creditos_por_mail_inicial')::numeric, 1.4), 1.0);
  meta_creditos := floor(presupuesto / cpm)::int;
  meta := least(meta_rampa, meta_creditos);

  return jsonb_build_object(
    'fecha', hoy, 'ciclo_inicio', inicio, 'ciclo_fin', fin - 1, 'dias_restantes', dias_restantes,
    'creditos_mes', fc->'creditos_mes', 'reserva_otros_usos', fc->'reserva_otros_usos',
    'usado_en_el_ciclo', usado, 'quedan', disponible - usado,
    'presupuesto_hoy', presupuesto,
    'creditos_por_mail', round(cpm, 2), 'modo', coalesce(pr->>'modo', 'rampa'),
    'cuenta_sana', sana, 'enviados_7d', env7, 'rebotes_7d', reb7, 'bajas_7d', no7,
    'meta_rampa', meta_rampa, 'meta_por_creditos', meta_creditos, 'meta_hoy', meta);
end $$;

revoke all on function mkt_prospeccion_presupuesto(uuid) from public, anon, authenticated;
