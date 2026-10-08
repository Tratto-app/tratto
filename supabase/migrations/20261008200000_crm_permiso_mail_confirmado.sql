-- CRM: el permiso de novedades cuenta recién con el mail confirmado.
-- Aplicada en producción el 8/10/2026. Item aprobado 55d80a7f de growth_mkt_items.
--
-- Con la casilla opcional del registro (item 693f91ce), el permiso se guarda al
-- crear la cuenta, antes de que la persona confirme su mail. Si alguien tipea
-- mal su dirección y tilda la casilla, el dueño real de ese mail recibiría
-- mails sin haber dado permiso. Ahora:
--   1. Al registrarse: opt_in solo si el mail ya está confirmado; si no, unknown.
--   2. Al confirmar el mail: si tildó la casilla, pasa a opt_in y se disparan
--      las automatizaciones, igual que cuando activa el permiso en Ajustes.
--   3. Activar el permiso desde Ajustes con el mail sin confirmar tampoco da
--      opt_in. Apagarlo siempre da de baja.
-- Se mide con: contactos opt_in de registro_app con la cuenta sin confirmar = 0.

create or replace function public.crm_registrar_usuario(u auth.users)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m   jsonb := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  o   jsonb := coalesce(m->'origen', '{}'::jsonb);
  ws  uuid := public.crm_ws();
  pid uuid;
  r   jsonb;
begin
  if ws is null or u.email is null or privado.es_demo(u.id) then return; end if;
  pid := public.crm_capturar(case when m->>'rol' = 'proveedor' then 'provider' else 'customer' end,
           u.email, 'registro_app',
           case when m->>'publicidad_permiso' = 'true' and u.email_confirmed_at is not null
                then 'opt_in' else 'unknown' end,
           'Permiso de publicidad en la app',
           jsonb_build_object('first_name', m->>'nombre', 'phone', m->>'telefono', 'rubro', m->>'rubro'),
           o);
  r := public.growth_ingest_event(ws, jsonb_build_object(
         'event', 'register', 'external_user_id', u.id::text, 'email', u.email, 'name', m->>'nombre',
         'platform', coalesce(o->>'plataforma', 'web'), 'click_token', o->>'gid', 'prospect_id', pid,
         'occurred_at', u.created_at, 'idempotency_key', 'register:' || u.id::text));
  update public.growth_app_users a set source_id = p.source_id
    from public.growth_prospects p
   where a.id = public.growth_uuid(r->>'app_user_id') and p.id = pid and p.source_id is not null;
  -- Cuentas internas del equipo (alias +algo de la casilla de Tratto): marcadas y sin mensajes
  if u.email ~* '^trattoapp1[+]' then
    update public.growth_prospects set do_not_contact = true,
           tags = case when 'interno' = any(tags) then tags else tags || 'interno'::text end
     where id = pid;
  end if;
end $$;

create or replace function public.crm_desde_permiso()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ahora boolean := (new.raw_user_meta_data->>'publicidad_permiso') = 'true';
  pid uuid;
begin
  -- Activar sin el mail confirmado no da permiso todavía: lo da crm_desde_confirmacion().
  if ahora and new.email_confirmed_at is null then return new; end if;
  begin
    update public.growth_prospects set
      consent = case when ahora then 'opt_in' else 'opt_out' end,
      do_not_contact = case when ahora then ('interno' = any(tags)) else true end,
      consent_source = case when ahora then 'Activó la publicidad en la app' else 'Apagó la publicidad en la app' end
     where workspace_id = public.crm_ws() and lower(email) = lower(new.email)
    returning id into pid;
    if ahora and pid is not null then perform public.crm_disparar(pid); end if;
  exception when others then
    raise warning 'CRM (permiso): %', sqlerrm;
  end;
  return new;
end $$;

-- Al confirmar el mail: si tildó la casilla al registrarse, recién ahí cuenta el permiso.
create or replace function public.crm_desde_confirmacion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  if (new.raw_user_meta_data->>'publicidad_permiso') is distinct from 'true' then return new; end if;
  begin
    update public.growth_prospects set
      consent = 'opt_in',
      do_not_contact = ('interno' = any(tags)),
      consent_source = 'Permiso de publicidad en la app (mail confirmado)'
     where workspace_id = public.crm_ws() and lower(email) = lower(new.email)
       and consent <> 'opt_out'
    returning id into pid;
    if pid is not null then perform public.crm_disparar(pid); end if;
  exception when others then
    raise warning 'CRM (confirmación): %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.crm_desde_confirmacion() from public, anon, authenticated;

drop trigger if exists crm_confirmacion on auth.users;
create trigger crm_confirmacion after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.crm_desde_confirmacion();
