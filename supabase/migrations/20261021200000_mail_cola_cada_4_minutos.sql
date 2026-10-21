-- Ritmo de la cola de mails: uno cada 4 minutos (fundador, 21/10/2026: "que
-- cada 4 minutos mande mail. Los 70 mails por día"). n8n espera entre 3:45 y
-- 4:15 después de cada envío; la base solo frena si n8n vuelve antes de 3:20,
-- así una espera de n8n nunca choca con la de la base y corta la tanda.

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

  -- Ritmo: nunca dos mails con menos de 3 minutos y 20 segundos entre sí
  -- (n8n espera unos 4 minutos; esto es solo el piso por si se adelanta)
  select * into ultimo from public.growth_mail_cola
   where estado = 'enviado' order by enviado_at desc limit 1;
  if found and ultimo.enviado_at + interval '200 seconds' > now() then
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
