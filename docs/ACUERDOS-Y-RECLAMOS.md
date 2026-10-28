# Acuerdos de trabajo y reclamos

Implementación del 28/10/2026. Complementa el chat existente. No verifica DNI,
antecedentes, matrícula, cobertura de seguro, ubicación ni calidad del trabajo.

## Contrato de datos

La migración `20261028021451_servicio_acuerdos_reclamos.sql` agrega:

- `servicio_acuerdos`: propuesta, respuesta, versiones e historial de visita,
  adicional y retiro. El cliente real y el proveedor real se obtienen de
  `matches → solicitudes/proveedores`; no se usa el rol editable del perfil.
- `servicio_reclamos` y `servicio_reclamo_eventos`: expediente y comentarios
  compartidos por las partes de ese trabajo. El texto de soporte se diferencia
  de los comentarios de las partes.
- Bucket privado `servicio-evidencias`: imágenes JPG/PNG/WebP de hasta 5 MB.
  Ruta `<usuario UUID>/<match bigint>/<archivo UUID>.<extensión>`. El frontend
  comprime imágenes y obtiene enlaces firmados breves; no guarda URLs firmadas
  como evidencia permanente. La referencia no es una URL pública.
- `privado.servicio_resguardos` y `privado.servicio_archivos_por_borrar`: soporte
  mínimo posterior a una baja y cola de eliminación física. No son accesibles
  a cuentas de la app.

Sólo las partes pueden leer datos o imágenes. Las tablas de operación no
admiten INSERT/UPDATE/DELETE directos desde `authenticated`; se escribe mediante
RPC. Los RPC de la app y sus implementaciones privadas tienen ACL explícitas.
Una cuenta Auth eliminada o marcada `deleted_at` no conserva acceso aunque su
token todavía no haya vencido. Las respuestas y cambios usan versiones para
rechazar acciones sobre datos que cambiaron.

## Flujo de acuerdos

El proveedor propone y el cliente acepta/rechaza expresamente. Proponer o
aceptar exige al menos un presupuesto aceptado, sin terminar ni pagar. Para un
adicional se comprueba y bloquea también la fila del presupuesto base al aceptar.

- Visita: nombre declarado, foto opcional, día, franja y nota. Cambiar visitante
  o reprogramar crea otra propuesta y conserva la anterior como reemplazada.
  Estados: `aceptado → en_camino → llego` por el proveedor; el cliente confirma
  `visita_confirmada`. Son declaraciones de las partes, sin GPS ni comprobación
  automática de presencia.
- Adicional: descripción, importe separado, qué incluye, plazo y presupuesto
  base. Aceptarlo crea exactamente un mensaje de presupuesto aceptado nuevo,
  vinculado en `presupuesto_id`. No modifica monto, pago o estado del original,
  no realiza cobros y no modifica la lógica de comisiones. Repetir la misma
  aceptación devuelve el resultado existente. Un adicional aceptado no se edita
  ni se reemplaza; debe acordarse uno nuevo si corresponde.
- Retiro: equipo, marca/modelo/serie opcionales, estado, accesorios, devolución
  prevista, fotos opcionales. Tras la aceptación, el proveedor declara
  `retiro_realizado` y luego `devolucion_informada`; el cliente confirma
  `devuelto`. El seguimiento de una devolución sigue disponible luego del pago
  o la finalización. Un retiro confirmado no se modifica unilateralmente.

Los acuerdos no se pueden modificar cuando hay bloqueo entre las partes; el
expediente de reclamo permanece disponible. Tope por proveedor: 30 propuestas
por día. No hay envío de emails/WhatsApps ni nueva automatización comercial.

## Reclamos y operación humana de soporte

Cualquiera de las partes abre un reclamo, incluso si bloqueó la conversación.
Hay como máximo uno abierto por parte/trabajo; repetir la apertura devuelve el
existente. Se permiten cinco aperturas y veinte comentarios por usuario/día.
No se prometen atención permanente, resolución automática, devolución de dinero
ni un plazo de resolución.

