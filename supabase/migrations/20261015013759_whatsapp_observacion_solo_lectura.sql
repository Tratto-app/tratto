-- Coexistencia Meta: observación aislada del motor de mensajes/campañas.
-- No escribe growth_messages, growth_wa_queue, workflows ni contadores de email.
create table public.growth_wa_observer_config (
  workspace_id uuid primary key references public.growth_workspaces(id) on delete cascade,
  receiving_enabled boolean not null default false,
  waba_id text not null default '',
  phone_number_id text not null default '',
  business_phone text not null default '',
  owner_authorized_at timestamptz,
  coexistence_verified_at timestamptz,
  history_shared boolean not null default false,
  coverage_since timestamptz,
  coverage_through timestamptz,
  coverage_gap boolean not null default true,
  updated_at timestamptz not null default now(),
  check (not receiving_enabled or
    (waba_id ~ '^[0-9]+$' and phone_number_id ~ '^[0-9]+$' and business_phone ~ '^\+[0-9]{8,15}$'
     and owner_authorized_at is not null and coexistence_verified_at is not null)),
  check (coverage_through is null or (coverage_since is not null and coverage_through >= coverage_since))
);
create unique index growth_wa_observer_phone_unique on public.growth_wa_observer_config(waba_id,phone_number_id)
  where phone_number_id <> '' and waba_id <> '';

create table public.growth_wa_observer_events (
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  event_key text not null,
  kind text not null check (kind in ('message','account_update','history_progress')),
  prospect_id uuid references public.growth_prospects(id) on delete cascade,
  external_id text,
  direction text check (direction in ('in','out')),
  source text,
  body text not null default '',
  message_type text,
  text_available boolean not null default false,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  detail jsonb not null default '{}',
  primary key(workspace_id,event_key),
  check (kind <> 'message' or (prospect_id is not null and direction is not null and occurred_at is not null and external_id is not null))
);
create index growth_wa_observer_thread on public.growth_wa_observer_events(workspace_id,prospect_id,occurred_at,event_key)
  where kind='message';
create index growth_wa_observer_prospect on public.growth_wa_observer_events(prospect_id) where prospect_id is not null;
alter table public.growth_wa_observer_config enable row level security;
alter table public.growth_wa_observer_events enable row level security;
revoke all on public.growth_wa_observer_config,public.growth_wa_observer_events from public,anon,authenticated;
grant select on public.growth_wa_observer_config,public.growth_wa_observer_events to authenticated;
grant select,insert,update,delete on public.growth_wa_observer_config,public.growth_wa_observer_events to service_role;
create policy observer_config_read on public.growth_wa_observer_config for select to authenticated
  using ((select public.growth_is_member(workspace_id)));
create policy observer_events_read on public.growth_wa_observer_events for select to authenticated
  using ((select public.growth_is_member(workspace_id)));
create policy observer_config_service on public.growth_wa_observer_config for all to service_role using (true) with check (true);
create policy observer_events_service on public.growth_wa_observer_events for all to service_role using (true) with check (true);

