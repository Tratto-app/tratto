-- Growth OS · 1/4 · Tablas
--
-- Plataforma interna para conseguir usuarios para la app: prospectos, campañas,
-- conversaciones, automatizaciones, links trackeados y eventos de la app.
--
-- Reglas de diseño:
--   * Todo cuelga de un workspace (workspace_id) y la RLS solo deja ver los
--     datos de los workspaces de los que la persona es miembro.
--   * PROSPECTOS (growth_prospects: gente a la que queremos llegar) y USUARIOS
--     DE LA APP (growth_app_users: gente que instaló o se registró) son tablas
--     distintas. Se vinculan por prospect_id cuando se puede atribuir.
--   * Las tablas llevan el prefijo growth_ para no mezclarse con las de Tratto
--     si algún día este esquema se aplica en la misma base.
--   * Ningún secreto de integraciones se guarda acá: van como secrets de las
--     Edge Functions. La clave de ingesta de eventos se guarda solo como hash.

create extension if not exists pgcrypto with schema extensions;

-- ── Workspaces y miembros ──
create table if not exists public.growth_workspaces (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 1 and 80),
  slug             text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  is_demo          boolean not null default false,
  ingest_key_hash  text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists public.growth_members (
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists growth_members_user_idx on public.growth_members (user_id);

-- ── La app que queremos hacer crecer ──
create table if not exists public.growth_app_settings (
  workspace_id        uuid primary key references public.growth_workspaces(id) on delete cascade,
  app_name            text not null default 'Mi app',
  description         text,
  logo_url            text,
  play_store_url      text,
  app_store_url       text,
  website             text,
  category            text,
  audience            text,
  value_prop          text,
  features            text,
  benefits            text,
  price               text,
  monetization        text,
  deep_link_base      text,
  -- Qué evento cuenta como "usuario activado" (configurable desde App Settings)
  activation_event    text not null default 'first_action',
  -- Cuántos días sin usar la app para dejar de contar a alguien como activo
  active_window_days  int  not null default 7 check (active_window_days between 1 and 90),
  updated_at          timestamptz not null default now()
);

create table if not exists public.growth_knowledge (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  kind         text not null default 'faq'
               check (kind in ('problem','feature','benefit','pricing','faq','terms','audience','other')),
  title        text not null,
  content      text not null,
  sort         int  not null default 0,
  updated_at   timestamptz not null default now()
);
create index if not exists growth_knowledge_ws_idx on public.growth_knowledge (workspace_id, kind, sort);

create table if not exists public.growth_objections (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  label        text not null,
  patterns     text[] not null default '{}',   -- palabras o frases que la delatan
  response     text not null,                  -- respuesta recomendada (con datos reales de la app)
  created_at   timestamptz not null default now()
);
create index if not exists growth_objections_ws_idx on public.growth_objections (workspace_id);

-- ── Fuentes, gasto, segmentos, campañas ──
create table if not exists public.growth_sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9_]{2,30}$'),
  name         text not null,
  kind         text not null default 'other'
               check (kind in ('social','paid','organic','referral','messaging','email','search','influencer','other')),
  created_at   timestamptz not null default now(),
  unique (workspace_id, key)
);

create table if not exists public.growth_segments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  entity       text not null default 'prospect' check (entity in ('prospect','app_user')),
  rules        jsonb not null default '{}'::jsonb,
  is_system    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists growth_segments_ws_idx on public.growth_segments (workspace_id);

