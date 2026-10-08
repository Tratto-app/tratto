-- Separar todo el CRM en clientes y proveedores.
-- Pedido del fundador (8/10/2026): "todo lo que son registros en la aplicación,
-- y no solamente registros sino todo, separalo en usuarios clientes y usuarios
-- proveedores".
--
-- 1. growth_app_users.kind: el tipo del usuario (lo toma del prospecto
--    vinculado). En Tratto el rol se fija al crear la cuenta.
-- 2. Versiones "_tipo" de cada métrica con un parámetro p_kind:
--    null = todos · 'customer' = clientes · 'provider' = proveedores.
--    Las funciones originales quedan iguales (no se borran ni cambian).
--    Lo que no se puede separar se devuelve en null con p_kind (el gasto en
--    anuncios no dice a quién iba), y los clicks solo se separan cuando se
--    sabe de quién son (link personal o persona ya identificada).
-- Aplicada en producción (Tratto) el 8/10/2026.

alter table public.growth_app_users add column if not exists kind text check (kind in ('customer','provider'));
create index if not exists growth_app_users_kind on public.growth_app_users (workspace_id, kind);

-- El tipo sale del prospecto vinculado
create or replace function public.growth_app_users_kind() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.prospect_id is not null and (new.kind is null or tg_op = 'UPDATE' and new.prospect_id is distinct from old.prospect_id) then
    select p.kind into new.kind from public.growth_prospects p where p.id = new.prospect_id;
  end if;
  return new;
end $$;
drop trigger if exists growth_app_users_kind on public.growth_app_users;
create trigger growth_app_users_kind before insert or update of prospect_id on public.growth_app_users
  for each row execute function public.growth_app_users_kind();

-- Si cambia el tipo del prospecto, cambia el del usuario
create or replace function public.growth_prospects_kind_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind is distinct from old.kind then
    update public.growth_app_users set kind = new.kind where prospect_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists growth_prospects_kind_sync on public.growth_prospects;
create trigger growth_prospects_kind_sync after update of kind on public.growth_prospects
  for each row execute function public.growth_prospects_kind_sync();

-- Carga inicial
update public.growth_app_users u set kind = p.kind
  from public.growth_prospects p where p.id = u.prospect_id and u.kind is null;

-- ¿Este usuario / prospecto es del tipo pedido? (null = todos)
create or replace function public.growth_u_tipo(uid uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_kind is null or exists (select 1 from public.growth_app_users u where u.id = uid and u.kind = p_kind)
$$;
create or replace function public.growth_p_tipo(pid uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_kind is null or exists (select 1 from public.growth_prospects p where p.id = pid and p.kind = p_kind)
$$;

-- ════════════ Métricas con filtro de tipo ════════════

create or replace function public.growth_kpis_tipo(ws uuid, p_from timestamptz, p_to timestamptz, p_kind text default null)
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
        'prospects',     (select count(*) from public.growth_prospects where workspace_id = ws and (p_kind is null or kind = p_kind) and created_at >= per.a and created_at < per.b),
        'contacted',     (select count(*) from public.growth_prospects where workspace_id = ws and (p_kind is null or kind = p_kind) and contacted_at >= per.a and contacted_at < per.b),
        'replies',       (select count(*) from public.growth_messages x where x.workspace_id = ws and x.direction = 'in' and x.created_at >= per.a and x.created_at < per.b and public.growth_p_tipo(x.prospect_id, p_kind)),
        'replied',       (select count(*) from public.growth_prospects where workspace_id = ws and (p_kind is null or kind = p_kind) and replied_at >= per.a and replied_at < per.b),
        'interested',    (select count(*) from public.growth_prospects where workspace_id = ws and (p_kind is null or kind = p_kind) and interested_at >= per.a and interested_at < per.b),
        'links_sent',    (select count(*) from public.growth_prospects where workspace_id = ws and (p_kind is null or kind = p_kind) and link_sent_at >= per.a and link_sent_at < per.b),
        'clicks_play',   (select count(*) from public.growth_link_clicks k where k.workspace_id = ws and k.target = 'play' and k.created_at >= per.a and k.created_at < per.b and public.growth_p_tipo(k.prospect_id, p_kind)),
        'clicks_appstore',(select count(*) from public.growth_link_clicks k where k.workspace_id = ws and k.target = 'appstore' and k.created_at >= per.a and k.created_at < per.b and public.growth_p_tipo(k.prospect_id, p_kind)),
        'clicks_web',    (select count(*) from public.growth_link_clicks k where k.workspace_id = ws and k.target in ('web','custom') and k.created_at >= per.a and k.created_at < per.b and public.growth_p_tipo(k.prospect_id, p_kind)),
        'installs',      (select count(*) from public.growth_installations x where x.workspace_id = ws and x.installed_at >= per.a and x.installed_at < per.b and public.growth_u_tipo(x.app_user_id, p_kind)),
        'registrations', (select count(*) from public.growth_registrations x where x.workspace_id = ws and x.registered_at >= per.a and x.registered_at < per.b and public.growth_u_tipo(x.app_user_id, p_kind)),
        'activations',   (select count(*) from public.growth_activations x where x.workspace_id = ws and x.activated_at >= per.a and x.activated_at < per.b and public.growth_u_tipo(x.app_user_id, p_kind)),
        'active_users',  (select count(distinct s.app_user_id) from public.growth_user_sessions s
                           where s.workspace_id = ws and s.started_at >= greatest(per.a, per.b - make_interval(days => coalesce(w, 7))) and s.started_at < per.b
                             and public.growth_u_tipo(s.app_user_id, p_kind)),
        'retained',      (select count(distinct s.app_user_id) from public.growth_user_sessions s
                           join public.growth_app_users u on u.id = s.app_user_id
                          where s.workspace_id = ws and s.started_at >= per.a and s.started_at < per.b and u.registered_at < per.a
                            and (p_kind is null or u.kind = p_kind)),
        'paying_users',  (select count(distinct e.app_user_id) from public.growth_app_events e
                           where e.workspace_id = ws and e.event = 'purchase' and e.occurred_at >= per.a and e.occurred_at < per.b and public.growth_u_tipo(e.app_user_id, p_kind)),
        'revenue',       (select coalesce(sum(e.amount), 0) from public.growth_app_events e
                           where e.workspace_id = ws and e.event = 'purchase' and e.occurred_at >= per.a and e.occurred_at < per.b and public.growth_u_tipo(e.app_user_id, p_kind)),
        'spend',         case when p_kind is null then (select coalesce(sum(amount), 0) from public.growth_spend
                           where workspace_id = ws and spent_on >= per.a::date and spent_on < (per.b::date + 1)) end,
        'cohort_activated', (select count(*) from public.growth_prospects
                           where workspace_id = ws and (p_kind is null or kind = p_kind) and created_at >= per.a and created_at < per.b and activated_at is not null)
      )));
  end loop;
  return res || jsonb_build_object('active_window_days', w, 'kind', p_kind);
