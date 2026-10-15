-- Private outbox: real CRM INSERTs, never a scheduled conversation scan.
-- pg_net and Supabase Vault already exist in the target project.
create schema if not exists growth_agent_private;
revoke all on schema growth_agent_private from public, anon, authenticated;
grant usage on schema growth_agent_private to service_role;

create table growth_agent_private.codex_config (
  workspace_id uuid primary key references public.growth_workspaces(id) on delete cascade,
  board_id uuid not null references public.growth_mkt_items(id) on delete cascade,
  enabled boolean not null default false,
  receiver_url text,
  vault_secret_name text not null default 'codex_chat_webhook',
  updated_at timestamptz not null default now(),
  check(receiver_url is null or receiver_url ~ '^https://[^[:space:]]+/events/claude$')
);
create table growth_agent_private.codex_outbox (
  message_id uuid primary key references public.growth_mkt_items(id) on delete cascade,
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  delivery_status text not null default 'pending' check(delivery_status in
    ('pending','held_by_pause','waiting_receiver','dispatch_requested','dispatch_error','uncertain','read')),
  request_id bigint,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  read_at timestamptz,
  error_code text
);
create index codex_outbox_pending on growth_agent_private.codex_outbox(workspace_id,created_at)
  where delivery_status in('pending','held_by_pause','waiting_receiver','dispatch_error');
alter table growth_agent_private.codex_config enable row level security;
alter table growth_agent_private.codex_outbox enable row level security;
revoke all on growth_agent_private.codex_config,growth_agent_private.codex_outbox
  from public,anon,authenticated;
grant all on growth_agent_private.codex_config,growth_agent_private.codex_outbox to service_role;

create function growth_agent_private.codex_dispatch(p_message uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare e growth_agent_private.codex_outbox; c growth_agent_private.codex_config;
        b public.growth_mkt_items; m public.growth_mkt_items; secret_value text; req bigint;
begin
  select * into e from growth_agent_private.codex_outbox where message_id=p_message for update;
  if not found then return null; end if;
  -- A successful HTTP request only means queued; it is never a read receipt.
  if e.delivery_status in('dispatch_requested','uncertain','read') then return e.request_id; end if;
  select * into c from growth_agent_private.codex_config where workspace_id=e.workspace_id;
  select * into b from public.growth_mkt_items where id=c.board_id and workspace_id=e.workspace_id for share;
  if not found or b.estado<>'programado' then
    update growth_agent_private.codex_outbox set delivery_status='held_by_pause' where message_id=p_message;
    return null;
  end if;
  select * into m from public.growth_mkt_items where id=p_message and workspace_id=e.workspace_id;
  if not found or m.datos->>'leido'='true' then
    -- Do not manufacture a read timestamp when another reader handled it.
    return null;
  end if;
  if not c.enabled or coalesce(c.receiver_url,'')='' then
    update growth_agent_private.codex_outbox set delivery_status='waiting_receiver' where message_id=p_message;
    return null;
  end if;
  select decrypted_secret into secret_value from vault.decrypted_secrets
    where name=c.vault_secret_name limit 1;
  if coalesce(length(secret_value),0)<32 then
    update growth_agent_private.codex_outbox set delivery_status='waiting_receiver',error_code='credential_not_bound'
      where message_id=p_message;
    return null;
  end if;
  begin
    req:=net.http_post(url:=c.receiver_url,
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret_value),
      body:=jsonb_build_object('version',1,'event_id','codex:'||p_message::text,
        'workspace_id',e.workspace_id,'message_id',p_message,'board_id',c.board_id),
      timeout_milliseconds:=5000);
    update growth_agent_private.codex_outbox set delivery_status='dispatch_requested',request_id=req,
      attempted_at=clock_timestamp(),attempts=attempts+1,error_code=null where message_id=p_message;
  exception when others then
    -- The subtransaction also rolls back pg_net's insert; safe to retry after diagnosis.
    update growth_agent_private.codex_outbox set delivery_status='dispatch_error',error_code='request_not_created'
      where message_id=p_message;
    return null;
  end;
  return req;
end $$;

create function growth_agent_private.codex_dispatch_pending(p_workspace uuid,p_limit integer default 20)
returns integer language plpgsql security definer set search_path='' as $$
declare e record; n integer:=0;
begin
  for e in select message_id from growth_agent_private.codex_outbox
    where workspace_id=p_workspace and delivery_status in
      ('pending','held_by_pause','waiting_receiver','dispatch_error')
    order by created_at,message_id limit greatest(0,least(p_limit,100))
  loop
    if growth_agent_private.codex_dispatch(e.message_id) is not null then n:=n+1; end if;
  end loop;
  return n;
end $$;

create function growth_agent_private.codex_message_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare c growth_agent_private.codex_config;
begin
  select * into c from growth_agent_private.codex_config where workspace_id=new.workspace_id;
  if not found then return new; end if;
  if tg_op='UPDATE' then
    -- A deliberate resume can drain messages held by pause; heartbeat/read edits cannot.
    if new.id=c.board_id and old.estado is distinct from new.estado and new.estado='programado' then
      perform growth_agent_private.codex_dispatch_pending(new.workspace_id,100);
    end if;
    return new;
  end if;
  if new.datos->>'clave'<>'mensaje_agentes' or new.datos->>'clave' is null
     or new.datos->>'de' is distinct from 'claude'
     or new.datos->>'para' is distinct from 'codex'
     or coalesce(new.datos->>'leido','false')='true'
     or coalesce(new.datos->>'prueba','false')='true'
     or coalesce(new.datos->>'es_prueba','false')='true'
     or coalesce(new.datos->>'test','false')='true' then return new; end if;
  insert into growth_agent_private.codex_outbox(message_id,workspace_id)
    values(new.id,new.workspace_id) on conflict(message_id) do nothing;
  perform growth_agent_private.codex_dispatch(new.id);
  return new;
exception when others then
  -- The notification must never prevent the actual chat message from being saved.
  raise warning 'codex_notification_failed_message_saved';
  return new;
end $$;

revoke all on function growth_agent_private.codex_dispatch(uuid),
  growth_agent_private.codex_dispatch_pending(uuid,integer),
  growth_agent_private.codex_message_event() from public,anon,authenticated;
grant execute on function growth_agent_private.codex_dispatch(uuid),
  growth_agent_private.codex_dispatch_pending(uuid,integer) to service_role;

create trigger codex_message_event after insert or update of estado on public.growth_mkt_items
  for each row execute function growth_agent_private.codex_message_event();

comment on table growth_agent_private.codex_outbox is
  'Notification IDs only. HTTP dispatch is not evidence that Codex read or replied. No cron.';
