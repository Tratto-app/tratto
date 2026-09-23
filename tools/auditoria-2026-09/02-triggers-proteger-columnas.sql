-- Corrige P-01 y P-02 (confirmados el 23/09/2026 leyendo la base):
--
--   P-01 (CRITICAL) - la politica msg_editar deja a cualquiera de los dos
--     participantes de un chat modificar CUALQUIER columna de cualquier
--     mensaje del chat, y authenticated tiene UPDATE sobre todas. Un cliente
--     podia bajar el monto de un presupuesto aceptado antes de pagar, o poner
--     pago_estado = 'cobrado' sin pagar (y el proveedor recibia el push "Te
--     pagaron"). El proveedor podia aceptar su propio presupuesto. Y por
--     msg_crear, cualquiera podia INSERTAR un presupuesto ya aceptado/cobrado.
--   P-02 (HIGH) - authenticated tiene UPDATE sobre perfil_proveedor.
--     trabajos_hechos, y "edito mi perfil" deja editar la fila propia: un
--     proveedor podia ponerse cualquier numero de trabajos y la medalla que
--     quisiera. Ademas, como sumar_trabajo() suma 1 cada vez que un
--     presupuesto pasa a 'aceptado', el proveedor podia alternar
--     pendiente/aceptado sobre su propio presupuesto y sumar sin limite.
--
-- Quien queda afuera de estas reglas: todo lo que NO corre como
-- authenticated/anon. Eso incluye a n8n (service_role) y a las funciones
-- SECURITY DEFINER de la base (sumar_trabajo, abrir_chat_al_interesarse...),
-- que corren como su duenio. Por eso se mira current_user y NO auth.role():
-- dentro de sumar_trabajo, auth.role() sigue diciendo 'authenticated' y la
-- suma legitima de trabajos quedaria bloqueada.
--
-- Lo que la app hace hoy (index.html) y sigue funcionando igual:
--   INSERT texto:        match_id, remitente_tipo, contenido, leido
--   INSERT presupuesto:  el proveedor, tipo, monto, incluye, plazo, 'pendiente'
--   UPDATE cliente:      estado_presupuesto pendiente -> aceptado | rechazado
--   UPDATE proveedor:    trabajo_estado -> 'terminado' (presupuesto aceptado)
-- pago_estado, pago_id, jurisdiccion_* y zona_* los escribe solo n8n. Si un
-- workflow de n8n los escribia con el token del usuario en vez de la
-- service_role, desde ahora va a fallar: tiene que usar la service_role
-- (que ya necesita de todos modos para leer cuentas_mp).

begin;

create or replace function public.proteger_mensajes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  es_cliente   boolean;
  es_proveedor boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select
    coalesce(bool_or(s.user_id = auth.uid()), false),
    coalesce(bool_or(p.user_id = auth.uid()), false)
  into es_cliente, es_proveedor
  from public.matches m
  left join public.solicitudes s on s.id = m.solicitud_id
  left join public.proveedores p on p.id = m.proveedor_id
  where m.id = new.match_id;

  if tg_op = 'INSERT' then
    -- Lo que solo puede escribir n8n arranca siempre vacio.
    new.pago_estado := null;
    new.pago_id := null;
    new.trabajo_estado := null;
    new.jurisdiccion_proveedor := null;
    new.jurisdiccion_trabajo := null;
    new.zona_proveedor := null;
    new.zona_trabajo := null;

    if new.tipo = 'presupuesto' then
      if not es_proveedor then
        raise exception 'Solo el proveedor puede mandar un presupuesto.';
      end if;
      new.remitente_tipo := 'proveedor';
      new.estado_presupuesto := 'pendiente';
    elsif new.tipo = 'texto' then
      new.estado_presupuesto := null;
      new.monto := null;
      new.incluye := null;
      new.plazo := null;
      -- El remitente es el que sos en este match, no el que digas ser.
      if es_cliente and not es_proveedor then
        new.remitente_tipo := 'cliente';
      elsif es_proveedor and not es_cliente then
        new.remitente_tipo := 'proveedor';
      end if;
    else
      raise exception 'Tipo de mensaje no permitido.';
    end if;
    return new;
  end if;

  -- UPDATE: lo ya enviado no se toca.
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.match_id is distinct from old.match_id
     or new.remitente_tipo is distinct from old.remitente_tipo
     or new.tipo is distinct from old.tipo
     or new.contenido is distinct from old.contenido
     or new.monto is distinct from old.monto
     or new.incluye is distinct from old.incluye
     or new.plazo is distinct from old.plazo
     or new.pago_estado is distinct from old.pago_estado
     or new.pago_id is distinct from old.pago_id
     or new.jurisdiccion_proveedor is distinct from old.jurisdiccion_proveedor
     or new.jurisdiccion_trabajo is distinct from old.jurisdiccion_trabajo
     or new.zona_proveedor is distinct from old.zona_proveedor
     or new.zona_trabajo is distinct from old.zona_trabajo
  then
    raise exception 'No se puede modificar un mensaje ya enviado.';
  end if;

  if new.estado_presupuesto is distinct from old.estado_presupuesto then
    if not es_cliente then
      raise exception 'Solo el cliente puede aceptar o rechazar el presupuesto.';
    end if;
    if old.tipo <> 'presupuesto'
       or old.estado_presupuesto is distinct from 'pendiente'
       or new.estado_presupuesto not in ('aceptado', 'rechazado') then
      raise exception 'Ese presupuesto ya no se puede responder.';
    end if;
  end if;

  if new.trabajo_estado is distinct from old.trabajo_estado then
    if not es_proveedor then
      raise exception 'Solo el proveedor puede marcar el trabajo como terminado.';
    end if;
    if old.tipo <> 'presupuesto'
       or new.estado_presupuesto is distinct from 'aceptado'
       or old.trabajo_estado is not null
       or new.trabajo_estado is distinct from 'terminado' then
      raise exception 'Ese trabajo no se puede marcar como terminado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_mensajes on public.mensajes;
create trigger proteger_mensajes
  before insert or update on public.mensajes
  for each row execute function public.proteger_mensajes();


create or replace function public.proteger_perfil_proveedor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;  -- sumar_trabajo() y n8n
  end if;
  if tg_op = 'UPDATE' then
    new.trabajos_hechos := old.trabajos_hechos;
  else
    new.trabajos_hechos := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfil_proveedor on public.perfil_proveedor;
create trigger proteger_perfil_proveedor
  before insert or update on public.perfil_proveedor
  for each row execute function public.proteger_perfil_proveedor();

commit;
