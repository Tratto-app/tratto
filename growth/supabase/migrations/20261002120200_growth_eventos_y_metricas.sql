-- Growth OS · 3/4 · Eventos de la app, clicks y métricas
--
-- Todas las métricas se calculan desde las tablas: nada está escrito a mano.
-- Las funciones de métricas son security definer pero verifican que quien
-- pregunta sea miembro del workspace (growth_check).

create or replace function public.growth_check(ws uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  -- auth.uid() es null cuando llama el service role (Edge Functions) o el SQL editor
  if (select auth.uid()) is not null and not public.growth_is_member(ws) then
    raise exception 'Sin acceso a este workspace' using errcode = '42501';
  end if;
end $$;

create or replace function public.growth_uuid(v text)
returns uuid language plpgsql immutable as $$
begin
  return v::uuid;
exception when others then
  return null;
end $$;

create or replace function public.growth_name(first text, last text)
returns text language sql immutable as $$
  select coalesce(nullif(trim(concat_ws(' ', first, last)), ''), 'Sin nombre');
$$;

-- ── Avisos de objetivo de campaña (una vez por campaña) ──
create or replace function public.growth_check_campaign_goal(cid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; n bigint;
begin
  if cid is null then return; end if;
  select * into c from public.growth_campaigns where id = cid;
  if c.goal_target is null or c.status <> 'active' then return; end if;
  if exists (select 1 from public.growth_notifications where campaign_id = cid and type = 'campaign_goal') then return; end if;
  n := case c.goal_metric
    when 'prospects'     then (select count(*) from public.growth_prospects where campaign_id = cid)
    when 'contacted'     then (select count(*) from public.growth_prospects where campaign_id = cid and contacted_at is not null)
    when 'replies'       then (select count(*) from public.growth_prospects where campaign_id = cid and replied_at is not null)
    when 'clicks'        then (select count(*) from public.growth_link_clicks k join public.growth_tracking_links l on l.id = k.link_id where l.campaign_id = cid)
    when 'installs'      then (select count(*) from public.growth_app_users where campaign_id = cid and installed_at is not null)
    when 'registrations' then (select count(*) from public.growth_app_users where campaign_id = cid and registered_at is not null)
    when 'activations'   then (select count(*) from public.growth_app_users where campaign_id = cid and activated_at is not null)
  end;
  if n >= c.goal_target * 0.9 then
    insert into public.growth_notifications (workspace_id, type, title, body, campaign_id)
    values (c.workspace_id, 'campaign_goal',
            case when n >= c.goal_target then 'Campaña cumplió su objetivo: ' else 'Campaña cerca del objetivo: ' end || c.name,
            n || ' de ' || c.goal_target, cid);
  end if;
end $$;

-- ── Click en un link trackeado ──
-- Lo llama la Edge Function growth-go (service role). Devuelve los datos para
-- que la función arme la redirección.
create or replace function public.growth_record_click(p_slug text, p_ref text, p_device text, p_ua text, p_referrer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l record; s record; pid uuid; tok text; tgt text; src text; camp text;
begin
  select * into l from public.growth_tracking_links where slug = lower(p_slug) and not archived;
  if l.id is null then return null; end if;
  select * into s from public.growth_app_settings where workspace_id = l.workspace_id;
  if p_ref is not null and p_ref ~ '^[a-z0-9]{6,16}$' then
    select id into pid from public.growth_prospects where ref = p_ref and workspace_id = l.workspace_id;
  end if;
  p_device := case when p_device in ('android','ios','desktop') then p_device else 'other' end;
  tgt := case l.destination
    when 'play' then 'play' when 'appstore' then 'appstore' when 'web' then 'web' when 'custom' then 'custom'
    else case p_device when 'android' then 'play' when 'ios' then 'appstore' else 'web' end end;
  -- Si falta la URL del destino elegido, se cae a la web
  if (tgt = 'play' and s.play_store_url is null) or (tgt = 'appstore' and s.app_store_url is null) then
    tgt := 'web';
  end if;
  tok := encode(extensions.gen_random_bytes(12), 'hex');
  insert into public.growth_link_clicks (workspace_id, link_id, prospect_id, click_token, device, target, referrer, user_agent)
  values (l.workspace_id, l.id, pid, tok, p_device, tgt, left(p_referrer, 300), left(p_ua, 300));
  if pid is not null then
    perform public.growth_advance(pid, 'clicked', now());
    insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail)
    values (l.workspace_id, pid, 'click', 'Hizo click en el link "' || l.name || '"',
            jsonb_build_object('device', p_device, 'target', tgt, 'link_id', l.id));
  end if;
  select key into src from public.growth_sources where id = l.source_id;
  select name into camp from public.growth_campaigns where id = l.campaign_id;
  perform public.growth_check_campaign_goal(l.campaign_id);
  return jsonb_build_object(
    'target', tgt, 'token', tok, 'slug', l.slug,
    'play_store_url', s.play_store_url, 'app_store_url', s.app_store_url,
    'website', s.website, 'custom_url', l.custom_url,
    'utm_source', coalesce(src, 'growth'), 'utm_medium', coalesce(l.utm_medium, 'link'),
    'utm_campaign', coalesce(camp, l.slug), 'utm_content', l.utm_content);
end $$;

-- ── Ingesta de eventos de la app ──
-- Eventos: install, open, register, onboarding_complete, first_action,
-- session_start, purchase, o cualquier otro (queda registrado). Vincula al
-- usuario con su prospecto por click_token, prospect_id o email.
create or replace function public.growth_ingest_event(ws uuid, ev jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e   text := lower(coalesce(ev->>'event', ''));
  at  timestamptz := coalesce(public.growth_ts(ev->>'occurred_at'), now());
  ext text := nullif(ev->>'external_user_id', '');
  tok text := nullif(ev->>'click_token', '');
  em  text := lower(nullif(trim(ev->>'email'), ''));
  plat text := lower(nullif(ev->>'platform', ''));
  idem text := nullif(ev->>'idempotency_key', '');
  amt numeric := public.growth_num(ev->>'amount');
  pid uuid := public.growth_uuid(ev->>'prospect_id');
  u   public.growth_app_users;
  clk public.growth_link_clicks;
  lnk public.growth_tracking_links;
  s   public.growth_app_settings;
  pname text;
  nuevo boolean := false;
begin
  e := case e when 'sign_up' then 'register' when 'signup' then 'register' when 'app_open' then 'open'
              when 'first_open' then 'open' else e end;
  if e !~ '^[a-z0-9_]{2,40}$' then raise exception 'Evento inválido'; end if;
  if plat is not null and plat not in ('android','ios','web') then plat := 'other'; end if;
  if idem is not null and exists (select 1 from public.growth_app_events where workspace_id = ws and idempotency_key = idem) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  select * into s from public.growth_app_settings where workspace_id = ws;
  if s.workspace_id is null then raise exception 'Workspace inexistente'; end if;

  if tok is not null then
    select * into clk from public.growth_link_clicks where click_token = tok and workspace_id = ws;
    if clk.id is not null then select * into lnk from public.growth_tracking_links where id = clk.link_id; end if;
  end if;

  if ext is not null then select * into u from public.growth_app_users where workspace_id = ws and external_user_id = ext; end if;
  if u.id is null and tok is not null then
    select * into u from public.growth_app_users where workspace_id = ws and click_token = tok order by created_at limit 1;
  end if;
  if u.id is null and em is not null then
    select * into u from public.growth_app_users where workspace_id = ws and lower(email) = em order by created_at limit 1;
  end if;
  if u.id is null then
    insert into public.growth_app_users (workspace_id, external_user_id, email, name, platform, click_token, link_id,
                                         campaign_id, source_id, created_at)
    values (ws, ext, em, nullif(ev->>'name', ''), plat, tok, lnk.id, lnk.campaign_id,
            coalesce(lnk.source_id, (select id from public.growth_sources where workspace_id = ws and key = lower(ev->>'source'))),
            at)
    returning * into u;
    nuevo := true;
  else
    update public.growth_app_users
       set external_user_id = coalesce(external_user_id, ext), email = coalesce(email, em),
           name = coalesce(name, nullif(ev->>'name', '')), platform = coalesce(platform, plat),
           click_token = coalesce(click_token, tok), link_id = coalesce(link_id, lnk.id),
           campaign_id = coalesce(campaign_id, lnk.campaign_id), source_id = coalesce(source_id, lnk.source_id)
     where id = u.id returning * into u;
  end if;

  -- Vincular con el prospecto
  if u.prospect_id is null then
    pid := coalesce(pid, clk.prospect_id);
    if pid is null and em is not null then
      select id into pid from public.growth_prospects where workspace_id = ws and lower(email) = em order by created_at limit 1;
    end if;
    if pid is not null and exists (select 1 from public.growth_prospects where id = pid and workspace_id = ws) then
      update public.growth_app_users set prospect_id = pid,
             source_id = coalesce(source_id, (select source_id from public.growth_prospects where id = pid)),
             campaign_id = coalesce(campaign_id, (select campaign_id from public.growth_prospects where id = pid))
       where id = u.id returning * into u;
      update public.growth_prospects set app_user_id = u.id where id = pid and app_user_id is null;
      insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, actor)
      values (ws, pid, u.id, 'linked', 'Se vinculó con un usuario de la app', 'app');
    else
      pid := null;
    end if;
  else
    pid := u.prospect_id;
  end if;
  if pid is not null then
    select public.growth_name(first_name, last_name) into pname from public.growth_prospects where id = pid;
  end if;
  pname := coalesce(pname, u.name, u.email, 'Un usuario');

  -- Efectos de cada evento
  if e = 'install' and u.installed_at is null then
    update public.growth_app_users set installed_at = at where id = u.id returning * into u;
    insert into public.growth_installations (workspace_id, app_user_id, prospect_id, platform, link_id, installed_at)
    values (ws, u.id, pid, coalesce(plat, u.platform), u.link_id, at);
    insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, actor, created_at)
    values (ws, pid, u.id, 'install', 'Instaló la app' || coalesce(' (' || coalesce(plat, u.platform) || ')', ''), 'app', at);
    if pid is not null then perform public.growth_advance(pid, 'installed', at); end if;
    insert into public.growth_notifications (workspace_id, type, title, prospect_id, app_user_id, campaign_id)
    values (ws, 'install', 'Instalación: ' || pname, pid, u.id, u.campaign_id);
  end if;

  if e in ('open','session_start') then
    if u.first_open_at is null then
      update public.growth_app_users set first_open_at = at where id = u.id returning * into u;
      insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, actor, created_at)
      values (ws, pid, u.id, 'open', 'Abrió la app por primera vez', 'app', at);
    end if;
    insert into public.growth_user_sessions (workspace_id, app_user_id, platform, started_at, duration_s)
    values (ws, u.id, coalesce(plat, u.platform), at, public.growth_num(ev->'properties'->>'duration_s')::int);
    update public.growth_app_users set sessions_count = sessions_count + 1 where id = u.id returning * into u;
  end if;

  if e = 'register' and u.registered_at is null then
    update public.growth_app_users set registered_at = at, first_open_at = coalesce(first_open_at, at)
     where id = u.id returning * into u;
    insert into public.growth_registrations (workspace_id, app_user_id, prospect_id, method, registered_at)
    values (ws, u.id, pid, ev->'properties'->>'method', at);
    insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, actor, created_at)
    values (ws, pid, u.id, 'register', 'Se registró en la app', 'app', at);
    if pid is not null then perform public.growth_advance(pid, 'registered', at); end if;
    insert into public.growth_notifications (workspace_id, type, title, prospect_id, app_user_id, campaign_id)
    values (ws, 'registration', 'Registro: ' || pname, pid, u.id, u.campaign_id);
  end if;

  if e = 'onboarding_complete' and u.onboarded_at is null then
    update public.growth_app_users set onboarded_at = at where id = u.id returning * into u;
    insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, actor, created_at)
    values (ws, pid, u.id, 'onboarding', 'Completó el onboarding', 'app', at);
  end if;

  if e = 'first_action' and u.first_action_at is null then
    update public.growth_app_users set first_action_at = at where id = u.id returning * into u;
    insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, detail, actor, created_at)
    values (ws, pid, u.id, 'first_action', 'Hizo su primera acción en la app',
            coalesce(ev->'properties', '{}'::jsonb), 'app', at);
  end if;

  if e = 'purchase' and coalesce(amt, 0) > 0 then
    update public.growth_app_users set revenue = revenue + amt, is_paying = true where id = u.id returning * into u;
    insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, detail, actor, created_at)
    values (ws, pid, u.id, 'purchase', 'Pago en la app', jsonb_build_object('amount', amt), 'app', at);
  end if;

  -- Activación: el evento configurado en App Settings
  if e = s.activation_event and u.activated_at is null then
    update public.growth_app_users set activated_at = at where id = u.id returning * into u;
    insert into public.growth_activations (workspace_id, app_user_id, prospect_id, activation_event, activated_at)
    values (ws, u.id, pid, e, at);
    insert into public.growth_timeline (workspace_id, prospect_id, app_user_id, type, title, actor, created_at)
    values (ws, pid, u.id, 'activation', 'Usuario activado', 'app', at);
    if pid is not null then perform public.growth_advance(pid, 'activated', at); end if;
    insert into public.growth_notifications (workspace_id, type, title, prospect_id, app_user_id, campaign_id)
    values (ws, 'activation', 'Activación: ' || pname, pid, u.id, u.campaign_id);
  end if;

  update public.growth_app_users set last_seen_at = greatest(coalesce(last_seen_at, at), at) where id = u.id;

  insert into public.growth_app_events (workspace_id, app_user_id, prospect_id, event, platform, amount, properties,
                                        idempotency_key, occurred_at)
  values (ws, u.id, pid, e, coalesce(plat, u.platform), amt, coalesce(ev->'properties', '{}'::jsonb), idem, at);

  perform public.growth_check_campaign_goal(u.campaign_id);
  return jsonb_build_object('ok', true, 'app_user_id', u.id, 'prospect_id', pid, 'new_user', nuevo,
                            'activated', u.activated_at is not null);
