-- Apps al día (micro apps que se venden aparte de Tratto): cola de mails en
-- frío desde appsaldia1@gmail.com. Separada de la de Tratto (growth_mail_cola)
-- para que un freno de Google en una casilla no toque a la otra.
-- La manda el workflow de n8n "Apps al día · mails (Gmail appsaldia1)".

create table if not exists public.apps_mail_cola (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,                         -- desde qué día puede salir
  orden int not null default 0,
  app text not null,                           -- control, cuotas, libreta, combi
  para text not null,
  asunto text not null,
  texto text not null,
  html text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviando', 'enviado', 'error', 'cancelado')),
  enviado_at timestamptz,
  gmail_message_id text,
  gmail_thread_id text,
  error text,
  datos jsonb not null default '{}'::jsonb,    -- consultorio, zona, fuente
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un mismo mail recibe una sola presentación por app.
create unique index if not exists apps_mail_cola_para_app on public.apps_mail_cola (lower(para), app);
create index if not exists apps_mail_cola_pendientes on public.apps_mail_cola (estado, fecha, orden);

-- Quien pidió la baja o rebotó no recibe nada más de ninguna app.
create table if not exists public.apps_mail_bajas (
  mail text primary key,                       -- en minúsculas
  motivo text not null,                        -- baja, rebote
  detalle text,
  created_at timestamptz not null default now()
);

create table if not exists public.apps_mail_dsn (
  dsn_id text primary key,                     -- id del aviso de mailer-daemon o de la respuesta
  para text,
  tipo text not null,                          -- bloqueo, rebote, baja
  texto text,
  created_at timestamptz not null default now()
);

create table if not exists public.apps_mail_ajustes (
  id int primary key default 1 check (id = 1),
  -- {"desde_2026-11-16": 20, ...}: vale la clave "desde_" más reciente que ya empezó
  meta_por_fecha jsonb not null default '{}'::jsonb,
  pausa_hasta date,
  pausa_motivo text,
  freno_rebotes_dia int not null default 3,
  desde time not null default '09:00',
  hasta time not null default '18:00',
  updated_at timestamptz not null default now()
);
-- Rampa para una casilla nueva (a trattoapp1 la frenó Google con 44 en un día).
insert into public.apps_mail_ajustes (id, meta_por_fecha)
values (1, '{"desde_2026-11-16": 20, "desde_2026-11-23": 40, "desde_2026-11-30": 70}')
on conflict (id) do nothing;

alter table public.apps_mail_cola enable row level security;
alter table public.apps_mail_bajas enable row level security;
alter table public.apps_mail_dsn enable row level security;
alter table public.apps_mail_ajustes enable row level security;
revoke all on public.apps_mail_cola, public.apps_mail_bajas, public.apps_mail_dsn, public.apps_mail_ajustes from anon, authenticated;

-- El siguiente mail para mandar, o nada. Lunes a viernes, en horario, con la
-- meta del día, el freno de rebotes, uno a la vez y nunca dos en menos de 200 s.
create or replace function public.apps_mail_siguiente()
returns setof public.apps_mail_cola
language plpgsql security definer set search_path to ''
as $$
declare
  aj public.apps_mail_ajustes%rowtype;
  ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  hoy date := ahora::date;
  meta int;
  enviados int;
  rebotes int;
  ultimo timestamptz;
  fila public.apps_mail_cola%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('apps_mail_cola'));
  select * into aj from public.apps_mail_ajustes where id = 1;
  if not found then return; end if;
  if aj.pausa_hasta is not null and aj.pausa_hasta >= hoy then return; end if;
  if extract(isodow from ahora) > 5 then return; end if;
  if ahora::time < aj.desde or ahora::time > aj.hasta then return; end if;

  select (v)::int into meta
    from jsonb_each_text(aj.meta_por_fecha) as e(k, v)
   where k like 'desde\_%' and substr(k, 7)::date <= hoy
   order by substr(k, 7)::date desc limit 1;
  if coalesce(meta, 0) <= 0 then return; end if;

  select count(*) into enviados from public.apps_mail_cola
   where estado = 'enviado' and (enviado_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy;
  if enviados >= meta then return; end if;

  select count(*) into rebotes from public.apps_mail_dsn
   where tipo = 'rebote' and (created_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy;
  if rebotes >= aj.freno_rebotes_dia then return; end if;

  update public.apps_mail_cola set estado = 'error', updated_at = now(),
         error = 'Quedó a medio enviar: revisar en Enviados de Gmail antes de volver a ponerlo en pendiente'
   where estado = 'enviando' and updated_at < now() - interval '10 minutes';
  if exists (select 1 from public.apps_mail_cola where estado = 'enviando') then return; end if;

  select max(enviado_at) into ultimo from public.apps_mail_cola where estado = 'enviado';
  if ultimo is not null and ultimo + interval '200 seconds' > now() then return; end if;

  loop
    select * into fila from public.apps_mail_cola
     where estado = 'pendiente' and fecha <= hoy
     order by fecha, orden, created_at
     limit 1 for update skip locked;
    if not found then return; end if;
    if exists (select 1 from public.apps_mail_bajas b where b.mail = lower(fila.para)) then
      update public.apps_mail_cola set estado = 'cancelado', updated_at = now(),
             error = 'Pidió la baja o rebotó antes' where id = fila.id;
      continue;
    end if;
    update public.apps_mail_cola set estado = 'enviando', updated_at = now()
     where id = fila.id returning * into fila;
    return next fila;
    return;
  end loop;
end $$;

create or replace function public.apps_mail_marcar(p_id uuid, p_ok boolean, p_message_id text default null,
                                                   p_thread_id text default null, p_error text default null)
returns text
language plpgsql security definer set search_path to ''
as $$
begin
  if not p_ok then
    update public.apps_mail_cola set estado = 'error', updated_at = now(),
           error = left(coalesce(p_error, 'Error de Gmail sin detalle'), 2000)
     where id = p_id;
    return case when found then 'error' else 'no_existe' end;
  end if;
  update public.apps_mail_cola set estado = 'enviado', enviado_at = now(), error = null, updated_at = now(),
         gmail_message_id = p_message_id, gmail_thread_id = p_thread_id
   where id = p_id;
  return case when found then 'enviado' else 'no_existe' end;
end $$;

-- Avisos que lee n8n en la casilla: bloqueo de Google (pausa de 3 días),
-- rebote o pedido de baja (esa dirección no recibe nada más).
create or replace function public.apps_mail_avisos(p_items jsonb)
returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  it jsonb;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  bloqueo boolean := false;
  nuevos int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when coalesce(it->>'dsn_id', '') = '' or it->>'tipo' not in ('bloqueo', 'rebote', 'baja');
    insert into public.apps_mail_dsn (dsn_id, para, tipo, texto)
    values (it->>'dsn_id', lower(it->>'para'), it->>'tipo', left(it->>'texto', 2000))
    on conflict (dsn_id) do nothing;
    continue when not found;
    nuevos := nuevos + 1;
    if it->>'tipo' = 'bloqueo' then
      bloqueo := true;
    elsif coalesce(it->>'para', '') <> '' then
      insert into public.apps_mail_bajas (mail, motivo, detalle)
      values (lower(it->>'para'), it->>'tipo', left(it->>'texto', 500))
      on conflict (mail) do nothing;
      update public.apps_mail_cola set estado = 'cancelado', updated_at = now(), error = 'Pidió la baja o rebotó'
       where lower(para) = lower(it->>'para') and estado = 'pendiente';
    end if;
  end loop;
  if bloqueo then
    update public.apps_mail_ajustes set pausa_hasta = hoy + 3, updated_at = now(),
           pausa_motivo = 'Gmail rechazó un mail de appsaldia1 (5.7.1 o límite de envío) el ' || to_char(hoy, 'DD/MM')
                          || '. n8n frenó la cola sola. Pausa de 3 días.'
     where id = 1;
  end if;
  return jsonb_build_object('bloqueo', bloqueo, 'nuevos', nuevos);
end $$;

revoke all on function public.apps_mail_siguiente(), public.apps_mail_marcar(uuid, boolean, text, text, text),
                       public.apps_mail_avisos(jsonb) from public, anon, authenticated;
grant execute on function public.apps_mail_siguiente(), public.apps_mail_marcar(uuid, boolean, text, text, text),
                          public.apps_mail_avisos(jsonb) to service_role;
