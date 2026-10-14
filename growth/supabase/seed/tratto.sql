-- Growth OS · Workspace real de Tratto (sin datos ficticios)
--
-- Carga App Settings, base de conocimiento y objeciones con información
-- verificada de la app (ficha de tiendas, términos). No crea prospectos ni
-- usuarios: esos llegan de verdad (formularios, importación, growth-event).
--
-- Dueño inicial: el usuario indicado abajo. Cambialo por tu propia cuenta
-- (o agregala después desde Settings → Workspace).
-- Google Play / App Store quedan vacíos hasta que la app esté publicada para
-- todo el público: mientras tanto los links trackeados van a la web (PWA).

do $tratto$
declare
  owner uuid := (select id from auth.users where email = 'demo.growth@example.com');
  ws uuid;
begin
  if owner is null then raise exception 'No existe el usuario dueño'; end if;
  if exists (select 1 from public.growth_workspaces where slug = 'tratto') then
    raise notice 'El workspace tratto ya existe: no se modifica.'; return;
  end if;
  insert into public.growth_workspaces (name, slug, is_demo, created_by)
  values ('Tratto', 'tratto', false, owner) returning id into ws;

  update public.growth_app_settings set
    app_name = 'Tratto: servicios cerca tuyo',
    description = 'Marketplace de servicios de Argentina: la persona cuenta qué necesita (o saca una foto), recibe presupuestos de quienes ofrecen ese servicio en su zona, y elige el que más le conviene.',
    website = 'https://www.trattoapp.com.ar',
    category = 'Casa y hogar / servicios',
    audience = 'Personas mayores de 18 años de Argentina que necesitan un servicio (hogar, limpieza, autos y traslados, clases, eventos, digital, trámites, belleza, mascotas) y quienes ofrecen esos servicios de forma independiente.',
    value_prop = 'Pedí lo que necesitás y recibí presupuestos de profesionales de tu zona, sin llamar a diez personas',
    features = 'Precio de referencia a partir de una foto o de lo que escribís; comparador de presupuestos con IA (qué incluye y qué no cada uno); chat privado dentro de la app; calificaciones de otros clientes en el perfil de quien ofrece el servicio; más de 40 rubros.',
    benefits = 'Ahorra tiempo, permite comparar precios con información y elegir con tranquilidad; para quien ofrece el servicio, pedidos de gente de su zona y su rubro sin abono mensual.',
    price = 'Gratis para quien pide un servicio. Quienes ofrecen servicios se registran gratis, sin abono mensual.',
    monetization = 'Comisión del 3% a quien ofrece el servicio, solo cuando cobra a través de la app.',
    activation_event = 'first_action', active_window_days = 7
  where workspace_id = ws;

  insert into public.growth_knowledge (workspace_id, kind, title, content, sort) values
    (ws,'problem','Qué problema resuelve','Necesitás a alguien para un trabajo y no sabés a quién llamar ni cuánto debería costar. En Tratto contás qué necesitás y te llegan presupuestos de gente de tu zona.',1),
    (ws,'feature','Cómo funciona','1) Pedís: contás qué necesitás o le sacás una foto y recibís un precio de referencia. 2) Te cotizan: quienes ofrecen ese servicio en tu zona te mandan su presupuesto por el chat. 3) Elegís vos comparando qué incluye cada uno, cuánto sale y cuándo puede.',2),
    (ws,'feature','Precio de referencia','A partir de una foto o de lo que escribís, la app da un precio de referencia para saber si un presupuesto tiene sentido.',3),
    (ws,'feature','Comparador de presupuestos','La inteligencia artificial muestra qué incluye y qué no incluye cada presupuesto recibido.',4),
    (ws,'feature','Chat privado','Toda la conversación con quien ofrece el servicio es dentro de la app: tus datos no quedan expuestos.',5),
    (ws,'feature','Calificaciones','Quien ofrece el servicio tiene en su perfil las calificaciones de otros clientes.',6),
    (ws,'feature','Rubros','Más de 40 rubros (46): hogar (plomería, pintura, albañilería, techos, cerrajería, aire acondicionado, jardinería), limpieza, autos y traslados (mecánica, gomería, lavado, fletes y mudanzas), clases (apoyo escolar, idiomas, música, computación, manejo), eventos, digital (diseño, programación, redes, foto y video, soporte técnico), trámites, contabilidad, belleza, entrenamiento, mascotas y más.',7),
    (ws,'pricing','Precio para quien pide','Pedir un servicio, chatear y recibir presupuestos no cuesta nada.',8),
    (ws,'pricing','Precio para quienes ofrecen servicios','Registrarse es gratis y no hay abono mensual. Tratto cobra una comisión del 3% solo cuando quien ofrece el servicio cobra a través de la app.',9),
    (ws,'terms','Rubros no admitidos','Tratto no admite rubros que requieran matrícula (gas, electricidad, salud).',10),
    (ws,'terms','Edad','Hay que ser mayor de 18 años.',11),
    (ws,'faq','¿Dónde la consigo?','Está en https://www.trattoapp.com.ar y se puede instalar desde el navegador. La versión de Google Play está en prueba cerrada y la de App Store, en preparación.',12),
    (ws,'faq','Contacto','Soporte: trattoapp1@gmail.com',13);

  insert into public.growth_objections (workspace_id, label, patterns, response) values
    (ws,'Precio',array['cuanto sale','cuánto sale','cuanto cuesta','precio','cobran','pagar'],'Para pedir es gratis: publicar tu pedido, chatear y recibir presupuestos no cuesta nada.'),
    (ws,'Comisión (quienes ofrecen servicios)',array['comision','comisión','abono','cuanto me cobran'],'Registrarte es gratis y no hay abono mensual. Solo hay una comisión del 3% cuando cobrás a través de la app.'),
    (ws,'Seguridad de datos',array['mis datos','segura','seguro','estafa','confiable'],'Hablás con quien ofrece el servicio por un chat privado dentro de la app, así tus datos no quedan expuestos, y ves las calificaciones de otros clientes.'),
    (ws,'Ya tengo a alguien',array['ya tengo','tengo uno','conozco a alguien'],'¡Bien! Igual te sirve para comparar precios o para los rubros en los que no tenés a nadie de confianza.'),
    (ws,'No quiero instalar',array['no quiero instalar','no tengo espacio','otra app','no uso apps'],'Funciona desde el navegador en trattoapp.com.ar, sin instalar nada.'),
    (ws,'Rubro con matrícula',array['gasista','electricista','gas','medico','médico','enfermera'],'Por ahora Tratto no admite rubros que requieren matrícula (gas, electricidad, salud).');

  insert into public.growth_tracking_links (workspace_id, slug, name, source_id, destination, utm_medium)
  values (ws, 'tratto-bio', 'Link de la bio (Instagram)', (select id from public.growth_sources where workspace_id = ws and key = 'instagram'), 'smart', 'bio'),
         (ws, 'tratto-qr', 'Cartel con QR', (select id from public.growth_sources where workspace_id = ws and key = 'offline'), 'smart', 'qr');
end $tratto$;
