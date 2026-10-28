-- Trabajo listo (fundador, 23/10/2026): "cuando algún cliente haga su primer
-- pedido y no haya proveedores todavía de eso, le vamos a ese proveedor con un
-- trabajo listo ya para que haga".
--
-- Cuando entra un pedido (no demo) de un rubro sin nadie publicado en esa zona,
-- la base:
--   1. lo anota en growth_trabajo_listo, con la descripción sin datos de
--      contacto (a quien no está anotado nunca le llega el nombre, el teléfono
--      ni la dirección del cliente);
--   2. elige hasta 8 contactos del CRM de ese rubro (primero de esa zona) para
--      mandarles el mail "trabajo listo" y deja aparte los que solo tienen
--      teléfono, para que el fundador les escriba por WhatsApp a mano;
--   3. deja una alerta en la cola del equipo y despierta al flujo de n8n
--      "Trabajo listo", que manda los mails de a uno por minuto, de 8 a 21.
--
-- Excepción a "una sola presentación por dirección" aprobada por el fundador el
-- 23/10/2026: se le puede volver a escribir a alguien ya contactado solo cuando
-- hay un pedido real de su rubro, una vez por pedido y como mucho una vez cada
-- 7 días. Los mails salen solo con growth_mkt_ajustes.trabajo_listo.envio_aprobado
-- en true (el texto lo aprueba el fundador).

create table if not exists public.growth_trabajo_listo (
  id bigserial primary key,
  solicitud_id bigint not null unique references public.solicitudes(id) on delete cascade,
  rubro text not null,
  zona text,
  motivo text not null check (motivo in ('rubro_vacio', 'zona_vacia')),
  descripcion_publica text,
  cupo smallint,
  estado text not null default 'buscando' check (estado in ('buscando', 'cubierto', 'vencido')),
  contactos_mail int not null default 0,
  contactos_whatsapp int not null default 0,
  created_at timestamptz not null default now(),
  cubierto_at timestamptz,
  datos jsonb not null default '{}'::jsonb
);

create table if not exists public.growth_trabajo_listo_envios (
  id bigserial primary key,
  trabajo_id bigint not null references public.growth_trabajo_listo(id) on delete cascade,
  prospect_id uuid references public.growth_prospects(id) on delete set null,
  canal text not null check (canal in ('mail', 'whatsapp')),
  para text not null,
  nombre text,
  misma_zona boolean not null default true,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviando', 'enviado', 'salteado', 'error', 'manual')),
  motivo text,
  gmail_message_id text,
  enviado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trabajo_id, canal, para)
);

create index if not exists growth_trabajo_listo_envios_pendientes
  on public.growth_trabajo_listo_envios (estado, created_at) where estado in ('pendiente', 'enviando');

-- Solo la base (funciones security definer) y la service role de n8n las tocan.
alter table public.growth_trabajo_listo enable row level security;
alter table public.growth_trabajo_listo_envios enable row level security;

insert into public.growth_mkt_ajustes (workspace_id, clave, valor)
values (public.crm_ws(), 'trabajo_listo', jsonb_build_object(
  'envio_aprobado', false,
  'max_mails_por_pedido', 8,
  'max_mails_por_dia', 30,
  'max_whatsapp_por_pedido', 8,
  'webhook', 'https://marketplace-servicios.app.n8n.cloud/webhook/trabajo-listo'))
on conflict (workspace_id, clave) do nothing;

-- La descripción que puede leer alguien que todavía no está anotado: sin mails,
-- teléfonos, links ni números largos (alturas de calle, documentos), y corta.
create or replace function public.growth_texto_publico(p_texto text)
returns text
language sql
immutable
set search_path to ''
as $$
  select nullif(btrim(left(
    regexp_replace(regexp_replace(regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(p_texto, ''), '\S+@\S+', '', 'g'),
            'https?://\S+|www\.\S+', '', 'g'),
          '\+?\d[\d\s().-]{5,}\d', '', 'g'),
        '\m\d{3,}\M', '', 'g'),
      '\s+([,.;:])', '\1', 'g'), '([,.;:])(\s*[,.;:])+', '\1', 'g'), '\s{2,}', ' ', 'g'),
    180)), '')
$$;

create or replace function public.growth_trabajo_listo_detectar()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  aj jsonb;
  v_motivo text;
  v_id bigint;
  v_mails int := 0;
  v_tels int := 0;
  v_max_mail int;
  v_max_wa int;
