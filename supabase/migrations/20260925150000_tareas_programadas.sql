-- Tareas programadas dentro de la base (pg_cron, gratis en todos los planes).
-- Reemplazan cosas que dependían de n8n o no existían:
--
--  1. vencer-pedidos (todos los días 04:00 AR): pedidos 'pendiente' con más de
--     15 días pasan a 'vencida'. Es lo que hacía el workflow de n8n "LIMPIEZA -
--     Vencer pedidos", que estaba apagado. La app ya muestra 'vencida'.
--  2. reintentar-matching (cada 10 min): el aviso a n8n sale por pg_net una sola
--     vez, sin reintento. Si n8n estaba caído, el pedido quedaba sin
--     proveedores para siempre. Ahora, un pedido pendiente sin ninguna conexión
--     se vuelve a avisar hasta 3 veces (a los 10 min, ~2 h y ~8 h).
--     La URL y el encabezado secreto se leen del propio trigger
--     matching_solicitudes, así no se duplica el secreto.
--  3. revisar-salud (cada 15 min): junta problemas y manda UN mail por tipo de
--     problema cada 6 h como máximo (función avisar-equipo → SMTP de Brevo;
--     el destinatario está fijo en la función). Mira: avisos a n8n que fallaron, pedidos que quedaron sin
--     proveedores después de los reintentos, tareas programadas que fallaron,
--     y tamaño de la base / fotos cerca del tope del plan.
--  4. limpiar-fotos (todos los días 04:30 AR): llama a la función
--     limpieza-fotos, que borra por la API de Storage las fotos de pedidos
--     vencidos y de cuentas dadas de baja (lo promete la Política de
--     privacidad; la base sola no puede borrar archivos de Storage).
--     NO se programa en esta migración: borrar archivos es irreversible y
--     espera la aprobación del dueño. Para activarla:
--       select cron.schedule('limpiar-fotos', '30 7 * * *', $$
--         select net.http_post(
--           url := (select valor from privado.config where clave = 'url_funciones') || '/limpieza-fotos',
--           headers := jsonb_build_object('x-tratto-firma',
--             (select decrypted_secret from vault.decrypted_secrets where name = 'push_firma_quick_service')),
--           timeout_milliseconds := 60000) $$);

create extension if not exists pg_cron;
create schema if not exists privado;

create table if not exists privado.reintentos_matching (
  solicitud_id bigint primary key references public.solicitudes(id) on delete cascade,
  intentos     int not null default 0,
  ultimo_en    timestamptz not null default now()
);

create table if not exists privado.alertas_enviadas (
  tipo       text primary key,
  enviada_en timestamptz not null
);

create table if not exists privado.config (
  clave text primary key,
  valor text not null
);
insert into privado.config (clave, valor) values
  ('url_funciones', 'https://qglsonbcsncgekzbfafk.supabase.co/functions/v1'),
  ('tope_base_mb', '500'),      -- plan Free: 500 MB. Con Pro, subir a 8000.
  ('tope_fotos_mb', '1024')     -- plan Free: 1 GB. Con Pro, 100000.
on conflict (clave) do nothing;

alter table privado.reintentos_matching enable row level security;
alter table privado.alertas_enviadas   enable row level security;
alter table privado.config             enable row level security;

-- ── 1) Vencer pedidos ──────────────────────────────────────────────────────
create or replace function privado.vencer_pedidos()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.solicitudes set estado = 'vencida'
   where estado = 'pendiente' and created_at < now() - interval '15 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 2) Reintentar matching ─────────────────────────────────────────────────
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

-- ── 3) Revisar salud y avisar por mail ─────────────────────────────────────
create or replace function privado.avisar(tipo text, asunto text, cuerpo text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare firma text; url text;
begin
  -- como máximo un mail por tipo cada 6 horas
  if exists (select 1 from privado.alertas_enviadas a
              where a.tipo = avisar.tipo and a.enviada_en > now() - interval '6 hours') then
    return false;
  end if;
  -- Se manda por la función avisar-equipo (SMTP de Brevo). La API REST de
  -- Brevo no sirve desde acá: la clave de API tiene restringidas las IPs.
  select decrypted_secret into firma from vault.decrypted_secrets where name = 'push_firma_quick_service';
  select valor into url from privado.config where clave = 'url_funciones';
  if firma is null or url is null then return false; end if;   -- p. ej. staging
  perform net.http_post(
    url := url || '/avisar-equipo',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tratto-firma', firma),
    body := jsonb_build_object('asunto', asunto,
      'texto', cuerpo || E'\n\nMás detalle y qué hacer: docs/MONITORING.md en el repositorio.'),
    timeout_milliseconds := 15000);
  insert into privado.alertas_enviadas (tipo, enviada_en) values (avisar.tipo, now())
  on conflict on constraint alertas_enviadas_pkey do update set enviada_en = now();
  return true;
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
   where s.estado = 'pendiente' and x.intentos >= 3
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

revoke all on all functions in schema privado from public, anon, authenticated;
-- (fotos_permitidas y es_pedido_de_usuario, de la migración de límites, siguen
--  necesitando EXECUTE para authenticated/anon)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'fotos_permitidas' and pronamespace = 'privado'::regnamespace) then
    grant execute on function privado.fotos_permitidas(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_proc where proname = 'es_pedido_de_usuario' and pronamespace = 'privado'::regnamespace) then
    grant execute on function privado.es_pedido_de_usuario() to anon, authenticated;
  end if;
end $$;

-- ── 4) Fotos a borrar (la usa la función limpieza-fotos con service_role) ──
create or replace function public.fotos_para_borrar(limite int default 200)
returns table (nombre text, motivo text)
language sql stable security definer set search_path = '' as $$
  -- fotos de pedidos vencidos
  select substring(s.foto_url from '/object/public/publicaciones/(.+)$'), 'pedido_vencido'
    from public.solicitudes s
   where s.estado = 'vencida' and s.foto_url like '%/object/public/publicaciones/%'
  union all
  -- fotos de cuentas que ya no existen (la carpeta es el id del usuario)
  select o.name, 'cuenta_borrada'
    from storage.objects o
   where o.bucket_id = 'publicaciones'
     and not exists (select 1 from auth.users u where u.id::text = (storage.foldername(o.name))[1])
  limit limite;
$$;

create or replace function public.fotos_borradas(nombres text[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.solicitudes set foto_url = null
   where estado = 'vencida'
     and substring(foto_url from '/object/public/publicaciones/(.+)$') = any(nombres);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.fotos_para_borrar(int) from public, anon, authenticated;
revoke all on function public.fotos_borradas(text[]) from public, anon, authenticated;
grant execute on function public.fotos_para_borrar(int) to service_role;
grant execute on function public.fotos_borradas(text[]) to service_role;

-- ── Programación (horas en UTC; Argentina = UTC-3) ─────────────────────────
do $$
begin
  perform cron.unschedule(jobname) from cron.job
   where jobname in ('vencer-pedidos', 'reintentar-matching', 'revisar-salud', 'limpiar-fotos', 'limpiar-historial');
end $$;

select cron.schedule('vencer-pedidos',      '0 7 * * *',    'select privado.vencer_pedidos()');
select cron.schedule('reintentar-matching', '*/10 * * * *', 'select privado.reintentar_matching()');
select cron.schedule('revisar-salud',       '*/15 * * * *', 'select privado.revisar_salud()');
-- El historial de pg_cron crece sin límite: se guarda una semana.
select cron.schedule('limpiar-historial',   '15 7 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