create or replace function public.growth_wa_observer_phone(p_phone text) returns text
language sql immutable set search_path='' as $$
  select case when d ~ '^549[0-9]{10}$' then '54'||substring(d from 4)
              when d ~ '^54[0-9]{10}$' then d end
  from (select regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') d) s;
$$;
revoke all on function public.growth_wa_observer_phone(text) from public,anon,authenticated;
grant execute on function public.growth_wa_observer_phone(text) to service_role;

-- Auth no se expone al navegador ni se concede SELECT auth.users a service_role.
-- Única función privilegiada: esquema privado, salida mínima y ejecución sólo interna.
create schema growth_wa_private;
revoke all on schema growth_wa_private from public,anon,authenticated;
grant usage on schema growth_wa_private to service_role;
create function growth_wa_private.registration(p_workspace uuid,p_prospect uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with p as (
  select id,email,phone,app_user_id from public.growth_prospects
  where workspace_id=p_workspace and id=p_prospect
 ), matches as (
  select distinct u.id,u.created_at from p join auth.users u on u.deleted_at is null and (
   (nullif(trim(p.email),'') is not null and lower(trim(u.email))=lower(trim(p.email)))
   or exists(select 1 from public.growth_app_users g where g.workspace_id=p_workspace
      and (g.id=p.app_user_id or g.prospect_id=p.id) and g.external_user_id=u.id::text)
   or exists(select 1 from public.proveedores v where v.user_id=u.id and coalesce(v.demo,false)=false
      and public.growth_wa_observer_phone(v.telefono)=public.growth_wa_observer_phone(p.phone))
  )
 ) select jsonb_build_object('estado',case count(*) when 1 then 'registrado_verificado'
     when 0 then 'sin_registro_detectado_al_corte' else 'identidad_ambigua_revision_humana' end,
     'coincidencias',count(*),'registered_at',case when count(*)=1 then min(created_at) end,
     'atribucion_whatsapp','no_comprobada') from matches;
$$;
revoke all on function growth_wa_private.registration(uuid,uuid) from public,anon,authenticated;
grant execute on function growth_wa_private.registration(uuid,uuid) to service_role;

create function public.growth_wa_observer_refresh(p_workspace uuid,p_cutoff timestamptz default now(),p_prospect uuid default null) returns integer
language plpgsql security invoker set search_path='' as $$
declare p record; c public.growth_wa_observer_config; first_out timestamptz; last_out timestamptz;
 last_in timestamptz; response_at timestamptz; j jsonb; reg jsonb; n integer:=0;
begin
 if p_cutoff>now() then raise exception 'future_cutoff'; end if;
 select * into c from public.growth_wa_observer_config where workspace_id=p_workspace;
 for p in select id,datos from public.growth_prospects where workspace_id=p_workspace
    and (p_prospect is null or id=p_prospect) and jsonb_typeof(datos->'whatsapp_manual')='object' for update loop
  select min(occurred_at) filter(where direction='out'),max(occurred_at) filter(where direction='out'),
    max(occurred_at) filter(where direction='in') into first_out,last_out,last_in
  from public.growth_wa_observer_events where workspace_id=p_workspace and prospect_id=p.id
    and kind='message' and occurred_at<=p_cutoff;
  select max(occurred_at) into response_at from public.growth_wa_observer_events where workspace_id=p_workspace
    and prospect_id=p.id and kind='message' and direction='in' and occurred_at>=first_out and occurred_at<=p_cutoff;
  reg:=growth_wa_private.registration(p_workspace,p.id);
  j:=jsonb_build_object('fuente','meta_coexistencia','corte_at',p_cutoff,
    'contacto',case when first_out is not null then 'escrito_confirmado' else 'pendiente_de_comprobar' end,
    'primera_salida_at',first_out,'ultima_salida_at',last_out,'ultima_entrada_at',last_in,
    'respuesta',case when response_at is not null then 'respondio'
      when last_in is not null and first_out is null then 'mensaje_recibido_sin_contacto_previo_observado'
      when first_out is not null and c.receiving_enabled and not c.coverage_gap
         and c.coverage_since<=first_out and c.coverage_through>=p_cutoff then 'sin_respuesta_observada_al_corte'
      else 'pendiente_de_comprobar' end,
    'respuesta_at',response_at,'registro',reg,
    'conexion',case when c.receiving_enabled then 'recepcion_habilitada' else 'pendiente_de_conexion' end,
    'cobertura_desde',c.coverage_since,'cobertura_hasta',c.coverage_through,'cobertura_con_lagunas',coalesce(c.coverage_gap,true));
  update public.growth_prospects set datos=jsonb_set(datos,'{whatsapp_manual,seguimiento_meta}',j,true)
    where id=p.id and workspace_id=p_workspace;
  n:=n+1;
 end loop;
 return n;
end; $$;
revoke all on function public.growth_wa_observer_refresh(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.growth_wa_observer_refresh(uuid,timestamptz,uuid) to service_role;

create function public.growth_wa_observer_ingest(p_workspace uuid,p_event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cfg public.growth_wa_observer_config; p public.growth_prospects; candidates uuid[];
 k text:=p_event->>'key'; kind text:=p_event->>'kind'; ext text:=p_event->>'external_id';
 dir text:=p_event->>'direction'; src text:=p_event->>'source'; happened timestamptz; affected integer;
 txt text:=left(coalesce(p_event->>'body',''),16384);
begin
 select * into cfg from public.growth_wa_observer_config where workspace_id=p_workspace for update;
 if not found or not cfg.receiving_enabled then return jsonb_build_object('stored',false,'reason','disabled'); end if;
 if p_event->>'waba_id' is distinct from cfg.waba_id or p_event->>'phone_number_id' is distinct from cfg.phone_number_id then
  return jsonb_build_object('stored',false,'reason','configuration_changed');
 end if;
 if k is null or length(k)>600 or kind not in ('message','history_progress','account_update') then
  raise exception 'invalid_event';
 end if;
 if kind<>'message' then
  insert into public.growth_wa_observer_events(workspace_id,event_key,kind,detail)
   values(p_workspace,k,kind,p_event-'body'-'phone') on conflict do nothing;
  if kind='account_update' then
   update public.growth_wa_observer_config set receiving_enabled=false,coverage_gap=true,updated_at=now() where workspace_id=p_workspace;
  elsif coalesce((p_event->>'has_error')::boolean,false) then
   update public.growth_wa_observer_config set coverage_gap=true,updated_at=now() where workspace_id=p_workspace;
  end if;
  return jsonb_build_object('stored',true,'kind',kind);
 end if;
 if src not in ('messages','smb_message_echoes','history') or dir not in ('in','out')
   or nullif(ext,'') is null or k<>'message:'||ext or (p_event->>'timestamp') !~ '^[0-9]{1,12}$'
   or length(ext)>512 then raise exception 'invalid_message'; end if;
 if src='history' and not cfg.history_shared then return jsonb_build_object('stored',false,'reason','history_not_shared'); end if;
 happened:=to_timestamp((p_event->>'timestamp')::double precision);
 if happened>now()+interval '5 minutes' or happened<'2000-01-01'::timestamptz then raise exception 'invalid_timestamp'; end if;
 select array_agg(id) into candidates from public.growth_prospects
  where workspace_id=p_workspace and public.growth_wa_observer_phone(phone)=public.growth_wa_observer_phone(p_event->>'phone');
 if coalesce(cardinality(candidates),0)<>1 then
  if cardinality(candidates)>1 then
   update public.growth_wa_observer_config set coverage_gap=true,updated_at=now() where workspace_id=p_workspace;
  end if;
  return jsonb_build_object('stored',false,'reason','unknown_or_ambiguous_business');
 end if;
 select * into p from public.growth_prospects where workspace_id=p_workspace and id=candidates[1] for update;
 if jsonb_typeof(p.datos->'whatsapp_manual') is distinct from 'object' then
  return jsonb_build_object('stored',false,'reason','outside_manual_lists');
 end if;
 -- history.messages sólo completa un adjunto ya identificado, sin adivinar su dirección.
 if coalesce((p_event->>'media_update_only')::boolean,false) then
  update public.growth_wa_observer_events set body=txt,text_available=true,message_type=p_event->>'message_type'
   where workspace_id=p_workspace and event_key=k and prospect_id=p.id and kind='message'
     and not text_available and coalesce((p_event->>'text_available')::boolean,false);
  return jsonb_build_object('stored',true,'media_update',true);
 end if;
 insert into public.growth_wa_observer_events(workspace_id,event_key,kind,prospect_id,external_id,direction,source,body,message_type,text_available,occurred_at,detail)
 values(p_workspace,k,kind,p.id,ext,dir,src,txt,p_event->>'message_type',coalesce((p_event->>'text_available')::boolean,false),happened,
   jsonb_build_object('media_pending',coalesce((p_event->>'media_pending')::boolean,false),'waba_id',cfg.waba_id,'phone_number_id',cfg.phone_number_id))
 on conflict do nothing;
 get diagnostics affected=row_count;
 if affected=0 then
  update public.growth_wa_observer_events set body=txt,text_available=true,message_type=p_event->>'message_type'
   where workspace_id=p_workspace and event_key=k and prospect_id=p.id and direction=dir
    and not text_available and coalesce((p_event->>'text_available')::boolean,false);
  return jsonb_build_object('stored',false,'reason','duplicate');
 end if;
 -- Una baja real se conserva aun si ya existe una cuenta; nunca baja registered/activated.
 if dir='in' and (lower(trim(txt)) in ('no','baja','stop','cancelar')
   or lower(txt) ~ '(no me (escriban|contacten|manden)|darme de baja|dej(a|á|en) de escribirme)') then
  update public.growth_prospects set do_not_contact=true,consent='opt_out' where id=p.id and workspace_id=p_workspace;
 end if;
 insert into public.growth_timeline(workspace_id,prospect_id,type,title,detail,actor)
 values(p_workspace,p.id,'whatsapp_observado',case dir when 'in' then 'Mensaje de WhatsApp recibido por Meta' else 'Mensaje del celular observado por Meta' end,
  jsonb_build_object('event_key',k,'external_id',ext,'source',src,'occurred_at',happened),'system');
 perform public.growth_wa_observer_refresh(p_workspace,now(),p.id);
 return jsonb_build_object('stored',true,'prospect_id',p.id);
end; $$;
revoke all on function public.growth_wa_observer_ingest(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.growth_wa_observer_ingest(uuid,jsonb) to service_role;