begin
  if coalesce(new.demo, false) or coalesce(new.servicio_necesitado, '') = '' then return new; end if;

  if exists (select 1 from public.proveedores p
              where not coalesce(p.demo, false) and p.rubro = new.servicio_necesitado
                and p.zona is not distinct from new.zona) then
    return new;
  end if;

  v_motivo := case when exists (select 1 from public.proveedores p
                                 where not coalesce(p.demo, false) and p.rubro = new.servicio_necesitado)
                   then 'zona_vacia' else 'rubro_vacio' end;

  select valor into aj from public.growth_mkt_ajustes where clave = 'trabajo_listo';
  v_max_mail := coalesce((aj->>'max_mails_por_pedido')::int, 8);
  v_max_wa := coalesce((aj->>'max_whatsapp_por_pedido')::int, 8);

  insert into public.growth_trabajo_listo (solicitud_id, rubro, zona, motivo, descripcion_publica, cupo)
  values (new.id, new.servicio_necesitado, new.zona, v_motivo,
          public.growth_texto_publico(new.descripcion), coalesce(new.cupo, 5))
  on conflict (solicitud_id) do nothing
  returning id into v_id;
  if v_id is null then return new; end if;

  -- Candidatos: ese rubro, sin baja, sin rebote, sin cuenta en la app y sin un
  -- "trabajo listo" en los últimos 7 días. Primero los de la misma zona.
  with base as (
    select p.id, lower(p.email) as email, p.phone,
           coalesce(nullif(p.company, ''), nullif(p.first_name, '')) as nombre,
           p.zona is not distinct from new.zona as misma_zona, p.created_at
      from public.growth_prospects p
     where p.kind = 'provider' and p.rubro = new.servicio_necesitado
       and not coalesce(p.do_not_contact, false)
       and not ('rebote' = any(coalesce(p.tags, '{}')))
       and p.registered_at is null and p.app_user_id is null
       and coalesce(p.status, '') not in ('registered', 'activated', 'not_interested')
       and coalesce(p.zona, '') <> 'Buenos Aires (interior)'
  ), mails as (
    select distinct on (b.email) b.*
      from base b
     where b.email is not null and b.email like '%@%'
       and not exists (select 1 from public.growth_trabajo_listo_envios e
                        where e.canal = 'mail' and lower(e.para) = b.email
                          and e.created_at > now() - interval '7 days')
     order by b.email, b.misma_zona desc
  ), elegidos as (
    select * from mails order by misma_zona desc, created_at limit v_max_mail
  )
  insert into public.growth_trabajo_listo_envios (trabajo_id, prospect_id, canal, para, nombre, misma_zona)
  select v_id, id, 'mail', email, nombre, misma_zona from elegidos
  on conflict do nothing;
  get diagnostics v_mails = row_count;

  with base as (
    select p.id, regexp_replace(p.phone, '\D', '', 'g') as tel,
           coalesce(nullif(p.company, ''), nullif(p.first_name, '')) as nombre,
           p.zona is not distinct from new.zona as misma_zona, p.created_at
      from public.growth_prospects p
     where p.kind = 'provider' and p.rubro = new.servicio_necesitado
       and coalesce(p.phone, '') <> ''
       and not coalesce(p.do_not_contact, false)
       and p.registered_at is null and p.app_user_id is null
       and coalesce(p.status, '') not in ('registered', 'activated', 'not_interested')
       and coalesce(p.zona, '') <> 'Buenos Aires (interior)'
       and not exists (select 1 from public.growth_trabajo_listo_envios e
                        where e.trabajo_id = v_id and e.prospect_id = p.id)
  ), elegidos as (
    select distinct on (tel) * from base where length(tel) >= 8
     order by tel, misma_zona desc
  )
  insert into public.growth_trabajo_listo_envios (trabajo_id, prospect_id, canal, para, nombre, misma_zona, estado)
  select v_id, id, 'whatsapp', tel, nombre, misma_zona, 'manual'
    from (select * from elegidos order by misma_zona desc, created_at limit v_max_wa) x
  on conflict do nothing;
  get diagnostics v_tels = row_count;

  update public.growth_trabajo_listo set contactos_mail = v_mails, contactos_whatsapp = v_tels where id = v_id;

  insert into public.growth_mkt_items (workspace_id, departamento, tipo, estado, prioridad, creado_por, titulo, resumen, datos)
  values (public.crm_ws(), 'operaciones', 'alerta', 'para_aprobar', 1, 'automation',
          'Pedido sin nadie: ' || new.servicio_necesitado || coalesce(' en ' || new.zona, ''),
          case v_motivo when 'rubro_vacio' then 'No hay nadie de este rubro en la app. '
                        else 'Hay gente de este rubro, pero no en esta zona. ' end
            || v_mails || ' mails "trabajo listo" preparados y ' || v_tels || ' WhatsApp para mandar a mano.',
          jsonb_build_object('clave', 'trabajo_listo', 'trabajo_id', v_id, 'solicitud_id', new.id));

  -- Despierta a n8n: avisa al fundador y manda sin esperar a la próxima vuelta.
  if coalesce(aj->>'webhook', '') <> '' and (v_mails > 0 or v_tels > 0) then
    perform net.http_post(url := aj->>'webhook', body := jsonb_build_object('trabajo_id', v_id),
                          headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 5000);
  end if;

  return new;
