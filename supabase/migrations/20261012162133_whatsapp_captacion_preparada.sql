-- Preparación de WhatsApp. Sólo service_role; nada habilita envíos al instalar.
create table public.growth_wa_config (
  workspace_id uuid primary key references public.growth_workspaces(id) on delete cascade,
  enabled boolean not null default false,
  template_approved boolean not null default false,
  phone_number_id text not null default '',
  waba_id text not null default '',
  api_version text not null default 'v26.0' check (api_version ~ '^v[0-9]+\.0$'),
  template_name text not null default '',
  template_body text not null default '',
  health_template_body text not null default '',
  template_language text not null default 'es_AR',
  daily_limit integer not null default 0 check (daily_limit between 0 and 250),
  monthly_budget_usd numeric not null default 0 check (monthly_budget_usd >= 0),
  price_ceiling_usd numeric not null default 0 check (price_ceiling_usd >= 0),
  health_ok boolean not null default false,
  health_checked_at timestamptz,
  meta_limit integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.growth_wa_contacts (
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  phone text not null check (phone ~ '^549[0-9]{10}$'),
  consent text not null default 'pending' check (consent in ('pending','opt_in','opt_out')),
  consent_proof jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, phone)
);
create table public.growth_wa_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  prospect_id uuid not null references public.growth_prospects(id) on delete cascade,
  phone text not null,
  state text not null default 'queued' check (state in ('queued','reserved','dispatching','accepted','sent','delivered','read','failed','unknown','cancelled')),
  claim_token uuid,
  reserved_at timestamptz,
  attempted_at timestamptz,
  price_reserved_usd numeric not null default 0,
  external_id text unique,
  message_id uuid references public.growth_messages(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id,phone) references public.growth_wa_contacts(workspace_id,phone),
  unique (workspace_id,phone), unique (workspace_id,prospect_id)
);
create index growth_wa_queue_dispatch_idx on public.growth_wa_queue(workspace_id,state,created_at);
create index growth_wa_queue_budget_idx on public.growth_wa_queue(workspace_id,reserved_at) where reserved_at is not null;
create table public.growth_wa_events (
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  event_key text not null,
  kind text not null,
  phone text,
  external_id text,
  body text,
  detail jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  primary key (workspace_id,event_key)
);
alter table public.growth_wa_config enable row level security;
alter table public.growth_wa_contacts enable row level security;
alter table public.growth_wa_queue enable row level security;
alter table public.growth_wa_events enable row level security;
revoke all on public.growth_wa_config,public.growth_wa_contacts,public.growth_wa_queue,public.growth_wa_events from public,anon,authenticated;
grant select,insert,update,delete on public.growth_wa_config,public.growth_wa_contacts,public.growth_wa_queue,public.growth_wa_events to service_role;

create function public.growth_wa_phone(p_text text) returns text
language sql immutable security invoker set search_path='' as $$
 with cleaned as (select regexp_replace(coalesce(p_text,''),'[^0-9]','','g') d)
 select case
   when d ~ '^549[0-9]{10}$' then d
   when d ~ '^54[0-9]{10}$' then '549'||substring(d from 3)
   when d ~ '^0?11(15)?[0-9]{8}$' then '54911'||right(d,8)
   when d ~ '^[0-9]{10}$' then '549'||d
   when d ~ '^0[0-9]{10}$' then '549'||right(d,10)
   else d end from cleaned
$$;

