-- El rubro del día toma la zona de la etapa actual (pedido del fundador,
-- 14/10/2026: datos nuevos solo de CABA; después Zona Norte, Oeste y Sur, y
-- el cambio de etapa lo decide el fundador). Antes la zona rotaba sola con
-- cada vuelta de los 46 rubros, y al terminar la primera vuelta habría pasado
-- a GBA Norte sin que nadie lo pidiera.
-- La zona sale de growth_mkt_ajustes.prospeccion_geografia.zona_actual; si ese
-- ajuste no existe, queda la rotación de antes. El resto no cambia.

create or replace function public.mkt_rubro_del_dia(p_ws uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ws uuid := coalesce(p_ws, public.crm_ws());
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  zonas text[] := array['CABA', 'GBA Norte', 'GBA Oeste', 'GBA Sur', 'Buenos Aires (interior)'];
  r public.growth_mkt_rotacion;
  hechos int;
  rebotes int;
  zona_actual text;
begin
  select valor->>'zona_actual' into zona_actual
    from public.growth_mkt_ajustes where workspace_id = ws and clave = 'prospeccion_geografia';

  select * into r from public.growth_mkt_rotacion where workspace_id = ws and ultima_vez = hoy limit 1;
  if r.orden is null then
    select * into r from public.growth_mkt_rotacion where workspace_id = ws and activo
     order by vueltas, orden limit 1 for update;
    if r.orden is null then return null; end if;
    update public.growth_mkt_rotacion set vueltas = vueltas + 1, ultima_vez = hoy
     where workspace_id = ws and orden = r.orden returning * into r;
  end if;
  select count(*) into hechos from public.growth_prospects p
   where p.workspace_id = ws and p.entrada = 'prospeccion' and p.rubro = r.rubro
     and p.contacted_at is not null
     and (p.contacted_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy;
  select count(*) into rebotes from public.growth_prospects p
   where p.workspace_id = ws and p.entrada = 'prospeccion' and p.rubro = r.rubro
     and p.contacted_at is not null and 'rebote' = any(p.tags)
     and (p.contacted_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy;
  return jsonb_build_object(
    'fecha', hoy, 'orden', r.orden, 'rubro', r.rubro, 'grupo', r.grupo,
    'busquedas', to_jsonb(r.busquedas), 'vuelta', r.vueltas,
    'zona', coalesce(nullif(zona_actual, ''), zonas[((r.vueltas - 1) % 5) + 1]),
    'zona_fuente', case when nullif(zona_actual, '') is not null then 'prospeccion_geografia' else 'rotacion' end,
    'zonas', to_jsonb(zonas),
    'total_rubros', (select count(*) from public.growth_mkt_rotacion where workspace_id = ws and activo),
    'enviados_hoy', hechos,
    'rebotes_hoy', rebotes,
    'entregados_hoy', hechos - rebotes,
    'pendientes_hoy', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'ref', p.ref, 'email', p.email)), '[]'::jsonb)
                         from public.growth_prospects p
                        where p.workspace_id = ws and p.entrada = 'prospeccion' and p.rubro = r.rubro
                          and p.status = 'uncontacted' and not p.do_not_contact));
end $function$;