end $$;

create or replace function public.growth_funnel_tipo(ws uuid, p_from timestamptz, p_to timestamptz, p_kind text default null)
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
           case when p.activated_at is not null and u.last_seen_at >= now() - make_interval(days => coalesce(w, 7)) then u.last_seen_at end r9
      from public.growth_prospects p
      left join public.growth_app_users u on u.id = p.app_user_id
     where p.workspace_id = ws and p.created_at < t and (p_kind is null or p.kind = p_kind)
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

create or replace function public.growth_app_funnel_tipo(ws uuid, p_from timestamptz, p_to timestamptz, p_kind text default null)
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
     where u.workspace_id = ws and (p_kind is null or u.kind = p_kind)
       and coalesce(u.installed_at, u.registered_at, u.created_at) >= f
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

create or replace function public.growth_breakdown_tipo(ws uuid, p_from timestamptz, p_to timestamptz, dim text, p_kind text default null)
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
     where p.workspace_id = ws and (p_kind is null or p.kind = p_kind) and p.created_at >= f and p.created_at < t group by 1
  ),
  cl as (
    select case when dim = 'source' then l.source_id else l.campaign_id end k, count(*) n
      from public.growth_link_clicks k join public.growth_tracking_links l on l.id = k.link_id
     where k.workspace_id = ws and k.created_at >= f and k.created_at < t and public.growth_p_tipo(k.prospect_id, p_kind) group by 1
  ),
  us as (
    select case when dim = 'source' then u.source_id else u.campaign_id end k,
           count(*) filter (where u.installed_at >= f and u.installed_at < t) ins,
           count(*) filter (where u.registered_at >= f and u.registered_at < t) reg,
           count(*) filter (where u.activated_at >= f and u.activated_at < t) act,
           count(*) filter (where u.last_seen_at >= now() - make_interval(days => coalesce(w, 7))) acv
      from public.growth_app_users u where u.workspace_id = ws and (p_kind is null or u.kind = p_kind) group by 1
  ),
  rv as (
    select case when dim = 'source' then u.source_id else u.campaign_id end k, sum(e.amount) amt
      from public.growth_app_events e join public.growth_app_users u on u.id = e.app_user_id
     where e.workspace_id = ws and e.event = 'purchase' and e.occurred_at >= f and e.occurred_at < t
       and (p_kind is null or u.kind = p_kind) group by 1
  ),
  sp as (
    select case when dim = 'source' then x.source_id else x.campaign_id end k, sum(x.amount) amt
      from public.growth_spend x where x.workspace_id = ws and p_kind is null and x.spent_on >= f::date and x.spent_on < t::date + 1 group by 1
  )
  select d.id, d.name, coalesce(pr.n,0), coalesce(pr.c,0), coalesce(pr.r,0), coalesce(pr.i,0), coalesce(cl.n,0),
         coalesce(us.ins,0), coalesce(us.reg,0), coalesce(us.act,0), coalesce(us.acv,0),
         case when p_kind is null then coalesce(sp.amt,0) end, coalesce(rv.amt,0)
    from d
    left join pr on pr.k = d.id left join cl on cl.k = d.id left join us on us.k = d.id
    left join rv on rv.k = d.id left join sp on sp.k = d.id
   order by d.name;
