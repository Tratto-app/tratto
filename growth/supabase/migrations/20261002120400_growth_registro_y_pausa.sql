-- Growth OS · 5/5 · Registro con consentimiento, tipo/rubro/zona y pausa de envíos
--
-- Prepara el sistema para captar proveedores y clientes DESDE SUS PROPIOS
-- registros (nunca escribiéndole a desconocidos):
--  * growth_prospects.kind: 'provider' (ofrece un servicio) o 'customer' (lo busca).
--  * rubro y zona, con los mismos valores que usa la app.
--  * growth_app_settings.sending_paused: mientras está en true, las
--    automatizaciones NO envían nada (se encolan). Arranca en true.
--  * growth_app_settings.contact_phone: teléfono de contacto que puede
--    aparecer en los mensajes (no se hardcodea en el código).
--  * growth_signup(): alta pública con consentimiento explícito (la usa la
--    Edge Function growth-signup; nadie escribe la tabla sin pasar por acá).
--  * El disparador 'prospect_created' ahora respeta el trigger_filter, así la
--    automatización de proveedores solo corre para proveedores, etc.

alter table public.growth_prospects
  add column if not exists kind  text not null default 'customer' check (kind in ('provider','customer')),
  add column if not exists rubro text,
  add column if not exists zona  text;
create index if not exists growth_prospects_ws_kind_idx on public.growth_prospects (workspace_id, kind);

alter table public.growth_app_settings
  add column if not exists contact_phone  text,
  -- Interruptor de lanzamiento: en true, el sistema prepara todo pero no envía.
  add column if not exists sending_paused boolean not null default true;

-- Alta pública con consentimiento. La llama la Edge Function growth-signup
-- (service role). Valida el workspace y el tipo; guarda de dónde vino el
-- consentimiento. Si ya existe alguien con ese email/teléfono en el
-- workspace, actualiza en vez de duplicar.
create or replace function public.growth_signup(ws uuid, kind text, data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  em  text := lower(nullif(trim(data->>'email'), ''));
  ph  text := nullif(regexp_replace(coalesce(data->>'phone',''), '[^0-9+]', '', 'g'), '');
  src uuid;
begin
  if not exists (select 1 from public.growth_workspaces where id = ws) then
    raise exception 'Workspace inexistente';
  end if;
  if kind not in ('provider','customer') then raise exception 'Tipo inválido'; end if;
  if em is null and ph is null then raise exception 'Hace falta un email o un teléfono'; end if;

  select id into src from public.growth_sources
   where workspace_id = ws and key = coalesce(nullif(data->>'source',''), 'organic') limit 1;

  -- ¿Ya está? (mismo email o teléfono en el workspace)
  select id into pid from public.growth_prospects
   where workspace_id = ws and ((em is not null and lower(email) = em) or (ph is not null and phone = ph))
   order by created_at limit 1;

  if pid is null then
    insert into public.growth_prospects
      (workspace_id, kind, first_name, last_name, email, phone, company, city, zona, rubro,
       source_id, consent, consent_source, status, notes)
    values (ws, kind, nullif(data->>'first_name',''), nullif(data->>'last_name',''), em, ph,
            nullif(data->>'company',''), nullif(data->>'city',''), nullif(data->>'zona',''), nullif(data->>'rubro',''),
            src, 'opt_in', coalesce(nullif(data->>'consent_source',''), 'Registro en la web'), 'new',
            nullif(data->>'notes',''))
    returning id into pid;
  else
    update public.growth_prospects set
      kind = kind, -- respeta el tipo con el que se registró ahora
      first_name = coalesce(first_name, nullif(data->>'first_name','')),
      last_name  = coalesce(last_name,  nullif(data->>'last_name','')),
      email = coalesce(email, em), phone = coalesce(phone, ph),
      company = coalesce(company, nullif(data->>'company','')),
      zona = coalesce(nullif(data->>'zona',''), zona), rubro = coalesce(nullif(data->>'rubro',''), rubro),
      consent = 'opt_in', do_not_contact = false,
      consent_source = coalesce(consent_source, 'Registro en la web')
    where id = pid;
  end if;

  insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail, actor)
  values (ws, pid, 'signup', 'Se registró desde la web', jsonb_build_object('kind', kind, 'rubro', data->>'rubro', 'zona', data->>'zona'), 'app');
  return pid;
end $$;

revoke all on function public.growth_signup(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.growth_signup(uuid, text, jsonb) to service_role;

-- Baja: marca opt_out por email/teléfono. La usa growth-baja (link de cada mail).
create or replace function public.growth_optout(ws uuid, who text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int; k text := lower(trim(who));
begin
  update public.growth_prospects
     set consent = 'opt_out', do_not_contact = true, consent_source = 'Pidió la baja'
   where workspace_id = ws and (lower(email) = k or phone = regexp_replace(who, '[^0-9+]', '', 'g'));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.growth_optout(uuid, text) from public, anon, authenticated;
grant execute on function public.growth_optout(uuid, text) to service_role;

-- El disparador 'prospect_created' ahora aplica el trigger_filter (igual que
-- 'status_changed'): así la automatización de proveedores solo arranca para
-- proveedores y la de clientes solo para clientes.
create or replace function public.growth_prospects_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare w record;
begin
  if tg_op = 'INSERT' then
    insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail)
    values (new.workspace_id, new.id, 'created', 'Prospecto agregado',
            jsonb_build_object('source_id', new.source_id, 'campaign_id', new.campaign_id, 'kind', new.kind));
    for w in select id, trigger_filter from public.growth_workflows
              where workspace_id = new.workspace_id and active and trigger = 'prospect_created' loop
      if public.growth_match(to_jsonb(new), w.trigger_filter) then
        insert into public.growth_workflow_runs (workspace_id, workflow_id, prospect_id)
        values (new.workspace_id, w.id, new.id) on conflict do nothing;
      end if;
    end loop;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail)
    values (new.workspace_id, new.id, 'status', 'Estado: ' || public.growth_status_label(new.status),
            jsonb_build_object('from', old.status, 'to', new.status));
    for w in select id, trigger_filter from public.growth_workflows
              where workspace_id = new.workspace_id and active and trigger = 'status_changed' loop
      if public.growth_match(to_jsonb(new), w.trigger_filter) then
        insert into public.growth_workflow_runs (workspace_id, workflow_id, prospect_id)
        values (new.workspace_id, w.id, new.id) on conflict do nothing;
      end if;
    end loop;
  end if;

  if new.score >= 81 and old.score < 81 then
    insert into public.growth_notifications (workspace_id, type, title, body, prospect_id)
    values (new.workspace_id, 'high_intent',
            'Alta intención: ' || coalesce(nullif(trim(concat_ws(' ', new.first_name, new.last_name)), ''), 'prospecto'),
            'El score subió a ' || new.score || '.', new.id);
  end if;
  return new;
end $$;
