-- CRM de Tratto en producción (Growth OS conectado a la app)
--
-- El Growth OS (growth/supabase/migrations, 5 archivos) se instaló en esta
-- base el 2026-10-07, con una diferencia a propósito: NO existe la política
-- "crear workspace". Todos los usuarios de la app tienen sesión en esta base y
-- el CRM es uno solo, el de Tratto, que crea esta migración.
--
-- En producción se aplicó por partes con el conector de Supabase (nombres
-- crm_produccion_1..8 en supabase_migrations); este archivo junta todo.
--
-- Esta migración conecta el CRM con lo que ya existe:
--   * calculadora_respuestas → prospecto (entrada "calculadora").
--   * auth.users (registro en la app) → prospecto + usuario de la app
--     (entrada "registro_app"), con el origen que la app guarda al registrarse.
--   * auth.users (permiso de publicidad prendido/apagado) → consentimiento.
--   * auth.users (inicio de sesión) → sesión (para "usuario activo").
--   * solicitudes / proveedores (primer pedido o primer servicio publicado)
--     → activación.
--
-- Reglas:
--   * Solo se le escribe a quien dio permiso: el de la calculadora (casilla de
--     novedades) o el de publicidad de la app (art. 27, Ley 25.326). El resto
--     queda registrado, sin mensajes.
--   * Nada de esto puede romper la app: cada disparador atrapa sus errores y
--     solo deja un aviso en el log.
--   * Origen = primer contacto. Si alguien llegó por TikTok y después vuelve
--     por un mail, sigue contando como TikTok.

-- ── 1. Columnas de origen y datos para personalizar los mails ──
alter table public.growth_prospects
  add column if not exists entrada      text,   -- puerta: calculadora, registro_app, registro_web, pedido_web, manual
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists referrer     text,
  add column if not exists datos        jsonb not null default '{}'::jsonb;
create index if not exists growth_prospects_ws_entrada_idx on public.growth_prospects (workspace_id, entrada);

-- El workspace del CRM (hay uno solo: el de Tratto)
create or replace function public.crm_ws()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.growth_workspaces where slug = 'tratto';
$$;

