-- Cuentas demo: para los revisores de Apple y Google y para filmar la app.
--
-- Una cuenta es demo si su app_metadata tiene "demo": true. Eso solo se puede
-- poner desde la base o el panel de Supabase (el usuario no puede tocar su
-- app_metadata). Los pedidos y servicios de una cuenta demo:
--   * no disparan el matching de n8n, y el matching nunca los ofrece como
--     candidatos a cuentas reales (filtro demo=eq.false en n8n);
--   * no aparecen en el feed de pedidos abiertos de proveedores reales, y los
--     proveedores demo solo ven pedidos demo;
--   * no se vencen a los 15 días ni cuentan para reintentos ni alertas;
--   * nunca generan notificaciones (push ni mail).
-- Seguro extra: la base descarta cualquier conexión (matches / interesados)
-- que mezcle una cuenta demo con una real.
-- Los datos demo se crean y se reponen con privado.reponer_demo().

create schema if not exists privado;

create or replace function privado.es_demo(quien uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (u.raw_app_meta_data->>'demo')::boolean from auth.users u where u.id = quien), false);
$$;
revoke all on function privado.es_demo(uuid) from public, anon, authenticated;

-- Para la vista del feed: Postgres chequea el permiso de las funciones con el
-- usuario que consulta (aunque la vista corra con permisos del dueño), así que
-- el feed usa esta, que solo responde sobre uno mismo.
create or replace function privado.soy_demo()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.es_demo(auth.uid());
$$;

alter table public.solicitudes add column if not exists demo boolean not null default false;
alter table public.proveedores add column if not exists demo boolean not null default false;

-- La marca sale siempre de la cuenta; lo que mande el cliente se ignora.
create or replace function privado.marcar_demo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.demo := privado.es_demo(new.user_id);
  return new;
end $$;
drop trigger if exists a_marcar_demo on public.solicitudes;
drop trigger if exists a_marcar_demo on public.proveedores;
create trigger a_marcar_demo before insert or update of user_id, demo on public.solicitudes
  for each row execute function privado.marcar_demo();
create trigger a_marcar_demo before insert or update of user_id, demo on public.proveedores
  for each row execute function privado.marcar_demo();

-- Seguro: ninguna conexión mezcla demo con real (se descarta en silencio).
create or replace function privado.no_mezclar_demo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ds boolean; dp boolean;
begin
  select demo into ds from public.solicitudes where id = new.solicitud_id;
  select demo into dp from public.proveedores where id = new.proveedor_id;
  if coalesce(ds, false) <> coalesce(dp, false) then return null; end if;
  return new;
end $$;
drop trigger if exists a_no_mezclar_demo on public.matches;
drop trigger if exists a_no_mezclar_demo on public.interesados;
create trigger a_no_mezclar_demo before insert on public.matches
  for each row execute function privado.no_mezclar_demo();
create trigger a_no_mezclar_demo before insert on public.interesados
  for each row execute function privado.no_mezclar_demo();

revoke all on all functions in schema privado from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_proc where proname = 'fotos_permitidas' and pronamespace = 'privado'::regnamespace) then
    grant execute on function privado.fotos_permitidas(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_proc where proname = 'es_pedido_de_usuario' and pronamespace = 'privado'::regnamespace) then
    grant execute on function privado.es_pedido_de_usuario() to anon, authenticated;
  end if;
  grant execute on function privado.soy_demo() to authenticated;
end $$;

-- Feed de pedidos abiertos: cada uno ve solo los de su mundo (demo o real).
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
    AND (( SELECT count(*) AS count
           FROM interesados i
          WHERE (i.solicitud_id = s.id)) < cupo) AND (NOT (EXISTS ( SELECT 1
           FROM (interesados i
             JOIN proveedores p ON ((p.id = i.proveedor_id)))
          WHERE ((i.solicitud_id = s.id) AND (p.user_id = auth.uid()))))) AND (EXISTS ( SELECT 1
           FROM proveedores p
          WHERE ((p.user_id = auth.uid()) AND (p.rubro = s.servicio_necesitado)))));

-- Tareas programadas: los pedidos demo no vencen ni se reintentan ni alertan.
create or replace function privado.vencer_pedidos()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.solicitudes set estado = 'vencida'
   where estado = 'pendiente' and not demo and created_at < now() - interval '15 days';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function privado.reintentar_matching()
returns int language plpgsql security definer set search_path = '' as $$
declare
  a bytea; args text[]; url text; hdr jsonb; r record; n int := 0;
begin
  select t.tgargs into a from pg_catalog.pg_trigger t
   where t.tgname = 'matching_solicitudes' and t.tgrelid = 'public.solicitudes'::regclass;
  if a is null then return 0; end if;           -- sin trigger (p. ej. staging): no hace nada
  args := string_to_array(encode(a, 'escape'), '\000');
  url := args[1];
  hdr := args[3]::jsonb;

  for r in
    select s.id, coalesce(x.intentos, 0) as intentos
      from public.solicitudes s
      left join privado.reintentos_matching x on x.solicitud_id = s.id
     where s.estado = 'pendiente'
       and not s.demo
       and s.created_at between now() - interval '2 days' and now() - interval '10 minutes'
       and not exists (select 1 from public.matches m where m.solicitud_id = s.id)
       and coalesce(x.intentos, 0) < 3
       and (x.ultimo_en is null or x.ultimo_en < now() - interval '30 minutes' * power(4, x.intentos))
     order by s.id
     limit 50
  loop
    perform net.http_post(
      url := url,
      body := jsonb_build_object('type', 'INSERT', 'table', 'solicitudes', 'schema', 'public',
                                 'record', jsonb_build_object('id', r.id), 'old_record', null),
      headers := hdr,
      timeout_milliseconds := 5000);
    insert into privado.reintentos_matching (solicitud_id, intentos, ultimo_en)
    values (r.id, 1, now())
    on conflict (solicitud_id) do update
      set intentos = privado.reintentos_matching.intentos + 1, ultimo_en = now();
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function privado.revisar_salud()
returns text language plpgsql security definer set search_path = '' as $$
declare
  n int; mb numeric; tope numeric; salida text := '';