end $$;

create or replace function public.growth_daily_tipo(ws uuid, p_from timestamptz, p_to timestamptz, p_kind text default null)
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
    (select count(*) from public.growth_prospects x where x.workspace_id = ws and (p_kind is null or x.kind = p_kind) and x.created_at::date = g.d),
    (select count(*) from public.growth_prospects x where x.workspace_id = ws and (p_kind is null or x.kind = p_kind) and x.contacted_at::date = g.d),
    (select count(*) from public.growth_messages x where x.workspace_id = ws and x.direction = 'in' and x.created_at::date = g.d and public.growth_p_tipo(x.prospect_id, p_kind)),
    (select count(*) from public.growth_link_clicks x where x.workspace_id = ws and x.created_at::date = g.d and public.growth_p_tipo(x.prospect_id, p_kind)),
    (select count(*) from public.growth_installations x where x.workspace_id = ws and x.installed_at::date = g.d and public.growth_u_tipo(x.app_user_id, p_kind)),
    (select count(*) from public.growth_registrations x where x.workspace_id = ws and x.registered_at::date = g.d and public.growth_u_tipo(x.app_user_id, p_kind)),
    (select count(*) from public.growth_activations x where x.workspace_id = ws and x.activated_at::date = g.d and public.growth_u_tipo(x.app_user_id, p_kind)),
    (select count(distinct x.app_user_id) from public.growth_user_sessions x where x.workspace_id = ws and x.started_at::date = g.d and public.growth_u_tipo(x.app_user_id, p_kind)),
    (select coalesce(sum(x.amount),0) from public.growth_app_events x where x.workspace_id = ws and x.event = 'purchase' and x.occurred_at::date = g.d and public.growth_u_tipo(x.app_user_id, p_kind))
  from generate_series(f, t, interval '1 day') g(d);
end $$;

