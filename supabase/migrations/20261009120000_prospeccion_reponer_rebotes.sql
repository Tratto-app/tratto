-- Mails a proveedores: la meta de 70 por día se cuenta sobre los mails que
-- llegaron. mkt_rubro_del_dia() suma rebotes_hoy y entregados_hoy para que la
-- corrida reponga cada rebote con un proveedor nuevo (pedido del fundador,
-- 9/10/2026). Misma firma: solo se agregan claves a la respuesta.

-- Rubro del día. La primera llamada del día lo toma (suma la vuelta y anota la
-- fecha); las siguientes del mismo día devuelven el mismo, con cuántos mails
-- ya salieron hoy. Así una corrida cortada se puede retomar sin cambiar de rubro.
-- Desde el 9/10/2026 también devuelve cuántos de los de hoy rebotaron (la
-- dirección no existía) y cuántos llegaron: la meta de 70 se cuenta sobre los
-- que llegaron, así que cada rebote se repone con un proveedor nuevo
-- (pedido del fundador).
create or replace function mkt_rubro_del_dia(p_ws uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := coalesce(p_ws, public.crm_ws());
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  zonas text[] := array['CABA', 'GBA Norte', 'GBA Oeste', 'GBA Sur', 'Buenos Aires (interior)'];
  r public.growth_mkt_rotacion;
  hechos int;
  rebotes int;
begin
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
    'zona', zonas[((r.vueltas - 1) % 5) + 1], 'zonas', to_jsonb(zonas),
    'total_rubros', (select count(*) from public.growth_mkt_rotacion where workspace_id = ws and activo),
    'enviados_hoy', hechos,
    'rebotes_hoy', rebotes,
    'entregados_hoy', hechos - rebotes,
    'pendientes_hoy', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'ref', p.ref, 'email', p.email)), '[]'::jsonb)
                         from public.growth_prospects p
                        where p.workspace_id = ws and p.entrada = 'prospeccion' and p.rubro = r.rubro
                          and p.status = 'uncontacted' and not p.do_not_contact));
end $$;

revoke all on function mkt_rubro_del_dia(uuid) from public, anon, authenticated;
