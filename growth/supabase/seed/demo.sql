-- Growth OS · Datos de demostración
--
-- Crea el workspace "Demo" (is_demo = true) con datos FICTICIOS:
-- 520 prospectos, conversaciones, campañas, links, gasto, automatizaciones y
-- 100 usuarios de la app con sus eventos. Nombres inventados, emails
-- @example.com, teléfonos +54 9 11 0000-xxxx y cuentas @demo_.
-- Ningún dato pertenece a personas reales y nada se envía de verdad: los
-- mensajes quedan como 'mock_sent'.
--
-- Requisito: que exista el usuario dueño del workspace (ver seed/README.md).
-- Se puede correr más de una vez: si el workspace "demo" ya existe, no hace nada.
-- Los eventos de la app pasan por growth_ingest_event, la misma función que
-- usa la app real, así que los usuarios, instalaciones, registros y
-- activaciones se generan con la lógica de producción.

do $seed$
declare
  owner   uuid := (select id from auth.users where email = 'demo.growth@example.com');
  ws      uuid;
  src     record;
  srcs    uuid[]; skeys text[];
  camps   uuid[]; links uuid[]; wfs uuid[];
  nombres text[] := array['Sofía','Martina','Lucía','Valentina','Camila','Julieta','Florencia','Agustina','Micaela','Paula',
                          'Mateo','Santiago','Benjamín','Tomás','Joaquín','Lautaro','Facundo','Nicolás','Matías','Juan',
                          'Carla','Romina','Daniela','Natalia','Gabriel','Diego','Martín','Federico','Ezequiel','Rocío'];
  apellidos text[] := array['González','Rodríguez','Gómez','Fernández','López','Díaz','Martínez','Pérez','Romero','Sosa',
                            'Álvarez','Torres','Ruiz','Ramírez','Flores','Benítez','Acosta','Medina','Herrera','Suárez',
                            'Aguirre','Giménez','Gutiérrez','Pereyra','Molina','Castro','Ortiz','Silva','Núñez','Luna'];
  ciudades text[] := array['CABA','CABA','CABA','La Plata, Buenos Aires','Quilmes, Buenos Aires','San Isidro, Buenos Aires',
                           'Lomas de Zamora, Buenos Aires','Tigre, Buenos Aires','Rosario','Córdoba','Mar del Plata','Mendoza'];
  empresas text[] := array['Plomería Sur','Pinturas Delta','Fletes Ya','Limpieza Brillo','Jardines del Norte','Clases Pro',
                           'Eventos Luna','Mecánica Oeste','Diseño Nube','Cerrajería 24'];
  tags_pool text[] := array['zona norte','zona sur','profesional','referido','evento','hogar','comercio'];
  respuestas_si text[] := array['Me interesa, ¿cómo la descargo?','Dale, pasame el link','Genial, la quiero probar',
                                'Sí, ¿cómo funciona?','Perfecto, mandame el link así la bajo'];
  respuestas_duda text[] := array['¿Cuánto sale?','¿Es segura? No quiero dar mis datos','No tengo tiempo ahora, ¿después me escribís?',
                                  '¿Hay gente de mi zona?','¿Tengo que pagar algo para pedir?'];
  respuestas_no text[] := array['No me interesa, gracias','No gracias','Baja por favor','No quiero más mensajes'];
  plantillas text[] := array['intro_a','intro_b','intro_corta','intro_problema'];
  i int; k int; n int;
  pid uuid; conv uuid; ch text; sk text; sidx int; cid uuid; lid uuid;
  t0 timestamptz; tc timestamptz; tr timestamptz; ti timestamptz; tl timestamptz; tk timestamptz;
  tin timestamptz; treg timestamptz; tact timestamptz; t timestamptz;
  st text; interest text; reply_kind text; fn text; ln text; tok text; plat text;
  res jsonb; uid uuid; usuarios int;
