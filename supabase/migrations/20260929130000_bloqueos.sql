-- Bloquear usuarios desde el chat.
--
-- Apple lo exige en apps con conversaciones entre personas (guía 1.2), y
-- Google lo espera en apps con contenido de usuarios. Desde el chat, cualquiera
-- de las dos partes puede bloquear a la otra. A partir de ese momento, entre
-- esas dos personas:
--   * no se pueden mandar más mensajes, en ninguna de sus conversaciones;
--   * no se crean conexiones nuevas (ni el matching ni "Me interesa");
--   * los pedidos de una no le aparecen a la otra en "Pedidos para vos".
-- A quien bloquearon no se le dice que lo bloquearon: ve "Esta conversación
-- está cerrada". Quien bloqueó puede desbloquear desde el mismo chat.
--
-- La tabla no se lee ni se escribe directo desde la app: todo pasa por tres
-- funciones que resuelven quién es "el otro" a partir de la conversación, así
-- la app nunca necesita conocer el id de la otra persona.

create table if not exists public.bloqueos (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  bloqueador  uuid not null references auth.users(id) on delete cascade,
  bloqueado   uuid not null references auth.users(id) on delete cascade,
  match_id    bigint references public.matches(id) on delete set null,
  unique (bloqueador, bloqueado),
  check (bloqueador <> bloqueado)
);
create index if not exists bloqueos_bloqueado_idx on public.bloqueos (bloqueado);
alter table public.bloqueos enable row level security;
revoke all on public.bloqueos from anon, authenticated;

-- ¿Hay un bloqueo entre estas dos personas, en cualquier sentido?
create or replace function privado.hay_bloqueo(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from public.bloqueos x
     where (x.bloqueador = a and x.bloqueado = b) or (x.bloqueador = b and x.bloqueado = a));
$$;

-- Las dos partes de una conversación.
create or replace function privado.partes_del_match(mid bigint, out cliente uuid, out proveedor uuid)
language sql stable security definer set search_path = '' as $$
  select s.user_id, p.user_id
    from public.matches m
    join public.solicitudes s on s.id = m.solicitud_id
    join public.proveedores p on p.id = m.proveedor_id
   where m.id = mid;
$$;

-- ── Lo que usa la app ──
create or replace function public.bloquear_conversacion(mid bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare yo uuid := auth.uid(); c uuid; p uuid; otro uuid;
begin
  if yo is null then raise exception 'Tenés que iniciar sesión.'; end if;
  select x.cliente, x.proveedor into c, p from privado.partes_del_match(mid) x;
  if yo is distinct from c and yo is distinct from p then
    raise exception 'No sos parte de esta conversación.';
  end if;
  otro := case when yo = c then p else c end;
  if otro is null or otro = yo then return; end if;
  insert into public.bloqueos (bloqueador, bloqueado, match_id) values (yo, otro, mid)
  on conflict (bloqueador, bloqueado) do nothing;
end $$;

create or replace function public.desbloquear_conversacion(mid bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare yo uuid := auth.uid(); c uuid; p uuid;
begin
  if yo is null then raise exception 'Tenés que iniciar sesión.'; end if;
  select x.cliente, x.proveedor into c, p from privado.partes_del_match(mid) x;
  if yo is distinct from c and yo is distinct from p then
    raise exception 'No sos parte de esta conversación.';
  end if;
  delete from public.bloqueos
   where bloqueador = yo and bloqueado = case when yo = c then p else c end;
end $$;

-- Mis conversaciones cerradas por un bloqueo, y si el bloqueo lo hice yo.
create or replace function public.chats_bloqueados()
returns table (match_id bigint, bloqueaste boolean)
language sql stable security definer set search_path = '' as $$
  select m.id,
         exists (select 1 from public.bloqueos b
                  where b.bloqueador = (select auth.uid())
                    and b.bloqueado = case when s.user_id = (select auth.uid()) then p.user_id else s.user_id end)
    from public.matches m
    join public.solicitudes s on s.id = m.solicitud_id
    join public.proveedores p on p.id = m.proveedor_id
   where (s.user_id = (select auth.uid()) or p.user_id = (select auth.uid()))
     and privado.hay_bloqueo(s.user_id, p.user_id);
$$;

revoke all on function public.bloquear_conversacion(bigint), public.desbloquear_conversacion(bigint),
  public.chats_bloqueados() from public, anon;
grant execute on function public.bloquear_conversacion(bigint), public.desbloquear_conversacion(bigint),
  public.chats_bloqueados() to authenticated;

-- ── Efectos ──
-- 1) No más mensajes entre bloqueados, ni aceptar, rechazar o pagar un
--    presupuesto desde la app. Los cambios que hace el sistema (por ejemplo,
--    Mercado Pago confirmando un pago que ya estaba en curso) siguen pasando.
create or replace function privado.no_escribir_bloqueado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c uuid; p uuid;
begin
  if tg_op = 'UPDATE' and not privado.es_pedido_de_usuario() then return new; end if;
  select x.cliente, x.proveedor into c, p from privado.partes_del_match(new.match_id) x;
  if privado.hay_bloqueo(c, p) then
    raise exception 'LIMITE: Esta conversación está cerrada. No se pueden mandar más mensajes.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists no_escribir_bloqueado on public.mensajes;
create trigger no_escribir_bloqueado before insert or update on public.mensajes
  for each row execute function privado.no_escribir_bloqueado();

-- 2) No se crean conexiones nuevas entre bloqueados (se descartan en silencio,
--    igual que las que mezclan cuentas demo con reales).
create or replace function privado.no_conectar_bloqueados()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c uuid; p uuid;
begin
  select s.user_id into c from public.solicitudes s where s.id = new.solicitud_id;
  select x.user_id into p from public.proveedores x where x.id = new.proveedor_id;
  if privado.hay_bloqueo(c, p) then return null; end if;
  return new;