-- service_role no puede leer auth.users. Esta consulta mínima devuelve sólo
-- un booleano, permanece en privado y no admite llamadas de usuarios finales.
create schema if not exists privado;
create function privado.growth_wa_registered(p_email text,p_phone text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is not null or current_setting('role',true) not in ('service_role','none') then
    raise exception 'Sólo operación interna';
  end if;
  return exists(select 1 from auth.users u where (nullif(p_email,'') is not null and lower(u.email)=lower(p_email))
    or (nullif(u.phone,'') is not null and regexp_replace(u.phone,'[^0-9]','','g')=p_phone));
end $$;
revoke all on function privado.growth_wa_registered(text,text) from public,anon,authenticated;
grant usage on schema privado to service_role;
grant execute on function privado.growth_wa_registered(text,text) to service_role;

-- Se consulta antes de reservar y otra vez justo antes del intento.
create function public.growth_wa_suppressed(p_workspace uuid,p_prospect uuid,p_phone text) returns boolean
language sql stable security invoker set search_path='' as $$
 select not exists (
   select 1 from public.growth_prospects p
   where p.id=p_prospect and p.workspace_id=p_workspace and p.kind='provider'
     and public.growth_wa_phone(p.phone)=p_phone and p_phone ~ '^549[0-9]{10}$'
     and not p.do_not_contact and p.consent<>'opt_out'
     and p.status not in ('registered','activated','installed','not_interested')
     and p.app_user_id is null and p.registered_at is null
     and p.rubro is not null and p.rubro<>''
     and p.zona in ('CABA','GBA Norte','GBA Oeste','GBA Sur','Buenos Aires (interior)')
     and exists (select 1 from public.growth_mkt_rotacion r where r.workspace_id=p_workspace and r.rubro=p.rubro and r.activo)
 ) or not exists (
   select 1 from public.growth_wa_contacts c where c.workspace_id=p_workspace and c.phone=p_phone
     and c.consent='opt_in' and c.consent_proof->>'verified_webhook'='true'
 ) or exists (
   select 1 from public.growth_prospects original join public.growth_prospects p on p.id=p_prospect
   where original.workspace_id=p_workspace and (
     original.id=p.id or public.growth_wa_phone(original.phone)=p_phone
     or (nullif(p.email,'') is not null and lower(original.email)=lower(p.email))
     or (length(trim(coalesce(p.company,'')))>=5 and lower(trim(original.company))=lower(trim(p.company)))
     or (nullif(p.datos->'whatsapp'->>'fuente_url','') is not null
       and rtrim(lower(split_part(original.datos->'prospeccion'->>'fuente_url','?',1)),'/')=rtrim(lower(split_part(p.datos->'whatsapp'->>'fuente_url','?',1)),'/'))
   ) and (
     original.do_not_contact or original.consent='opt_out'
     or original.status in ('registered','activated') or original.app_user_id is not null
     or original.entrada='prospeccion' or original.datos->'prospeccion'->>'gmail_thread' is not null
     or exists(select 1 from public.growth_messages m where m.prospect_id=original.id and m.workspace_id=p_workspace
       and m.channel='email' and m.direction='out' and m.status in ('sent','delivered','read'))
   )
 ) or coalesce((select privado.growth_wa_registered(p.email,p_phone)
   from public.growth_prospects p where p.id=p_prospect and p.workspace_id=p_workspace),true)
$$;

create function public.growth_wa_enqueue(p_workspace uuid,p_prospect uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ph text; qid uuid;
begin
  select public.growth_wa_phone(phone) into ph from public.growth_prospects where id=p_prospect and workspace_id=p_workspace;
  if ph is null or public.growth_wa_suppressed(p_workspace,p_prospect,ph) then
    return jsonb_build_object('ok',false,'reason','Sin permiso WhatsApp verificado, fuera de zona/rubro, registrado, baja o canal mail');
  end if;
  insert into public.growth_wa_queue(workspace_id,prospect_id,phone) values(p_workspace,p_prospect,ph)
  on conflict do nothing returning id into qid;
  return jsonb_build_object('ok',qid is not null,'id',qid,'reason',case when qid is null then 'Proveedor o teléfono ya reservado/contactado' end);
end $$;

-- El formulario no concede permiso: el teléfono debe haber aceptado mediante
-- un mensaje entrante con firma Meta antes de crear o encolar el prospecto.
create function public.growth_wa_qualify(p_workspace uuid,p_phone text,p_company text,p_name text,p_email text,p_rubro text,p_zone text,p_city text,p_source text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ph text:=public.growth_wa_phone(p_phone); pid uuid; source uuid;
begin
  perform 1 from public.growth_wa_config where workspace_id=p_workspace for update;
  if ph !~ '^549[0-9]{10}$' or p_zone not in ('CABA','GBA Norte','GBA Oeste','GBA Sur','Buenos Aires (interior)')
    or length(trim(coalesce(p_company,'')))<2 or length(trim(coalesce(p_city,'')))<2
    or not exists(select 1 from public.growth_mkt_rotacion where workspace_id=p_workspace and rubro=p_rubro and activo)
    or not exists(select 1 from public.growth_wa_contacts where workspace_id=p_workspace and phone=ph and consent='opt_in' and consent_proof->>'verified_webhook'='true') then
    return jsonb_build_object('ok',false,'reason','Falta permiso WhatsApp verificado o los datos de rubro y zona');
  end if;
  if privado.growth_wa_registered(p_email,ph) then return jsonb_build_object('ok',false,'reason','Ya registrado en Tratto'); end if;
  select id into pid from public.growth_prospects where workspace_id=p_workspace and (
    public.growth_wa_phone(phone)=ph or (nullif(trim(p_email),'') is not null and lower(email)=lower(trim(p_email)))
    or lower(trim(company))=lower(trim(p_company))
  ) order by created_at limit 1;
  if pid is null then
    select id into source from public.growth_sources where workspace_id=p_workspace and key='whatsapp';
    insert into public.growth_prospects(workspace_id,kind,phone,email,company,first_name,rubro,zona,city,source_id,consent,status,entrada,datos)
      values(p_workspace,'provider',ph,nullif(lower(trim(p_email)),''),left(trim(p_company),120),nullif(left(trim(p_name),80),''),p_rubro,p_zone,left(trim(p_city),80),source,
        'unknown','new','whatsapp',jsonb_build_object('whatsapp',jsonb_build_object('opt_in',true,'permission_channel','whatsapp','fuente_url',left(p_source,300)))) returning id into pid;
  end if;
  -- No cambiar status ni consent genérico, ni sobrescribir proveedores existentes.
  return public.growth_wa_enqueue(p_workspace,pid);
end $$;

create function public.growth_wa_health(p_workspace uuid,p_phone jsonb,p_template jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cfg public.growth_wa_config; lim integer:=0; good boolean:=false; tier text;
begin
  select * into cfg from public.growth_wa_config where workspace_id=p_workspace for update;
  tier:=p_phone->>'whatsapp_business_manager_messaging_limit';
  if tier ~ '^TIER_[0-9]+$' then lim:=substring(tier from 6)::integer; end if;
  good:=coalesce(p_phone->>'id'=cfg.phone_number_id and p_phone->>'quality_rating'='GREEN'
    and p_phone->>'code_verification_status'='VERIFIED' and lim>0 and exists (
      select 1 from jsonb_array_elements(coalesce(p_template->'data','[]'::jsonb)) t
      where t->>'name'=cfg.template_name and t->>'language'=cfg.template_language
        and t->>'category'='MARKETING' and t->>'status'='APPROVED'
        and exists(select 1 from jsonb_array_elements(coalesce(t->'components','[]'::jsonb)) c
          where c->>'type'='BODY' and c->>'text'=cfg.template_body and c->>'text' ilike '%BAJA%')
    ),false);
  update public.growth_wa_config set health_ok=good,health_checked_at=now(),meta_limit=lim,health_template_body=cfg.template_body where workspace_id=p_workspace;
  return jsonb_build_object('ok',good,'meta_limit',lim);
end $$;

create function public.growth_wa_ready(p_workspace uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((select enabled and template_approved and daily_limit>0 and monthly_budget_usd>0 and price_ceiling_usd>0
   and phone_number_id ~ '^[0-9]+$' and waba_id ~ '^[0-9]+$' and template_name<>'' and template_body<>'' and template_body=health_template_body and health_ok
   and health_checked_at>now()-interval '15 minutes' and meta_limit>0
   from public.growth_wa_config where workspace_id=p_workspace),false)
$$;

create function public.growth_wa_claim(p_workspace uuid,p_limit integer default 20) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cfg public.growth_wa_config; slots integer; spent numeric; used integer; result jsonb;
begin
  select * into cfg from public.growth_wa_config where workspace_id=p_workspace for update;
  -- Nunca liberar ni reintentar una reserva que quedó sin resultado conocido.
  update public.growth_wa_queue set state='unknown',error='Reserva vencida; revisar manualmente, no reenviar',updated_at=now()
  where workspace_id=p_workspace and state in ('reserved','dispatching') and reserved_at<now()-interval '30 minutes';
  if not public.growth_wa_ready(p_workspace) then return '[]'::jsonb; end if;
  select count(*) into used from public.growth_wa_queue where workspace_id=p_workspace and reserved_at>now()-interval '24 hours';
  select coalesce(sum(price_reserved_usd),0) into spent from public.growth_wa_queue
    where workspace_id=p_workspace and reserved_at>=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires';
  slots:=greatest(0,least(cfg.daily_limit-used,cfg.meta_limit-used,floor((cfg.monthly_budget_usd-spent)/cfg.price_ceiling_usd)::integer,greatest(0,least(coalesce(p_limit,0),20))));
  with picked as (
    select id from public.growth_wa_queue q where q.workspace_id=p_workspace and q.state='queued'
      and not public.growth_wa_suppressed(p_workspace,q.prospect_id,q.phone)
      order by created_at for update skip locked limit slots
  ), claimed as (
    update public.growth_wa_queue q set state='reserved',claim_token=gen_random_uuid(),reserved_at=now(),
      price_reserved_usd=cfg.price_ceiling_usd,updated_at=now()
      from picked where q.id=picked.id returning q.id,q.claim_token
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'claim_token',claim_token)),'[]'::jsonb) into result from claimed;
  return result;
end $$;

create function public.growth_wa_begin(p_id uuid,p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.growth_wa_queue; cfg public.growth_wa_config;
begin
  perform 1 from public.growth_wa_config c where c.workspace_id=(select workspace_id from public.growth_wa_queue where id=p_id and claim_token=p_token) for update;
  select * into job from public.growth_wa_queue where id=p_id and claim_token=p_token for update;
  if job.id is null or job.state<>'reserved' then return jsonb_build_object('ok',false,'reason','Sin reserva válida'); end if;
  select * into cfg from public.growth_wa_config where workspace_id=job.workspace_id;
  if not public.growth_wa_ready(job.workspace_id) or public.growth_wa_suppressed(job.workspace_id,job.prospect_id,job.phone) then
    update public.growth_wa_queue set state='cancelled',error='Pausa, permiso, cuenta, registro o canal mail cambió',updated_at=now() where id=p_id;
    return jsonb_build_object('ok',false,'reason','Guardia bloqueó envío');
  end if;
  update public.growth_wa_queue set state='dispatching',attempted_at=now(),updated_at=now() where id=p_id;
  return jsonb_build_object('ok',true,'id',p_id,'claim_token',p_token,'workspace_id',job.workspace_id,'api_version',cfg.api_version,'phone_number_id',cfg.phone_number_id,
    'payload',jsonb_build_object('messaging_product','whatsapp','recipient_type','individual','to',job.phone,'type','template',
      'template',jsonb_build_object('name',cfg.template_name,'language',jsonb_build_object('code',cfg.template_language))));
end $$;

create function public.growth_wa_result(p_id uuid,p_token uuid,p_status integer,p_response jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.growth_wa_queue; ext text; cid uuid; mid uuid; st text; ev record;
begin
  perform 1 from public.growth_wa_config c where c.workspace_id=(select workspace_id from public.growth_wa_queue where id=p_id and claim_token=p_token) for update;
  select * into job from public.growth_wa_queue where id=p_id and claim_token=p_token for update;
  if job.id is null then return jsonb_build_object('ok',false); end if;
  if job.state<>'dispatching' then return jsonb_build_object('ok',true,'state',job.state,'duplicate',true); end if;
  ext:=p_response->'messages'->0->>'id';
  st:=case when p_status between 200 and 299 and nullif(ext,'') is not null then 'accepted'
    when p_status between 400 and 499 then 'failed' else 'unknown' end;
  if st='accepted' then
    select id into cid from public.growth_conversations where workspace_id=job.workspace_id and prospect_id=job.prospect_id and channel='whatsapp';
    if cid is null then insert into public.growth_conversations(workspace_id,prospect_id,channel) values(job.workspace_id,job.prospect_id,'whatsapp') returning id into cid; end if;
    insert into public.growth_messages(workspace_id,conversation_id,prospect_id,direction,channel,body,status,provider,external_id)
      select job.workspace_id,cid,job.prospect_id,'out','whatsapp',c.template_body,'sent','whatsapp_cloud',ext from public.growth_wa_config c where c.workspace_id=job.workspace_id returning id into mid;
  end if;
  update public.growth_wa_queue set state=st,external_id=case when st='accepted' then ext end,message_id=mid,
    error=case when st<>'accepted' then left(coalesce(p_response->>'error','Resultado incierto; no reintentar automáticamente'),500) end,updated_at=now() where id=p_id;
  -- Un error real frena el lote y requiere revisión antes de otro intento.
  if st<>'accepted' then update public.growth_wa_config set health_ok=false where workspace_id=job.workspace_id; end if;
  if st='accepted' then
    -- Meta puede llamar al webhook antes de que n8n guarde la respuesta HTTP.
    for ev in select detail from public.growth_wa_events where workspace_id=job.workspace_id and external_id=ext and kind='status' order by received_at loop
      perform public.growth_wa_apply_status(job.workspace_id,ext,ev.detail->>'status',ev.detail->>'error');
    end loop;
  end if;
  return jsonb_build_object('ok',st='accepted','state',st,'delivery_confirmed',false);
end $$;

create function public.growth_wa_apply_status(p_workspace uuid,p_external text,p_status text,p_error text) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.growth_wa_queue;
begin
  perform 1 from public.growth_wa_config where workspace_id=p_workspace for update;
  select * into job from public.growth_wa_queue where workspace_id=p_workspace and external_id=p_external for update;
  if job.id is not null and (
    (p_status='read' and job.state in ('accepted','sent','delivered'))
    or (p_status='delivered' and job.state in ('accepted','sent'))
    or (p_status='sent' and job.state='accepted')
    or (p_status='failed' and job.state in ('accepted','sent'))
  ) then
    update public.growth_wa_queue set state=p_status,updated_at=now(),error=case when p_status='failed' then left(p_error,500) end where id=job.id;
    update public.growth_messages set status=p_status,error=case when p_status='failed' then left(p_error,500) end where id=job.message_id;
    if p_status='failed' then update public.growth_wa_config set health_ok=false where workspace_id=p_workspace; end if;
  end if;
end $$;

-- Sólo se llama tras validar firma HMAC y número empresarial en el webhook.
create function public.growth_wa_event(p_workspace uuid,p_event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ph text; kind text; txt text; eid text; changed integer; job public.growth_wa_queue; cid uuid; new_consent text;
begin
  perform 1 from public.growth_wa_config where workspace_id=p_workspace for update;
  ph:=public.growth_wa_phone(p_event->>'phone'); kind:=p_event->>'kind';txt:=left(coalesce(p_event->>'body',''),4000);eid:=p_event->>'external_id';
  if nullif(p_event->>'key','') is null or kind not in ('message','status','account_alert') or length(p_event->>'key')>300 then raise exception 'Evento inválido'; end if;
  insert into public.growth_wa_events(workspace_id,event_key,kind,phone,external_id,body,detail)
    values(p_workspace,p_event->>'key',kind,ph,eid,txt,p_event-'body') on conflict do nothing;
  get diagnostics changed=row_count;
  if changed=0 then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if kind='account_alert' then
    update public.growth_wa_config set enabled=false,health_ok=false,updated_at=now() where workspace_id=p_workspace;
  end if;
  if kind='message' and ph ~ '^549[0-9]{10}$' then
    new_consent:=case when upper(trim(txt)) in ('BAJA','NO','STOP','NO ME ESCRIBAS MÁS','NO ME ESCRIBAS MAS') then 'opt_out'
      when upper(trim(txt))='QUIERO RECIBIR INVITACIONES DE TRATTO POR WHATSAPP' then 'opt_in' else 'pending' end;
    if new_consent<>'pending' then
      insert into public.growth_wa_contacts(workspace_id,phone,consent,consent_proof)
        values(p_workspace,ph,new_consent,jsonb_build_object('verified_webhook',true,'message_id',eid,'text',txt,'at',now()))
      on conflict(workspace_id,phone) do update set consent=excluded.consent,consent_proof=excluded.consent_proof,updated_at=now();
    end if;
    if new_consent='opt_out' then
      update public.growth_wa_queue set state='cancelled',error='Baja por WhatsApp',updated_at=now() where workspace_id=p_workspace and phone=ph and state in ('queued','reserved');
      -- No alterar registered/activated ni el permiso de mail: baja del canal WhatsApp.
    end if;
    select * into job from public.growth_wa_queue where workspace_id=p_workspace and phone=ph;
    if job.id is not null then
      select id into cid from public.growth_conversations where workspace_id=p_workspace and prospect_id=job.prospect_id and channel='whatsapp';
      if cid is null then insert into public.growth_conversations(workspace_id,prospect_id,channel) values(p_workspace,job.prospect_id,'whatsapp') returning id into cid; end if;
      insert into public.growth_messages(workspace_id,conversation_id,prospect_id,direction,channel,body,status,provider,external_id)
        values(p_workspace,cid,job.prospect_id,'in','whatsapp',txt,'received','whatsapp_cloud',eid);
    end if;
  elsif kind='status' then
    perform public.growth_wa_apply_status(p_workspace,eid,p_event->>'status',p_event->>'error');
  end if;
  return jsonb_build_object('ok',true,'new',true);
end $$;

create function public.growth_wa_report(p_workspace uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('enabled',coalesce((select enabled from public.growth_wa_config where workspace_id=p_workspace),false),
   'counts',(select coalesce(jsonb_object_agg(state,n),'{}'::jsonb) from (select state,count(*) n from public.growth_wa_queue where workspace_id=p_workspace group by state) s),
   'permission_verified',(select count(*) from public.growth_wa_contacts where workspace_id=p_workspace and consent='opt_in'),
   'delivery_note','accepted/sent no confirma entrega final; sólo delivered/read del webhook',
   'at',now())
$$;

create function public.growth_wa_daily_report(p_workspace uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date; stats jsonb; item uuid;
begin
  perform 1 from public.growth_wa_config where workspace_id=p_workspace for update;
  stats:=public.growth_wa_report(p_workspace)||jsonb_build_object('clave','whatsapp_prospeccion_dia','fecha',d,'creditos_firecrawl',0);
  select id into item from public.growth_mkt_items where workspace_id=p_workspace and tipo='informe' and datos->>'clave'='whatsapp_prospeccion_dia' and datos->>'fecha'=d::text limit 1;
  if item is null then
    insert into public.growth_mkt_items(workspace_id,departamento,tipo,titulo,resumen,cuerpo,canal,estado,datos,creado_por)
      values(p_workspace,'operaciones','informe','WhatsApp a proveedores: '||d,'Estado de WhatsApp · registro de intentos y entregas · revisar fallos y bajas',
        'EN CORTO'||E'\n'||'Los estados accepted/sent no confirman entrega final. Sólo el webhook delivered/read la acredita.'||E'\n'||stats::text,
        'whatsapp','hecho',stats,'agente:n8n') returning id into item;
  else
    update public.growth_mkt_items set datos=stats,cuerpo='EN CORTO'||E'\n'||'Sólo delivered/read acredita entrega; no se reintentan resultados inciertos.'||E'\n'||stats::text where id=item and workspace_id=p_workspace;
  end if;
  return stats||jsonb_build_object('informe_id',item);
end $$;

-- Revocar permisos por firma exacta: no modifica funciones de otros componentes.
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'growth_wa_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.sig);
    execute format('grant execute on function %s to service_role',f.sig);
  end loop;
end $$;
insert into public.growth_wa_config(workspace_id) select id from public.growth_workspaces where slug='tratto';
