-- Volver a unos 100 mails por día (pedido del fundador, 14/10/2026: "no entiendo
-- por qué 20 mails ... con el límite que estábamos antes que eran 100").
--
-- Por qué daba 20: 1.800 créditos apartados para las listas de WhatsApp y un
-- costo por mail de 2,96 sacado de un solo informe (la recuperación del 11/10),
-- mientras los informes diarios de Codex (datos.clave 'gmail_rutina_dia_<fecha>')
-- no entraban ni en lo gastado ni en el costo por mail.
--
-- Decisión del fundador: WhatsApp con tope chico (15 créditos por día) y se
-- mantiene el freno por rebotes (70 por día mientras los rebotes de 7 días
-- estén en 3 % o más). Meta máxima: 100.
--
-- Cambios:
-- - Los mails de los dos agentes cuentan igual: informes 'prospeccion_dia'
--   (Claude) y 'gmail_rutina_dia_<fecha>' (Codex), en lo gastado del ciclo y en
--   el costo por mail.
-- - prospeccion.cpm_desde: el costo por mail se calcula con los informes desde
--   esa fecha (deja afuera la recuperación del 11 al 13).
-- - Reserva de Firecrawl: 400 de otros usos + 455 de WhatsApp (63 ya gastados +
--   15 por día hasta el 8/11).

update public.growth_mkt_ajustes
   set valor = valor || jsonb_build_object(
         'meta_maxima', 100,
         'cpm_desde', '2026-10-14',
         'nota', 'Modo maximo hasta 100 por día (pedido del fundador 14/10/2026). La meta es lo que alcanzan los créditos del día. Si rebotes de 7 días >= 3 % o bajas >= 5 %, baja a 70. El costo por mail usa los informes desde cpm_desde.'),
       updated_at = now()
 where clave = 'prospeccion';

update public.growth_mkt_ajustes
   set valor = valor || jsonb_build_object(
         'reserva_otros_usos', 855,
         'reserva_desglose', jsonb_build_object('otros_usos_preexistentes', 400, 'whatsapp_manual', 455),
         'whatsapp_tope_diario', 15,
         'nota_reserva', 'Decisión del fundador 14/10/2026: WhatsApp manual con tope de 15 créditos por día (63 ya gastados + 15 x 26 días = 455). El resto va a los mails.'),
       updated_at = now()
 where clave = 'firecrawl';

create or replace function public.mkt_prospeccion_presupuesto(p_ws uuid default null)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  ws uuid := coalesce(p_ws, public.crm_ws());
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  fc jsonb; pr jsonb;
  dia int; inicio date; fin date; dias_restantes int;
  disponible int; usado int; presupuesto int;
  semanas int; meta_rampa int; meta_creditos int; meta int;
  base int; maxima int;
  env7 int; reb7 int; no7 int; sana boolean;
  cpm numeric; cpm_desde date;
begin
  select valor into fc from public.growth_mkt_ajustes where workspace_id = ws and clave = 'firecrawl';
  select valor into pr from public.growth_mkt_ajustes where workspace_id = ws and clave = 'prospeccion';
  if fc is null or pr is null then return null; end if;

  dia := least(greatest(coalesce((fc->>'dia_renovacion')::int, 1), 1), 28);
  inicio := make_date(extract(year from hoy)::int, extract(month from hoy)::int, dia);
  if inicio > hoy then inicio := (inicio - interval '1 month')::date; end if;
  fin := (inicio + interval '1 month')::date;
  dias_restantes := greatest(fin - hoy, 1);
  cpm_desde := greatest(coalesce((pr->>'cpm_desde')::date, inicio), inicio);

  -- Informes de mails de los dos agentes: 'prospeccion_dia' (Claude) y
  -- 'gmail_rutina_dia_<fecha>' (Codex).
  disponible := coalesce((fc->>'creditos_mes')::int, 0) - coalesce((fc->>'reserva_otros_usos')::int, 0);
  select coalesce(sum(coalesce((datos->>'creditos_firecrawl')::int, 0)), 0) into usado
    from public.growth_mkt_items
   where workspace_id = ws
     and (datos->>'clave' = 'prospeccion_dia' or datos->>'clave' like 'gmail\_rutina\_dia\_%')
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
           where workspace_id = ws
             and (datos->>'clave' = 'prospeccion_dia' or datos->>'clave' like 'gmail\_rutina\_dia\_%')
             and datos ? 'creditos_firecrawl' and datos ? 'entregados'
             and coalesce(datos->>'excluir_promedio', 'false') <> 'true'
             and (datos->>'fecha')::date >= cpm_desde
           order by (datos->>'fecha')::date desc limit 7) x;
  cpm := greatest(coalesce(cpm, (pr->>'creditos_por_mail_inicial')::numeric, 1.4), 1.0);
  meta_creditos := floor(presupuesto / cpm)::int;
  meta := least(meta_rampa, meta_creditos);

  return jsonb_build_object(
    'fecha', hoy, 'ciclo_inicio', inicio, 'ciclo_fin', fin - 1, 'dias_restantes', dias_restantes,
    'creditos_mes', fc->'creditos_mes', 'reserva_otros_usos', fc->'reserva_otros_usos',
    'usado_en_el_ciclo', usado, 'quedan', disponible - usado,
    'presupuesto_hoy', presupuesto,
    'creditos_por_mail', round(cpm, 2), 'cpm_desde', cpm_desde, 'modo', coalesce(pr->>'modo', 'rampa'),
    'cuenta_sana', sana, 'enviados_7d', env7, 'rebotes_7d', reb7, 'bajas_7d', no7,
    'meta_rampa', meta_rampa, 'meta_por_creditos', meta_creditos, 'meta_hoy', meta);
end $function$;