exception when others then
  -- Un pedido nunca se tiene que caer por esto.
  raise warning 'trabajo_listo: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trabajo_listo_detectar on public.solicitudes;
create trigger trabajo_listo_detectar
  after insert on public.solicitudes
  for each row when (not coalesce(new.demo, false))
  execute function public.growth_trabajo_listo_detectar();

-- Cuando alguien toma el pedido, se deja de escribirle a nadie más por ese pedido.
create or replace function public.growth_trabajo_listo_cubierto()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.growth_trabajo_listo
     set estado = 'cubierto', cubierto_at = now(),
         datos = datos || jsonb_build_object('proveedor_id', new.proveedor_id)
   where solicitud_id = new.solicitud_id and estado = 'buscando';
  if found then
    update public.growth_trabajo_listo_envios e set estado = 'salteado', motivo = 'Ya lo tomó alguien', updated_at = now()
      from public.growth_trabajo_listo t
     where t.id = e.trabajo_id and t.solicitud_id = new.solicitud_id and e.estado = 'pendiente';
  end if;
  return new;
exception when others then
  raise warning 'trabajo_listo_cubierto: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trabajo_listo_cubierto on public.interesados;
create trigger trabajo_listo_cubierto
  after insert on public.interesados
  for each row execute function public.growth_trabajo_listo_cubierto();

-- n8n: el siguiente mail para mandar. Uno por vez, con 45 segundos entre uno y
-- otro, de 8 a 21, con el texto aprobado y sin pausa de Gmail ni tope del día.
create or replace function public.growth_trabajo_listo_siguiente()
returns table (envio_id bigint, para text, nombre text, rubro text, zona text,
               descripcion text, cupo smallint, misma_zona boolean)
