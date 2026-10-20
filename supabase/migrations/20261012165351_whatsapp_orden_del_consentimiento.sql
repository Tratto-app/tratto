-- Un opt-in viejo no puede reactivar un teléfono después de una baja más nueva.
create or replace function public.growth_wa_event(p_workspace uuid,p_event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ph text; kind text; txt text; eid text; changed integer; job public.growth_wa_queue; cid uuid; new_consent text; old_status text; event_at timestamptz:=now();
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
    if coalesce(p_event->>'timestamp','') ~ '^[0-9]{10}$' then event_at:=to_timestamp((p_event->>'timestamp')::double precision); end if;
    new_consent:=case when upper(trim(txt)) in ('BAJA','NO','STOP') or upper(txt) ~ '(DARME DE BAJA|DAME DE BAJA|NO QUIERO|NO ME (ESCRIB|MAND|ENV|CONTACT)|NO (ESCRIBAN|MANDEN|ENV[IÍ]EN|CONTACTEN)|BORR[AÁ]ME|ELIMIN[AÁ]ME)' then 'opt_out'
      when upper(trim(txt))='QUIERO RECIBIR INVITACIONES DE TRATTO POR WHATSAPP' then 'opt_in' else 'pending' end;
    if new_consent<>'pending' then
      insert into public.growth_wa_contacts(workspace_id,phone,consent,consent_proof)
        values(p_workspace,ph,new_consent,jsonb_build_object('verified_webhook',true,'message_id',eid,'text',txt,'at',event_at,'received_at',now()))
      on conflict(workspace_id,phone) do update set consent=excluded.consent,consent_proof=excluded.consent_proof,updated_at=now()
      where coalesce((excluded.consent_proof->>'at')::timestamptz,'-infinity'::timestamptz)>coalesce((public.growth_wa_contacts.consent_proof->>'at')::timestamptz,'-infinity'::timestamptz)
        or (excluded.consent='opt_out' and coalesce((excluded.consent_proof->>'at')::timestamptz,'-infinity'::timestamptz)>=coalesce((public.growth_wa_contacts.consent_proof->>'at')::timestamptz,'-infinity'::timestamptz));
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
