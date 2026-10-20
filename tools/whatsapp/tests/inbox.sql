\set ON_ERROR_STOP on
begin;
-- Simular el trigger de Inbox existente que cambia estado al recibir respuesta.
create function public.test_message_status() returns trigger language plpgsql as $$ begin
 if new.direction='in' then update public.growth_prospects set status='replied' where id=new.prospect_id; end if;
 return new;
end $$;
create trigger test_message_status after insert on public.growth_messages for each row execute function public.test_message_status();
set local role service_role;
do $$ declare ws uuid:='00000000-0000-4000-8000-000000000001';pid uuid:='00000000-0000-4000-8000-000000000011';
begin
  perform public.growth_wa_event(ws,'{"key":"signed-optin","kind":"message","phone":"5491100000001","body":"QUIERO RECIBIR INVITACIONES DE TRATTO POR WHATSAPP"}');
  perform public.growth_wa_enqueue(ws,pid);
  update public.growth_prospects set status='registered' where id=pid;
  perform public.growth_wa_event(ws,'{"key":"reply-registered","kind":"message","phone":"5491100000001","body":"Ya me registré"}');
  if (select status from public.growth_prospects where id=pid)<>'registered' then raise exception 'Inbox overwrote registered'; end if;
  perform public.growth_wa_event(ws,'{"key":"natural-optout","kind":"message","phone":"5491100000001","body":"Hola, por favor no me escriban más"}');
  if (select consent from public.growth_wa_contacts where workspace_id=ws and phone='5491100000001')<>'opt_out' then raise exception 'natural opt-out ignored'; end if;
  if (select status from public.growth_prospects where id=pid)<>'registered' then raise exception 'opt-out overwrote registered'; end if;
  perform public.growth_wa_event(ws,'{"key":"new-baja-order","kind":"message","phone":"5491100000003","body":"BAJA","timestamp":"1790000002"}');
  perform public.growth_wa_event(ws,'{"key":"old-optin-order","kind":"message","phone":"5491100000003","body":"QUIERO RECIBIR INVITACIONES DE TRATTO POR WHATSAPP","timestamp":"1790000001"}');
  if (select consent from public.growth_wa_contacts where workspace_id=ws and phone='5491100000003')<>'opt_out' then raise exception 'old opt-in reversed newer unsubscribe'; end if;
  raise notice 'PASS: registered preserved against Inbox trigger; natural opt-out blocked';
end $$;
rollback;
