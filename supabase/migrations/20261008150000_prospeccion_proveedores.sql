-- Mails a proveedores desde Gmail (prospección), un rubro por día.
-- Aplicada en producción el 8/10/2026.
--
-- Cada día el equipo busca proveedores de UN rubro en fuentes públicas (sus
-- páginas, directorios y publicaciones donde dejan el mail para que los
-- contacten), les escribe un mail personalizado desde trattoapp1@gmail.com
-- (nunca por Brevo) y los guarda acá como contactos proveedores.
--
-- growth_mkt_rotacion: los 46 rubros de la app en el orden de index.html. El
-- rubro del día es el que menos vueltas tiene y, a igualdad, el de menor
-- número: va del 1 al 46 y vuelve a empezar por el 1. La zona cambia en cada
-- vuelta (CABA, GBA Norte, GBA Oeste, GBA Sur, interior bonaerense): Tratto
-- solo opera en CABA y Provincia de Buenos Aires.
--
-- Los contactos entran con permiso "unknown": ninguna automatización les
-- escribe y el envío por Brevo está bloqueado para ellos (_shared/send.ts).
-- Si se registran en la app con permiso, crm_capturar() los encuentra por
-- mail y desde ahí reciben los mails de cualquier usuario.

create table if not exists growth_mkt_rotacion (
  workspace_id uuid not null references growth_workspaces(id) on delete cascade,
  orden smallint not null check (orden between 1 and 200),
  rubro text not null,
  grupo text,
  busquedas text[] not null default '{}',
  vueltas int not null default 0,
  ultima_vez date,
  enviados int not null default 0,
  activo boolean not null default true,
  primary key (workspace_id, orden),
  unique (workspace_id, rubro)
);

alter table growth_mkt_rotacion enable row level security;

create policy "miembros del workspace" on growth_mkt_rotacion for all to authenticated
  using ((select growth_is_member(workspace_id)))
  with check ((select growth_is_member(workspace_id)));