create or replace function public.growth_cohorts_tipo(ws uuid, p_from timestamptz, p_to timestamptz, grain text default 'week', p_kind text default null)
returns table (cohort date, size bigint, d1 bigint, d7 bigint, d30 bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.growth_check(ws);
  if grain not in ('day','week','month') then raise exception 'grain inválido'; end if;
  return query
  with u as (
    select x.id, x.registered_at r, date_trunc(grain, x.registered_at)::date c
      from public.growth_app_users x
     where x.workspace_id = ws and x.registered_at is not null and (p_kind is null or x.kind = p_kind)
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

create or replace function public.growth_retention_tipo(ws uuid, p_from timestamptz, p_to timestamptz, p_kind text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz; t timestamptz; res jsonb;
begin
  perform public.growth_check(ws);
  t := coalesce(p_to, now()); f := coalesce(p_from, '-infinity'::timestamptz);
  with u as (select * from public.growth_app_users where workspace_id = ws and registered_at is not null and (p_kind is null or kind = p_kind)),
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
    'active_users', (select count(distinct s.app_user_id) from public.growth_user_sessions s
                      where s.workspace_id = ws and s.started_at >= f and s.started_at < t and public.growth_u_tipo(s.app_user_id, p_kind)),
    'returning_users', (select count(distinct s.app_user_id) from public.growth_user_sessions s join u on u.id = s.app_user_id
                         where s.started_at >= f and s.started_at < t and u.registered_at < f),
    'd1',  (select round(100.0 * count(*) filter (where b1)  / nullif(count(*), 0), 1) from ret where r + interval '2 days'  <= now()),
    'd7',  (select round(100.0 * count(*) filter (where b7)  / nullif(count(*), 0), 1) from ret where r + interval '14 days' <= now()),
    'd30', (select round(100.0 * count(*) filter (where b30) / nullif(count(*), 0), 1) from ret where r + interval '60 days' <= now())
  ) into res;
  return res;
end $$;

create or replace function public.growth_message_performance_tipo(ws uuid, p_from timestamptz, p_to timestamptz, p_kind text default null)
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
   where p_kind is null or p.kind = p_kind
   group by m.tk order by 3 desc;
end $$;

create or replace function public.growth_workflow_stats_tipo(ws uuid, p_kind text default null)
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
   where r.workspace_id = ws and (p_kind is null or p.kind = p_kind) group by r.workflow_id;
end $$;

create or replace function public.growth_link_stats_tipo(ws uuid, p_kind text default null)
returns table (link_id uuid, clicks bigint, android bigint, ios bigint, desktop bigint,
               installs bigint, registrations bigint, activations bigint, last_click timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.growth_check(ws);
  return query
  select l.id,
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id and public.growth_p_tipo(k.prospect_id, p_kind)),
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id and k.device = 'android' and public.growth_p_tipo(k.prospect_id, p_kind)),
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id and k.device = 'ios' and public.growth_p_tipo(k.prospect_id, p_kind)),
    (select count(*) from public.growth_link_clicks k where k.link_id = l.id and k.device in ('desktop','other') and public.growth_p_tipo(k.prospect_id, p_kind)),
    (select count(*) from public.growth_app_users u where u.link_id = l.id and u.installed_at is not null and (p_kind is null or u.kind = p_kind)),
    (select count(*) from public.growth_app_users u where u.link_id = l.id and u.registered_at is not null and (p_kind is null or u.kind = p_kind)),
    (select count(*) from public.growth_app_users u where u.link_id = l.id and u.activated_at is not null and (p_kind is null or u.kind = p_kind)),
    (select max(k.created_at) from public.growth_link_clicks k where k.link_id = l.id and public.growth_p_tipo(k.prospect_id, p_kind))
  from public.growth_tracking_links l where l.workspace_id = ws;
end $$;

create or replace function public.growth_store_stats_tipo(ws uuid, p_from timestamptz, p_to timestamptz, p_kind text default null)
returns table (platform text, clicks bigint, installs bigint, registrations bigint, activations bigint)
language plpgsql stable security definer set search_path = '' as $$
declare f timestamptz := coalesce(p_from, '-infinity'); t timestamptz := coalesce(p_to, now());
begin
  perform public.growth_check(ws);
  return query
  select x.p,
    (select count(*) from public.growth_link_clicks k where k.workspace_id = ws and k.target = x.destino and k.created_at >= f and k.created_at < t and public.growth_p_tipo(k.prospect_id, p_kind)),
    (select count(*) from public.growth_installations i where i.workspace_id = ws and i.platform = x.p and i.installed_at >= f and i.installed_at < t and public.growth_u_tipo(i.app_user_id, p_kind)),
    (select count(*) from public.growth_registrations r join public.growth_app_users u on u.id = r.app_user_id
      where r.workspace_id = ws and u.platform = x.p and r.registered_at >= f and r.registered_at < t and (p_kind is null or u.kind = p_kind)),
    (select count(*) from public.growth_activations a join public.growth_app_users u on u.id = a.app_user_id
      where a.workspace_id = ws and u.platform = x.p and a.activated_at >= f and a.activated_at < t and (p_kind is null or u.kind = p_kind))
  from (values ('android','play'), ('ios','appstore'), ('web','web')) x(p, destino);
end $$;

-- Permisos: solo usuarios con sesión (cada función valida además que sea
-- miembro del workspace con growth_check).
revoke execute on function public.growth_u_tipo(uuid, text), public.growth_p_tipo(uuid, text),
  public.growth_kpis_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_funnel_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_app_funnel_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_breakdown_tipo(uuid, timestamptz, timestamptz, text, text),
  public.growth_daily_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_cohorts_tipo(uuid, timestamptz, timestamptz, text, text),
  public.growth_retention_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_message_performance_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_workflow_stats_tipo(uuid, text),
  public.growth_link_stats_tipo(uuid, text),
  public.growth_store_stats_tipo(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function
  public.growth_kpis_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_funnel_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_app_funnel_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_breakdown_tipo(uuid, timestamptz, timestamptz, text, text),
  public.growth_daily_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_cohorts_tipo(uuid, timestamptz, timestamptz, text, text),
  public.growth_retention_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_message_performance_tipo(uuid, timestamptz, timestamptz, text),
  public.growth_workflow_stats_tipo(uuid, text),
  public.growth_link_stats_tipo(uuid, text),
  public.growth_store_stats_tipo(uuid, timestamptz, timestamptz, text) to authenticated;
