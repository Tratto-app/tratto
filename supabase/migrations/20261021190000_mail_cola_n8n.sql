-- Cola de mails a quienes ofrecen servicios, que manda n8n solo (fundador,
-- 21/10/2026: "que no se demore casi 3 horas la corrida de mails y que gaste
-- menos tokens"). Claude busca y deja los mails del día armados en la cola;
-- el workflow "Mails a proveedores · cola" de n8n los manda desde trattoapp2,
-- uno cada 3,5 a 4,5 minutos, sin que haga falta un agente despierto.
--
-- Las reglas del fundador siguen en la base y no en n8n: pausa_hasta, meta
-- del día, freno con 3 rebotes, horario y un solo envío a la vez.

create table if not exists public.growth_mail_cola (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.crm_ws(),
  prospect_id uuid not null references public.growth_prospects(id) on delete cascade,
  para text not null,
  asunto text not null,
  html text not null,
  texto text not null,
  remitente text not null default 'trattoapp2@gmail.com',
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  orden int not null default 0,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviando', 'enviado', 'error', 'cancelado')),
  enviado_at timestamptz,
  espera_seg int,
  gmail_message_id text,
  gmail_thread_id text,
  error text,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists growth_mail_cola_para_fecha
  on public.growth_mail_cola (fecha, lower(para));
create index if not exists growth_mail_cola_estado
  on public.growth_mail_cola (estado, fecha, orden);

-- Avisos de mailer-daemon ya procesados, para no contar dos veces un rebote
create table if not exists public.growth_mail_dsn (
  dsn_id text primary key,
  para text,
  tipo text not null,
  texto text,
  created_at timestamptz not null default now()
);

alter table public.growth_mail_cola enable row level security;
alter table public.growth_mail_dsn enable row level security;
-- Sin políticas: solo la clave service role (n8n) y las funciones de abajo.

-- El próximo mail para mandar, o nada. Bloquea la fila mientras n8n la manda.
create or replace function public.mail_cola_siguiente()
returns setof public.growth_mail_cola
language plpgsql
security definer
set search_path to ''
as $function$
declare
  aj jsonb;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  hora time := (now() at time zone 'America/Argentina/Buenos_Aires')::time;
  meta int;
  enviados int;
  rebotes int;
  ultimo public.growth_mail_cola%rowtype;
  fila public.growth_mail_cola%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('growth_mail_cola'));

  select valor into aj from public.growth_mkt_ajustes where clave = 'prospeccion';
  if aj is null then return; end if;

  -- Pausa (por ejemplo, después de un 5.7.1 de Google)
  if (aj->>'pausa_hasta') is not null and (aj->>'pausa_hasta')::date >= hoy then return; end if;

  -- Horario: de 9 a 20:30 de Argentina
  if hora < time '09:00' or hora > time '20:30' then return; end if;

  -- Meta del día: la clave con la fecha de hoy o, si no está, la "desde_" más reciente que ya empezó
  meta := (aj->'meta_por_fecha'->>to_char(hoy, 'YYYY-MM-DD'))::int;
  if meta is null then
    select (v)::int into meta
      from jsonb_each_text(coalesce(aj->'meta_por_fecha', '{}'::jsonb)) as e(k, v)
     where k like 'desde\_%' and substr(k, 7)::date <= hoy
     order by substr(k, 7)::date desc limit 1;
  end if;
  if coalesce(meta, 0) <= 0 then return; end if;

  select count(*) into enviados from public.growth_mail_cola
   where estado = 'enviado' and (enviado_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy
     and not coalesce((datos->>'rebote')::boolean, false);
  if enviados >= meta then return; end if;

  -- Freno del fundador: con 3 rebotes en el día no sale nada más
  select count(*) into rebotes from public.growth_mail_dsn
   where tipo = 'rebote' and (created_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy;
  if rebotes >= coalesce((aj->>'freno_rebotes_dia')::int, 3) then return; end if;

  -- Uno a la vez: si quedó uno a medio mandar hace más de 10 minutos, se marca
  -- como error (puede haber salido: se revisa en Enviados, nunca se reenvía solo)
  update public.growth_mail_cola set estado = 'error', updated_at = now(),
         error = 'Quedó a medio enviar: revisar en Enviados de Gmail antes de volver a ponerlo en pendiente'
   where estado = 'enviando' and updated_at < now() - interval '10 minutes';
  if exists (select 1 from public.growth_mail_cola where estado = 'enviando') then return; end if;

  -- Ritmo: la espera que se sorteó al mandar el anterior (3,5 a 4,5 minutos)
  select * into ultimo from public.growth_mail_cola
   where estado = 'enviado' order by enviado_at desc limit 1;
  if found and ultimo.enviado_at + make_interval(secs => coalesce(ultimo.espera_seg, 240)) > now() then
    return;
  end if;

  -- El siguiente pendiente; si ese contacto ya recibió algo o pidió la baja, se cancela
  loop
    select * into fila from public.growth_mail_cola
     where estado = 'pendiente' and fecha <= hoy
     order by fecha, orden, created_at
     limit 1
     for update skip locked;
    if not found then return; end if;
    if exists (select 1 from public.growth_prospects p
                where p.id = fila.prospect_id
                  and (p.do_not_contact or p.status <> 'uncontacted' or p.contacted_at is not null)) then
      update public.growth_mail_cola set estado = 'cancelado', updated_at = now(),
             error = 'El contacto ya fue contactado o pidió no recibir mails'
       where id = fila.id;
      continue;
    end if;
    update public.growth_mail_cola set estado = 'enviando', updated_at = now() where id = fila.id
    returning * into fila;
    return next fila;
    return;
  end loop;
end $function$;

-- Lo que devolvió Gmail al mandar. Si salió, el contacto pasa a contactado
-- con los mismos datos que dejaba el agente.
create or replace function public.mail_cola_marcar(
  p_id uuid, p_ok boolean, p_message_id text default null, p_thread_id text default null, p_error text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  fila public.growth_mail_cola%rowtype;
  espera int := 210 + floor(random() * 61)::int;
begin
  select * into fila from public.growth_mail_cola where id = p_id for update;
  if not found then return 'no_existe'; end if;

  if not p_ok then
    update public.growth_mail_cola set estado = 'error', error = left(coalesce(p_error, 'Error de Gmail sin detalle'), 2000),
           updated_at = now() where id = p_id;
    return 'error';
  end if;

  update public.growth_mail_cola set estado = 'enviado', enviado_at = now(), espera_seg = espera,
         gmail_message_id = p_message_id, gmail_thread_id = p_thread_id, error = null, updated_at = now()
   where id = p_id;

  update public.growth_prospects set
    status = 'contacted',
    contacted_at = coalesce(contacted_at, now()),
    last_contact_at = now(),
    contact_count = contact_count + 1,
    datos = jsonb_set(datos, '{prospeccion}', coalesce(datos->'prospeccion', '{}'::jsonb) || fila.datos
            || jsonb_build_object('asunto', fila.asunto, 'cuenta_envio', fila.remitente, 'via', 'n8n',
                                  'enviado_at', now(), 'fecha_envio', fila.fecha,
                                  'gmail_thread', p_thread_id, 'gmail_message_id', p_message_id))
  where id = fila.prospect_id;

  insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail, actor)
  values (fila.workspace_id, fila.prospect_id, 'mensaje', 'Mail de presentación (Gmail, n8n)',
          jsonb_build_object('canal', 'gmail', 'thread', p_thread_id, 'cola', p_id), 'automation');

  update public.growth_mkt_rotacion r set enviados = r.enviados + 1
   where r.workspace_id = fila.workspace_id
     and r.ultima_vez = (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  return 'enviado';
end $function$;

-- Avisos de mailer-daemon que n8n leyó en Gmail. Un bloqueo de Google (5.7.1,
-- límite de envío) pone la pausa de 3 días y deja una alerta; un rebote marca
-- al contacto y cuenta para el freno del día. Las demoras no cuentan.
create or replace function public.mail_cola_rechazos(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  it jsonb;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  bloqueo boolean := false;
  nuevos int := 0;
  rebotes int;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when coalesce(it->>'dsn_id', '') = '' or it->>'tipo' not in ('bloqueo', 'rebote');
    insert into public.growth_mail_dsn (dsn_id, para, tipo, texto)
    values (it->>'dsn_id', lower(it->>'para'), it->>'tipo', left(it->>'texto', 2000))
    on conflict (dsn_id) do nothing;
    continue when not found;
    nuevos := nuevos + 1;

    if it->>'tipo' = 'bloqueo' then
      bloqueo := true;
    elsif coalesce(it->>'para', '') <> '' then
      perform public.mkt_prospeccion_respuesta(it->>'para', 'rebote', it->>'texto');
      update public.growth_mail_cola set datos = datos || '{"rebote": true}'::jsonb, updated_at = now()
       where lower(para) = lower(it->>'para') and estado = 'enviado';
    end if;
  end loop;

  if bloqueo then
    update public.growth_mkt_ajustes set
      valor = valor || jsonb_build_object(
        'pausa_hasta', to_char(hoy + 3, 'YYYY-MM-DD'),
        'pausa_motivo', 'Gmail rechazó un mail de trattoapp2 (5.7.1 o límite de envío) el '
                        || to_char(hoy, 'DD/MM') || '. n8n frenó la cola sola. Pausa de 3 días.'),
      updated_at = now()
    where clave = 'prospeccion';
    insert into public.growth_mkt_items (workspace_id, departamento, tipo, estado, prioridad, creado_por, titulo, resumen)
    values (public.crm_ws(), 'operaciones', 'alerta', 'para_aprobar', 1, 'automation',
            'Gmail bloqueó los mails de trattoapp2: cola frenada 3 días',
            'n8n leyó un rechazo 5.7.1 o de límite de envío y frenó la cola. Revisar antes de reanudar.');
  end if;

  select count(*) into rebotes from public.growth_mail_dsn
   where tipo = 'rebote' and (created_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy;
  return jsonb_build_object('bloqueo', bloqueo, 'nuevos', nuevos, 'rebotes_hoy', rebotes);
end $function$;

revoke all on function public.mail_cola_siguiente() from public, anon, authenticated;
revoke all on function public.mail_cola_marcar(uuid, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.mail_cola_rechazos(jsonb) from public, anon, authenticated;
grant execute on function public.mail_cola_siguiente() to service_role;
grant execute on function public.mail_cola_marcar(uuid, boolean, text, text, text) to service_role;
grant execute on function public.mail_cola_rechazos(jsonb) to service_role;