insert into growth_mkt_rotacion (workspace_id, orden, rubro, grupo, busquedas)
select w.id, v.orden, v.rubro, v.grupo, v.busquedas
from growth_workspaces w, (values
  (1, 'Plomería y destapaciones', 'Hogar y construcción', array['plomero', 'destapaciones']),
  (2, 'Albañilería y refacciones', 'Hogar y construcción', array['albañil', 'refacciones']),
  (3, 'Pintura', 'Hogar y construcción', array['pintor', 'pintura de interiores']),
  (4, 'Carpintería y muebles', 'Hogar y construcción', array['carpintero', 'muebles a medida']),
  (5, 'Herrería y soldadura', 'Hogar y construcción', array['herrero', 'herrería']),
  (6, 'Techos e impermeabilización', 'Hogar y construcción', array['impermeabilización de techos', 'techista']),
  (7, 'Durlock y yeso', 'Hogar y construcción', array['durlock', 'yesero']),
  (8, 'Pisos y revestimientos', 'Hogar y construcción', array['colocación de pisos', 'porcellanato']),
  (9, 'Vidrios y aberturas', 'Hogar y construcción', array['vidriería', 'aberturas de aluminio']),
  (10, 'Cerrajería', 'Hogar y construcción', array['cerrajero', 'cerrajería']),
  (11, 'Aire acondicionado', 'Hogar y construcción', array['instalación de aire acondicionado', 'service de aire acondicionado']),
  (12, 'Service de electrodomésticos', 'Hogar y construcción', array['service de lavarropas', 'reparación de heladeras']),
  (13, 'Jardinería y piletas', 'Hogar y construcción', array['jardinero', 'mantenimiento de piletas']),
  (14, 'Arreglos generales', 'Hogar y construcción', array['mantenimiento del hogar', 'arreglos generales']),
  (15, 'Servicios de limpieza', 'Limpieza', array['limpieza de casas', 'limpieza de oficinas']),
  (16, 'Mecánica del automotor', 'Autos y traslados', array['taller mecánico', 'mecánico']),
  (17, 'Chapa y pintura', 'Autos y traslados', array['chapa y pintura', 'chapista']),
  (18, 'Gomería y auxilio', 'Autos y traslados', array['gomería', 'auxilio mecánico']),
  (19, 'Lavado de autos', 'Autos y traslados', array['lavadero de autos', 'detailing']),
  (20, 'Fletes y mudanzas', 'Autos y traslados', array['fletes', 'mudanzas']),
  (21, 'Contabilidad e impuestos', 'Trámites y administración', array['contador', 'estudio contable']),
  (22, 'Gestoría y trámites', 'Trámites y administración', array['gestoría', 'gestor del automotor']),
  (23, 'Asistente administrativo', 'Trámites y administración', array['asistente virtual', 'asistente administrativo freelance']),
  (24, 'Diseño gráfico', 'Digital y diseño', array['diseñador gráfico', 'diseño de logos']),
  (25, 'Programación y desarrollo', 'Digital y diseño', array['desarrollo web', 'programador freelance']),
  (26, 'Marketing y redes sociales', 'Digital y diseño', array['community manager', 'marketing digital']),
  (27, 'Fotografía y video', 'Digital y diseño', array['fotógrafo', 'filmmaker']),
  (28, 'Reparación y soporte técnico', 'Digital y diseño', array['service de PC', 'reparación de notebooks']),
  (29, 'Estética, maquillaje y peinados', 'Belleza', array['maquilladora', 'peinados y estética']),
  (30, 'Personal trainer, yoga y pilates', 'Bienestar y cuidado', array['personal trainer', 'clases de yoga', 'pilates']),
  (31, 'Masajes', 'Bienestar y cuidado', array['masajista', 'masajes descontracturantes']),
  (32, 'Cuidado de adultos mayores', 'Bienestar y cuidado', array['cuidadora de adultos mayores', 'acompañante de adultos mayores']),
  (33, 'Catering y pastelería', 'Eventos', array['catering', 'pastelería']),
  (34, 'Música y sonido (DJ)', 'Eventos', array['DJ para eventos', 'sonido para fiestas']),
  (35, 'Animación y organización de eventos', 'Eventos', array['animación de fiestas infantiles', 'organizadora de eventos']),
  (36, 'Apoyo escolar y universitario', 'Educación', array['apoyo escolar', 'profesora particular']),
  (37, 'Idiomas', 'Educación', array['profesora de inglés', 'clases de idiomas']),
  (38, 'Clases de música', 'Educación', array['profesor de guitarra', 'clases de piano']),
  (39, 'Computación y capacitación', 'Educación', array['clases de computación', 'cursos de excel']),
  (40, 'Clases de manejo', 'Educación', array['clases de manejo', 'escuela de manejo']),
  (41, 'Paseo y cuidado de mascotas', 'Mascotas', array['paseador de perros', 'cuidado de mascotas']),
  (42, 'Peluquería y adiestramiento canino', 'Mascotas', array['peluquería canina', 'adiestrador canino']),
  (43, 'Costura y arreglos de ropa', 'Otros servicios', array['modista', 'arreglos de ropa']),
  (44, 'Tapicería y restauración', 'Otros servicios', array['tapicero', 'restauración de muebles']),
  (45, 'Decoración e interiores', 'Otros servicios', array['decoradora de interiores', 'diseño de interiores']),
  (46, 'Mandados y compras', 'Otros servicios', array['mandados', 'cadetería'])
) as v(orden, rubro, grupo, busquedas)
where w.slug = 'tratto'
on conflict do nothing;

insert into growth_sources (workspace_id, key, name, kind)
select w.id, 'prospeccion', 'Mails a proveedores (Gmail)', 'email'
from growth_workspaces w
where w.slug = 'tratto'
  and not exists (select 1 from growth_sources s where s.workspace_id = w.id and s.key = 'prospeccion');

-- Los links de estos mails llevan utm_source=prospeccion: si el proveedor se
-- registra con otro mail, igual queda atribuido a esta fuente.
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
    when s ~ '^prospeccion' then 'prospeccion'
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