end $$;

-- Para probar el flujo completo sin la app real: solo en workspaces demo.
create or replace function public.growth_simulate_event(ws uuid, ev jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.growth_check(ws);
  if (select auth.uid()) is null or not public.growth_is_member(ws) then raise exception 'Sin acceso'; end if;
  if not (select is_demo from public.growth_workspaces where id = ws) then
    raise exception 'La simulación solo está permitida en workspaces de demostración';
  end if;
  return public.growth_ingest_event(ws, ev);
end $$;

create or replace function public.growth_simulate_click(ws uuid, p_link uuid, p_prospect uuid, p_device text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare sl text; rf text;
begin
  if (select auth.uid()) is null or not public.growth_is_member(ws) then raise exception 'Sin acceso'; end if;
  if not (select is_demo from public.growth_workspaces where id = ws) then
    raise exception 'La simulación solo está permitida en workspaces de demostración';
  end if;
  select slug into sl from public.growth_tracking_links where id = p_link and workspace_id = ws;
  select ref into rf from public.growth_prospects where id = p_prospect and workspace_id = ws;
  if sl is null then raise exception 'Link inexistente'; end if;
  return public.growth_record_click(sl, rf, p_device, 'simulado desde el panel', null);
end $$;

-- ── Usuarios inactivos (lo corre pg_cron una vez por día) ──
create or replace function public.growth_check_inactive()
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record;
begin
  for r in
    select u.id, u.workspace_id, u.prospect_id, coalesce(u.name, u.email, 'Un usuario') nombre, s.active_window_days w
      from public.growth_app_users u
      join public.growth_app_settings s on s.workspace_id = u.workspace_id
     where u.activated_at is not null
       and u.last_seen_at < now() - make_interval(days => s.active_window_days)
       and not exists (select 1 from public.growth_notifications x
                        where x.app_user_id = u.id and x.type = 'inactive_user'
                          and x.created_at > now() - make_interval(days => s.active_window_days))
     limit 200
  loop
    insert into public.growth_notifications (workspace_id, type, title, body, prospect_id, app_user_id)
    values (r.workspace_id, 'inactive_user', 'Usuario inactivo: ' || r.nombre,
            'No usa la app hace más de ' || r.w || ' días.', r.prospect_id, r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ════════════════ MÉTRICAS ════════════════
-- Convención de períodos: [p_from, p_to). p_from null = desde siempre.

-- Funnel de prospectos por cohorte: de los prospectos que entraron en el
-- período, cuántos llegaron a cada etapa (en cualquier momento). La
-- comparación es contra la cohorte del período anterior de igual duración.
create or replace function public.growth_funnel(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (stage text, label text, n bigint, prev_n bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz; t timestamptz; pf timestamptz; w int;
begin
  perform public.growth_check(ws);
  t := coalesce(p_to, now());
  f := coalesce(p_from, '-infinity'::timestamptz);
  pf := case when p_from is null then null else p_from - (t - p_from) end;
  select active_window_days into w from public.growth_app_settings where workspace_id = ws;
  return query
  with b as (
    select (p.created_at >= f) cur,
           p.created_at,
           least(p.contacted_at, p.replied_at, p.interested_at, p.link_sent_at, p.clicked_at, p.installed_at, p.registered_at, p.activated_at) r1,
           least(p.replied_at, p.interested_at, p.link_sent_at, p.clicked_at, p.installed_at, p.registered_at, p.activated_at) r2,
           least(p.interested_at, p.link_sent_at, p.clicked_at, p.installed_at, p.registered_at, p.activated_at) r3,
           least(p.link_sent_at, p.clicked_at, p.installed_at, p.registered_at, p.activated_at) r4,
           least(p.clicked_at, p.installed_at, p.registered_at, p.activated_at) r5,
           least(p.installed_at, p.registered_at, p.activated_at) r6,
           least(p.registered_at, p.activated_at) r7,
           p.activated_at r8,
           case when u.last_seen_at >= now() - make_interval(days => coalesce(w, 7)) then u.last_seen_at end r9
      from public.growth_prospects p
      left join public.growth_app_users u on u.id = p.app_user_id
     where p.workspace_id = ws and p.created_at < t
       and (p.created_at >= f or (pf is not null and p.created_at >= pf))
  )
  select x.stage, x.label, x.n, x.prev_n, x.last_at from (
    select 1 o, 'prospects'::text stage, 'Prospectos'::text label, count(*) filter (where cur) n,
           case when pf is null then null else count(*) filter (where not cur) end prev_n, max(created_at) filter (where cur) last_at from b
    union all select 2, 'contacted', 'Contactados', count(r1) filter (where cur), case when pf is null then null else count(r1) filter (where not cur) end, max(r1) filter (where cur) from b
    union all select 3, 'replied', 'Respondieron', count(r2) filter (where cur), case when pf is null then null else count(r2) filter (where not cur) end, max(r2) filter (where cur) from b
    union all select 4, 'interested', 'Interesados', count(r3) filter (where cur), case when pf is null then null else count(r3) filter (where not cur) end, max(r3) filter (where cur) from b
    union all select 5, 'link_sent', 'Link enviado', count(r4) filter (where cur), case when pf is null then null else count(r4) filter (where not cur) end, max(r4) filter (where cur) from b
    union all select 6, 'clicked', 'Click en store', count(r5) filter (where cur), case when pf is null then null else count(r5) filter (where not cur) end, max(r5) filter (where cur) from b
    union all select 7, 'installed', 'Instalaron', count(r6) filter (where cur), case when pf is null then null else count(r6) filter (where not cur) end, max(r6) filter (where cur) from b
    union all select 8, 'registered', 'Se registraron', count(r7) filter (where cur), case when pf is null then null else count(r7) filter (where not cur) end, max(r7) filter (where cur) from b
    union all select 9, 'activated', 'Activaron', count(r8) filter (where cur), case when pf is null then null else count(r8) filter (where not cur) end, max(r8) filter (where cur) from b
    union all select 10, 'active', 'Usuario activo', count(r9) filter (where cur), case when pf is null then null else count(r9) filter (where not cur) end, max(r9) filter (where cur) from b
  ) x order by x.o;
end $$;

-- Funnel dentro de la app (sección 13): de los usuarios que instalaron o
-- aparecieron en el período, cuántos abrieron, se registraron, etc.
create or replace function public.growth_app_funnel(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (stage text, label text, n bigint)
language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz; t timestamptz; w int;
begin
  perform public.growth_check(ws);
  t := coalesce(p_to, now()); f := coalesce(p_from, '-infinity'::timestamptz);
  select active_window_days into w from public.growth_app_settings where workspace_id = ws;
  return query
  with b as (
    select * from public.growth_app_users u
     where u.workspace_id = ws and coalesce(u.installed_at, u.registered_at, u.created_at) >= f
       and coalesce(u.installed_at, u.registered_at, u.created_at) < t
  )
  select x.stage, x.label, x.n from (
    select 1 o, 'install'::text stage, 'Instalación'::text label, count(*) filter (where installed_at is not null) n from b
    union all select 2, 'open', 'Abrió la app', count(*) filter (where first_open_at is not null) from b
    union all select 3, 'register', 'Registro', count(*) filter (where registered_at is not null) from b
    union all select 4, 'onboarding', 'Onboarding', count(*) filter (where onboarded_at is not null) from b
    union all select 5, 'first_action', 'Primera acción', count(*) filter (where first_action_at is not null) from b
    union all select 6, 'activated', 'Usuario activado', count(*) filter (where activated_at is not null) from b
    union all select 7, 'active', 'Usuario activo', count(*) filter (where last_seen_at >= now() - make_interval(days => coalesce(w, 7))) from b
  ) x order by x.o;
end $$;

-- KPIs del dashboard: valor del período y del período anterior.
create or replace function public.growth_kpis(ws uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t timestamptz := coalesce(p_to, now());
  f timestamptz := coalesce(p_from, '-infinity'::timestamptz);
  pf timestamptz := case when p_from is null then null else p_from - (coalesce(p_to, now()) - p_from) end;
  w int; res jsonb := '{}'::jsonb; per record;
begin
  perform public.growth_check(ws);
  select active_window_days into w from public.growth_app_settings where workspace_id = ws;
  for per in select 'cur' k, f a, t b union all select 'prev', pf, f where pf is not null loop
    res := res || jsonb_build_object(per.k, (
      select jsonb_build_object(
        'prospects',     (select count(*) from public.growth_prospects where workspace_id = ws and created_at >= per.a and created_at < per.b),
        'contacted',     (select count(*) from public.growth_prospects where workspace_id = ws and contacted_at >= per.a and contacted_at < per.b),
        'replies',       (select count(*) from public.growth_messages where workspace_id = ws and direction = 'in' and created_at >= per.a and created_at < per.b),
        'replied',       (select count(*) from public.growth_prospects where workspace_id = ws and replied_at >= per.a and replied_at < per.b),
        'interested',    (select count(*) from public.growth_prospects where workspace_id = ws and interested_at >= per.a and interested_at < per.b),
        'links_sent',    (select count(*) from public.growth_prospects where workspace_id = ws and link_sent_at >= per.a and link_sent_at < per.b),
        'clicks_play',   (select count(*) from public.growth_link_clicks where workspace_id = ws and target = 'play' and created_at >= per.a and created_at < per.b),
        'clicks_appstore',(select count(*) from public.growth_link_clicks where workspace_id = ws and target = 'appstore' and created_at >= per.a and created_at < per.b),
        'clicks_web',    (select count(*) from public.growth_link_clicks where workspace_id = ws and target in ('web','custom') and created_at >= per.a and created_at < per.b),
        'installs',      (select count(*) from public.growth_installations where workspace_id = ws and installed_at >= per.a and installed_at < per.b),
        'registrations', (select count(*) from public.growth_registrations where workspace_id = ws and registered_at >= per.a and registered_at < per.b),
        'activations',   (select count(*) from public.growth_activations where workspace_id = ws and activated_at >= per.a and activated_at < per.b),
        'active_users',  (select count(distinct app_user_id) from public.growth_user_sessions
                           where workspace_id = ws and started_at >= greatest(per.a, per.b - make_interval(days => coalesce(w, 7))) and started_at < per.b),
        'retained',      (select count(distinct s.app_user_id) from public.growth_user_sessions s
                           join public.growth_app_users u on u.id = s.app_user_id
                          where s.workspace_id = ws and s.started_at >= per.a and s.started_at < per.b and u.registered_at < per.a),
        'paying_users',  (select count(distinct app_user_id) from public.growth_app_events
                           where workspace_id = ws and event = 'purchase' and occurred_at >= per.a and occurred_at < per.b),
        'revenue',       (select coalesce(sum(amount), 0) from public.growth_app_events
                           where workspace_id = ws and event = 'purchase' and occurred_at >= per.a and occurred_at < per.b),
        'spend',         (select coalesce(sum(amount), 0) from public.growth_spend
                           where workspace_id = ws and spent_on >= per.a::date and spent_on < (per.b::date + 1)),
        'cohort_activated', (select count(*) from public.growth_prospects
                           where workspace_id = ws and created_at >= per.a and created_at < per.b and activated_at is not null)
      )));
  end loop;
  return res || jsonb_build_object('active_window_days', w);
end $$;

-- Rendimiento por canal, campaña o segmento.
-- prospects / contacted / replied / interested: de los prospectos que
--   entraron en el período (cohorte).
-- clicks / installs / registrations / activations / revenue / spend: lo que
--   ocurrió en el período (incluye usuarios orgánicos sin prospecto).
create or replace function public.growth_breakdown(ws uuid, p_from timestamptz, p_to timestamptz, dim text)
returns table (key uuid, name text, prospects bigint, contacted bigint, replied bigint, interested bigint,
               clicks bigint, installs bigint, registrations bigint, activations bigint, active bigint,
               spend numeric, revenue numeric)
language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz; t timestamptz; w int;
begin
  perform public.growth_check(ws);
  if dim not in ('source','campaign') then raise exception 'dim debe ser source o campaign'; end if;
  t := coalesce(p_to, now()); f := coalesce(p_from, '-infinity'::timestamptz);
  select active_window_days into w from public.growth_app_settings where workspace_id = ws;
  return query
  with d as (
    select s.id, s.name from public.growth_sources s where dim = 'source' and s.workspace_id = ws
    union all
    select c.id, c.name from public.growth_campaigns c where dim = 'campaign' and c.workspace_id = ws
  ),
  pr as (
    select case when dim = 'source' then p.source_id else p.campaign_id end k,
           count(*) n, count(p.contacted_at) c, count(p.replied_at) r, count(p.interested_at) i
      from public.growth_prospects p
     where p.workspace_id = ws and p.created_at >= f and p.created_at < t group by 1
  ),
  cl as (
    select case when dim = 'source' then l.source_id else l.campaign_id end k, count(*) n
      from public.growth_link_clicks k join public.growth_tracking_links l on l.id = k.link_id
     where k.workspace_id = ws and k.created_at >= f and k.created_at < t group by 1
  ),
  us as (
    select case when dim = 'source' then u.source_id else u.campaign_id end k,
           count(*) filter (where u.installed_at >= f and u.installed_at < t) ins,
           count(*) filter (where u.registered_at >= f and u.registered_at < t) reg,
           count(*) filter (where u.activated_at >= f and u.activated_at < t) act,
           count(*) filter (where u.last_seen_at >= now() - make_interval(days => coalesce(w, 7))) acv
      from public.growth_app_users u where u.workspace_id = ws group by 1
  ),
  rv as (
    select case when dim = 'source' then u.source_id else u.campaign_id end k, sum(e.amount) amt
      from public.growth_app_events e join public.growth_app_users u on u.id = e.app_user_id
     where e.workspace_id = ws and e.event = 'purchase' and e.occurred_at >= f and e.occurred_at < t group by 1
  ),
  sp as (
    select case when dim = 'source' then x.source_id else x.campaign_id end k, sum(x.amount) amt
      from public.growth_spend x where x.workspace_id = ws and x.spent_on >= f::date and x.spent_on < t::date + 1 group by 1
  )
  select d.id, d.name, coalesce(pr.n,0), coalesce(pr.c,0), coalesce(pr.r,0), coalesce(pr.i,0), coalesce(cl.n,0),
         coalesce(us.ins,0), coalesce(us.reg,0), coalesce(us.act,0), coalesce(us.acv,0),
         coalesce(sp.amt,0), coalesce(rv.amt,0)
    from d
    left join pr on pr.k = d.id left join cl on cl.k = d.id left join us on us.k = d.id
    left join rv on rv.k = d.id left join sp on sp.k = d.id
   order by d.name;
end $$;

-- Serie diaria para los gráficos
create or replace function public.growth_daily(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (day date, prospects bigint, contacted bigint, replies bigint, clicks bigint, installs bigint,
               registrations bigint, activations bigint, active_users bigint, revenue numeric)
language plpgsql stable security definer set search_path = '' as $$
declare f date; t date;
begin
  perform public.growth_check(ws);
  t := case when p_to is null then now()::date else (p_to - interval '1 microsecond')::date end;
  f := coalesce(p_from::date, (select min(created_at)::date from public.growth_prospects where workspace_id = ws), t - 30);
  if t - f > 400 then f := t - 400; end if;
  return query
  select g.d::date,
    (select count(*) from public.growth_prospects x where x.workspace_id = ws and x.created_at::date = g.d),
    (select count(*) from public.growth_prospects x where x.workspace_id = ws and x.contacted_at::date = g.d),
    (select count(*) from public.growth_messages x where x.workspace_id = ws and x.direction = 'in' and x.created_at::date = g.d),
    (select count(*) from public.growth_link_clicks x where x.workspace_id = ws and x.created_at::date = g.d),
    (select count(*) from public.growth_installations x where x.workspace_id = ws and x.installed_at::date = g.d),
    (select count(*) from public.growth_registrations x where x.workspace_id = ws and x.registered_at::date = g.d),
    (select count(*) from public.growth_activations x where x.workspace_id = ws and x.activated_at::date = g.d),
    (select count(distinct x.app_user_id) from public.growth_user_sessions x where x.workspace_id = ws and x.started_at::date = g.d),
    (select coalesce(sum(x.amount),0) from public.growth_app_events x where x.workspace_id = ws and x.event = 'purchase' and x.occurred_at::date = g.d)
  from generate_series(f, t, interval '1 day') g(d);
end $$;

-- Cohortes de retención por semana (o día) de registro.
-- D1 = volvió el día siguiente; D7 = volvió entre el día 7 y el 13;
-- D30 = volvió entre el día 30 y el 59. Null si la cohorte todavía no
-- cumplió ese plazo.
create or replace function public.growth_cohorts(ws uuid, p_from timestamptz, p_to timestamptz, grain text default 'week')
returns table (cohort date, size bigint, d1 bigint, d7 bigint, d30 bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.growth_check(ws);
  if grain not in ('day','week','month') then raise exception 'grain inválido'; end if;
  return query
  with u as (
    select x.id, x.registered_at r, date_trunc(grain, x.registered_at)::date c
      from public.growth_app_users x
     where x.workspace_id = ws and x.registered_at is not null
       and x.registered_at >= coalesce(p_from, '-infinity') and x.registered_at < coalesce(p_to, now())
  ),
  r as (
    select u.id, u.c, u.r,
      bool_or(s.started_at::date - u.r::date = 1) b1,
      bool_or(s.started_at::date - u.r::date between 7 and 13) b7,
      bool_or(s.started_at::date - u.r::date between 30 and 59) b30
      from u left join public.growth_user_sessions s on s.app_user_id = u.id
     group by u.id, u.c, u.r
  )
  select r.c, count(*),
    case when max(r.r) + interval '2 days'  <= now() then count(*) filter (where b1)  end,
    case when max(r.r) + interval '14 days' <= now() then count(*) filter (where b7)  end,
    case when max(r.r) + interval '60 days' <= now() then count(*) filter (where b30) end
    from r group by r.c order by r.c;
end $$;

create or replace function public.growth_retention(ws uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz; t timestamptz; res jsonb;
begin
  perform public.growth_check(ws);
  t := coalesce(p_to, now()); f := coalesce(p_from, '-infinity'::timestamptz);
  with u as (select * from public.growth_app_users where workspace_id = ws and registered_at is not null),
  ret as (
    select u.id, u.registered_at r,
      bool_or(s.started_at::date - u.registered_at::date = 1) b1,
      bool_or(s.started_at::date - u.registered_at::date between 7 and 13) b7,
      bool_or(s.started_at::date - u.registered_at::date between 30 and 59) b30
      from u left join public.growth_user_sessions s on s.app_user_id = u.id
     where u.registered_at >= f and u.registered_at < t group by u.id, u.registered_at
  )
  select jsonb_build_object(
    'new_users', (select count(*) from u where registered_at >= f and registered_at < t),
    'active_users', (select count(distinct app_user_id) from public.growth_user_sessions where workspace_id = ws and started_at >= f and started_at < t),
    'returning_users', (select count(distinct s.app_user_id) from public.growth_user_sessions s join u on u.id = s.app_user_id
                         where s.started_at >= f and s.started_at < t and u.registered_at < f),
    'd1',  (select round(100.0 * count(*) filter (where b1)  / nullif(count(*), 0), 1) from ret where r + interval '2 days'  <= now()),
    'd7',  (select round(100.0 * count(*) filter (where b7)  / nullif(count(*), 0), 1) from ret where r + interval '14 days' <= now()),
    'd30', (select round(100.0 * count(*) filter (where b30) / nullif(count(*), 0), 1) from ret where r + interval '60 days' <= now())
  ) into res;
  return res;
end $$;

-- ¿Qué mensajes convierten más? Agrupa los mensajes enviados por plantilla.
create or replace function public.growth_message_performance(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (template text, sent bigint, prospects bigint, replied bigint, interested bigint, installed bigint, registered bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.growth_check(ws);
  return query
  with m as (
    select coalesce(x.template_key, case when x.ai_generated then 'IA (sin plantilla)' else 'Manual' end) tk,
           x.prospect_id, min(x.created_at) first_at, count(*) n
      from public.growth_messages x
     where x.workspace_id = ws and x.direction = 'out' and x.status in ('sent','delivered','read','mock_sent')
       and x.created_at >= coalesce(p_from, '-infinity') and x.created_at < coalesce(p_to, now())
     group by 1, 2
  )
  select m.tk, sum(m.n)::bigint, count(distinct m.prospect_id),
         count(distinct m.prospect_id) filter (where p.replied_at >= m.first_at),
         count(distinct m.prospect_id) filter (where p.interested_at >= m.first_at),
         count(distinct m.prospect_id) filter (where p.installed_at >= m.first_at),
         count(distinct m.prospect_id) filter (where p.registered_at >= m.first_at)
    from m join public.growth_prospects p on p.id = m.prospect_id
   group by m.tk order by 3 desc;
end $$;

-- ¿Qué automatización funciona?
create or replace function public.growth_workflow_stats(ws uuid)
returns table (workflow_id uuid, runs bigint, running bigint, done bigint, failed bigint,
               replied bigint, installed bigint, registered bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.growth_check(ws);
  return query
  select r.workflow_id, count(*), count(*) filter (where r.status in ('running','waiting')),
         count(*) filter (where r.status = 'done'), count(*) filter (where r.status = 'failed'),
         count(*) filter (where p.replied_at >= r.started_at),
         count(*) filter (where p.installed_at >= r.started_at),
         count(*) filter (where p.registered_at >= r.started_at)
    from public.growth_workflow_runs r join public.growth_prospects p on p.id = r.prospect_id
   where r.workspace_id = ws group by r.workflow_id;
end $$;

-- Rendimiento de cada link trackeado (desde siempre)
create or replace function public.growth_link_stats(ws uuid)
returns table (link_id uuid, clicks bigint, android bigint, ios bigint, desktop bigint,
               installs bigint, registrations bigint, activations bigint, last_click timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.growth_check(ws);
  return query
  select l.id,
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id),
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id and k.device = 'android'),
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id and k.device = 'ios'),
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id and k.device in ('desktop','other')),
    (select count(*) from public.growth_app_users u where u.link_id = l.id and u.installed_at is not null),
    (select count(*) from public.growth_app_users u where u.link_id = l.id and u.registered_at is not null),
    (select count(*) from public.growth_app_users u where u.link_id = l.id and u.activated_at is not null),
    (select max(k.created_at) from public.growth_link_clicks k where k.link_id = l.id)
  from public.growth_tracking_links l where l.workspace_id = ws;
end $$;

-- Tiendas: clicks, instalaciones, registros y conversión por plataforma
create or replace function public.growth_store_stats(ws uuid, p_from timestamptz, p_to timestamptz)
returns table (platform text, clicks bigint, installs bigint, registrations bigint, activations bigint)
language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz := coalesce(p_from, '-infinity'); t timestamptz := coalesce(p_to, now());
begin
  perform public.growth_check(ws);
  return query
  select x.p,
    (select count(*) from public.growth_link_clicks k where k.workspace_id = ws and k.target = x.t and k.created_at >= f and k.created_at < t),
    (select count(*) from public.growth_installations i where i.workspace_id = ws and i.platform = x.p and i.installed_at >= f and i.installed_at < t),
    (select count(*) from public.growth_registrations r join public.growth_app_users u on u.id = r.app_user_id
      where r.workspace_id = ws and u.platform = x.p and r.registered_at >= f and r.registered_at < t),
    (select count(*) from public.growth_activations a join public.growth_app_users u on u.id = a.app_user_id
      where a.workspace_id = ws and u.platform = x.p and a.activated_at >= f and a.activated_at < t)
  from (values ('android','play'), ('ios','appstore'), ('web','web')) x(p, t);
end $$;

-- ── Segmentos ──
create or replace function public.growth_segment_ids(seg uuid, lim int default 1000, off int default 0)
returns table (id uuid) language plpgsql stable security definer set search_path = '' as $$
declare s record;
begin
  select * into s from public.growth_segments where growth_segments.id = seg;
  if s.id is null then return; end if;
  perform public.growth_check(s.workspace_id);
  if s.entity = 'prospect' then
    return query select p.id from public.growth_prospects p
      where p.workspace_id = s.workspace_id and public.growth_match(to_jsonb(p), s.rules)
      order by p.score desc, p.created_at desc limit lim offset off;
  else
    return query select u.id from public.growth_app_users u
      where u.workspace_id = s.workspace_id and public.growth_match(to_jsonb(u), s.rules)
      order by u.last_seen_at desc nulls last limit lim offset off;
  end if;
end $$;

create or replace function public.growth_segment_count(seg uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare s record; n bigint;
begin
  select * into s from public.growth_segments where id = seg;
  if s.id is null then return 0; end if;
  perform public.growth_check(s.workspace_id);
  if s.entity = 'prospect' then
    select count(*) into n from public.growth_prospects p where p.workspace_id = s.workspace_id and public.growth_match(to_jsonb(p), s.rules);
  else
    select count(*) into n from public.growth_app_users u where u.workspace_id = s.workspace_id and public.growth_match(to_jsonb(u), s.rules);
  end if;
  return n;
end $$;

-- Vista previa de reglas sin guardar el segmento
create or replace function public.growth_rules_preview(ws uuid, p_entity text, p_rules jsonb)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare n bigint;
begin
  perform public.growth_check(ws);
  if p_entity = 'app_user' then
    select count(*) into n from public.growth_app_users u where u.workspace_id = ws and public.growth_match(to_jsonb(u), p_rules);
  else
    select count(*) into n from public.growth_prospects p where p.workspace_id = ws and public.growth_match(to_jsonb(p), p_rules);
  end if;
  return n;
end $$;

-- ── Permisos de las funciones ──
revoke all on function
  public.growth_record_click(text, text, text, text, text), public.growth_ingest_event(uuid, jsonb),
  public.growth_check_inactive(), public.growth_check_campaign_goal(uuid)
  from public, anon, authenticated;
revoke all on function
  public.growth_simulate_event(uuid, jsonb), public.growth_simulate_click(uuid, uuid, uuid, text),
  public.growth_funnel(uuid, timestamptz, timestamptz), public.growth_app_funnel(uuid, timestamptz, timestamptz),
  public.growth_kpis(uuid, timestamptz, timestamptz), public.growth_breakdown(uuid, timestamptz, timestamptz, text),
  public.growth_daily(uuid, timestamptz, timestamptz), public.growth_cohorts(uuid, timestamptz, timestamptz, text),
  public.growth_retention(uuid, timestamptz, timestamptz), public.growth_message_performance(uuid, timestamptz, timestamptz),
  public.growth_workflow_stats(uuid), public.growth_link_stats(uuid), public.growth_store_stats(uuid, timestamptz, timestamptz),
  public.growth_segment_ids(uuid, int, int), public.growth_segment_count(uuid), public.growth_rules_preview(uuid, text, jsonb)
  from public, anon;
grant execute on function
  public.growth_simulate_event(uuid, jsonb), public.growth_simulate_click(uuid, uuid, uuid, text),
  public.growth_funnel(uuid, timestamptz, timestamptz), public.growth_app_funnel(uuid, timestamptz, timestamptz),
  public.growth_kpis(uuid, timestamptz, timestamptz), public.growth_breakdown(uuid, timestamptz, timestamptz, text),
  public.growth_daily(uuid, timestamptz, timestamptz), public.growth_cohorts(uuid, timestamptz, timestamptz, text),
  public.growth_retention(uuid, timestamptz, timestamptz), public.growth_message_performance(uuid, timestamptz, timestamptz),
  public.growth_workflow_stats(uuid), public.growth_link_stats(uuid), public.growth_store_stats(uuid, timestamptz, timestamptz),
  public.growth_segment_ids(uuid, int, int), public.growth_segment_count(uuid), public.growth_rules_preview(uuid, text, jsonb)
  to authenticated;
revoke all on function public.growth_check(uuid), public.growth_is_member(uuid), public.growth_role(uuid) from public, anon;
grant execute on function public.growth_check(uuid), public.growth_is_member(uuid), public.growth_role(uuid) to authenticated;
