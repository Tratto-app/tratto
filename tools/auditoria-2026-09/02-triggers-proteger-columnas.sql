-- Corrige P-01 y P-02 SI el resultado de 01-verificar-potenciales.sql muestra
-- que hoy no hay ningun trigger ni permiso por columna protegiendo estas dos
-- tablas (o sea: un UPDATE de authenticated que pase el WITH CHECK de RLS
-- puede tocar cualquier columna, no solo la que la app usa).
--
-- Si 01 ya muestra un trigger o un permiso por columna equivalente, NO
-- corras esto: revisa primero que cubra los mismos casos para no duplicar
-- logica que despues hay que mantener en dos lugares.
--
-- Que arregla:
--   P-01 (CRITICAL si se confirma) - un cliente podria, con un PATCH directo
--     a /rest/v1/mensajes, bajar el monto de un presupuesto ya aceptado antes
--     de pagarlo (n8n cobra leyendo esa columna), o el proveedor podria
--     marcar su propio presupuesto como aceptado.
--   P-02 (HIGH si se confirma) - el proveedor hace upsert directo de
--     perfil_proveedor (index.html linea ~3929) y podria escribir
--     trabajos_hechos con cualquier numero y autoasignarse una medalla que
--     no gano.
--
-- Los triggers dejan pasar el INSERT normal de la app (que no toca estas
-- columnas) y solo rechazan un UPDATE que intente cambiarlas desde afuera.
-- service_role (n8n) sigue pudiendo escribir todo, porque estos triggers
-- excluyen explicitamente ese rol.

begin;

-- ============================================================
-- mensajes: protege monto/incluye/plazo/contenido, y limita quien puede
-- mover cada maquina de estados
-- ============================================================
create or replace function public.proteger_mensajes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- service_role (n8n) hace lo que necesite; esto es solo para authenticated.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.monto     is distinct from old.monto
     or new.incluye  is distinct from old.incluye
     or new.plazo    is distinct from old.plazo
     or new.contenido is distinct from old.contenido
     or new.remitente_tipo is distinct from old.remitente_tipo
     or new.match_id is distinct from old.match_id
     or new.tipo     is distinct from old.tipo
  then
    raise exception 'No se puede modificar un mensaje ya enviado.';
  end if;

  -- estado_presupuesto: solo el CLIENTE del match, y solo desde 'pendiente'
  if new.estado_presupuesto is distinct from old.estado_presupuesto then
    if old.estado_presupuesto <> 'pendiente' then
      raise exception 'Ese presupuesto ya no esta pendiente.';
    end if;
    if not exists (
      select 1 from public.matches m
      join public.solicitudes s on s.id = m.solicitud_id
      where m.id = new.match_id and s.user_id = auth.uid()
    ) then
      raise exception 'Solo el cliente puede aceptar o rechazar el presupuesto.';
    end if;
  end if;

  -- trabajo_estado: solo el PROVEEDOR del match
  if new.trabajo_estado is distinct from old.trabajo_estado then
    if not exists (
      select 1 from public.matches m
      join public.proveedores p on p.id = m.proveedor_id
      where m.id = new.match_id and p.user_id = auth.uid()
    ) then
      raise exception 'Solo el proveedor puede marcar el trabajo como terminado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_mensajes on public.mensajes;
create trigger proteger_mensajes
  before update on public.mensajes
  for each row
  execute function public.proteger_mensajes();

-- ============================================================
-- perfil_proveedor: el upsert de la app (index.html linea ~3929) escribe
-- titular/bio/anios_exp/web. trabajos_hechos no deberia poder tocarlo un
-- authenticated bajo ninguna circunstancia.
-- ============================================================
create or replace function public.proteger_perfil_proveedor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.trabajos_hechos := old.trabajos_hechos;  -- el upsert de la app nunca lo manda; esto cubre si algun dia lo manda
  else
    new.trabajos_hechos := 0;  -- un perfil nuevo siempre arranca sin trabajos
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfil_proveedor on public.perfil_proveedor;
create trigger proteger_perfil_proveedor
  before insert or update on public.perfil_proveedor
  for each row
  execute function public.proteger_perfil_proveedor();

commit;

-- ============================================================
-- Verificacion (correr como usuario autenticado de prueba, o simulando con
-- `set local role authenticated; set local request.jwt.claims...`):
--
--   1. Un cliente intenta: update mensajes set monto = 1 where id = <un_id>;
--      -> debe fallar con la excepcion, no con un 42501 generico de RLS.
--   2. Un proveedor intenta: update perfil_proveedor set trabajos_hechos = 999
--      where user_id = auth.uid();
--      -> debe ejecutar sin error, pero trabajos_hechos NO cambia.
--   3. El flujo normal de la app (aceptar presupuesto como cliente, marcar
--      terminado como proveedor, guardar bio en editar-perfil) sigue
--      funcionando igual que antes.
-- ============================================================
