-- Para cuándo y en qué horario (ideas del 28/10/2026, tomadas de Clickie):
-- el cliente elige "Lo necesito hoy", un rango o un día puntual, y la franja
-- (mañana, tarde o noche); quien cotiza dice en el presupuesto cuándo puede ir.
--
-- urgencia sigue siendo el texto que se lee en todos lados (el mail del
-- matching de n8n lo muestra tal cual): 'Hoy', 'Esta semana', 'Este mes',
-- 'Sin apuro' o 'Para el jue 30/10'. para_el guarda el día cuando hay uno, para
-- que "Hoy" no se siga leyendo "hoy" al día siguiente.

alter table public.solicitudes
 add column para_el date,
 add column franja text check(franja in('manana','tarde','noche')),
 add constraint solicitudes_para_el_rango check(para_el is null
   or para_el between (created_at - interval '2 days')::date and (created_at + interval '180 days')::date);

alter table public.mensajes
 add column visita_el date,
 add column visita_franja text check(visita_franja in('manana','tarde','noche')),
 add constraint mensajes_visita_el_rango check(visita_el is null
   or visita_el between (created_at - interval '2 days')::date and (created_at + interval '365 days')::date);

-- Lo que ve quien ofrece el servicio en "Pedidos abiertos": se suman al final.
create or replace view public.pedidos_abiertos with (security_invoker=off) as
 select s.id, s.created_at, s.servicio_necesitado, s.zona, s.urgencia, s.descripcion, s.foto_url,
  s.presupuesto, s.cupo,
  (select count(*) from public.interesados i where i.solicitud_id = s.id) as tomados,
  s.para_el, s.franja
 from public.solicitudes s
 where s.estado = 'pendiente' and s.created_at > now() - interval '15 days' and s.user_id <> auth.uid()
   and s.demo = privado.soy_demo()
   and not exists(select 1 from public.bloqueos b
                  where b.bloqueador = s.user_id and b.bloqueado = auth.uid()
                     or b.bloqueador = auth.uid() and b.bloqueado = s.user_id)
   and (select count(*) from public.interesados i where i.solicitud_id = s.id) < s.cupo
   and not exists(select 1 from public.interesados i join public.proveedores p on p.id = i.proveedor_id
                  where i.solicitud_id = s.id and p.user_id = auth.uid())
   and exists(select 1 from public.proveedores p where p.user_id = auth.uid() and p.rubro = s.servicio_necesitado);

-- Igual que antes, más los dos datos nuevos del presupuesto: no se mandan en un
-- mensaje de texto y no se cambian después de enviado.
create or replace function public.proteger_mensajes()
returns trigger language plpgsql set search_path='' as $$
declare es_cliente boolean; es_proveedor boolean;
begin
  -- n8n (service_role) y las funciones SECURITY DEFINER no pasan por estas reglas.
  -- Se mira current_user y no auth.role(): dentro de sumar_trabajo() auth.role()
  -- sigue diciendo 'authenticated' y bloquearia la suma legitima de trabajos.
  if current_user not in ('authenticated', 'anon') then return new; end if;
  select coalesce(bool_or(s.user_id = auth.uid()), false), coalesce(bool_or(p.user_id = auth.uid()), false)
    into es_cliente, es_proveedor
  from public.matches m
  left join public.solicitudes s on s.id = m.solicitud_id
  left join public.proveedores p on p.id = m.proveedor_id
  where m.id = new.match_id;
  if tg_op = 'INSERT' then
    new.pago_estado := null; new.pago_id := null; new.trabajo_estado := null;
    new.jurisdiccion_proveedor := null; new.jurisdiccion_trabajo := null;
    new.zona_proveedor := null; new.zona_trabajo := null;
    if new.tipo = 'presupuesto' then
      if not es_proveedor then raise exception 'Solo el proveedor puede mandar un presupuesto.'; end if;
      new.remitente_tipo := 'proveedor'; new.estado_presupuesto := 'pendiente';
    elsif new.tipo = 'texto' then
      new.estado_presupuesto := null; new.monto := null; new.incluye := null; new.plazo := null;
      new.visita_el := null; new.visita_franja := null;
      if es_cliente and not es_proveedor then new.remitente_tipo := 'cliente';
      elsif es_proveedor and not es_cliente then new.remitente_tipo := 'proveedor'; end if;
    else raise exception 'Tipo de mensaje no permitido.'; end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at
     or new.match_id is distinct from old.match_id or new.remitente_tipo is distinct from old.remitente_tipo
     or new.tipo is distinct from old.tipo or new.contenido is distinct from old.contenido
     or new.monto is distinct from old.monto or new.incluye is distinct from old.incluye
     or new.plazo is distinct from old.plazo or new.pago_estado is distinct from old.pago_estado
     or new.pago_id is distinct from old.pago_id
     or new.jurisdiccion_proveedor is distinct from old.jurisdiccion_proveedor
     or new.jurisdiccion_trabajo is distinct from old.jurisdiccion_trabajo
     or new.zona_proveedor is distinct from old.zona_proveedor or new.zona_trabajo is distinct from old.zona_trabajo
     or new.visita_el is distinct from old.visita_el or new.visita_franja is distinct from old.visita_franja
  then raise exception 'No se puede modificar un mensaje ya enviado.'; end if;
  if new.estado_presupuesto is distinct from old.estado_presupuesto then
    if not es_cliente then raise exception 'Solo el cliente puede aceptar o rechazar el presupuesto.'; end if;
    if old.tipo <> 'presupuesto' or old.estado_presupuesto is distinct from 'pendiente'
       or new.estado_presupuesto not in ('aceptado', 'rechazado') then
      raise exception 'Ese presupuesto ya no se puede responder.'; end if;
  end if;
  if new.trabajo_estado is distinct from old.trabajo_estado then
    if not es_proveedor then raise exception 'Solo el proveedor puede marcar el trabajo como terminado.'; end if;
    if old.tipo <> 'presupuesto' or new.estado_presupuesto is distinct from 'aceptado'
       or old.trabajo_estado is not null or new.trabajo_estado is distinct from 'terminado' then
      raise exception 'Ese trabajo no se puede marcar como terminado.'; end if;
  end if;
  return new;
end; $$;