begin
  -- a) avisos a n8n (matching) que fallaron en los últimos 15 minutos
  select count(*) into n from net._http_response r
   where r.created > now() - interval '15 minutes'
     and (r.error_msg is not null or r.status_code is null or r.status_code >= 400);
  if n > 0 then
    perform privado.avisar('http_fallidos', n || ' llamadas salientes fallaron',
      'En los últimos 15 minutos fallaron ' || n || ' llamadas de la base a servicios externos '
      || '(matching en n8n, notificaciones o mails). Los pedidos sin proveedores se reintentan solos; '
      || 'si esto se repite, revisá que n8n esté activo.');
    salida := salida || 'http_fallidos=' || n || ' ';
  end if;

  -- b) pedidos que siguen sin proveedores después de los 3 reintentos
  select count(*) into n from public.solicitudes s
    join privado.reintentos_matching x on x.solicitud_id = s.id
   where s.estado = 'pendiente' and not s.demo and x.intentos >= 3
     and not exists (select 1 from public.matches m where m.solicitud_id = s.id)
     and s.created_at > now() - interval '2 days';
  if n > 0 then
    perform privado.avisar('pedidos_sin_proveedores', n || ' pedidos sin proveedores',
      n || ' pedidos de los últimos 2 días no consiguieron ningún proveedor después de 3 intentos. '
      || 'Puede ser que no haya proveedores de ese rubro/zona, o que el matching de n8n esté fallando.');
    salida := salida || 'sin_proveedores=' || n || ' ';
  end if;

  -- c) tareas programadas que fallaron
  select count(*) into n from cron.job_run_details d
   where d.start_time > now() - interval '15 minutes' and d.status = 'failed';
  if n > 0 then
    perform privado.avisar('cron_fallido', 'Falló una tarea programada',
      n || ' ejecuciones de tareas programadas fallaron en los últimos 15 minutos. '
      || 'Ver: select * from cron.job_run_details order by start_time desc limit 20;');
    salida := salida || 'cron_fallido=' || n || ' ';
  end if;

  -- d) tamaño de la base
  select pg_database_size(current_database()) / 1048576.0 into mb;
  select valor::numeric into tope from privado.config where clave = 'tope_base_mb';
  if mb > tope * 0.8 then
    perform privado.avisar('base_llena', 'La base está al ' || round(100 * mb / tope) || '%',
      'La base ocupa ' || round(mb) || ' MB de ' || tope || ' MB. Al llegar al tope, Supabase la pasa a solo lectura. '
      || 'Pasar a Supabase Pro o limpiar datos viejos.');
    salida := salida || 'base_mb=' || round(mb) || ' ';
  end if;

  -- e) tamaño de las fotos
  select coalesce(sum((o.metadata->>'size')::bigint), 0) / 1048576.0 into mb
    from storage.objects o;
  select valor::numeric into tope from privado.config where clave = 'tope_fotos_mb';
  if mb > tope * 0.8 then
    perform privado.avisar('fotos_llenas', 'Las fotos ocupan el ' || round(100 * mb / tope) || '%',
      'Storage ocupa ' || round(mb) || ' MB de ' || tope || ' MB.');
    salida := salida || 'fotos_mb=' || round(mb) || ' ';
  end if;

  return coalesce(nullif(salida, ''), 'ok');
end $$;

-- El matching de n8n no se dispara para pedidos ni servicios demo.
do $$
declare r record; def text;
begin
  for r in select t.oid, t.tgname, c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
            where t.tgname in ('matching_solicitudes', 'matching_proveedores') and not t.tgisinternal loop
    def := pg_get_triggerdef(r.oid);
    if def not ilike '% WHEN %' then
      def := replace(def, ' FOR EACH ROW EXECUTE', ' FOR EACH ROW WHEN ((NOT new.demo)) EXECUTE');
      execute format('drop trigger %I on public.%I', r.tgname, r.relname);
      execute def;
    end if;
  end loop;
end $$;

-- Las cuentas demo no reciben avisos (push ni mail).
do $$
declare def text;
begin
  select pg_get_functiondef('public.notificar_evento_push'::regproc) into def;
  if def like '%if destinatario is null then%' and def not like '%es_demo%' then
    def := replace(def,
      E'  if destinatario is null then\n    return new;\n  end if;',
      E'  if destinatario is null then\n    return new;\n  end if;\n\n  -- Las cuentas demo (revisores de tiendas, videos) no reciben avisos.\n  if privado.es_demo(destinatario) then\n    return new;\n  end if;');
    execute def;
  end if;
end $$;

revoke all on all functions in schema privado from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_proc where proname = 'fotos_permitidas' and pronamespace = 'privado'::regnamespace) then
    grant execute on function privado.fotos_permitidas(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_proc where proname = 'es_pedido_de_usuario' and pronamespace = 'privado'::regnamespace) then
    grant execute on function privado.es_pedido_de_usuario() to anon, authenticated;
  end if;
  grant execute on function privado.soy_demo() to authenticated;
end $$;