El cliente y el proveedor pueden leer y aportar información en `recibido` o
`en_revision`. Sólo soporte interno puede pasar a `en_revision`, `resuelto` o
`cerrado`, dejando explicación. `resuelto` y `cerrado` no se reabren: se puede
crear otro expediente si surge un problema nuevo.

`servicio_soporte_reclamo(p_id,p_estado,p_texto,p_version)` es un RPC exclusivo
de `service_role` (o ejecución administrativa de base de datos). No se debe
añadir una clave de servicio al frontend. La bandeja puede consultarse por
herramientas internas autorizadas; la app no contiene una consola de agentes.
Antes de resolver, soporte debe leer el expediente/eventos y comprobar su
versión. Si cambió, se vuelve a leer y se decide de nuevo. La respuesta deja un
evento `tipo='soporte'`. Esta tarea no constituye ni configura un servicio
humano de guardia.

## Baja, conservación y eliminación física

No se bloquea `borrar_mi_cuenta`. Al eliminar un match, un trigger anterior al
DELETE conserva exclusivamente reclamos abiertos y retiros aceptados no
devueltos durante 180 días. Conserva referencia del caso/recibo, estado,
fechas y campos descriptivos mínimos; no copia chat, fotos, nombres de
visitantes, emails ni identificadores directos de cuenta. El texto libre,
una serie o un accesorio pueden identificar personas: este resguardo restringido
no se debe llamar anónimo.

Los reclamos resueltos/cerrados se purgan a los 180 días de su último cambio de
estado. `servicio-resguardos-purga` ejecuta diariamente a las 06:17 UTC
`privado.purgar_resguardos_servicio()` cuando pg_cron está instalado. La
migración no crea un plazo nuevo de conservación para los chats históricos.

Eliminar registros encola referencias. El consumidor debe:

1. Pedir `servicio_evidencias_pendientes_borrado(p_limit)` desde el servidor.
2. Eliminar esas referencias mediante `Storage.from('servicio-evidencias').remove`.
3. Confirmar sólo las eliminaciones aceptadas con
   `servicio_evidencias_borradas(p_names)`.

No se borra `storage.objects` por SQL. Si Storage falla, se conserva la cola.
Un resultado incierto se vuelve a comprobar: la cola devuelve también un
objeto ya ausente hasta recibir confirmación. Los archivos huérfanos de más de
24 horas también se encolan; no se puede publicar una referencia encolada.
Un archivo que siga referenciado no se elimina. El endpoint existente
`limpieza-fotos?solo=evidencias` consume exclusivamente esta cola privada. La
tarea histórica `limpiar-fotos` no estaba activa y no se habilita por este cambio:
la migración original dejó la limpieza de publicaciones pendiente de aprobación.
La tarea nueva `servicio-evidencias-limpieza` corre a las 06:30 UTC. Primero se
despliega el handler con el modo privado incluyendo `index.ts` y `handler.mjs`;
después se aplica `20261028113131_servicio_evidencias_programar_limpieza.sql`.
Sin query, el endpoint conserva su comportamiento administrativo de ambos
trabajos. El cron no guarda el secreto literal: lo resuelve dentro del servidor
desde Vault. Configuración ausente hace fallar la migración o ejecución.

## Validación reproducible

`cd tools/confianza && npm ci && npm run test:backend` ejecuta PostgreSQL
aislado con PGlite 0.5.10. Prueba permisos por parte y por rol, versiones,
aceptación idempotente, inmutabilidad del original, rutas privadas y su
limpieza, estados de retiro, reclamos tras bloqueo, baja y conservación.
No contacta usuarios reales ni dispara pagos, push, mails o WhatsApps.

Antes del despliegue hay que contrastar el esquema y triggers actuales. En la
base de producción revisada, `proteger_mensajes` permite la inserción controlada
desde SECURITY DEFINER, pero conserva protección contra escrituras directas del
cliente. Los triggers de bloqueo y límites existentes no se deshabilitan. Un
presupuesto adicional insertado ya aceptado no dispara el trigger actual de
notificación de aceptación ni aumenta `trabajos_hechos` del presupuesto base.