-- Rubro del día. La primera llamada del día lo toma (suma la vuelta y anota la
-- fecha); las siguientes del mismo día devuelven el mismo, con cuántos mails
-- ya salieron hoy. Así una corrida cortada se puede retomar sin cambiar de rubro.
create or replace function mkt_rubro_del_dia(p_ws uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := coalesce(p_ws, public.crm_ws());
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  zonas text[] := array['CABA', 'GBA Norte', 'GBA Oeste', 'GBA Sur', 'Buenos Aires (interior)'];
  r public.growth_mkt_rotacion;
  hechos int;
begin
  select * into r from public.growth_mkt_rotacion where workspace_id = ws and ultima_vez = hoy limit 1;
  if r.orden is null then
    select * into r from public.growth_mkt_rotacion where workspace_id = ws and activo
     order by vueltas, orden limit 1 for update;
    if r.orden is null then return null; end if;
    update public.growth_mkt_rotacion set vueltas = vueltas + 1, ultima_vez = hoy
     where workspace_id = ws and orden = r.orden returning * into r;
  end if;
  select count(*) into hechos from public.growth_prospects p
   where p.workspace_id = ws and p.entrada = 'prospeccion' and p.rubro = r.rubro
     and p.contacted_at is not null
     and (p.contacted_at at time zone 'America/Argentina/Buenos_Aires')::date = hoy;
  return jsonb_build_object(
    'fecha', hoy, 'orden', r.orden, 'rubro', r.rubro, 'grupo', r.grupo,
    'busquedas', to_jsonb(r.busquedas), 'vuelta', r.vueltas,
    'zona', zonas[((r.vueltas - 1) % 5) + 1], 'zonas', to_jsonb(zonas),
    'total_rubros', (select count(*) from public.growth_mkt_rotacion where workspace_id = ws and activo),
    'enviados_hoy', hechos,
    'pendientes_hoy', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'ref', p.ref, 'email', p.email)), '[]'::jsonb)
                         from public.growth_prospects p
                        where p.workspace_id = ws and p.entrada = 'prospeccion' and p.rubro = r.rubro
                          and p.status = 'uncontacted' and not p.do_not_contact));
end $$;

-- De una lista de mails, los que se pueden usar: formato válido, que no estén
-- en el CRM (ni dados de baja ni ya escritos) y que no tengan cuenta en la app.
create or replace function mkt_prospeccion_nuevos(p_emails text[], p_ws uuid default null)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct a.e), '{}')
  from (select lower(trim(x)) as e from unnest(p_emails) x) a
  where a.e ~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
    and a.e !~ '@gmail\.com\.ar$'
    and a.e !~ '(trattoapp|noreply|no-reply|@example\.)'
    and not exists (select 1 from public.growth_prospects p
                     where p.workspace_id = coalesce(p_ws, public.crm_ws()) and lower(p.email) = a.e)
    and not exists (select 1 from auth.users u where lower(u.email) = a.e);
$$;

