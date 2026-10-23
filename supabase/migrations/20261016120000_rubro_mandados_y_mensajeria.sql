-- El rubro "Mandados y compras" pasa a llamarse "Mandados y mensajería"
-- (pedido del fundador, 16/10/2026): las cadeterías y mensajerías se
-- presentan así y no se reconocían en "compras".
--
-- Igual que en la unificación de rubros del 30/09 (20260930120000), el nombre
-- cambia en todos los lugares donde se guarda a la vez, para que los pedidos
-- y quienes ofrecen el servicio sigan coincidiendo: servicios (proveedores),
-- pedidos (solicitudes), el rubro guardado en la cuenta, los precios de
-- referencia, las respuestas de la calculadora, el CRM y la rotación de los
-- mails a quienes ofrecen servicios.
--
-- Mientras alguien tenga abierta una versión vieja de la web (o el tasador de
-- n8n todavía diga el nombre viejo), los servicios y pedidos nuevos podrían
-- llegar con "Mandados y compras". Un trigger los guarda con el nombre nuevo.
--
-- Estas actualizaciones no disparan avisos ni matching (esos triggers son
-- solo de INSERT). Se puede correr más de una vez.

update public.proveedores set rubro = 'Mandados y mensajería' where rubro = 'Mandados y compras';
update public.solicitudes set servicio_necesitado = 'Mandados y mensajería' where servicio_necesitado = 'Mandados y compras';
update auth.users
   set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('rubro', 'Mandados y mensajería')
 where raw_user_meta_data->>'rubro' = 'Mandados y compras';
update public.precios_referencia set rubro = 'Mandados y mensajería' where rubro = 'Mandados y compras';
update public.calculadora_respuestas set rubro = 'Mandados y mensajería' where rubro = 'Mandados y compras';
update public.growth_prospects set rubro = 'Mandados y mensajería' where rubro = 'Mandados y compras';
update public.growth_mkt_rotacion
   set rubro = 'Mandados y mensajería',
       busquedas = case when 'mensajería' = any(busquedas) then busquedas else busquedas || array['mensajería'] end
 where rubro = 'Mandados y compras';

-- Red de seguridad para lo que llegue con el nombre viejo.
create or replace function public.rubro_nombre_actual()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'proveedores' then
    if new.rubro = 'Mandados y compras' then new.rubro := 'Mandados y mensajería'; end if;
  elsif tg_table_name = 'solicitudes' then
    if new.servicio_necesitado = 'Mandados y compras' then new.servicio_necesitado := 'Mandados y mensajería'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.rubro_nombre_actual() from public, anon, authenticated;

create or replace trigger rubro_nombre_actual before insert or update of rubro on public.proveedores
  for each row execute function public.rubro_nombre_actual();

create or replace trigger rubro_nombre_actual before insert or update of servicio_necesitado on public.solicitudes
  for each row execute function public.rubro_nombre_actual();
