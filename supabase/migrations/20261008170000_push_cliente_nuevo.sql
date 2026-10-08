-- Aviso al celular del proveedor cuando le llega un cliente.
-- Aplicada en producción el 8/10/2026.
--
-- Hasta ahora, cuando el matching (n8n "Matching automatico + avisos") conecta
-- un pedido con un proveedor, al proveedor le llegaba solo un mail. Con esto
-- también le llega una notificación al celular ("Te llegó un cliente"), si la
-- activó. Va solo por push (canal 'push'): el mail ya lo manda n8n.
-- Es un aviso de servicio, como "te aceptaron un presupuesto": no depende del
-- permiso de publicidad. Las cuentas y los pedidos demo no reciben nada, y si
-- algo falla el match se crea igual.

create or replace function public.notificar_cliente_nuevo_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  destinatario uuid;
  rubro text;
  zona text;
  pedido_demo boolean;
  secreto text;
begin
  select p.user_id, s.servicio_necesitado, s.zona, coalesce(s.demo, false) or coalesce(p.demo, false)
    into destinatario, rubro, zona, pedido_demo
    from public.solicitudes s, public.proveedores p
   where s.id = new.solicitud_id and p.id = new.proveedor_id;

  if destinatario is null or pedido_demo or privado.es_demo(destinatario) then
    return new;
  end if;

  select decrypted_secret into secreto
    from vault.decrypted_secrets where name = 'push_firma_quick_service';
  if secreto is null then return new; end if;

  perform net.http_post(
    url     := 'https://qglsonbcsncgekzbfafk.supabase.co/functions/v1/quick-service',
    body    := jsonb_build_object(
                 'user_id', destinatario,
                 'titulo',  'Te llegó un cliente',
                 'cuerpo',  'Alguien busca ' || coalesce(rubro, 'un servicio')
                            || coalesce(' en ' || zona, '') || '. Mandale tu presupuesto.',
                 'url',     '/',
                 'tipo',    'servicio',
                 'canal',   'push'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tratto-firma', secreto));
  return new;
exception when others then
  return new;  -- el match nunca se pierde por el aviso
end $$;

revoke all on function public.notificar_cliente_nuevo_push() from public, anon, authenticated;

drop trigger if exists matches_notificar_push on public.matches;
create trigger matches_notificar_push after insert on public.matches
  for each row execute function public.notificar_cliente_nuevo_push();
