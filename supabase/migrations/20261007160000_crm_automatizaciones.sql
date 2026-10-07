-- CRM de Tratto: las secuencias de mails que corren solas
--
-- Cada automatización arranca cuando entra (o cambia) una persona que cumple
-- su filtro, y le escribe SOLO si dio permiso (consent = opt_in). Corre una
-- sola vez por persona y se corta sola si la persona se registra, hace su
-- primer pedido, pide la baja o apaga la publicidad en la app.
--
-- Formato de los textos (los arma como mail la función de envío):
--   * {{campo}} se reemplaza con datos de la persona (first_name, zona...) y
--     con lo que guardó la calculadora (calc_servicio, calc_precio_txt...).
--   * Línea en blanco = párrafo nuevo.
--   * Una línea sola con [Texto](url) = botón. {{link}} es el link personal
--     con seguimiento (cuenta el click y después el registro).
--   * El pie con el link de baja lo agrega el envío: no hace falta escribirlo.

create or replace function public.crm_instalar_automatizaciones()
returns int language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := public.crm_ws();
  l_calc uuid; l_bienv uuid; w uuid; n int := 0;
begin
  if ws is null then raise exception 'Falta el workspace de Tratto'; end if;
  select id into l_calc  from public.growth_tracking_links where workspace_id = ws and slug = 'mail-calculadora';
  select id into l_bienv from public.growth_tracking_links where workspace_id = ws and slug = 'mail-bienvenida';

  -- 1) Usó la calculadora y aceptó novedades → que pida su primer presupuesto
  if not exists (select 1 from public.growth_workflows where workspace_id = ws and name = 'Calculadora → primer pedido') then
    insert into public.growth_workflows (workspace_id, name, description, trigger, trigger_filter, active)
    values (ws, 'Calculadora → primer pedido',
      'Le manda a quien usó la calculadora (y aceptó novedades) su resultado y cómo pedir presupuestos. Si a los 3 días no se registró, un segundo y último mail.',
      'prospect_created',
      '{"all":[{"field":"tags","op":"has_tag","value":"calculadora"},{"field":"consent","op":"eq","value":"opt_in"},{"field":"kind","op":"eq","value":"customer"},{"field":"registered_at","op":"is_null"}]}',
      true) returning id into w;
    insert into public.growth_workflow_steps (workspace_id, workflow_id, position, type, config, on_true, on_false) values
    (ws, w, 0, 'send_link', jsonb_build_object('channel', 'email', 'link_id', l_calc, 'template_key', 'calc-1-resultado',
      'subject', 'Tu comparación: {{calc_servicio}}',
      'body', E'Hola {{first_name}},\n\nHoy comparaste lo que {{calc_estado_txt}} por "{{calc_servicio}}" en {{calc_zona}}: {{calc_precio_txt}}. El rango de referencia es de {{calc_min_txt}} a {{calc_max_txt}} {{calc_unidad}}, así que quedó {{calc_veredicto_txt}}.\n\nLa próxima vez podés saberlo antes de pagar: en Tratto contás qué necesitás y te llegan presupuestos de gente de tu zona para comparar. Pedir es gratis.\n\n[Pedir presupuestos en Tratto]({{link}})\n\nEquipo de Tratto'),
      null, null),
    (ws, w, 1, 'wait', '{"days":3}', null, null),
    (ws, w, 2, 'condition', '{"condition":{"field":"registered_at","op":"is_null"}}', 3, -1),
    (ws, w, 3, 'send_link', jsonb_build_object('channel', 'email', 'link_id', l_calc, 'template_key', 'calc-2-rubros',
      'subject', '¿Qué tenés que resolver este mes?',
      'body', E'Hola {{first_name}},\n\nEste es el último mail sobre la calculadora. En Tratto se pide de todo, no solo arreglos de la casa: un DJ para un cumpleaños, clases de inglés, una manicura, un flete, una fotógrafa, alguien que te lleve la contabilidad. Son 46 rubros.\n\nAsí funciona:\n1. Contás qué necesitás (o sacás una foto) y ves un precio de referencia.\n2. Proveedores de tu zona te mandan su presupuesto por el chat.\n3. Comparás qué incluye cada uno y elegís vos.\n\n[Ver Tratto]({{link}})\n\nEquipo de Tratto'),
      null, null);
    n := n + 1;
  end if;

  -- 2) Cliente registrado en la app, con permiso de publicidad, sin pedidos
  if not exists (select 1 from public.growth_workflows where workspace_id = ws and name = 'Cliente registrado → primer pedido') then
    insert into public.growth_workflows (workspace_id, name, description, trigger, trigger_filter, active)
    values (ws, 'Cliente registrado → primer pedido',
      'A los 2 días de registrarse, si todavía no hizo ningún pedido, le cuenta cómo hacer el primero. Un solo mail.',
      'prospect_created',
      '{"all":[{"field":"tags","op":"has_tag","value":"registro_app"},{"field":"consent","op":"eq","value":"opt_in"},{"field":"kind","op":"eq","value":"customer"},{"field":"activated_at","op":"is_null"}]}',
      true) returning id into w;
    insert into public.growth_workflow_steps (workspace_id, workflow_id, position, type, config, on_true, on_false) values
    (ws, w, 0, 'wait', '{"days":2}', null, null),
    (ws, w, 1, 'condition', '{"condition":{"field":"activated_at","op":"is_null"}}', 2, -1),
    (ws, w, 2, 'send_link', jsonb_build_object('channel', 'email', 'link_id', l_bienv, 'template_key', 'cliente-1-primer-pedido',
      'subject', 'Tu primer pedido en Tratto, en un minuto',
      'body', E'Hola {{first_name}},\n\nYa tenés tu cuenta en Tratto. Cuando necesites algo, el pedido se hace así:\n1. Tocá "Pedir un servicio" y contá qué necesitás. Si es algo que se ve, sacale una foto: te damos un precio de referencia.\n2. Proveedores de tu zona y de ese rubro te mandan su presupuesto por el chat.\n3. Comparás qué incluye cada uno y elegís vos. Pedir no cuesta nada.\n\nSirve para cualquiera de los 46 rubros: eventos, clases, belleza, mascotas, autos y traslados, trámites, la casa y más.\n\n[Hacer mi primer pedido]({{link}})\n\nEquipo de Tratto'),
      null, null);
    n := n + 1;
  end if;

  -- 3) Proveedor registrado, con permiso de publicidad, sin servicio publicado
  if not exists (select 1 from public.growth_workflows where workspace_id = ws and name = 'Proveedor registrado → publicar servicio') then
    insert into public.growth_workflows (workspace_id, name, description, trigger, trigger_filter, active)
    values (ws, 'Proveedor registrado → publicar servicio',
      'A los 2 días de registrarse como proveedor, si todavía no publicó su servicio, le explica cómo hacerlo para empezar a recibir pedidos. Un solo mail.',
      'prospect_created',
      '{"all":[{"field":"tags","op":"has_tag","value":"registro_app"},{"field":"consent","op":"eq","value":"opt_in"},{"field":"kind","op":"eq","value":"provider"},{"field":"activated_at","op":"is_null"}]}',
      true) returning id into w;
    insert into public.growth_workflow_steps (workspace_id, workflow_id, position, type, config, on_true, on_false) values
    (ws, w, 0, 'wait', '{"days":2}', null, null),
    (ws, w, 1, 'condition', '{"condition":{"field":"activated_at","op":"is_null"}}', 2, -1),
    (ws, w, 2, 'send_link', jsonb_build_object('channel', 'email', 'link_id', l_bienv, 'template_key', 'proveedor-1-publicar',
      'subject', 'Publicá tu servicio y empezá a recibir pedidos',
      'body', E'Hola {{first_name}},\n\nTu cuenta de proveedor en Tratto ya está creada. Para que te lleguen pedidos de tu zona falta un paso: publicar tu servicio con el rubro, la zona donde trabajás y tu precio desde.\n\nCuando alguien de tu zona pide algo de tu rubro, te avisamos y le mandás tu presupuesto por el chat. No hay abono mensual: solo hay una comisión del 3% cuando cobrás a través de la app.\n\n[Publicar mi servicio]({{link}})\n\nEquipo de Tratto'),
      null, null);
    n := n + 1;
  end if;
  return n;
end $$;

revoke all on function public.crm_instalar_automatizaciones() from public, anon, authenticated;
select public.crm_instalar_automatizaciones();
