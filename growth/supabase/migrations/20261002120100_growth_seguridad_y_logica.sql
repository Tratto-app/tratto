-- Growth OS · 2/4 · Seguridad (RLS) y lógica automática
--
-- RLS: cada fila tiene workspace_id y solo la ven/escriben los miembros de ese
-- workspace. growth_is_member() es security definer para que la política no
-- dependa de poder leer growth_members.

-- ── Membresía ──
create or replace function public.growth_is_member(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.growth_members m
                  where m.workspace_id = ws and m.user_id = (select auth.uid()));
$$;

create or replace function public.growth_role(ws uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.growth_members m
   where m.workspace_id = ws and m.user_id = (select auth.uid());
$$;

-- Lo que llega desde la app y lo que registra el sistema no se edita a mano:
-- los miembros lo leen; lo escriben las funciones (security definer) y el
-- service role de las Edge Functions.
-- ── RLS en todas las tablas (una sentencia por tabla) ──
alter table public.growth_app_settings enable row level security;
revoke all on public.growth_app_settings from anon;
grant select, insert, update, delete on public.growth_app_settings to authenticated;
drop policy if exists "miembros del workspace" on public.growth_app_settings;
create policy "miembros del workspace" on public.growth_app_settings for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_knowledge enable row level security;
revoke all on public.growth_knowledge from anon;
grant select, insert, update, delete on public.growth_knowledge to authenticated;
drop policy if exists "miembros del workspace" on public.growth_knowledge;
create policy "miembros del workspace" on public.growth_knowledge for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_objections enable row level security;
revoke all on public.growth_objections from anon;
grant select, insert, update, delete on public.growth_objections to authenticated;
drop policy if exists "miembros del workspace" on public.growth_objections;
create policy "miembros del workspace" on public.growth_objections for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_sources enable row level security;
revoke all on public.growth_sources from anon;
grant select, insert, update, delete on public.growth_sources to authenticated;
drop policy if exists "miembros del workspace" on public.growth_sources;
create policy "miembros del workspace" on public.growth_sources for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_segments enable row level security;
revoke all on public.growth_segments from anon;
grant select, insert, update, delete on public.growth_segments to authenticated;
drop policy if exists "miembros del workspace" on public.growth_segments;
create policy "miembros del workspace" on public.growth_segments for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_workflows enable row level security;
revoke all on public.growth_workflows from anon;
grant select, insert, update, delete on public.growth_workflows to authenticated;
drop policy if exists "miembros del workspace" on public.growth_workflows;
create policy "miembros del workspace" on public.growth_workflows for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_campaigns enable row level security;
revoke all on public.growth_campaigns from anon;
grant select, insert, update, delete on public.growth_campaigns to authenticated;
drop policy if exists "miembros del workspace" on public.growth_campaigns;
create policy "miembros del workspace" on public.growth_campaigns for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_campaign_sources enable row level security;
revoke all on public.growth_campaign_sources from anon;
grant select, insert, update, delete on public.growth_campaign_sources to authenticated;
drop policy if exists "miembros del workspace" on public.growth_campaign_sources;
create policy "miembros del workspace" on public.growth_campaign_sources for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_spend enable row level security;
revoke all on public.growth_spend from anon;
grant select, insert, update, delete on public.growth_spend to authenticated;
drop policy if exists "miembros del workspace" on public.growth_spend;
create policy "miembros del workspace" on public.growth_spend for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_prospects enable row level security;
revoke all on public.growth_prospects from anon;
grant select, insert, update, delete on public.growth_prospects to authenticated;
drop policy if exists "miembros del workspace" on public.growth_prospects;
create policy "miembros del workspace" on public.growth_prospects for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_timeline enable row level security;
revoke all on public.growth_timeline from anon;
grant select, insert, update, delete on public.growth_timeline to authenticated;
drop policy if exists "miembros del workspace" on public.growth_timeline;
create policy "miembros del workspace" on public.growth_timeline for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_conversations enable row level security;
revoke all on public.growth_conversations from anon;
grant select, insert, update, delete on public.growth_conversations to authenticated;
drop policy if exists "miembros del workspace" on public.growth_conversations;
create policy "miembros del workspace" on public.growth_conversations for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_messages enable row level security;
revoke all on public.growth_messages from anon;
grant select, insert, update, delete on public.growth_messages to authenticated;
drop policy if exists "miembros del workspace" on public.growth_messages;
create policy "miembros del workspace" on public.growth_messages for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_workflow_steps enable row level security;
revoke all on public.growth_workflow_steps from anon;
grant select, insert, update, delete on public.growth_workflow_steps to authenticated;
drop policy if exists "miembros del workspace" on public.growth_workflow_steps;
create policy "miembros del workspace" on public.growth_workflow_steps for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_workflow_runs enable row level security;
revoke all on public.growth_workflow_runs from anon;
grant select, insert, update, delete on public.growth_workflow_runs to authenticated;
drop policy if exists "miembros del workspace" on public.growth_workflow_runs;
create policy "miembros del workspace" on public.growth_workflow_runs for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_tasks enable row level security;
revoke all on public.growth_tasks from anon;
grant select, insert, update, delete on public.growth_tasks to authenticated;
drop policy if exists "miembros del workspace" on public.growth_tasks;
create policy "miembros del workspace" on public.growth_tasks for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_tracking_links enable row level security;
revoke all on public.growth_tracking_links from anon;
grant select, insert, update, delete on public.growth_tracking_links to authenticated;
drop policy if exists "miembros del workspace" on public.growth_tracking_links;
create policy "miembros del workspace" on public.growth_tracking_links for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_link_clicks enable row level security;
revoke all on public.growth_link_clicks from anon;
grant select, insert, update, delete on public.growth_link_clicks to authenticated;
drop policy if exists "miembros del workspace" on public.growth_link_clicks;
create policy "miembros del workspace" on public.growth_link_clicks for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_app_users enable row level security;
revoke all on public.growth_app_users from anon;
grant select, insert, update, delete on public.growth_app_users to authenticated;
drop policy if exists "miembros del workspace" on public.growth_app_users;
create policy "miembros del workspace" on public.growth_app_users for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_app_events enable row level security;
revoke all on public.growth_app_events from anon;
grant select, insert, update, delete on public.growth_app_events to authenticated;
drop policy if exists "miembros del workspace" on public.growth_app_events;
create policy "miembros del workspace" on public.growth_app_events for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_installations enable row level security;
revoke all on public.growth_installations from anon;
grant select, insert, update, delete on public.growth_installations to authenticated;
drop policy if exists "miembros del workspace" on public.growth_installations;
create policy "miembros del workspace" on public.growth_installations for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_registrations enable row level security;
revoke all on public.growth_registrations from anon;
grant select, insert, update, delete on public.growth_registrations to authenticated;
drop policy if exists "miembros del workspace" on public.growth_registrations;
create policy "miembros del workspace" on public.growth_registrations for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_activations enable row level security;
revoke all on public.growth_activations from anon;
grant select, insert, update, delete on public.growth_activations to authenticated;
drop policy if exists "miembros del workspace" on public.growth_activations;
create policy "miembros del workspace" on public.growth_activations for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_user_sessions enable row level security;
revoke all on public.growth_user_sessions from anon;
grant select, insert, update, delete on public.growth_user_sessions to authenticated;
drop policy if exists "miembros del workspace" on public.growth_user_sessions;
create policy "miembros del workspace" on public.growth_user_sessions for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_score_rules enable row level security;
revoke all on public.growth_score_rules from anon;
grant select, insert, update, delete on public.growth_score_rules to authenticated;
drop policy if exists "miembros del workspace" on public.growth_score_rules;
create policy "miembros del workspace" on public.growth_score_rules for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_ai_prompts enable row level security;
revoke all on public.growth_ai_prompts from anon;
grant select, insert, update, delete on public.growth_ai_prompts to authenticated;
drop policy if exists "miembros del workspace" on public.growth_ai_prompts;
create policy "miembros del workspace" on public.growth_ai_prompts for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_ai_runs enable row level security;
revoke all on public.growth_ai_runs from anon;
grant select, insert, update, delete on public.growth_ai_runs to authenticated;
drop policy if exists "miembros del workspace" on public.growth_ai_runs;
create policy "miembros del workspace" on public.growth_ai_runs for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_notifications enable row level security;
revoke all on public.growth_notifications from anon;
grant select, insert, update, delete on public.growth_notifications to authenticated;
drop policy if exists "miembros del workspace" on public.growth_notifications;
create policy "miembros del workspace" on public.growth_notifications for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

alter table public.growth_integrations enable row level security;
revoke all on public.growth_integrations from anon;
grant select, insert, update, delete on public.growth_integrations to authenticated;
drop policy if exists "miembros del workspace" on public.growth_integrations;
create policy "miembros del workspace" on public.growth_integrations for all to authenticated
  using ((select public.growth_is_member(workspace_id))) with check ((select public.growth_is_member(workspace_id)));

revoke insert, update, delete on public.growth_link_clicks from authenticated;

revoke insert, update, delete on public.growth_app_events from authenticated;

revoke insert, update, delete on public.growth_installations from authenticated;

revoke insert, update, delete on public.growth_registrations from authenticated;

revoke insert, update, delete on public.growth_activations from authenticated;

revoke insert, update, delete on public.growth_user_sessions from authenticated;

revoke insert, update, delete on public.growth_ai_runs from authenticated;

revoke insert, update, delete on public.growth_timeline from authenticated;

-- La línea de tiempo sí admite notas manuales (insert) desde el panel.
grant insert on public.growth_timeline to authenticated;

alter table public.growth_workspaces enable row level security;
revoke all on public.growth_workspaces from anon;
grant select, insert, update, delete on public.growth_workspaces to authenticated;
revoke update (ingest_key_hash, is_demo) on public.growth_workspaces from authenticated;
drop policy if exists "ver mis workspaces" on public.growth_workspaces;
drop policy if exists "crear workspace" on public.growth_workspaces;
drop policy if exists "editar workspace" on public.growth_workspaces;
drop policy if exists "borrar workspace" on public.growth_workspaces;
create policy "ver mis workspaces" on public.growth_workspaces for select to authenticated
  using ((select public.growth_is_member(id)));
create policy "crear workspace" on public.growth_workspaces for insert to authenticated
  with check (created_by = (select auth.uid()) and not is_demo);
create policy "editar workspace" on public.growth_workspaces for update to authenticated
  using ((select public.growth_role(id)) in ('owner','admin'));
create policy "borrar workspace" on public.growth_workspaces for delete to authenticated
  using ((select public.growth_role(id)) = 'owner');

alter table public.growth_members enable row level security;
revoke all on public.growth_members from anon;
grant select, insert, update, delete on public.growth_members to authenticated;
drop policy if exists "ver miembros" on public.growth_members;
drop policy if exists "administrar miembros" on public.growth_members;
create policy "ver miembros" on public.growth_members for select to authenticated
  using ((select public.growth_is_member(workspace_id)));
create policy "administrar miembros" on public.growth_members for all to authenticated
  using ((select public.growth_role(workspace_id)) in ('owner','admin') and role <> 'owner')
  with check ((select public.growth_role(workspace_id)) in ('owner','admin') and role <> 'owner');

alter table public.growth_system enable row level security;
revoke all on public.growth_system from anon, authenticated;

-- ── Evaluador de reglas (scoring y segmentos) ──
-- Una condición es {"field":"status","op":"in","value":[...]} o un grupo
-- {"all":[...]} / {"any":[...]}. Operadores: eq, neq, in, nin, gt, gte, lt,
-- lte, is_set, is_null, contains, has_tag, older_than_days, within_days.
create or replace function public.growth_num(v text)
returns numeric language plpgsql immutable as $$
begin
  return v::numeric;
exception when others then
  return null;
end $$;

create or replace function public.growth_ts(v text)
returns timestamptz language plpgsql stable as $$
begin
  return v::timestamptz;
exception when others then
  return null;
end $$;

create or replace function public.growth_match(obj jsonb, cond jsonb)
returns boolean language plpgsql stable set search_path = '' as $$
declare
  c jsonb; v jsonb; val jsonb; op text; vt text; valt text;
begin
  if cond is null or cond = '{}'::jsonb then return true; end if;
  if cond ? 'all' then
    for c in select * from jsonb_array_elements(cond->'all') loop
      if not public.growth_match(obj, c) then return false; end if;
    end loop;
    return true;
  end if;
  if cond ? 'any' then
    for c in select * from jsonb_array_elements(cond->'any') loop
      if public.growth_match(obj, c) then return true; end if;
    end loop;
    return false;
  end if;

  v := obj -> (cond->>'field');
  op := cond->>'op';
  val := cond->'value';
  vt := case when v is null or jsonb_typeof(v) = 'null' then null else v #>> '{}' end;
  valt := case when val is null or jsonb_typeof(val) = 'null' then null else val #>> '{}' end;

  return case op
    when 'is_set'  then vt is not null and vt <> '' and v <> '[]'::jsonb
    when 'is_null' then vt is null or vt = '' or v = '[]'::jsonb
    when 'eq'      then vt is not null and lower(vt) = lower(valt)
    when 'neq'     then vt is null or lower(vt) <> lower(valt)
    when 'in'      then vt is not null and jsonb_typeof(val) = 'array'
                        and exists (select 1 from jsonb_array_elements_text(val) x where lower(x) = lower(vt))
    when 'nin'     then vt is null or (jsonb_typeof(val) = 'array'
                        and not exists (select 1 from jsonb_array_elements_text(val) x where lower(x) = lower(vt)))
    when 'gt'      then public.growth_num(vt) >  public.growth_num(valt)
    when 'gte'     then public.growth_num(vt) >= public.growth_num(valt)
    when 'lt'      then public.growth_num(vt) <  public.growth_num(valt)
    when 'lte'     then public.growth_num(vt) <= public.growth_num(valt)
    when 'contains' then vt is not null and position(lower(valt) in lower(vt)) > 0
    when 'has_tag' then jsonb_typeof(v) = 'array' and exists (
                        select 1 from jsonb_array_elements_text(v) x where lower(x) = lower(valt))
    when 'older_than_days' then public.growth_ts(vt) < now() - make_interval(days => public.growth_num(valt)::int)
    when 'within_days'     then public.growth_ts(vt) >= now() - make_interval(days => public.growth_num(valt)::int)
    else false
  end;
end $$;

-- Puntaje según las reglas activas del workspace (0 a 100)
create or replace function public.growth_score_for(ws uuid, obj jsonb)
returns int language sql stable security definer set search_path = '' as $$
  select greatest(0, least(100, coalesce(sum(r.points), 0)))::int
    from public.growth_score_rules r
   where r.workspace_id = ws and r.active and public.growth_match(obj, r.condition);
$$;

-- Orden de las etapas del funnel (las negativas valen -1)
create or replace function public.growth_stage_rank(st text)
returns int language sql immutable as $$
  select case st
    when 'new' then 0 when 'uncontacted' then 0 when 'contacted' then 1 when 'replied' then 2
    when 'interested' then 3 when 'link_sent' then 4 when 'clicked' then 5 when 'installed' then 6
    when 'registered' then 7 when 'activated' then 8 when 'active' then 9 else -1 end;
$$;

create or replace function public.growth_status_label(st text)
returns text language sql immutable as $$
  select case st
    when 'new' then 'Nuevo' when 'uncontacted' then 'Sin contactar' when 'contacted' then 'Contactado'
    when 'replied' then 'Respondió' when 'interested' then 'Interesado' when 'link_sent' then 'Link enviado'
    when 'clicked' then 'Click realizado' when 'installed' then 'Instaló' when 'registered' then 'Registrado'
    when 'activated' then 'Activado' when 'active' then 'Usuario activo' when 'not_interested' then 'No interesado'
    when 'no_response' then 'No responde' else st end;
$$;

-- Avanza a un prospecto a una etapa sin hacerlo retroceder. Las etapas
-- "duras" (click, instalación, registro, activación) pisan un "no interesado".
create or replace function public.growth_advance(pid uuid, st text, ts timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  select status into cur from public.growth_prospects where id = pid;
  if cur is null then return; end if;
  -- La marca de tiempo de la etapa se guarda aunque no cambie el estado
  -- (por ejemplo, un click de alguien que ya estaba registrado), y antes del
  -- cambio de estado para conservar la hora real del evento.
  if st in ('contacted','replied','interested','link_sent','clicked','installed','registered','activated') then
    execute format('update public.growth_prospects set %I = coalesce(%I, $1) where id = $2', st || '_at', st || '_at')
      using ts, pid;
  end if;
  if public.growth_stage_rank(st) > public.growth_stage_rank(cur)
     or (public.growth_stage_rank(cur) < 0 and public.growth_stage_rank(st) >= 5) then
    update public.growth_prospects set status = st where id = pid;
  end if;
end $$;

-- ── Triggers de prospectos ──
create or replace function public.growth_prospects_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status is distinct from (case when tg_op = 'UPDATE' then old.status end) then
    case new.status
      when 'contacted'  then new.contacted_at  := coalesce(new.contacted_at, now());
      when 'replied'    then new.replied_at    := coalesce(new.replied_at, now());
      when 'interested' then new.interested_at := coalesce(new.interested_at, now());
      when 'link_sent'  then new.link_sent_at  := coalesce(new.link_sent_at, now());
      when 'clicked'    then new.clicked_at    := coalesce(new.clicked_at, now());
      when 'installed'  then new.installed_at  := coalesce(new.installed_at, now());
      when 'registered' then new.registered_at := coalesce(new.registered_at, now());
      when 'activated'  then new.activated_at  := coalesce(new.activated_at, now());
      else null;
    end case;
  end if;
  if new.status = 'interested' and new.interest in ('unknown','none','low') then
    new.interest := 'medium';
  end if;
  if new.consent = 'opt_out' then new.do_not_contact := true; end if;
  if not new.score_manual then
    new.score := public.growth_score_for(new.workspace_id, to_jsonb(new));
  end if;
  return new;
end $$;

create or replace function public.growth_prospects_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare w record;
begin
  if tg_op = 'INSERT' then
    insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail)
    values (new.workspace_id, new.id, 'created', 'Prospecto agregado',
            jsonb_build_object('source_id', new.source_id, 'campaign_id', new.campaign_id));
    for w in select id from public.growth_workflows
              where workspace_id = new.workspace_id and active and trigger = 'prospect_created' loop
      insert into public.growth_workflow_runs (workspace_id, workflow_id, prospect_id)
      values (new.workspace_id, w.id, new.id) on conflict do nothing;
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

drop trigger if exists growth_prospects_before on public.growth_prospects;
create trigger growth_prospects_before before insert or update on public.growth_prospects
  for each row execute function public.growth_prospects_before();
drop trigger if exists growth_prospects_after on public.growth_prospects;
create trigger growth_prospects_after after insert or update on public.growth_prospects
  for each row execute function public.growth_prospects_after();

-- Recalcular todos los scores del workspace (después de cambiar reglas)
create or replace function public.growth_recompute_scores(ws uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if (select auth.uid()) is not null and not public.growth_is_member(ws) then
    raise exception 'Sin acceso a este workspace';
  end if;
  update public.growth_prospects p set updated_at = now()
   where p.workspace_id = ws and not p.score_manual;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Mensajes: actualizan prospecto, conversación y automatizaciones ──
create or replace function public.growth_messages_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p record; w record;
begin
  select * into p from public.growth_prospects where id = new.prospect_id;
  if new.direction = 'out' and new.status in ('sent','delivered','read','mock_sent','queued') then
    update public.growth_prospects
       set contact_count = contact_count + 1, last_contact_at = new.created_at,
           status = case when public.growth_stage_rank(status) < 1 and status in ('new','uncontacted') then 'contacted' else status end
     where id = new.prospect_id;
    update public.growth_conversations
       set last_message_at = new.created_at, status = 'waiting'
     where id = new.conversation_id;
    insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail, actor)
    values (new.workspace_id, new.prospect_id, 'message_out',
            'Mensaje enviado por ' || new.channel || case when new.status = 'mock_sent' then ' (simulado)' else '' end,
            jsonb_build_object('message_id', new.id, 'ai', new.ai_generated, 'template', new.template_key),
            case when new.workflow_id is not null then 'automation' when new.ai_generated then 'ai' else 'user' end);
  elsif new.direction = 'in' then
    update public.growth_prospects
       set last_reply_at = new.created_at, last_reply_text = left(new.body, 500),
           replied_at = coalesce(replied_at, new.created_at),
           status = case when public.growth_stage_rank(status) < 2 then 'replied' else status end
     where id = new.prospect_id;
    update public.growth_conversations
       set last_message_at = new.created_at, unread = unread + 1, status = 'open'
     where id = new.conversation_id;
    insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail)
    values (new.workspace_id, new.prospect_id, 'message_in', 'Respondió por ' || new.channel,
            jsonb_build_object('message_id', new.id, 'texto', left(new.body, 200)));
    insert into public.growth_notifications (workspace_id, type, title, body, prospect_id)
    values (new.workspace_id, 'reply',
            'Nueva respuesta de ' || coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'un prospecto'),
            left(new.body, 140), new.prospect_id);
    -- Despierta las automatizaciones que esperaban respuesta
    update public.growth_workflow_runs
       set status = 'running', wait_until = null, updated_at = now()
     where prospect_id = new.prospect_id and status = 'waiting' and waiting_reply;
    for w in select id from public.growth_workflows
              where workspace_id = new.workspace_id and active and trigger = 'reply_received' loop
      insert into public.growth_workflow_runs (workspace_id, workflow_id, prospect_id)
      values (new.workspace_id, w.id, new.prospect_id) on conflict do nothing;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists growth_messages_after on public.growth_messages;
