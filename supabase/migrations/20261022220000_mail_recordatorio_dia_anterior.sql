-- Recontacto del día anterior (fundador, 22/10/2026): "a las 6 de la tarde que
-- haga un recontacto, pero del día anterior. Si ayer salió Service de
-- electrodomésticos y hoy Jardinería y piletas, hoy hago el contacto de
-- Jardinería y a las 6 de la tarde el recontacto de Service de
-- electrodomésticos". Reemplaza al recordatorio de Codex de las 19:30.
--
-- Lo manda n8n ("Recordatorio a quienes no respondieron", desde trattoapp2),
-- uno por minuto desde las 18, en el mismo hilo de la presentación. Antes de
-- cada uno n8n lee el hilo en Gmail: si hay un mensaje que no es nuestro
-- (respuesta, respuesta automática o rebote), lo saltea. Uno solo por
-- dirección, para siempre.

alter table public.growth_mail_cola
  add column if not exists recordatorio_estado text
    check (recordatorio_estado in ('enviando', 'enviado', 'salteado', 'error')),
  add column if not exists recordatorio_at timestamptz,
  add column if not exists recordatorio_message_id text,
  add column if not exists recordatorio_motivo text;

create index if not exists growth_mail_cola_recordatorio
  on public.growth_mail_cola (fecha, recordatorio_estado) where estado = 'enviado';

-- El próximo recontacto para mandar, o nada. Bloquea la fila mientras n8n lo manda.
create or replace function public.mail_recordatorio_siguiente()
returns setof public.growth_mail_cola
language plpgsql
security definer
set search_path to ''
as $function$
declare
  aj jsonb;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  hora time := (now() at time zone 'America/Argentina/Buenos_Aires')::time;
  ultimo timestamptz;
  fila public.growth_mail_cola%rowtype;
  motivo text;
begin
  perform pg_advisory_xact_lock(hashtext('growth_mail_recordatorio'));

  select valor into aj from public.growth_mkt_ajustes where clave = 'prospeccion';
  if aj is null or not coalesce((aj->>'recordatorios')::boolean, false) then return; end if;

  -- Pausa (por ejemplo, después de un 5.7.1 de Google)
  if (aj->>'pausa_hasta') is not null and (aj->>'pausa_hasta')::date >= hoy then return; end if;

  -- Horario: de 18 a 21 de Argentina
  if hora < time '18:00' or hora > time '21:00' then return; end if;

  -- Uno a la vez
  update public.growth_mail_cola set recordatorio_estado = 'error', updated_at = now(),
         recordatorio_motivo = 'Quedó a medio enviar: revisar en Enviados de Gmail'
   where recordatorio_estado = 'enviando' and updated_at < now() - interval '10 minutes';
  if exists (select 1 from public.growth_mail_cola where recordatorio_estado = 'enviando') then return; end if;

  -- Ritmo: nunca dos con menos de 45 segundos (n8n espera alrededor de un minuto)
  select max(recordatorio_at) into ultimo from public.growth_mail_cola where recordatorio_estado = 'enviado';
  if ultimo is not null and ultimo + interval '45 seconds' > now() then return; end if;

  loop
    select * into fila from public.growth_mail_cola c
     where c.estado = 'enviado' and c.fecha = hoy - 1 and c.recordatorio_estado is null
       and c.gmail_thread_id is not null
     order by c.orden, c.created_at
     limit 1
     for update skip locked;
    if not found then return; end if;

    select case
             when coalesce((fila.datos->>'rebote')::boolean, false) then 'Rebotó'
             when p.do_not_contact then 'Pidió no recibir más mails'
             when 'rebote' = any(p.tags) then 'Rebotó'
             when p.status <> 'contacted' then 'Ya no está sin respuesta (' || p.status || ')'
             when p.datos->'prospeccion' ? 'recordatorio_at' then 'Ya recibió un recordatorio'
             when exists (select 1 from public.growth_mail_cola c2
                           where lower(c2.para) = lower(fila.para) and c2.id <> fila.id
                             and c2.recordatorio_estado = 'enviado') then 'Ya recibió un recordatorio'
           end
      into motivo
      from public.growth_prospects p where p.id = fila.prospect_id;
    if not found then motivo := 'El contacto ya no está en el CRM'; end if;

    if motivo is not null then
      update public.growth_mail_cola set recordatorio_estado = 'salteado', recordatorio_motivo = motivo,
             updated_at = now()
       where id = fila.id;
      continue;
    end if;

    update public.growth_mail_cola set recordatorio_estado = 'enviando', updated_at = now()
     where id = fila.id returning * into fila;
    return next fila;
    return;
  end loop;
end $function$;

-- Lo que pasó con el recontacto: 'enviado', 'salteado' (con el motivo) o 'error'.
create or replace function public.mail_recordatorio_marcar(
  p_id uuid, p_resultado text, p_message_id text default null, p_motivo text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  fila public.growth_mail_cola%rowtype;
begin
  if p_resultado not in ('enviado', 'salteado', 'error') then return 'resultado_invalido'; end if;
  select * into fila from public.growth_mail_cola where id = p_id for update;
  if not found then return 'no_existe'; end if;

  update public.growth_mail_cola set
    recordatorio_estado = p_resultado,
    recordatorio_at = case when p_resultado = 'enviado' then now() else recordatorio_at end,
    recordatorio_message_id = coalesce(p_message_id, recordatorio_message_id),
    recordatorio_motivo = left(p_motivo, 2000),
    updated_at = now()
  where id = p_id;

  if p_resultado = 'enviado' then
    update public.growth_prospects set
      last_contact_at = now(),
      contact_count = contact_count + 1,
      datos = jsonb_set(datos, '{prospeccion}', coalesce(datos->'prospeccion', '{}'::jsonb)
              || jsonb_build_object('recordatorio_at', now(), 'recordatorio_agente', 'n8n',
                                    'recordatorio_message_id', p_message_id))
    where id = fila.prospect_id;

    insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail, actor)
    values (fila.workspace_id, fila.prospect_id, 'mensaje', 'Recordatorio (Gmail, n8n)',
            jsonb_build_object('canal', 'gmail', 'thread', fila.gmail_thread_id, 'cola', p_id), 'automation');
  end if;

  return p_resultado;
end $function$;

revoke all on function public.mail_recordatorio_siguiente() from public, anon, authenticated;
revoke all on function public.mail_recordatorio_marcar(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mail_recordatorio_siguiente() to service_role;
grant execute on function public.mail_recordatorio_marcar(uuid, text, text, text) to service_role;