begin
  if owner is null then raise exception 'Primero creá el usuario demo.growth@example.com (ver seed/README.md)'; end if;
  if exists (select 1 from public.growth_workspaces where slug = 'demo') then
    raise notice 'El workspace demo ya existe: no se modifica.'; return;
  end if;
  perform setseed(0.42);

  insert into public.growth_workspaces (name, slug, is_demo, created_by)
  values ('Demo · App de servicios', 'demo', true, owner) returning id into ws;

  update public.growth_app_settings set
    app_name = 'Tratto (demo)',
    description = 'Marketplace de servicios: la persona cuenta qué necesita y recibe presupuestos de proveedores de su zona.',
    play_store_url = 'https://play.google.com/store/apps/details?id=com.example.growthdemo',
    app_store_url = 'https://apps.apple.com/ar/app/id0000000000',
    website = 'https://example.com/app-demo',
    category = 'Servicios', audience = 'Personas que necesitan un servicio y proveedores independientes de Argentina',
    value_prop = 'Pedí lo que necesitás y recibí presupuestos de gente de tu zona sin llamar a diez personas',
    features = 'Precio de referencia con IA, comparador de presupuestos, chat privado, calificaciones',
    benefits = 'Ahorrás tiempo, comparás precios y elegís con información',
    price = 'Gratis para quien pide', monetization = 'Comisión al proveedor cuando cobra por la app',
    activation_event = 'first_action', active_window_days = 7
  where workspace_id = ws;

  insert into public.growth_knowledge (workspace_id, kind, title, content, sort) values
    (ws,'problem','Qué problema resuelve','Encontrar a alguien confiable para un trabajo sin llamar a diez personas y sin saber cuánto debería costar.',1),
    (ws,'feature','Precio de referencia','Con una foto o una descripción, la app da un precio de referencia para saber si un presupuesto tiene sentido.',2),
    (ws,'feature','Comparador de presupuestos','La IA muestra qué incluye y qué no incluye cada presupuesto recibido.',3),
    (ws,'feature','Chat privado','La conversación con el proveedor ocurre dentro de la app; los datos de contacto no quedan expuestos.',4),
    (ws,'pricing','Precio','Para quien pide es gratis. Los proveedores no pagan abono mensual.',5),
    (ws,'audience','Para quién es','Personas que necesitan un servicio (hogar, autos, clases, eventos, digital) y proveedores independientes.',6),
    (ws,'faq','¿Hay proveedores en mi zona?','La app muestra proveedores del rubro y de la zona del pedido; la cobertura depende de cada rubro.',7),
    (ws,'terms','Rubros no admitidos','No se admiten rubros que requieren matrícula (gas, electricidad, salud).',8);

  insert into public.growth_objections (workspace_id, label, patterns, response) values
    (ws,'Precio',array['cuanto sale','cuánto sale','cuesta','precio','pagar'],'Para pedir es gratis: no pagás nada por publicar tu pedido ni por chatear.'),
    (ws,'Seguridad',array['segura','seguro','mis datos','estafa','confiable'],'El chat es dentro de la app y tus datos no quedan expuestos. Además ves las calificaciones de cada proveedor.'),
    (ws,'Falta de tiempo',array['no tengo tiempo','despues','después','ahora no'],'Pedir lleva un minuto: contás qué necesitás y los presupuestos te llegan solos.'),
    (ws,'Cobertura',array['mi zona','mi barrio','llegan a'],'La app busca proveedores de tu zona y del rubro; si no hay, te avisa.'),
    (ws,'Ya tengo a alguien',array['ya tengo','tengo uno','mi plomero','conozco a alguien'],'¡Bien! La app te sirve para comparar o para los rubros en los que no tenés a nadie.'),
    (ws,'Desconfianza en apps',array['no uso apps','no me gustan las apps','otra app'],'También funciona desde la web, sin instalar nada.');

  select array_agg(id order by key), array_agg(key order by key) into srcs, skeys from public.growth_sources where workspace_id = ws;

  -- Campañas (fuente principal, presupuesto, meta)
  insert into public.growth_campaigns (workspace_id, name, description, goal_metric, goal_target, status, budget, start_date, end_date) values
    (ws,'Lanzamiento Instagram CABA','Mensajes directos a cuentas de barrios de CABA','installs',60,'active',150000,(now()-interval '110 days')::date,null),
    (ws,'Influencers zona norte','Tres micro-influencers con código propio','installs',40,'active',300000,(now()-interval '80 days')::date,null),
    (ws,'Google Ads búsqueda','Búsquedas tipo "plomero cerca"','installs',50,'active',250000,(now()-interval '60 days')::date,null),
    (ws,'Programa de referidos','Cada usuario invita a otro','registrations',30,'active',0,(now()-interval '100 days')::date,null),
    (ws,'TikTok orgánico','Videos cortos de antes/después','clicks',200,'paused',0,(now()-interval '90 days')::date,null),
    (ws,'Email a profesionales','Proveedores que se anotaron en la lista de espera','activations',25,'finished',20000,(now()-interval '120 days')::date,(now()-interval '30 days')::date);
  -- (todas tienen el mismo created_at: se ordenan por nombre explícitamente)
  select array_agg(c.id order by v.n) into camps
    from (values ('Lanzamiento Instagram CABA',1),('Influencers zona norte',2),('Google Ads búsqueda',3),
                 ('Programa de referidos',4),('TikTok orgánico',5),('Email a profesionales',6)) v(name, n)
    join public.growth_campaigns c on c.name = v.name and c.workspace_id = ws;

  insert into public.growth_campaign_sources (campaign_id, source_id, workspace_id)
  select c, s, ws from (values
    (camps[1], (select id from public.growth_sources where workspace_id = ws and key = 'instagram')),
    (camps[2], (select id from public.growth_sources where workspace_id = ws and key = 'influencers')),
    (camps[3], (select id from public.growth_sources where workspace_id = ws and key = 'google')),
    (camps[4], (select id from public.growth_sources where workspace_id = ws and key = 'referral')),
    (camps[5], (select id from public.growth_sources where workspace_id = ws and key = 'tiktok')),
    (camps[6], (select id from public.growth_sources where workspace_id = ws and key = 'email'))) v(c, s);

  -- Gasto diario (solo campañas pagas)
  insert into public.growth_spend (workspace_id, spent_on, source_id, campaign_id, amount, note)
  select ws, d::date, cs.source_id, cs.campaign_id, round((800 + random() * 2200)::numeric, 0), 'demo'
    from public.growth_campaign_sources cs
    join public.growth_campaigns c on c.id = cs.campaign_id
    cross join generate_series(c.start_date::timestamptz, coalesce(c.end_date::timestamptz, now()), interval '1 day') d
   where cs.workspace_id = ws and c.budget > 0;

  -- Links trackeados: uno por campaña + uno general
  insert into public.growth_tracking_links (workspace_id, slug, name, campaign_id, source_id, destination, utm_medium)
  select ws, 'demo-' || lower(regexp_replace(translate(c.name, 'áéíóúñ', 'aeioun'), '[^a-zA-Z0-9]+', '-', 'g')),
         c.name, c.id, cs.source_id, 'smart', 'dm'
    from public.growth_campaigns c join public.growth_campaign_sources cs on cs.campaign_id = c.id
   where c.workspace_id = ws;
  insert into public.growth_tracking_links (workspace_id, slug, name, source_id, destination, utm_medium)
  values (ws, 'demo-bio', 'Link de la bio', (select id from public.growth_sources where workspace_id = ws and key = 'organic'), 'smart', 'bio');
  select array_agg(l.id order by x.n) into links
    from unnest(camps) with ordinality x(cid, n) join public.growth_tracking_links l on l.campaign_id = x.cid;

  -- Automatizaciones (se activan al final para no dispararse con la carga)
  insert into public.growth_workflows (workspace_id, name, description, trigger, active) values
    (ws,'Bienvenida a prospectos nuevos','Primer mensaje, espera respuesta y seguimiento','prospect_created',false),
    (ws,'Interesados → link de descarga','Cuando alguien muestra interés le manda su link personal','status_changed',false),
    (ws,'Recuperar a los que hicieron click','Si hizo click y no instaló en 2 días, pregunta si pudo','manual',false);
  select array_agg(id order by name) into wfs from public.growth_workflows where workspace_id = ws;
  -- wfs[1] = Bienvenida, wfs[2] = Interesados, wfs[3] = Recuperar
  update public.growth_workflows set trigger_filter = '{"field":"status","op":"eq","value":"interested"}' where id = wfs[2];
  insert into public.growth_workflow_steps (workspace_id, workflow_id, position, type, config, on_true, on_false) values
    (ws, wfs[1], 0, 'ai_analyze', '{}', null, null),
    (ws, wfs[1], 1, 'send_message', '{"channel":"instagram","ai":true,"template_key":"wf_bienvenida"}', null, null),
    (ws, wfs[1], 2, 'wait_reply', '{"days":2}', 4, 3),
    (ws, wfs[1], 3, 'send_message', '{"channel":"instagram","body":"Hola {{first_name}}! Te escribo de nuevo por si se te pasó. ¿Te cuento cómo funciona?","template_key":"wf_seguimiento"}', null, null),
    (ws, wfs[1], 4, 'notify', '{"title":"{{first_name}} terminó la bienvenida"}', null, null),
    (ws, wfs[2], 0, 'send_link', jsonb_build_object('channel','instagram','link_id',links[1],'body','¡Genial {{first_name}}! Acá tenés tu link: {{link}}','template_key','wf_link'), null, null),
    (ws, wfs[2], 1, 'wait', '{"days":1}', null, null),
    (ws, wfs[2], 2, 'condition', '{"condition":{"field":"clicked_at","op":"is_null"}}', 3, -1),
    (ws, wfs[2], 3, 'create_task', '{"title":"Escribirle a {{first_name}}: no abrió el link","due_days":1}', null, null),
    (ws, wfs[3], 0, 'condition', '{"condition":{"field":"installed_at","op":"is_null"}}', 1, -1),
    (ws, wfs[3], 1, 'send_message', '{"channel":"whatsapp","body":"Hola {{first_name}}! ¿Pudiste instalar la app? Si tuviste algún problema avisame.","template_key":"wf_recupero"}', null, null),
    (ws, wfs[3], 2, 'add_tag', '{"tag":"recupero"}', null, null);

  -- ── Prospectos ──
  for i in 1..520 loop
    sidx := 1 + floor(random() * 6)::int;            -- campaña 1..6
    cid := camps[sidx];
    sk := (array['instagram','influencers','google','referral','tiktok','email'])[sidx];
    if random() < 0.15 then cid := null; sk := (array['organic','facebook','whatsapp','offline'])[1 + floor(random()*4)::int]; end if;
    ch := case sk when 'email' then 'email' when 'referral' then 'whatsapp' when 'whatsapp' then 'whatsapp'
                  when 'tiktok' then 'tiktok' when 'facebook' then 'facebook' when 'google' then 'email' else 'instagram' end;
    fn := nombres[1 + floor(random()*30)::int]; ln := apellidos[1 + floor(random()*30)::int];
    t0 := now() - (random() * 118 + 0.5) * interval '1 day';

    -- Recorrido por el funnel (cada etapa con su probabilidad y su demora)
    tc := null; tr := null; ti := null; tl := null; tk := null; tin := null; treg := null; tact := null;
    st := 'new'; interest := 'unknown'; reply_kind := null;
    if random() < 0.80 then tc := t0 + random() * interval '2 days'; st := 'contacted'; end if;
    if tc is not null and tc < now() and random() < 0.50 then
      tr := tc + (0.1 + random() * 3) * interval '1 day'; st := 'replied';
      reply_kind := case when random() < 0.62 then 'si' when random() < 0.6 then 'duda' else 'no' end;
      if reply_kind = 'no' then st := 'not_interested'; interest := 'none';
      elsif reply_kind = 'duda' then interest := 'medium';
      else interest := 'high'; end if;
    end if;
    if reply_kind in ('si','duda') and (reply_kind = 'si' or random() < 0.45) then
      ti := tr + random() * interval '12 hours'; st := 'interested';
      if random() < 0.9 then tl := ti + random() * interval '10 hours'; st := 'link_sent'; end if;
    end if;
    if tl is not null and random() < 0.75 then tk := tl + random() * interval '30 hours'; st := 'clicked'; end if;
    if tk is not null and random() < 0.70 then tin := tk + random() * interval '3 hours'; st := 'installed'; end if;
    if tin is not null and random() < 0.80 then treg := tin + random() * interval '20 hours'; st := 'registered'; end if;
    if treg is not null and random() < 0.72 then tact := treg + random() * interval '4 days'; st := 'activated'; end if;
    -- Nada en el futuro: se corta en la última etapa ya ocurrida
    if tact > now() then tact := null; st := 'registered'; end if;
    if treg > now() then treg := null; tact := null; st := 'installed'; end if;
    if tin > now() then tin := null; treg := null; st := 'clicked'; end if;
    if tk > now() then tk := null; tin := null; st := 'link_sent'; end if;
    if tl > now() then tl := null; tk := null; st := case when ti is null then st else 'interested' end; end if;
    if ti > now() then ti := null; tl := null; st := 'replied'; end if;
    if tr > now() then tr := null; ti := null; tl := null; reply_kind := null; st := 'contacted'; interest := 'unknown'; end if;
    if tc > now() then tc := null; st := 'new'; end if;
    if st = 'contacted' and t0 < now() - interval '20 days' and random() < 0.35 then st := 'no_response'; end if;

    insert into public.growth_prospects (workspace_id, first_name, last_name, company, instagram, tiktok, email, phone, city,
        source_id, campaign_id, status, interest, tags, consent, consent_source, created_at,
        contacted_at, replied_at, interested_at, link_sent_at, clicked_at, installed_at, registered_at, activated_at)
    values (ws, fn, ln,
        case when random() < 0.18 then empresas[1 + floor(random()*10)::int] end,
        case when ch in ('instagram','facebook') or random() < 0.3 then '@demo_' || lower(translate(fn, 'áéíóúñ', 'aeioun')) || i end,
        case when ch = 'tiktok' then '@demo_tt' || i end,
        case when ch = 'email' or random() < 0.5 then lower(translate(fn || '.' || ln, 'áéíóúñÁÉÍÓÚ', 'aeiounAEIOU')) || i || '@example.com' end,
        case when ch = 'whatsapp' or random() < 0.35 then '+54 9 11 0000-' || lpad(i::text, 4, '0') end,
        ciudades[1 + floor(random()*12)::int],
        (select id from public.growth_sources where workspace_id = ws and key = sk), cid,
        case when st = 'not_interested' then 'replied' else st end, interest,
        case when random() < 0.4 then array[tags_pool[1 + floor(random()*7)::int]] else '{}' end,
        case when ch in ('whatsapp') or random() < 0.15 then 'opt_in' else 'unknown' end,
        case when ch in ('whatsapp') then 'Formulario de la web (demo)' end,
        t0, tc, tr, ti, tl, tk, tin, treg, tact)
    returning id into pid;
    -- Conversación
    if tc is not null then
      insert into public.growth_conversations (workspace_id, prospect_id, channel, created_at)
      values (ws, pid, ch, tc) returning id into conv;
      n := case when tr is null then 1 + floor(random() * 3)::int else 1 end;
      for k in 1..n loop
        t := tc + (k - 1) * interval '2 days';
        exit when t > now();
        insert into public.growth_messages (workspace_id, conversation_id, prospect_id, direction, channel, body, status,
                                            provider, ai_generated, template_key, campaign_id, created_at)
        values (ws, conv, pid, 'out', ch,
                case when k = 1 then 'Hola ' || fn || '! Soy del equipo de Tratto (demo). Pedí lo que necesitás y recibí presupuestos de gente de tu zona. ¿Te paso el link?'
                     else 'Hola ' || fn || ', te escribo de nuevo por si se te pasó. ¿Te cuento cómo funciona?' end,
                'mock_sent', 'mock', random() < 0.4, case when k = 1 then plantillas[1 + floor(random()*4)::int] else 'seguimiento' end,
                cid, t);
      end loop;
      if tr is not null then
        insert into public.growth_messages (workspace_id, conversation_id, prospect_id, direction, channel, body, status, provider, intent, created_at)
        values (ws, conv, pid, 'in', ch,
                case reply_kind when 'si' then respuestas_si[1 + floor(random()*5)::int]
                                when 'duda' then respuestas_duda[1 + floor(random()*5)::int]
                                else respuestas_no[1 + floor(random()*4)::int] end,
                'received', 'manual', case reply_kind when 'si' then 'high' when 'duda' then 'medium' else 'none' end, tr);
        -- La respuesta pasa al prospecto a "respondió"; si dijo que no, queda "no interesado"
        if reply_kind = 'no' then
          update public.growth_prospects set status = 'not_interested',
                 consent = case when random() < 0.5 then 'opt_out' else consent end,
                 consent_source = 'Pidió la baja (demo)'
           where id = pid;
        end if;
      end if;
      if tl is not null then
        lid := coalesce(links[sidx], links[1]);
        insert into public.growth_messages (workspace_id, conversation_id, prospect_id, direction, channel, body, status,
                                            provider, ai_generated, template_key, campaign_id, created_at)
        values (ws, conv, pid, 'out', ch, '¡Genial ' || fn || '! Acá tenés el link para descargarla: https://example.com/l/demo',
                'mock_sent', 'mock', false, 'link', cid, tl);
      end if;
    end if;

    -- Click en el link personal
    if tk is not null then
      plat := case when random() < 0.68 then 'android' else 'ios' end;
      tok := encode(extensions.gen_random_bytes(12), 'hex');
      insert into public.growth_link_clicks (workspace_id, link_id, prospect_id, click_token, device, target, user_agent, created_at)
      values (ws, coalesce(links[sidx], links[1]), pid, tok, plat, case plat when 'android' then 'play' else 'appstore' end,
              'demo', tk);
      insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail, created_at)
      values (ws, pid, 'click', 'Hizo click en su link', jsonb_build_object('device', plat), tk);

      -- Lo que hace en la app (misma función que usa la app real)
      if tin is not null then
        perform public.growth_ingest_event(ws, jsonb_build_object('event','install','external_user_id','demo-p' || i,
          'click_token', tok, 'prospect_id', pid, 'platform', plat, 'name', fn || ' ' || ln, 'occurred_at', tin));
        perform public.growth_ingest_event(ws, jsonb_build_object('event','open','external_user_id','demo-p' || i,
          'platform', plat, 'occurred_at', tin + interval '2 minutes'));
      end if;
      if treg is not null then
        perform public.growth_ingest_event(ws, jsonb_build_object('event','register','external_user_id','demo-p' || i,
          'platform', plat, 'occurred_at', treg, 'properties', jsonb_build_object('method', case when random() < 0.6 then 'google' else 'email' end)));
        if random() < 0.85 then
          perform public.growth_ingest_event(ws, jsonb_build_object('event','onboarding_complete','external_user_id','demo-p' || i,
            'platform', plat, 'occurred_at', treg + interval '5 minutes'));
        end if;
      end if;
      if tact is not null then
        perform public.growth_ingest_event(ws, jsonb_build_object('event','first_action','external_user_id','demo-p' || i,
          'platform', plat, 'occurred_at', tact, 'properties', jsonb_build_object('accion','primer pedido')));
      end if;
    end if;
  end loop;

  -- ── Usuarios que llegaron solos (sin ser prospectos) hasta completar 100 ──
  select count(*) into usuarios from public.growth_app_users where workspace_id = ws;
  i := 0;
  while usuarios < 100 loop
    i := i + 1;
    plat := case when random() < 0.62 then 'android' when random() < 0.9 then 'ios' else 'web' end;
    fn := nombres[1 + floor(random()*30)::int]; ln := apellidos[1 + floor(random()*30)::int];
    tin := now() - (random() * 100 + 0.2) * interval '1 day';
    sk := (array['organic','organic','google','referral','instagram','tiktok','offline'])[1 + floor(random()*7)::int];
    tok := null;
    -- Algunos llegaron por un link (click anónimo, sin prospecto)
    if random() < 0.4 then
      tok := encode(extensions.gen_random_bytes(12), 'hex');
      lid := links[1 + floor(random() * array_length(links, 1))::int];
      insert into public.growth_link_clicks (workspace_id, link_id, click_token, device, target, user_agent, created_at)
      values (ws, lid, tok, case when plat = 'web' then 'desktop' else plat end,
              case plat when 'android' then 'play' when 'ios' then 'appstore' else 'web' end, 'demo', tin - interval '5 minutes');
    end if;
    perform public.growth_ingest_event(ws, jsonb_build_object('event','install','external_user_id','demo-u' || i,
      'click_token', tok, 'platform', plat, 'source', sk, 'name', fn || ' ' || ln,
      'email', 'usuario' || i || '@example.com', 'occurred_at', tin));
    perform public.growth_ingest_event(ws, jsonb_build_object('event','open','external_user_id','demo-u' || i, 'occurred_at', tin + interval '1 minute'));
    if random() < 0.7 then
      treg := tin + random() * interval '1 day';
      if treg < now() then
        perform public.growth_ingest_event(ws, jsonb_build_object('event','register','external_user_id','demo-u' || i, 'occurred_at', treg));
        if random() < 0.65 then
          tact := treg + random() * interval '3 days';
          if tact < now() then
            perform public.growth_ingest_event(ws, jsonb_build_object('event','first_action','external_user_id','demo-u' || i, 'occurred_at', tact));
          end if;
        end if;
      end if;
    end if;
    select count(*) into usuarios from public.growth_app_users where workspace_id = ws;
  end loop;

  -- ── Sesiones (retención) y pagos de los usuarios activados ──
  for uid, t, plat in select id, activated_at, platform from public.growth_app_users where workspace_id = ws and activated_at is not null loop
    for k in 1..60 loop
      exit when t + k * interval '1 day' > now();
      -- Probabilidad de volver cada día: baja con el tiempo
      if random() < 0.55 * exp(-k / 18.0) + 0.04 then
        perform public.growth_ingest_event(ws, jsonb_build_object('event','session_start',
          'external_user_id', (select external_user_id from public.growth_app_users where id = uid), 'platform', plat,
          'occurred_at', t + k * interval '1 day' + random() * interval '10 hours',
          'properties', jsonb_build_object('duration_s', 60 + floor(random() * 600)::int)));
      end if;
    end loop;
    if random() < 0.22 then
      perform public.growth_ingest_event(ws, jsonb_build_object('event','purchase',
        'external_user_id', (select external_user_id from public.growth_app_users where id = uid),
        'amount', (500 + floor(random() * 6000))::int, 'occurred_at', least(now(), t + random() * interval '20 days')));
    end if;
  end loop;

  -- ── Ejecuciones de automatizaciones ya terminadas (historial) ──
  insert into public.growth_workflow_runs (workspace_id, workflow_id, prospect_id, status, current_step, log, started_at, finished_at, updated_at)
  select ws, wfs[1], p.id, 'done', 4,
         jsonb_build_array(jsonb_build_object('at', p.contacted_at, 'step', 1, 'type', 'send_message', 'info', 'Mensaje por instagram: mock_sent'),
                           jsonb_build_object('at', coalesce(p.replied_at, p.contacted_at + interval '2 days'), 'step', 2, 'type', 'wait_reply',
                                              'info', case when p.replied_at is null then 'No respondió a tiempo' else 'Respondió' end)),
         p.contacted_at, coalesce(p.replied_at, p.contacted_at + interval '2 days'), coalesce(p.replied_at, p.contacted_at + interval '2 days')
    from public.growth_prospects p
   where p.workspace_id = ws and p.contacted_at is not null and p.contacted_at < now() - interval '3 days'
   order by p.created_at desc limit 120;

  -- Tareas de ejemplo
  insert into public.growth_tasks (workspace_id, prospect_id, title, due_at)
  select ws, id, 'Escribirle a ' || first_name || ': no abrió el link', now() + (random() * 3) * interval '1 day'
    from public.growth_prospects where workspace_id = ws and status = 'link_sent' limit 8;

  -- La línea de tiempo usa la fecha real de cada cosa, no la de la carga
  update public.growth_timeline t set created_at = p.created_at
    from public.growth_prospects p where t.prospect_id = p.id and t.workspace_id = ws and t.type = 'created';
  update public.growth_timeline t set created_at = m.created_at
    from public.growth_messages m where t.workspace_id = ws and t.type in ('message_out','message_in')
     and m.id = (t.detail->>'message_id')::uuid;
  update public.growth_timeline t set created_at = coalesce(u.installed_at, u.created_at)
    from public.growth_app_users u where t.app_user_id = u.id and t.workspace_id = ws and t.type = 'linked';
  update public.growth_timeline t set created_at = coalesce(p.replied_at, p.created_at)
    from public.growth_prospects p where t.prospect_id = p.id and t.workspace_id = ws and t.type = 'status';
  update public.growth_conversations c set unread = 0 where c.workspace_id = ws and c.last_message_at < now() - interval '3 days';

  -- Notificaciones: quedan sin leer solo las de los últimos 3 días
  update public.growth_notifications set read = true where workspace_id = ws;
  update public.growth_notifications n set read = false, created_at = coalesce(
           (select max(m.created_at) from public.growth_messages m where m.prospect_id = n.prospect_id and m.direction = 'in'), n.created_at)
   where n.workspace_id = ws and n.type = 'reply' and n.prospect_id in
         (select id from public.growth_prospects where workspace_id = ws and last_reply_at > now() - interval '3 days');
  update public.growth_notifications n set read = false, created_at = coalesce(u.activated_at, u.registered_at, u.installed_at, n.created_at)
    from public.growth_app_users u
   where n.workspace_id = ws and n.app_user_id = u.id and n.type in ('install','registration','activation')
     and coalesce(u.activated_at, u.registered_at, u.installed_at) > now() - interval '3 days';

  -- Activa las automatizaciones para lo que se cargue de ahora en más
  update public.growth_workflows set active = true where id in (wfs[1], wfs[2]);
  raise notice 'Demo creada: workspace %, % prospectos, % usuarios', ws,
    (select count(*) from public.growth_prospects where workspace_id = ws), usuarios;
end $seed$;