create trigger growth_messages_after after insert on public.growth_messages
  for each row execute function public.growth_messages_after();

-- ── Al crear un workspace: su dueño, configuración y valores iniciales ──
create or replace function public.growth_workspace_init()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.growth_members (workspace_id, user_id, role)
    values (new.id, new.created_by, 'owner') on conflict do nothing;
  end if;
  insert into public.growth_app_settings (workspace_id) values (new.id) on conflict do nothing;

  insert into public.growth_sources (workspace_id, key, name, kind) values
    (new.id, 'instagram', 'Instagram', 'social'), (new.id, 'tiktok', 'TikTok', 'social'),
    (new.id, 'facebook', 'Facebook', 'social'), (new.id, 'google', 'Google', 'search'),
    (new.id, 'ads', 'Publicidad', 'paid'), (new.id, 'influencers', 'Influencers', 'influencer'),
    (new.id, 'referral', 'Referidos', 'referral'), (new.id, 'organic', 'Orgánico', 'organic'),
    (new.id, 'whatsapp', 'WhatsApp', 'messaging'), (new.id, 'email', 'Email', 'email'),
    (new.id, 'offline', 'Calle y carteles', 'other'), (new.id, 'other', 'Otros', 'other')
  on conflict do nothing;

  insert into public.growth_score_rules (workspace_id, name, condition, points, sort) values
    (new.id, 'Tiene un dato de contacto', '{"any":[{"field":"email","op":"is_set"},{"field":"phone","op":"is_set"},{"field":"instagram","op":"is_set"}]}', 5, 1),
    (new.id, 'Aceptó recibir mensajes', '{"field":"consent","op":"eq","value":"opt_in"}', 10, 2),
    (new.id, 'Respondió', '{"field":"replied_at","op":"is_set"}', 15, 3),
    (new.id, 'Interés medio', '{"field":"interest","op":"eq","value":"medium"}', 15, 4),
    (new.id, 'Interés alto', '{"field":"interest","op":"eq","value":"high"}', 30, 5),
    (new.id, 'Hizo click en el link', '{"field":"clicked_at","op":"is_set"}', 15, 6),
    (new.id, 'Instaló la app', '{"field":"installed_at","op":"is_set"}', 15, 7),
    (new.id, 'Se registró', '{"field":"registered_at","op":"is_set"}', 10, 8),
    (new.id, 'No le interesa', '{"field":"status","op":"eq","value":"not_interested"}', -40, 9),
    (new.id, 'No responde después de 3 contactos', '{"all":[{"field":"contact_count","op":"gte","value":3},{"field":"replied_at","op":"is_null"}]}', -15, 10);

  insert into public.growth_segments (workspace_id, name, description, entity, rules, is_system) values
    (new.id, 'Argentina', 'Prospectos de Argentina', 'prospect', '{"field":"country","op":"eq","value":"AR"}', true),
    (new.id, 'Buenos Aires', 'Ciudad o provincia de Buenos Aires', 'prospect', '{"any":[{"field":"city","op":"contains","value":"buenos aires"},{"field":"city","op":"contains","value":"caba"}]}', true),
    (new.id, 'Usuarios potenciales', 'Todavía no contactados', 'prospect', '{"field":"status","op":"in","value":["new","uncontacted"]}', true),
    (new.id, 'Alta intención', 'Score 81 o más', 'prospect', '{"field":"score","op":"gte","value":81}', true),
    (new.id, 'Interesados', 'Mostraron interés y todavía no instalaron', 'prospect', '{"all":[{"field":"interested_at","op":"is_set"},{"field":"installed_at","op":"is_null"}]}', true),
    (new.id, 'Instaló pero no se registró', '', 'app_user', '{"all":[{"field":"installed_at","op":"is_set"},{"field":"registered_at","op":"is_null"}]}', true),
    (new.id, 'Se registró pero no se activó', '', 'app_user', '{"all":[{"field":"registered_at","op":"is_set"},{"field":"activated_at","op":"is_null"}]}', true),
    (new.id, 'Usuario activo', 'Usó la app en los últimos 7 días', 'app_user', '{"field":"last_seen_at","op":"within_days","value":7}', true),
    (new.id, 'Usuario inactivo', 'Activado, sin usar la app hace más de 7 días', 'app_user', '{"all":[{"field":"activated_at","op":"is_set"},{"field":"last_seen_at","op":"older_than_days","value":7}]}', true),
    (new.id, 'Abandonaron', 'Sin usar la app hace más de 30 días', 'app_user', '{"field":"last_seen_at","op":"older_than_days","value":30}', true);

  insert into public.growth_ai_prompts (workspace_id, key, instructions) values
    (new.id, 'analyze', 'Analizá al prospecto: a qué segmento pertenece, qué tan probable es que use la app (0 a 100), qué problema de la app le resolvería y cuál es la mejor próxima acción. No inventes datos que no estén en el perfil.'),
    (new.id, 'message', 'Escribí un primer mensaje corto (máximo 3 oraciones), en el tono del canal, que explique qué gana esta persona con la app. Usá solo funcionalidades y precios reales de la base de conocimiento. Incluí cómo dejar de recibir mensajes si el canal lo requiere. Nada de promesas que la app no cumple.'),
    (new.id, 'reply', 'Analizá la respuesta: intención (alta, media, baja, ninguna), si hay una objeción y cuál, y proponé la respuesta siguiente basada en la base de conocimiento.'),
    (new.id, 'summary', 'Resumí la conversación en 2 líneas: qué quiere la persona, en qué etapa está y qué falta.'),
    (new.id, 'objection', 'Identificá la objeción y respondela con información real de la app. Si no sabés la respuesta, decilo y ofrecé averiguarlo.'),
    (new.id, 'score', 'Recomendá un score de 0 a 100 según la probabilidad de que esta persona instale, se registre y use la app. Explicá en una línea por qué.'),
    (new.id, 'explain', 'Explicá la app en lenguaje simple, adaptado al perfil de la persona, en no más de 4 oraciones.')
  on conflict do nothing;

  insert into public.growth_integrations (workspace_id, provider, mode) values
    (new.id,'instagram','mock'),(new.id,'whatsapp','mock'),(new.id,'email','mock'),(new.id,'sms','mock'),
    (new.id,'tiktok','mock'),(new.id,'google_ads','mock'),(new.id,'google_play','mock'),(new.id,'app_store','mock'),
    (new.id,'analytics','mock'),(new.id,'attribution','mock'),(new.id,'openai','mock')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists growth_workspace_init on public.growth_workspaces;
create trigger growth_workspace_init after insert on public.growth_workspaces
  for each row execute function public.growth_workspace_init();

-- Clave para que la app mande eventos (se muestra una sola vez)
create or replace function public.growth_rotate_ingest_key(ws uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if coalesce(public.growth_role(ws), '') not in ('owner','admin') then
    raise exception 'Solo el dueño o un admin pueden generar la clave';
  end if;
  k := 'gk_' || encode(extensions.gen_random_bytes(24), 'hex');
  update public.growth_workspaces set ingest_key_hash = encode(extensions.digest(k, 'sha256'), 'hex') where id = ws;
  return k;
end $$;

revoke all on function public.growth_rotate_ingest_key(uuid), public.growth_recompute_scores(uuid),
  public.growth_advance(uuid, text, timestamptz), public.growth_score_for(uuid, jsonb) from public, anon;
grant execute on function public.growth_rotate_ingest_key(uuid), public.growth_recompute_scores(uuid) to authenticated;
revoke all on function public.growth_advance(uuid, text, timestamptz), public.growth_score_for(uuid, jsonb) from authenticated;