-- ── 2. El workspace de Tratto ──
-- Las descripciones largas de la app (App Settings) quedan para completar
-- desde el panel; el conocimiento y las objeciones van más abajo.
create or replace function public.crm_instalar_workspace(owner uuid, admin_ uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select id into ws from public.growth_workspaces where slug = 'tratto';
  if ws is not null then return ws; end if;
  insert into public.growth_workspaces (name, slug, is_demo, created_by)
  values ('Tratto', 'tratto', false, owner) returning id into ws;
  if admin_ is not null and admin_ <> owner then
    insert into public.growth_members (workspace_id, user_id, role) values (ws, admin_, 'admin') on conflict do nothing;
  end if;
  update public.growth_app_settings set
    app_name = 'Tratto: servicios cerca tuyo',
    website = 'https://www.trattoapp.com.ar',
    category = 'Servicios',
    activation_event = 'first_action', active_window_days = 7,
    sending_paused = true
  where workspace_id = ws;
  update public.growth_sources set name = 'Directo / sin campaña' where workspace_id = ws and key = 'organic';
  insert into public.growth_sources (workspace_id, key, name, kind) values
    (ws, 'calculadora', 'Calculadora de precios', 'organic'),
    (ws, 'meta_ads', 'Anuncios de Meta', 'paid'),
    (ws, 'google_ads', 'Anuncios de Google', 'paid'),
    (ws, 'radar', 'Radar de redes', 'social'),
    (ws, 'ia', 'Asistentes de IA', 'search')
  on conflict do nothing;
  insert into public.growth_tracking_links (workspace_id, slug, name, source_id, destination, utm_medium) values
    (ws, 'tratto-bio', 'Link de la bio (Instagram)', (select id from public.growth_sources where workspace_id = ws and key = 'instagram'), 'smart', 'bio'),
    (ws, 'tratto-qr', 'Cartel con QR', (select id from public.growth_sources where workspace_id = ws and key = 'offline'), 'smart', 'qr'),
    (ws, 'mail-calculadora', 'Mails de la calculadora', (select id from public.growth_sources where workspace_id = ws and key = 'email'), 'web', 'email'),
    (ws, 'mail-bienvenida', 'Mails de bienvenida', (select id from public.growth_sources where workspace_id = ws and key = 'email'), 'web', 'email');
  -- Mails reales (Brevo) apenas se active el envío; mientras tanto, en pausa
  update public.growth_integrations set mode = 'live' where workspace_id = ws and provider = 'email';
  return ws;
end $$;
revoke all on function public.crm_instalar_workspace(uuid, uuid) from public, anon, authenticated;

-- Dueño: la cuenta del fundador; admin: la casilla de Tratto
select public.crm_instalar_workspace(
  (select id from auth.users where email = 'amomelenicki@ipcac.edu.ar'),
  (select id from auth.users where email = 'trattoapp1@gmail.com'));

-- Base de conocimiento y objeciones (las usa la IA del panel para responder)
insert into public.growth_knowledge (workspace_id, kind, title, content, sort)
select public.crm_ws(), k, t, c, o from (values
 ('problem','Qué problema resuelve','Necesitás a alguien para un trabajo y no sabés a quién llamar ni cuánto debería costar. En Tratto contás qué necesitás y te llegan presupuestos de gente de tu zona.',1),
 ('feature','Cómo funciona','1) Pedís: contás qué necesitás o le sacás una foto y recibís un precio de referencia. 2) Te cotizan: proveedores de tu zona y de ese rubro te mandan su presupuesto por el chat. 3) Elegís vos comparando qué incluye cada uno, cuánto sale y cuándo puede.',2),
 ('feature','Precio de referencia','A partir de una foto o de lo que escribís, la app da un precio de referencia para saber si un presupuesto tiene sentido.',3),
 ('feature','Comparador de presupuestos','La inteligencia artificial muestra qué incluye y qué no incluye cada presupuesto recibido.',4),
 ('feature','Chat privado','Toda la conversación con el proveedor es dentro de la app: tus datos no quedan expuestos.',5),
 ('feature','Calificaciones','Cada proveedor tiene en su perfil las calificaciones de otros clientes.',6),
 ('feature','Rubros','46 rubros: hogar (plomería, pintura, albañilería, techos, cerrajería, aire acondicionado, jardinería), limpieza, autos y traslados (mecánica, gomería, lavado, fletes y mudanzas), clases (apoyo escolar, idiomas, música, computación, manejo), eventos, digital (diseño, programación, redes, foto y video, soporte técnico), trámites, contabilidad, belleza, entrenamiento, mascotas y más.',7),
 ('feature','Calculadora','En trattoapp.com.ar/calculadora cualquiera compara lo que pagó o le presupuestaron con el rango de referencia de su zona, gratis.',8),
 ('pricing','Precio para quien pide','Pedir un servicio, chatear y recibir presupuestos no cuesta nada.',9),
 ('pricing','Precio para proveedores','Registrarse es gratis y no hay abono mensual. Tratto cobra una comisión del 3% solo cuando el proveedor cobra a través de la app.',10),
 ('terms','Rubros no admitidos','Tratto no admite rubros que requieran matrícula (gas, electricidad, salud).',11),
 ('terms','Edad','Hay que ser mayor de 18 años.',12),
 ('faq','¿Dónde la consigo?','Está en https://www.trattoapp.com.ar y se puede instalar desde el navegador.',13)
) v(k, t, c, o)
where not exists (select 1 from public.growth_knowledge where workspace_id = public.crm_ws());

insert into public.growth_objections (workspace_id, label, patterns, response)
select public.crm_ws(), l, pt, r from (values
 ('Precio',array['cuanto sale','cuánto sale','cuanto cuesta','precio','cobran','pagar'],'Para pedir es gratis: publicar tu pedido, chatear y recibir presupuestos no cuesta nada.'),
 ('Comisión (proveedores)',array['comision','comisión','abono','cuanto me cobran'],'Registrarte es gratis y no hay abono mensual. Solo hay una comisión del 3% cuando cobrás a través de la app.'),
 ('Seguridad de datos',array['mis datos','segura','seguro','confiable'],'Hablás con el proveedor por un chat privado dentro de la app, así tus datos no quedan expuestos, y ves las calificaciones de otros clientes.'),
 ('Ya tengo a alguien',array['ya tengo','tengo uno','conozco a alguien'],'¡Bien! Igual te sirve para comparar precios o para los rubros en los que no tenés a nadie de confianza.'),
 ('No quiero instalar',array['no quiero instalar','no tengo espacio','otra app','no uso apps'],'Funciona desde el navegador en trattoapp.com.ar, sin instalar nada.'),
 ('Rubro con matrícula',array['gasista','electricista','gas','medico','médico','enfermera'],'Por ahora Tratto no admite rubros que requieren matrícula (gas, electricidad, salud).')
) v(l, pt, r)
where not exists (select 1 from public.growth_objections where workspace_id = public.crm_ws());

-- ── 3. Utilidades ──
-- Medio de marketing a partir del utm_source (o, si no hay, del sitio de donde vino)
create or replace function public.crm_fuente(p_utm text, p_ref text)
returns text language sql immutable as $$
  select case
    when s ~ '^(meta|meta_ads|fb_ads|ig_ads)' then 'meta_ads'
    when s ~ '^(google_ads|gads|adwords)' then 'google_ads'
    when s ~ '^(ig|instagram)' then 'instagram'
    when s ~ '^(tt|tiktok)' then 'tiktok'
    when s ~ '^(fb|facebook)' then 'facebook'
    when s ~ '^google' then 'google'
    when s ~ '^(wa|whatsapp)' then 'whatsapp'
    when s ~ '^(email|mail|newsletter|brevo|crm)' then 'email'
    when s ~ '^(qr|cartel|offline|volante)' then 'offline'
    when s ~ '^(referido|referral|amigo|compartido)' then 'referral'
    when s ~ '^calculadora' then 'calculadora'
    when s ~ '^radar' then 'radar'
    when s ~ '^(influencer|creador)' then 'influencers'
    when s ~ '^(chatgpt|openai|perplexity|gemini|claude|copilot)' then 'ia'
    when s in ('directo', 'organic', 'organico', 'orgánico') then 'organic'
    when s <> '' then 'other'
    when r ~ 'instagram\.com' then 'instagram'
    when r ~ 'tiktok\.com' then 'tiktok'
    when r ~ '(facebook\.com|fb\.com|fb\.me)' then 'facebook'
    when r ~ '(chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google|claude\.ai|copilot\.microsoft)' then 'ia'
    when r ~ '(google\.|bing\.com|duckduckgo|yahoo\.)' then 'google'
    when r ~ '(whatsapp|wa\.me)' then 'whatsapp'
    when r ~ '(mail\.|outlook|brevo)' then 'email'
    when r <> '' and r !~ 'trattoapp\.com\.ar' then 'other'
    else 'organic' end
  -- "ref:sitio.com" (lo manda la calculadora cuando no hay utm) se trata como referrer
  from (select case when s0 ~ '^ref:' then '' else s0 end s,
               case when s0 ~ '^ref:' then substr(s0, 5) else r0 end r
          from (select lower(trim(coalesce(p_utm, ''))) s0, lower(coalesce(p_ref, '')) r0) a) x;
$$;

-- Pesos argentinos con punto de miles: 450000 → $450.000
create or replace function public.crm_pesos(n numeric)
returns text language sql immutable as $$
  select case when n is null then null else '$' || replace(to_char(round(n), 'FM999G999G999'), ',', '.') end;
$$;

-- Arranca las automatizaciones "al crear" que le correspondan a un prospecto
-- que ya existía y ahora cumple el filtro (por ejemplo, dio permiso después).
-- Cada automatización corre una sola vez por persona.
create or replace function public.crm_disparar(pid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.growth_prospects; w record;
begin
  select * into p from public.growth_prospects where id = pid;
  if p.id is null or p.do_not_contact or p.consent = 'opt_out' then return; end if;
  for w in select id, trigger_filter from public.growth_workflows
            where workspace_id = p.workspace_id and active and trigger = 'prospect_created' loop
    if public.growth_match(to_jsonb(p), w.trigger_filter)
       and not exists (select 1 from public.growth_workflow_runs r where r.workflow_id = w.id and r.prospect_id = pid) then
      insert into public.growth_workflow_runs (workspace_id, workflow_id, prospect_id)
      values (p.workspace_id, w.id, pid) on conflict do nothing;
    end if;
  end loop;
end $$;

-- Alta o actualización de una persona en el CRM (una por email).
--   p_datos:  first_name, phone, rubro, zona y "datos" (objeto que se suma a datos)
--   p_origen: utm_source, utm_medium, utm_campaign, utm_content, referrer
-- El origen y la entrada se guardan la primera vez y no se pisan.
create or replace function public.crm_capturar(p_kind text, p_email text, p_entrada text, p_consent text,
                                               p_consent_source text, p_datos jsonb, p_origen jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ws  uuid := public.crm_ws();
  em  text := lower(nullif(trim(p_email), ''));
  d   jsonb := coalesce(p_datos, '{}'::jsonb);
  o   jsonb := coalesce(p_origen, '{}'::jsonb);
  ph  text := nullif(regexp_replace(coalesce(d->>'phone', ''), '[^0-9+]', '', 'g'), '');
  src uuid;
  pid uuid;
  cur public.growth_prospects;
  kind_ text := case when p_kind = 'provider' then 'provider' else 'customer' end;
  cons text := case when p_consent = 'opt_in' then 'opt_in' else 'unknown' end;
begin
  if ws is null or em is null or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
  select * into cur from public.growth_prospects where workspace_id = ws and lower(email) = em order by created_at limit 1;

  if cur.id is null then
    select id into src from public.growth_sources
     where workspace_id = ws and key = public.crm_fuente(o->>'utm_source', o->>'referrer');
    insert into public.growth_prospects
      (workspace_id, kind, email, phone, first_name, rubro, zona, city, source_id, consent, consent_source, status,
       entrada, utm_source, utm_medium, utm_campaign, utm_content, referrer, datos, tags)
    values (ws, kind_, em, ph, nullif(trim(d->>'first_name'), ''), nullif(d->>'rubro', ''), nullif(d->>'zona', ''),
            nullif(d->>'zona', ''), src, cons, case when cons = 'opt_in' then p_consent_source end, 'new',
            p_entrada, left(o->>'utm_source', 80), left(o->>'utm_medium', 80), left(o->>'utm_campaign', 80),
            left(o->>'utm_content', 80), left(o->>'referrer', 200), coalesce(d->'datos', '{}'::jsonb),
            array[p_entrada])
    returning id into pid;
  else
    pid := cur.id;
    update public.growth_prospects set
      kind = case when kind_ = 'provider' then 'provider' else kind end,
      first_name = coalesce(first_name, nullif(trim(d->>'first_name'), '')),
      phone = coalesce(phone, ph),
      rubro = coalesce(nullif(d->>'rubro', ''), rubro),
      zona = coalesce(nullif(d->>'zona', ''), zona),
      city = coalesce(city, nullif(d->>'zona', '')),
      consent = case when consent = 'opt_out' then 'opt_out' when cons = 'opt_in' then 'opt_in' else consent end,
      consent_source = case when consent <> 'opt_in' and consent <> 'opt_out' and cons = 'opt_in'
                            then p_consent_source else consent_source end,
      datos = datos || coalesce(d->'datos', '{}'::jsonb),
      entrada = coalesce(entrada, p_entrada),
      tags = case when p_entrada = any(tags) then tags else tags || p_entrada end
    where id = pid;
    perform public.crm_disparar(pid);
  end if;

  insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail, actor)
  values (ws, pid, 'entrada',
          case p_entrada when 'calculadora' then 'Usó la calculadora de precios'
                         when 'registro_app' then 'Se registró en la app'
                         when 'pedido_web' then 'Hizo un pedido sin cuenta'
                         else 'Entró por ' || coalesce(p_entrada, 'otro lado') end,
          jsonb_build_object('entrada', p_entrada, 'origen', o, 'permiso', cons), 'app');
  return pid;
end $$;

revoke all on function public.crm_ws(), public.crm_disparar(uuid),
  public.crm_capturar(text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- ── 4. Calculadora → CRM ──
create or replace function public.crm_calc_registrar(c public.calculadora_respuestas)
returns uuid language plpgsql security definer set search_path = '' as $$
declare dif text; est text;
begin
  if coalesce(c.origen, '') = 'prueba' then return null; end if;
  est := case when c.estado = 'pagado' then 'pagaste' else 'te presupuestaron' end;
  dif := case
    when c.diferencia_pct is null then ''
    when c.diferencia_pct > 0 then ' (' || round(c.diferencia_pct) || '% arriba del promedio)'
    when c.diferencia_pct < 0 then ' (' || abs(round(c.diferencia_pct)) || '% abajo del promedio)'
    else '' end;
  return public.crm_capturar('customer', c.email, 'calculadora',
    case when c.acepta_novedades then 'opt_in' else 'unknown' end,
    'Casilla de novedades de la calculadora',
    jsonb_build_object('rubro', c.rubro, 'zona', c.zona, 'datos', jsonb_build_object(
      'calc_servicio', c.servicio, 'calc_rubro', c.rubro, 'calc_zona', c.zona,
      'calc_estado', c.estado, 'calc_estado_txt', est,
      'calc_precio', c.precio, 'calc_precio_txt', public.crm_pesos(c.precio),
      'calc_min_txt', public.crm_pesos(c.ref_min), 'calc_max_txt', public.crm_pesos(c.ref_max),
      'calc_unidad', c.unidad,
      'calc_veredicto', c.veredicto,
      'calc_veredicto_txt', case c.veredicto
          when 'muy_caro' then 'muy por encima de lo habitual' when 'caro' then 'por encima de lo habitual'
          when 'justo' then 'dentro de lo habitual' when 'barato' then 'por debajo de lo habitual'
          when 'muy_barato' then 'muy por debajo de lo habitual' else 'comparado' end || dif,
      'calc_fecha', c.creado_en)),
    jsonb_build_object('utm_source', c.origen, 'utm_campaign', c.campana));
end $$;

create or replace function public.crm_desde_calculadora()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.crm_calc_registrar(new);
  exception when others then
    raise warning 'CRM (calculadora): %', sqlerrm;
  end;
  return new;
end $$;

create trigger crm_calculadora after insert on public.calculadora_respuestas
  for each row execute function public.crm_desde_calculadora();

-- ── 5. Registro en la app → CRM ──
-- La app guarda en user_metadata.origen los utm, el referrer y el gid (click
-- de un link con seguimiento) de la última visita con campaña antes de crear
-- la cuenta.
create or replace function public.crm_registrar_usuario(u auth.users)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m   jsonb := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  o   jsonb := coalesce(m->'origen', '{}'::jsonb);
  ws  uuid := public.crm_ws();
  pid uuid;
  r   jsonb;
begin
  if ws is null or u.email is null or privado.es_demo(u.id) then return; end if;
  pid := public.crm_capturar(case when m->>'rol' = 'proveedor' then 'provider' else 'customer' end,
           u.email, 'registro_app',
           case when m->>'publicidad_permiso' = 'true' then 'opt_in' else 'unknown' end,
           'Permiso de publicidad en la app',
           jsonb_build_object('first_name', m->>'nombre', 'phone', m->>'telefono', 'rubro', m->>'rubro'),
           o);
  r := public.growth_ingest_event(ws, jsonb_build_object(
         'event', 'register', 'external_user_id', u.id::text, 'email', u.email, 'name', m->>'nombre',
         'platform', coalesce(o->>'plataforma', 'web'), 'click_token', o->>'gid', 'prospect_id', pid,
         'occurred_at', u.created_at, 'idempotency_key', 'register:' || u.id::text));
  -- El usuario de la app cuenta con el origen del prospecto (primer contacto)
  update public.growth_app_users a set source_id = p.source_id
    from public.growth_prospects p
   where a.id = public.growth_uuid(r->>'app_user_id') and p.id = pid and p.source_id is not null;
  -- Las cuentas internas (pruebas del equipo) quedan marcadas y sin mensajes
  if u.email ~* '^trattoapp1[+]' then
    update public.growth_prospects set do_not_contact = true,
           tags = case when 'interno' = any(tags) then tags else tags || 'interno'::text end
     where id = pid;
  end if;
end $$;

create or replace function public.crm_desde_registro()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.crm_registrar_usuario(new);
  exception when others then
    raise warning 'CRM (registro): %', sqlerrm;
  end;
  return new;
end $$;

create trigger crm_registro after insert on auth.users
  for each row execute function public.crm_desde_registro();

-- Permiso de publicidad prendido o apagado desde la app
create or replace function public.crm_desde_permiso()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ahora boolean := (new.raw_user_meta_data->>'publicidad_permiso') = 'true'; pid uuid;
begin
  begin
    update public.growth_prospects set
      consent = case when ahora then 'opt_in' else 'opt_out' end,
      do_not_contact = case when ahora then (('interno' = any(tags))) else true end,
      consent_source = case when ahora then 'Activó la publicidad en la app' else 'Apagó la publicidad en la app' end
     where workspace_id = public.crm_ws() and lower(email) = lower(new.email)
    returning id into pid;
    if ahora and pid is not null then perform public.crm_disparar(pid); end if;
  exception when others then
    raise warning 'CRM (permiso): %', sqlerrm;
  end;
  return new;
end $$;

create trigger crm_permiso after update of raw_user_meta_data on auth.users
  for each row when ((old.raw_user_meta_data->>'publicidad_permiso') is distinct from (new.raw_user_meta_data->>'publicidad_permiso'))
  execute function public.crm_desde_permiso();

-- Cada inicio de sesión cuenta como sesión (para "usuario activo" y retención)
create or replace function public.crm_desde_sesion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ws uuid := public.crm_ws();
begin
  begin
    if ws is not null and new.last_sign_in_at is not null and not privado.es_demo(new.id)
       and exists (select 1 from public.growth_app_users where workspace_id = ws and external_user_id = new.id::text) then
      perform public.growth_ingest_event(ws, jsonb_build_object(
        'event', 'session_start', 'external_user_id', new.id::text, 'occurred_at', new.last_sign_in_at,
        'idempotency_key', 'sesion:' || new.id::text || ':' || extract(epoch from new.last_sign_in_at)::bigint));
    end if;
  exception when others then
    raise warning 'CRM (sesión): %', sqlerrm;
  end;
  return new;
end $$;

create trigger crm_sesion after update of last_sign_in_at on auth.users
  for each row when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.crm_desde_sesion();

-- ── 6. Primer pedido o primer servicio publicado → activación ──
create or replace function public.crm_desde_actividad()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ws uuid := public.crm_ws(); j jsonb := to_jsonb(new);
begin
  begin
    if ws is null or coalesce((j->>'demo')::boolean, false) then return new; end if;
    if new.user_id is not null then
      if not exists (select 1 from public.growth_app_users where workspace_id = ws and external_user_id = new.user_id::text) then
        perform public.crm_registrar_usuario(u) from auth.users u where u.id = new.user_id;
      end if;
      perform public.growth_ingest_event(ws, jsonb_build_object(
        'event', 'first_action', 'external_user_id', new.user_id::text, 'occurred_at', j->>'created_at',
        'properties', case when tg_table_name = 'solicitudes'
          then jsonb_build_object('tipo', 'pedido', 'servicio', j->>'servicio_necesitado', 'zona', j->>'zona')
          else jsonb_build_object('tipo', 'servicio_publicado', 'rubro', j->>'rubro', 'zona', j->>'zona') end));
    elsif tg_table_name = 'solicitudes' and nullif(j->>'email_cliente', '') is not null then
      perform public.crm_capturar('customer', j->>'email_cliente', 'pedido_web', 'unknown', null,
        jsonb_build_object('first_name', j->>'nombre_cliente', 'phone', j->>'telefono_cliente', 'zona', j->>'zona'),
        '{}'::jsonb);
    end if;
  exception when others then
    raise warning 'CRM (actividad): %', sqlerrm;
  end;
  return new;
end $$;

create trigger crm_actividad after insert on public.solicitudes
  for each row execute function public.crm_desde_actividad();
create trigger crm_actividad after insert on public.proveedores
  for each row execute function public.crm_desde_actividad();

revoke all on function public.crm_desde_calculadora(), public.crm_calc_registrar(public.calculadora_respuestas),
  public.crm_desde_registro(), public.crm_desde_permiso(),
  public.crm_desde_sesion(), public.crm_desde_actividad(), public.crm_registrar_usuario(auth.users)
  from public, anon, authenticated;

-- ── 7. Baja desde un mail: también apaga el permiso de publicidad en la app ──
create or replace function public.crm_apagar_publicidad(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('publicidad_permiso', false, 'publicidad_permiso_fecha', now())
   where lower(email) = lower(trim(p_email))
     and (raw_user_meta_data->>'publicidad_permiso') = 'true';
end $$;
revoke all on function public.crm_apagar_publicidad(text) from public, anon, authenticated;
grant execute on function public.crm_apagar_publicidad(text) to service_role;
grant execute on function public.crm_ws() to service_role;

-- ── 8. Herramientas de operación (se usan desde el SQL editor) ──
-- Prender o apagar los envíos (lo mismo que Settings → Workspace → Lanzamiento)
create or replace function public.crm_envios(activar boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.growth_app_settings set sending_paused = not activar where workspace_id = public.crm_ws();
  -- Al activar, lo que estaba esperando por la pausa sale en la próxima vuelta del cron
  if activar then
    update public.growth_workflow_runs set wait_until = now(), updated_at = now()
     where workspace_id = public.crm_ws() and status = 'waiting' and not waiting_reply
       and log->-1->>'info' like 'En pausa%';
  end if;
  return activar;
end $$;

-- Volver a poner en marcha una automatización que falló, desde el paso donde quedó
create or replace function public.crm_reintentar(p_run uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare r public.growth_workflow_runs;
begin
  select * into r from public.growth_workflow_runs where id = p_run;
  if r.id is null then return 'no existe'; end if;
  if r.status <> 'failed' then return 'no estaba fallada: ' || r.status; end if;
  if exists (select 1 from public.growth_workflow_runs x where x.workflow_id = r.workflow_id and x.prospect_id = r.prospect_id
              and x.status in ('running', 'waiting')) then return 'ya hay otra activa'; end if;
  update public.growth_workflow_runs set status = 'running', error = null, finished_at = null, wait_until = null,
         waiting_reply = false, updated_at = now() where id = p_run;
  return 'ok';
end $$;
revoke all on function public.crm_envios(boolean), public.crm_reintentar(uuid) from public, anon, authenticated;

-- ── 9. Carga inicial: lo que ya había antes de conectar el CRM ──
create or replace function public.crm_carga_inicial()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ws uuid := public.crm_ws(); u auth.users; c public.calculadora_respuestas; a record;
        nu int := 0; nc int := 0; na int := 0;
begin
  for u in select * from auth.users order by created_at loop
    if not privado.es_demo(u.id) then
      perform public.crm_registrar_usuario(u); nu := nu + 1;
    end if;
  end loop;
  for a in
    select user_id, min(created_at) at, 'pedido' tipo from public.solicitudes where user_id is not null and not coalesce(demo, false) group by user_id
    union all
    select user_id, min(created_at), 'servicio_publicado' from public.proveedores where user_id is not null and not coalesce(demo, false) group by user_id
    order by 2
  loop
    if exists (select 1 from public.growth_app_users where workspace_id = ws and external_user_id = a.user_id::text) then
      perform public.growth_ingest_event(ws, jsonb_build_object('event', 'first_action', 'external_user_id', a.user_id::text,
        'occurred_at', a.at, 'properties', jsonb_build_object('tipo', a.tipo, 'carga_inicial', true)));
      na := na + 1;
    end if;
  end loop;
  for c in select * from public.calculadora_respuestas order by creado_en loop
    if public.crm_calc_registrar(c) is not null then nc := nc + 1; end if;
  end loop;
  return jsonb_build_object('usuarios', nu, 'actividad', na, 'calculadora', nc);
end $$;
revoke all on function public.crm_carga_inicial() from public, anon, authenticated;
-- Se corrió una vez el 2026-10-07: {"usuarios": 6, "actividad": 7, "calculadora": 1}
-- select public.crm_carga_inicial();