create table if not exists public.growth_workflows (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.growth_workspaces(id) on delete cascade,
  name           text not null,
  description    text,
  trigger        text not null default 'manual'
                 check (trigger in ('prospect_created','status_changed','reply_received','manual')),
  trigger_filter jsonb not null default '{}'::jsonb,
  active         boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists growth_workflows_ws_idx on public.growth_workflows (workspace_id, active);

create table if not exists public.growth_campaigns (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.growth_workspaces(id) on delete cascade,
  name             text not null,
  description      text,
  segment_id       uuid references public.growth_segments(id) on delete set null,
  workflow_id      uuid references public.growth_workflows(id) on delete set null,
  goal_metric      text not null default 'installs'
                   check (goal_metric in ('prospects','contacted','replies','clicks','installs','registrations','activations')),
  goal_target      int  check (goal_target is null or goal_target > 0),
  status           text not null default 'draft' check (status in ('draft','active','paused','finished')),
  budget           numeric(14,2),
  start_date       date,
  end_date         date,
  created_at       timestamptz not null default now()
);
create index if not exists growth_campaigns_ws_idx on public.growth_campaigns (workspace_id, status);

create table if not exists public.growth_campaign_sources (
  campaign_id  uuid not null references public.growth_campaigns(id) on delete cascade,
  source_id    uuid not null references public.growth_sources(id) on delete cascade,
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  primary key (campaign_id, source_id)
);

-- Gasto por día, fuente y/o campaña: de acá sale el CAC
create table if not exists public.growth_spend (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  spent_on     date not null,
  source_id    uuid references public.growth_sources(id) on delete set null,
  campaign_id  uuid references public.growth_campaigns(id) on delete set null,
  amount       numeric(14,2) not null check (amount >= 0),
  currency     text not null default 'ARS',
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists growth_spend_ws_idx on public.growth_spend (workspace_id, spent_on);

-- ── Prospectos ──
create table if not exists public.growth_prospects (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.growth_workspaces(id) on delete cascade,
  ref             text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  first_name      text,
  last_name       text,
  company         text,
  instagram       text,
  facebook        text,
  tiktok          text,
  email           text,
  phone           text,
  city            text,
  country         text default 'AR',
  source_id       uuid references public.growth_sources(id) on delete set null,
  campaign_id     uuid references public.growth_campaigns(id) on delete set null,
  segment_label   text,               -- segmento principal sugerido (IA o manual)
  status          text not null default 'new' check (status in (
                    'new','uncontacted','contacted','replied','interested','link_sent','clicked',
                    'installed','registered','activated','active','not_interested','no_response')),
  score           int  not null default 0 check (score between 0 and 100),
  score_manual    boolean not null default false,   -- si es true, las reglas no lo pisan
  ai_score        int check (ai_score between 0 and 100),
  ai_summary      text,
  next_action     text,
  interest        text not null default 'unknown' check (interest in ('unknown','none','low','medium','high')),
  tags            text[] not null default '{}',
  -- Consentimiento para contactarlo (Ley 25.326 y políticas de cada canal)
  consent         text not null default 'unknown' check (consent in ('unknown','opt_in','opt_out')),
  consent_source  text,
  do_not_contact  boolean not null default false,
  contact_count   int  not null default 0,
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  last_reply_at   timestamptz,
  last_reply_text text,
  -- Cuándo llegó a cada etapa (de acá sale el funnel)
  contacted_at    timestamptz,
  replied_at      timestamptz,
  interested_at   timestamptz,
  link_sent_at    timestamptz,
  clicked_at      timestamptz,
  installed_at    timestamptz,
  registered_at   timestamptz,
  activated_at    timestamptz,
  app_user_id     uuid,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists growth_prospects_ws_created_idx on public.growth_prospects (workspace_id, created_at desc);
create index if not exists growth_prospects_ws_status_idx  on public.growth_prospects (workspace_id, status);
create index if not exists growth_prospects_ws_score_idx   on public.growth_prospects (workspace_id, score desc);
create index if not exists growth_prospects_source_idx     on public.growth_prospects (source_id);
create index if not exists growth_prospects_campaign_idx   on public.growth_prospects (campaign_id);
create index if not exists growth_prospects_email_idx      on public.growth_prospects (workspace_id, lower(email));
create index if not exists growth_prospects_next_idx       on public.growth_prospects (workspace_id, next_contact_at) where next_contact_at is not null;

-- Línea de tiempo de cada prospecto / usuario
create table if not exists public.growth_timeline (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references public.growth_workspaces(id) on delete cascade,
  prospect_id   uuid references public.growth_prospects(id) on delete cascade,
  app_user_id   uuid,
  type          text not null,
  title         text not null,
  detail        jsonb not null default '{}'::jsonb,
  actor         text not null default 'system' check (actor in ('system','user','ai','automation','app')),
  created_at    timestamptz not null default now()
);
create index if not exists growth_timeline_prospect_idx on public.growth_timeline (prospect_id, created_at desc);
create index if not exists growth_timeline_user_idx     on public.growth_timeline (app_user_id, created_at desc);
create index if not exists growth_timeline_ws_idx       on public.growth_timeline (workspace_id, created_at desc);

-- ── Conversaciones ──
create table if not exists public.growth_conversations (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.growth_workspaces(id) on delete cascade,
  prospect_id     uuid not null references public.growth_prospects(id) on delete cascade,
  channel         text not null check (channel in ('instagram','whatsapp','email','sms','tiktok','facebook','other')),
  status          text not null default 'open' check (status in ('open','waiting','closed')),
  unread          int  not null default 0,
  ai_summary      text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (prospect_id, channel)
);
create index if not exists growth_conversations_ws_idx on public.growth_conversations (workspace_id, last_message_at desc);

create table if not exists public.growth_messages (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.growth_workspaces(id) on delete cascade,
  conversation_id uuid not null references public.growth_conversations(id) on delete cascade,
  prospect_id     uuid not null references public.growth_prospects(id) on delete cascade,
  direction       text not null check (direction in ('out','in')),
  channel         text not null,
  body            text not null,
  status          text not null default 'sent'
                  check (status in ('draft','queued','sent','delivered','read','failed','received','mock_sent','blocked')),
  provider        text,             -- 'mock', 'brevo', 'whatsapp_cloud', 'twilio', 'manual'...
  external_id     text,
  error           text,
  ai_generated    boolean not null default false,
  ai_run_id       uuid,
  template_key    text,             -- para medir qué mensaje convierte más
  workflow_id     uuid references public.growth_workflows(id) on delete set null,
  campaign_id     uuid references public.growth_campaigns(id) on delete set null,
  intent          text,             -- interés detectado en respuestas
  objection_id    uuid references public.growth_objections(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists growth_messages_conv_idx     on public.growth_messages (conversation_id, created_at);
create index if not exists growth_messages_ws_idx       on public.growth_messages (workspace_id, created_at desc);
create index if not exists growth_messages_prospect_idx on public.growth_messages (prospect_id, created_at);

-- ── Automatizaciones ──
create table if not exists public.growth_workflow_steps (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  workflow_id  uuid not null references public.growth_workflows(id) on delete cascade,
  position     int  not null check (position >= 0),
  type         text not null check (type in ('send_message','wait','wait_reply','ai_analyze','set_score','add_score',
                                             'set_status','add_tag','send_link','create_task','webhook','condition','notify')),
  config       jsonb not null default '{}'::jsonb,
  -- Para 'condition' y 'wait_reply': a qué paso ir (null = siguiente, -1 = terminar)
  on_true      int,
  on_false     int,
  unique (workflow_id, position)
);

create table if not exists public.growth_workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  workflow_id  uuid not null references public.growth_workflows(id) on delete cascade,
  prospect_id  uuid not null references public.growth_prospects(id) on delete cascade,
  status       text not null default 'running' check (status in ('running','waiting','done','failed','cancelled')),
  current_step int  not null default 0,
  wait_until   timestamptz,
  waiting_reply boolean not null default false,
  log          jsonb not null default '[]'::jsonb,
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  updated_at   timestamptz not null default now()
);
create unique index if not exists growth_runs_uno_activo on public.growth_workflow_runs (workflow_id, prospect_id)
  where status in ('running','waiting');
create index if not exists growth_runs_pendientes on public.growth_workflow_runs (status, wait_until)
  where status in ('running','waiting');
create index if not exists growth_runs_ws_idx on public.growth_workflow_runs (workspace_id, started_at desc);

create table if not exists public.growth_tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  prospect_id  uuid references public.growth_prospects(id) on delete cascade,
  title        text not null,
  due_at       timestamptz,
  done         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists growth_tasks_ws_idx on public.growth_tasks (workspace_id, done, due_at);

-- ── Links trackeados ──
create table if not exists public.growth_tracking_links (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  slug         text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  name         text not null,
  campaign_id  uuid references public.growth_campaigns(id) on delete set null,
  source_id    uuid references public.growth_sources(id) on delete set null,
  destination  text not null default 'smart' check (destination in ('smart','play','appstore','web','custom')),
  custom_url   text check (custom_url is null or custom_url ~ '^https://'),
  utm_medium   text,
  utm_content  text,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists growth_links_ws_idx on public.growth_tracking_links (workspace_id);

create table if not exists public.growth_link_clicks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  link_id      uuid not null references public.growth_tracking_links(id) on delete cascade,
  prospect_id  uuid references public.growth_prospects(id) on delete set null,
  click_token  text not null unique,
  device       text not null default 'other' check (device in ('android','ios','desktop','other')),
  target       text not null,        -- 'play','appstore','web','custom'
  referrer     text,
  user_agent   text,                 -- recortado; no se guarda la IP
  created_at   timestamptz not null default now()
);
create index if not exists growth_clicks_link_idx on public.growth_link_clicks (link_id, created_at);
create index if not exists growth_clicks_ws_idx   on public.growth_link_clicks (workspace_id, created_at);

-- ── Usuarios reales de la app y sus eventos ──
create table if not exists public.growth_app_users (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.growth_workspaces(id) on delete cascade,
  external_user_id text,            -- id del usuario en la app (por ejemplo, auth.users de Tratto)
  prospect_id      uuid references public.growth_prospects(id) on delete set null,
  name             text,
  email            text,
  platform         text check (platform in ('android','ios','web','other')),
  source_id        uuid references public.growth_sources(id) on delete set null,
  campaign_id      uuid references public.growth_campaigns(id) on delete set null,
  link_id          uuid references public.growth_tracking_links(id) on delete set null,
  click_token      text,
  installed_at     timestamptz,
  first_open_at    timestamptz,
  registered_at    timestamptz,
  onboarded_at     timestamptz,
  first_action_at  timestamptz,
  activated_at     timestamptz,
  last_seen_at     timestamptz,
  sessions_count   int not null default 0,
  revenue          numeric(14,2) not null default 0,
  is_paying        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (workspace_id, external_user_id)
);
create index if not exists growth_users_ws_idx       on public.growth_app_users (workspace_id, created_at desc);
create index if not exists growth_users_prospect_idx on public.growth_app_users (prospect_id);
create index if not exists growth_users_token_idx    on public.growth_app_users (workspace_id, click_token);
create index if not exists growth_users_seen_idx     on public.growth_app_users (workspace_id, last_seen_at);

alter table public.growth_prospects
  drop constraint if exists growth_prospects_app_user_fk,
  add  constraint growth_prospects_app_user_fk foreign key (app_user_id) references public.growth_app_users(id) on delete set null;
alter table public.growth_timeline
  drop constraint if exists growth_timeline_app_user_fk,
  add  constraint growth_timeline_app_user_fk foreign key (app_user_id) references public.growth_app_users(id) on delete cascade;

create table if not exists public.growth_app_events (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references public.growth_workspaces(id) on delete cascade,
  app_user_id     uuid references public.growth_app_users(id) on delete cascade,
  prospect_id     uuid references public.growth_prospects(id) on delete set null,
  event           text not null check (event ~ '^[a-z0-9_]{2,40}$'),
  platform        text,
  amount          numeric(14,2),
  properties      jsonb not null default '{}'::jsonb,
  idempotency_key text,
  occurred_at     timestamptz not null default now(),
  received_at     timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index if not exists growth_events_ws_idx   on public.growth_app_events (workspace_id, occurred_at desc);
create index if not exists growth_events_user_idx on public.growth_app_events (app_user_id, occurred_at desc);

create table if not exists public.growth_installations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  app_user_id  uuid not null references public.growth_app_users(id) on delete cascade,
  prospect_id  uuid references public.growth_prospects(id) on delete set null,
  platform     text,
  link_id      uuid references public.growth_tracking_links(id) on delete set null,
  installed_at timestamptz not null
);
create index if not exists growth_installs_ws_idx on public.growth_installations (workspace_id, installed_at);

create table if not exists public.growth_registrations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.growth_workspaces(id) on delete cascade,
  app_user_id   uuid not null references public.growth_app_users(id) on delete cascade,
  prospect_id   uuid references public.growth_prospects(id) on delete set null,
  method        text,
  registered_at timestamptz not null
);
create index if not exists growth_regs_ws_idx on public.growth_registrations (workspace_id, registered_at);

create table if not exists public.growth_activations (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.growth_workspaces(id) on delete cascade,
  app_user_id      uuid not null references public.growth_app_users(id) on delete cascade,
  prospect_id      uuid references public.growth_prospects(id) on delete set null,
  activation_event text not null,
  activated_at     timestamptz not null
);
create index if not exists growth_acts_ws_idx on public.growth_activations (workspace_id, activated_at);

create table if not exists public.growth_user_sessions (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  app_user_id  uuid not null references public.growth_app_users(id) on delete cascade,
  platform     text,
  started_at   timestamptz not null,
  duration_s   int
);
create index if not exists growth_sessions_user_idx on public.growth_user_sessions (app_user_id, started_at);
create index if not exists growth_sessions_ws_idx   on public.growth_user_sessions (workspace_id, started_at);

-- ── Scoring ──
create table if not exists public.growth_score_rules (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  name         text not null,
  condition    jsonb not null,
  points       int  not null check (points between -100 and 100),
  active       boolean not null default true,
  sort         int  not null default 0
);
create index if not exists growth_rules_ws_idx on public.growth_score_rules (workspace_id, active);

-- ── IA ──
create table if not exists public.growth_ai_prompts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.growth_workspaces(id) on delete cascade,
  key           text not null check (key in ('analyze','message','reply','summary','objection','score','explain')),
  instructions  text not null,
  updated_at    timestamptz not null default now(),
  unique (workspace_id, key)
);

create table if not exists public.growth_ai_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  prospect_id  uuid references public.growth_prospects(id) on delete set null,
  kind         text not null,
  provider     text not null,          -- 'openai' o 'mock'
  model        text,
  input        jsonb not null default '{}'::jsonb,
  output       jsonb not null default '{}'::jsonb,
  ok           boolean not null default true,
  error        text,
  tokens_in    int,
  tokens_out   int,
  duration_ms  int,
  created_at   timestamptz not null default now()
);
create index if not exists growth_ai_runs_ws_idx on public.growth_ai_runs (workspace_id, created_at desc);
create index if not exists growth_ai_runs_prospect_idx on public.growth_ai_runs (prospect_id, created_at desc);

-- ── Notificaciones ──
create table if not exists public.growth_notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  type         text not null check (type in ('high_intent','reply','install','registration','activation',
                                             'inactive_user','campaign_goal','automation_error','info')),
  title        text not null,
  body         text,
  prospect_id  uuid references public.growth_prospects(id) on delete cascade,
  app_user_id  uuid references public.growth_app_users(id) on delete cascade,
  campaign_id  uuid references public.growth_campaigns(id) on delete cascade,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists growth_notifs_ws_idx on public.growth_notifications (workspace_id, read, created_at desc);

-- ── Integraciones (solo configuración NO secreta y estado) ──
create table if not exists public.growth_integrations (
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  provider     text not null check (provider in ('instagram','whatsapp','email','sms','tiktok','google_ads',
                                                 'google_play','app_store','analytics','attribution','openai')),
  mode         text not null default 'mock' check (mode in ('mock','live','off')),
  config       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, provider)
);

-- Datos del sistema que nadie lee desde la app (hash del secreto del cron)
create table if not exists public.growth_system (
  key   text primary key,
  value text not null
);
