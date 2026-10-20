-- Bajas en lenguaje natural y conservación de registered/activated al recibir mensajes.
create or replace function public.growth_wa_event(p_workspace uuid,p_event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ph text; kind text; txt text; eid text; changed integer; job public.growth_wa_queue; cid uuid; new_consent text; old_status text;
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
    new_consent:=case when upper(trim(txt)) in ('BAJA','NO','STOP') or upper(txt) ~ '(DARME DE BAJA|DAME DE BAJA|NO QUIERO|NO ME (ESCRIB|MAND|ENV|CONTACT)|NO (ESCRIBAN|MANDEN|ENV[IÍ]EN|CONTACTEN)|BORR[AÁ]ME|ELIMIN[AÁ]ME)' then 'opt_out'
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
      select status into old_status from public.growth_prospects where id=job.prospect_id and workspace_id=p_workspace;
      select id into cid from public.growth_conversations where workspace_id=p_workspace and prospect_id=job.prospect_id and channel='whatsapp';
      if cid is null then insert into public.growth_conversations(workspace_id,prospect_id,channel) values(p_workspace,job.prospect_id,'whatsapp') returning id into cid; end if;
      insert into public.growth_messages(workspace_id,conversation_id,prospect_id,direction,channel,body,status,provider,external_id)
        values(p_workspace,cid,job.prospect_id,'in','whatsapp',txt,'received','whatsapp_cloud',eid);
      if old_status in ('registered','activated') then
        update public.growth_prospects set status=old_status where id=job.prospect_id and workspace_id=p_workspace;
      end if;
    end if;
  elsif kind='status' then
    perform public.growth_wa_apply_status(p_workspace,eid,p_event->>'status',p_event->>'error');
  end if;
  return jsonb_build_object('ok',true,'new',true);
end $$;

create or replace function public.growth_wa_qualify(p_workspace uuid,p_phone text,p_company text,p_name text,p_email text,p_rubro text,p_zone text,p_city text,p_source text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ph text:=public.growth_wa_phone(p_phone); pid uuid; source uuid;
begin
  perform 1 from public.growth_wa_config where workspace_id=p_workspace for update;
  if ph !~ '^549[0-9]{10}$' or p_zone is null or p_zone not in ('CABA','GBA Norte','GBA Oeste','GBA Sur','Buenos Aires (interior)')
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
