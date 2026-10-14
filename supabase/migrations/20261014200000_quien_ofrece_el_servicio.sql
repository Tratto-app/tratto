-- «Proveedor» → «quien ofrece el servicio» en los textos que ve la gente
-- (pedido del fundador, 14/10/2026). Solo textos: nombres de tablas, roles,
-- claves de plantillas y segmentos quedan igual. Idempotente (replace).

-- Ficha de la app que usa el CRM para escribir y responder.
update public.growth_app_settings set
  price = replace(price, 'Para el proveedor, sin abono mensual', 'Para quien ofrece el servicio, sin abono mensual'),
  audience = replace(audience, 'Proveedores: personas y pequeñas empresas', 'Quienes ofrecen servicios: personas y pequeñas empresas'),
  benefits = replace(benefits, 'Para el proveedor: pedidos', 'Para quien ofrece el servicio: pedidos'),
  features = replace(features, 'en el perfil de cada proveedor', 'en el perfil de quien ofrece el servicio'),
  description = replace(description, 'recibe presupuestos de proveedores de su zona y de ese rubro', 'recibe presupuestos de quienes ofrecen ese servicio en su zona'),
  monetization = replace(monetization, 'Comisión del 3% al proveedor solo', 'Comisión del 3% a quien ofrece el servicio, solo');

-- Base de conocimiento y objeciones.
update public.growth_knowledge set
  content = replace(replace(replace(replace(content,
    '2) Te cotizan: proveedores de tu zona y de ese rubro te mandan su presupuesto por el chat.', '2) Te cotizan: quienes ofrecen ese servicio en tu zona te mandan su presupuesto por el chat.'),
    'Toda la conversación con el proveedor es dentro de la app', 'Toda la conversación con quien ofrece el servicio es dentro de la app'),
    'Cada proveedor tiene en su perfil las calificaciones de otros clientes.', 'Quien ofrece el servicio tiene en su perfil las calificaciones de otros clientes.'),
    'Tratto cobra una comisión del 3% solo cuando el proveedor cobra a través de la app.', 'Tratto cobra una comisión del 3% solo cuando quien ofrece el servicio cobra a través de la app.'),
  title = replace(title, 'Precio para proveedores', 'Precio para quienes ofrecen servicios')
 where title ilike '%proveedor%' or content ilike '%proveedor%';

update public.growth_objections set
  label = replace(label, 'Comisión (proveedores)', 'Comisión (quienes ofrecen servicios)'),
  response = replace(response, 'Hablás con el proveedor por un chat privado', 'Hablás con quien ofrece el servicio por un chat privado')
 where label ilike '%proveedor%' or response ilike '%proveedor%';

-- Mails automáticos (pasos de las secuencias).
update public.growth_workflow_steps set
  config = replace(replace(replace(config::text,
    'Proveedores de tu zona y de ese rubro te mandan su presupuesto por el chat.', 'Quienes ofrecen ese servicio en tu zona te mandan su presupuesto por el chat.'),
    'Proveedores de tu zona te mandan su presupuesto por el chat.', 'Quienes ofrecen ese servicio en tu zona te mandan su presupuesto por el chat.'),
    'Tu cuenta de proveedor en Tratto', 'Tu cuenta para ofrecer servicios en Tratto')::jsonb
 where config::text ilike '%proveedor%';

-- Mail de presentación (v3) y recordatorio de las 18:30.
update public.growth_mkt_items set
  cuerpo = replace(replace(replace(cuerpo,
    'recibe presupuestos de proveedores de su zona.', 'recibe presupuestos de quienes ofrecen el servicio en su zona.'),
    'estamos sumando proveedores de {servicio} en {barrio o zona}.', 'estamos sumando a quienes ofrecen {servicio} en {barrio o zona}.'),
    'Estamos sumando proveedores de {servicio} en {zona}.', 'Estamos sumando a quienes ofrecen {servicio} en {zona}.')
 where datos->>'clave' in ('prospeccion_plantilla', 'prospeccion_recontacto_plantilla');
