-- Topes anti-abuso por usuario, en la base (no se pueden saltear desde el
-- cliente). Solo aplican a pedidos que llegan por la API con sesión de
-- usuario (rol authenticated/anon). n8n (service_role), las tareas
-- programadas y el panel de Supabase quedan exentos.
--
-- Cuando se pasa un tope, el error es "LIMITE: <texto>" y la app muestra ese
-- texto tal cual (limiteDe() en index.html).
--
-- Topes elegidos (holgados para un uso normal; ajustables acá):
--   solicitudes      5 por día           (la auditoría lo pedía explícito)
--   proveedores      5 por día           (servicios publicados)
--   publicaciones   10 por día
--   credenciales    20 por día
--   interesados     30 por día           (proveedor que se anota a pedidos)
--   mensajes        20 por minuto por conversación (texto y presupuestos)
--   visitas_perfil  1 por hora por visitante y perfil: la repetida se descarta
--                   en silencio (no es un error para la persona).
--   fotos (Storage) 20 por día y 150 en total por usuario; tope por archivo
--                   2 MB (la app las achica a 1280 px, pesan ~150-400 KB).

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- ¿El pedido viene de un usuario por la API? (y no de n8n, cron o el panel)
create or replace function privado.es_pedido_de_usuario()
returns boolean language sql stable set search_path = '' as $$
  select session_user = 'authenticator'
     and coalesce(auth.role(), 'anon') in ('authenticated', 'anon');
$$;

-- Trigger genérico: args = (tope, ventana, columna_del_usuario, texto)
create or replace function privado.limitar_por_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tope     int      := tg_argv[0]::int;
  ventana  interval := tg_argv[1]::interval;
  columna  text     := tg_argv[2];
  texto    text     := tg_argv[3];
  quien    uuid;
  cuantos  int;
begin
  if not privado.es_pedido_de_usuario() then return new; end if;
  quien := auth.uid();
  if quien is null then return new; end if;   -- sin sesión ya lo frena RLS
  -- serializa los inserts del mismo usuario en la misma tabla: el tope es exacto
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || quien::text, 0));
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2',
                 tg_table_name, columna)
     into cuantos using quien, ventana;
  if cuantos >= tope then
    raise exception 'LIMITE: %', texto using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function privado.limitar_mensajes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cuantos int;
begin
  if not privado.es_pedido_de_usuario() then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('mensajes:' || coalesce(new.match_id, 0)::text, 0));
  select count(*) into cuantos from public.mensajes
   where match_id = new.match_id and created_at > now() - interval '1 minute';
  if cuantos >= 20 then
    raise exception 'LIMITE: %', 'Estás mandando muchos mensajes seguidos. Esperá un minuto y volvé a intentar.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function privado.visita_sin_repetir()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_pedido_de_usuario() then return new; end if;
  if exists (select 1 from public.visitas_perfil
              where perfil_user_id = new.perfil_user_id
                and visitante is not distinct from new.visitante
                and created_at > now() - interval '1 hour') then
    return null;   -- ya contada en la última hora: se descarta sin error
  end if;
  return new;
end $$;

-- Las funciones de trigger no se llaman directo; privado no está expuesto
-- por la API, pero igual se cierra EXECUTE.
revoke all on all functions in schema privado from public, anon, authenticated;
grant usage on schema privado to anon, authenticated;
grant execute on function privado.es_pedido_de_usuario() to anon, authenticated;

create trigger limite_solicitudes before insert on public.solicitudes for each row
  execute function privado.limitar_por_usuario('5', '1 day', 'user_id',
    'Ya hiciste 5 pedidos en las últimas 24 horas. Vas a poder hacer otro mañana.');
create trigger limite_proveedores before insert on public.proveedores for each row
  execute function privado.limitar_por_usuario('5', '1 day', 'user_id',
    'Ya publicaste 5 servicios hoy. Vas a poder publicar otro mañana.');
create trigger limite_publicaciones before insert on public.publicaciones for each row
  execute function privado.limitar_por_usuario('10', '1 day', 'user_id',
    'Ya hiciste 10 publicaciones hoy. Vas a poder publicar otra mañana.');
create trigger limite_credenciales before insert on public.credenciales for each row
  execute function privado.limitar_por_usuario('20', '1 day', 'user_id',
    'Ya cargaste 20 antecedentes hoy. Seguí mañana.');
create trigger limite_interesados before insert on public.interesados for each row
  execute function privado.limitar_por_usuario('30', '1 day', 'user_id',
    'Ya te anotaste a 30 pedidos hoy. Vas a poder anotarte a más mañana.');
create trigger limite_mensajes before insert on public.mensajes for each row
  execute function privado.limitar_mensajes();
create trigger limite_visitas before insert on public.visitas_perfil for each row
  execute function privado.visita_sin_repetir();

-- ── Fotos (Storage) ──────────────────────────────────────────────────────
create or replace function privado.fotos_permitidas(quien uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select count(*) filter (where created_at > now() - interval '1 day') < 20
     and count(*) < 150
    from storage.objects
   where bucket_id = 'publicaciones' and name like quien::text || '/%';   -- su carpeta
$$;
revoke all on function privado.fotos_permitidas(uuid) from public;
grant execute on function privado.fotos_permitidas(uuid) to authenticated;

drop policy "subo mis fotos" on storage.objects;
create policy "subo mis fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'publicaciones'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and privado.fotos_permitidas((select auth.uid())));

update storage.buckets set file_size_limit = 2097152 where id = 'publicaciones';