-- Guarda los proveedores elegidos ANTES de escribirles (estado "uncontacted").
-- p_items: [{email, nombre, empresa, telefono, rubro, zona, barrio, fuente_url, gancho, vuelta, campania}]
create or replace function mkt_prospeccion_guardar(p_items jsonb, p_ws uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := coalesce(p_ws, public.crm_ws());
  src uuid;
  it jsonb;
  em text;
  pid uuid;
  ref_ text;
  res jsonb := '[]'::jsonb;
begin
  select id into src from public.growth_sources where workspace_id = ws and key = 'prospeccion';
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    em := lower(trim(it->>'email'));
    if em is null or cardinality(public.mkt_prospeccion_nuevos(array[em], ws)) = 0 then continue; end if;
    insert into public.growth_prospects
      (workspace_id, kind, email, phone, first_name, company, rubro, zona, city, source_id, consent,
       status, entrada, utm_source, utm_medium, utm_campaign, tags, notes, datos)
    values (ws, 'provider', em, nullif(left(it->>'telefono', 40), ''), nullif(left(it->>'nombre', 80), ''),
            nullif(left(it->>'empresa', 120), ''), it->>'rubro', nullif(it->>'zona', ''),
            nullif(left(it->>'barrio', 80), ''), src, 'unknown', 'uncontacted', 'prospeccion',
            'prospeccion', 'email', left(it->>'campania', 80), array['prospeccion'],
            'Mail público encontrado en ' || coalesce(left(it->>'fuente_url', 300), 'una fuente pública'),
            jsonb_build_object('prospeccion', jsonb_build_object(
              'fuente_url', left(it->>'fuente_url', 300), 'gancho', left(it->>'gancho', 300),
              'vuelta', nullif(it->>'vuelta', '')::int,
              'fecha', (now() at time zone 'America/Argentina/Buenos_Aires')::date)))
    returning id, ref into pid, ref_;
    res := res || jsonb_build_object('id', pid, 'ref', ref_, 'email', em);
  end loop;
  return res;
end $$;

-- Marca como enviados los que ya salieron por Gmail. p_items: [{id, thread}]
create or replace function mkt_prospeccion_enviado(p_items jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare it jsonb; n int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.growth_prospects set
      status = 'contacted', contact_count = contact_count + 1, last_contact_at = now(),
      datos = jsonb_set(datos, '{prospeccion}', coalesce(datos->'prospeccion', '{}'::jsonb)
              || jsonb_build_object('gmail_thread', it->>'thread', 'enviado_at', now()))
    where id = (it->>'id')::uuid and entrada = 'prospeccion' and status = 'uncontacted';
    if found then
      n := n + 1;
      insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail, actor)
      select workspace_id, id, 'mensaje', 'Mail de presentación (Gmail)',
             jsonb_build_object('canal', 'gmail', 'thread', it->>'thread'), 'automation'
        from public.growth_prospects where id = (it->>'id')::uuid;
    end if;
  end loop;
  update public.growth_mkt_rotacion r set enviados = r.enviados + n
   where r.workspace_id = public.crm_ws()
     and r.ultima_vez = (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  return n;
end $$;

-- Lo que pasó después: p_tipo = 'interesado' | 'respondio' | 'no' (pidió que no le
-- escribamos más) | 'rebote' (la dirección no existe).
create or replace function mkt_prospeccion_respuesta(p_email text, p_tipo text, p_texto text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  select id into pid from public.growth_prospects
   where workspace_id = public.crm_ws() and lower(email) = lower(trim(p_email))
   order by created_at limit 1;
  if pid is null then return null; end if;
  update public.growth_prospects set
    status = case p_tipo when 'interesado' then 'interested' when 'respondio' then 'replied'
                         when 'no' then 'not_interested' when 'rebote' then 'no_response' else status end,
    consent = case when p_tipo = 'no' then 'opt_out' else consent end,
    consent_source = case when p_tipo = 'no' then 'Respondió que no le escribamos (Gmail)' else consent_source end,
    do_not_contact = do_not_contact or p_tipo in ('no', 'rebote'),
    last_reply_at = case when p_tipo in ('interesado', 'respondio', 'no') then now() else last_reply_at end,
    last_reply_text = coalesce(left(p_texto, 2000), last_reply_text),
    tags = case when p_tipo = 'rebote' and not ('rebote' = any(tags)) then tags || 'rebote'::text else tags end
  where id = pid;
  return pid;
end $$;

-- Números de los mails a proveedores (para el informe del día y el CMO).
create or replace function mkt_prospeccion_numeros(p_dias int default 7)
returns jsonb language sql stable security definer set search_path = '' as $$
  with p as (
    select * from public.growth_prospects
     where workspace_id = public.crm_ws() and entrada = 'prospeccion'
       and contacted_at >= now() - make_interval(days => greatest(1, least(p_dias, 365)))
  )
  select jsonb_build_object(
    'dias', p_dias,
    'enviados', count(*),
    'respondieron', count(*) filter (where last_reply_at is not null),
    'interesados', count(*) filter (where status = 'interested' or interested_at is not null),
    'pidieron_no', count(*) filter (where consent = 'opt_out'),
    'rebotes', count(*) filter (where 'rebote' = any(tags)),
    'registrados', count(*) filter (where registered_at is not null),
    'por_rubro', coalesce((select jsonb_object_agg(rubro, n) from
                   (select rubro, count(*) n from p group by rubro) x), '{}'::jsonb))
  from p;
$$;

revoke all on function mkt_rubro_del_dia(uuid), mkt_prospeccion_nuevos(text[], uuid),
  mkt_prospeccion_guardar(jsonb, uuid), mkt_prospeccion_enviado(jsonb),
  mkt_prospeccion_respuesta(text, text, text), mkt_prospeccion_numeros(int)
  from public, anon, authenticated;
