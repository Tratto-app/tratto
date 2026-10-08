-- Retención: una visita por día.
-- Antes el CRM anotaba una sesión solo cuando alguien iniciaba sesión
-- (last_sign_in_at), y como la app recuerda la sesión, quien la abría seguido
-- figuraba como que no volvía. Ahora la app llama a crm_visita() al abrirse:
-- se anota como mucho UNA visita por persona y por día (hora de Argentina).
-- Aplicada en producción el 8/10/2026.

create or replace function crm_visita() returns void
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.crm_ws();
  uid uuid := auth.uid();
  hoy text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
begin
  if ws is null or uid is null or privado.es_demo(uid) then return; end if;
  if not exists (select 1 from public.growth_app_users where workspace_id = ws and external_user_id = uid::text) then return; end if;
  if exists (select 1 from public.growth_app_events where workspace_id = ws and idempotency_key = 'visita:' || uid::text || ':' || hoy) then return; end if;
  perform public.growth_ingest_event(ws, jsonb_build_object(
    'event', 'session_start', 'external_user_id', uid::text,
    'idempotency_key', 'visita:' || uid::text || ':' || hoy));
exception when others then
  raise warning 'CRM (visita): %', sqlerrm;  -- la app nunca se rompe por el CRM
end $$;

revoke execute on function crm_visita() from public, anon;
grant execute on function crm_visita() to authenticated;