end $$;
drop trigger if exists a_no_conectar_bloqueados on public.matches;
drop trigger if exists a_no_conectar_bloqueados on public.interesados;
create trigger a_no_conectar_bloqueados before insert on public.matches
  for each row execute function privado.no_conectar_bloqueados();
create trigger a_no_conectar_bloqueados before insert on public.interesados
  for each row execute function privado.no_conectar_bloqueados();

-- 3) "Pedidos para vos": los pedidos de alguien bloqueado (o que te bloqueó)
--    no aparecen. Misma vista que antes, con una condición más.
create or replace view public.pedidos_abiertos with (security_invoker = off) as
 SELECT id,
    created_at,
    servicio_necesitado,
    zona,
    urgencia,
    descripcion,
    foto_url,
    presupuesto,
    cupo,
    ( SELECT count(*) AS count
           FROM interesados i
          WHERE (i.solicitud_id = s.id)) AS tomados
   FROM solicitudes s
  WHERE ((estado = 'pendiente'::text) AND (created_at > (now() - '15 days'::interval)) AND (user_id <> auth.uid())
    AND (s.demo = privado.soy_demo())
    AND (NOT (EXISTS ( SELECT 1 FROM bloqueos b
          WHERE ((b.bloqueador = s.user_id) AND (b.bloqueado = auth.uid()))
             OR ((b.bloqueador = auth.uid()) AND (b.bloqueado = s.user_id)))))
    AND (( SELECT count(*) AS count
           FROM interesados i
          WHERE (i.solicitud_id = s.id)) < cupo) AND (NOT (EXISTS ( SELECT 1
           FROM (interesados i
             JOIN proveedores p ON ((p.id = i.proveedor_id)))
          WHERE ((i.solicitud_id = s.id) AND (p.user_id = auth.uid()))))) AND (EXISTS ( SELECT 1
           FROM proveedores p
          WHERE ((p.user_id = auth.uid()) AND (p.rubro = s.servicio_necesitado)))));

revoke all on function privado.hay_bloqueo(uuid, uuid), privado.partes_del_match(bigint),
  privado.no_escribir_bloqueado(), privado.no_conectar_bloqueados() from public, anon, authenticated;

-- Reponer las cuentas demo también las desbloquea (un revisor puede probar
-- "Bloquear" y dejar la demo con un chat cerrado).
do $$
declare def text;
begin
  select pg_get_functiondef('privado.reponer_demo'::regproc) into def;
  if def not like '%public.bloqueos%' then
    def := replace(def,
      E'  -- ── Limpiar lo que haya de antes ──\n',
      E'  -- ── Limpiar lo que haya de antes ──\n  delete from public.bloqueos where bloqueador in (cli, tec, hum) or bloqueado in (cli, tec, hum);\n');
    execute def;
  end if;
end $$;
revoke all on function privado.reponer_demo() from public, anon, authenticated;