language plpgsql
security definer
set search_path to ''
as $$
declare
  aj jsonb;
  pr jsonb;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  hora time := (now() at time zone 'America/Argentina/Buenos_Aires')::time;
  ultimo timestamptz;
  v_env public.growth_trabajo_listo_envios%rowtype;
  v_tr public.growth_trabajo_listo%rowtype;
  v_sol public.solicitudes%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('growth_trabajo_listo'));

  select valor into aj from public.growth_mkt_ajustes where clave = 'trabajo_listo';
  if aj is null or not coalesce((aj->>'envio_aprobado')::boolean, false) then return; end if;
  select valor into pr from public.growth_mkt_ajustes where clave = 'prospeccion';
  if (pr->>'pausa_hasta') is not null and (pr->>'pausa_hasta')::date >= hoy then return; end if;
  if hora < time '08:00' or hora > time '21:00' then return; end if;

  update public.growth_trabajo_listo set estado = 'vencido'
   where estado = 'buscando' and created_at < now() - interval '15 days';
  update public.growth_trabajo_listo_envios set estado = 'error', updated_at = now(),
         motivo = 'Quedó a medio enviar: revisar en Enviados de Gmail'
   where estado = 'enviando' and updated_at < now() - interval '10 minutes';
  if exists (select 1 from public.growth_trabajo_listo_envios where estado = 'enviando') then return; end if;

  if (select count(*) from public.growth_trabajo_listo_envios
       where estado = 'enviado' and (enviado_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy)
     >= coalesce((aj->>'max_mails_por_dia')::int, 30) then
    return;
  end if;

  select max(enviado_at) into ultimo from public.growth_trabajo_listo_envios where estado = 'enviado';
  if ultimo is not null and ultimo + interval '45 seconds' > now() then return; end if;

  loop
    select e.* into v_env from public.growth_trabajo_listo_envios e
      join public.growth_trabajo_listo t on t.id = e.trabajo_id
     where e.canal = 'mail' and e.estado = 'pendiente' and t.estado = 'buscando'
     order by t.created_at, e.misma_zona desc, e.id
     limit 1
     for update of e skip locked;
    if not found then return; end if;

    select * into v_tr from public.growth_trabajo_listo where id = v_env.trabajo_id;
    select * into v_sol from public.solicitudes where id = v_tr.solicitud_id;

    if v_sol.id is null or v_sol.estado <> 'pendiente' then
      update public.growth_trabajo_listo set estado = 'vencido' where id = v_tr.id;
      update public.growth_trabajo_listo_envios set estado = 'salteado', motivo = 'El pedido ya no está abierto',
             updated_at = now() where trabajo_id = v_tr.id and estado = 'pendiente';
      continue;
    end if;
    if exists (select 1 from public.growth_prospects p where p.id = v_env.prospect_id
                and (p.do_not_contact or 'rebote' = any(coalesce(p.tags, '{}')) or p.app_user_id is not null)) then
      update public.growth_trabajo_listo_envios set estado = 'salteado', motivo = 'Baja, rebote o ya tiene cuenta',
             updated_at = now() where id = v_env.id;
      continue;
    end if;

    update public.growth_trabajo_listo_envios set estado = 'enviando', updated_at = now() where id = v_env.id;
    envio_id := v_env.id; para := v_env.para; nombre := v_env.nombre; rubro := v_tr.rubro;
    zona := v_tr.zona; descripcion := v_tr.descripcion_publica; cupo := v_tr.cupo;
    misma_zona := v_env.misma_zona;
    return next;
    return;
  end loop;
end $$;

create or replace function public.growth_trabajo_listo_marcar(p_id bigint, p_resultado text,
                                                            p_message_id text default null, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_prospect uuid;
begin
  if p_resultado not in ('enviado', 'error', 'salteado') then
    raise exception 'Resultado inválido: %', p_resultado;
  end if;
  update public.growth_trabajo_listo_envios
     set estado = p_resultado, gmail_message_id = p_message_id, motivo = left(p_motivo, 1500),
         enviado_at = case when p_resultado = 'enviado' then now() end, updated_at = now()
   where id = p_id
  returning prospect_id into v_prospect;
  if p_resultado = 'enviado' and v_prospect is not null then
    update public.growth_prospects
       set contact_count = coalesce(contact_count, 0) + 1, last_contact_at = now(), updated_at = now(),
           datos = coalesce(datos, '{}'::jsonb) || jsonb_build_object('trabajo_listo_at', now())
     where id = v_prospect;
  end if;
end $$;

-- n8n: lo que necesita el aviso al fundador (los WhatsApp van con su teléfono).
create or replace function public.growth_trabajo_listo_resumen(p_trabajo_id bigint)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'trabajo_id', t.id, 'solicitud_id', t.solicitud_id, 'rubro', t.rubro, 'zona', t.zona,
    'motivo', t.motivo, 'descripcion', t.descripcion_publica, 'cupo', t.cupo, 'estado', t.estado,
    'mails', t.contactos_mail,
    'aprobado', coalesce((select (a.valor->>'envio_aprobado')::boolean from public.growth_mkt_ajustes a
                           where a.clave = 'trabajo_listo'), false),
    'whatsapp', coalesce((select jsonb_agg(jsonb_build_object('nombre', e.nombre, 'tel', e.para, 'misma_zona', e.misma_zona)
                                           order by e.misma_zona desc, e.id)
                            from public.growth_trabajo_listo_envios e
                           where e.trabajo_id = t.id and e.canal = 'whatsapp'), '[]'::jsonb))
    from public.growth_trabajo_listo t where t.id = p_trabajo_id
$$;

revoke all on function public.growth_trabajo_listo_resumen(bigint) from public, anon, authenticated;
grant execute on function public.growth_trabajo_listo_resumen(bigint) to service_role;
revoke all on function public.growth_trabajo_listo_siguiente() from public, anon, authenticated;
revoke all on function public.growth_trabajo_listo_marcar(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.growth_trabajo_listo_detectar() from public, anon, authenticated;
revoke all on function public.growth_trabajo_listo_cubierto() from public, anon, authenticated;
grant execute on function public.growth_trabajo_listo_siguiente() to service_role;
grant execute on function public.growth_trabajo_listo_marcar(bigint, text, text, text) to service_role;
