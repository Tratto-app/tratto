# Correcciones de seguridad — estado y lo que falta

Continuación de `SECURITY-AUDIT.md` (que no está en el repo porque es público).

## Ya aplicado en Supabase (23/09/2026, en producción)

Cada cambio se probó primero dentro de una transacción con rollback, actuando
como el cliente y el proveedor reales del match 29, antes de aplicarlo.

| Migración | Qué corrige |
|---|---|
| `proteger_columnas_mensajes_y_perfil` (= `02-...sql`) | **P-01 (CRITICAL)**: nadie puede cambiar `monto`, `pago_estado` ni nada de un mensaje ya enviado; solo el cliente responde un presupuesto, solo desde `pendiente`; solo el proveedor marca "terminado"; un presupuesto insertado siempre entra `pendiente` y sin pago. **P-02 (HIGH)**: `trabajos_hechos` ya no se puede escribir a mano, y como el proveedor ya no puede aceptarse a sí mismo, tampoco inflarlo con el trigger. |
| `cerrar_listado_bucket_publicaciones` (= `03-...sql`) | **H-02**: el bucket de fotos ya no se puede listar (antes: 7 fotos de 6 usuarios visibles sin sesión). Las URLs públicas siguen andando. Además, solo acepta imágenes de hasta 5 MB. |
| `oauth_states_mercadopago` (= `04-...sql`) | Tabla de nonces para **H-01**. |
| `pedidos_abiertos_solo_lectura` | **Hallazgo nuevo**: a través de esa vista un proveedor podía modificar y **borrar pedidos de otros clientes** (la vista saltea RLS). Ahora es solo lectura. |
| `revocar_ejecucion_publica_funciones_internas` | `marcar_publicacion` se podía ejecutar sin sesión; funciones internas sin `search_path` fijo. |

Si algún pago o flujo de n8n empieza a fallar con *"No se puede modificar un
mensaje ya enviado"*, es que ese workflow escribe `pago_estado` con el token
del usuario en vez de la `service_role`. Tiene que usar la `service_role`
(ya la necesita para leer `cuentas_mp`).

---

## Hecho el 23/09/2026 después del merge (PR #5)

- `mp-iniciar` importado y activo: rechaza tokens inválidos sin crear nonces.
- Rama mergeada a `main`. Verificado en producción: cabeceras de seguridad
  activas, CSP sin bloqueos en la app real, supabase-js con hash de
  integridad, `/lapeluquerie/`, `/.claude/` y `/tools/` dan 404.
- `05-contacto-cliente-privado.sql` aplicado (migración `contacto_cliente_privado`):
  ningún usuario puede leer `email_cliente` ni `telefono_cliente`; n8n sí.

**Si algo de n8n deja de andar después de esto** (comparar presupuestos,
calificar, cobrar) con un error de *permission denied for table solicitudes*,
es que ese workflow lee `solicitudes` con el token del usuario. Arreglo: que
use la `service_role`. Reversión de emergencia (vuelve a exponer el contacto):
`grant select on public.solicitudes to authenticated;`

---

## Lo que falta, en este orden

### 1. ~~Probar el flujo completo con cuentas de prueba~~ — hecho el 24/09/2026

Con 1 cliente y 2 proveedores de prueba (rubro inventado, ningún usuario real
recibió nada), por la API real y los webhooks reales de n8n:

- Pedido → matching → 2 proveedores; chat; presupuestos; aceptar; "terminado":
  todo anda.
- Comparar presupuestos (n8n): anda para el cliente; no le devuelve nada a
  un proveedor ni a alguien sin sesión.
- Calificar (n8n): anda para el cliente; al proveedor le responde `permiso`.
  Calificar dos veces el mismo trabajo reemplaza la calificación (no duplica).
- Asistente: anda con y sin sesión.
- Siguen bloqueados: leer email/teléfono del cliente, colar un presupuesto
  como aceptado o pagado, aceptarse el propio presupuesto, cambiar el monto,
  que el cliente marque "terminado", escribir en el chat de otro.
- **Conclusión: ningún workflow de n8n dependía de leer `solicitudes` con el
  token del usuario.** La reversión de emergencia de arriba ya no hace falta.

Todo lo de prueba (3 usuarios, 2 pedidos, 2 perfiles, 3 matches, 6 mensajes,
1 calificación) se borró al terminar.

Detalle de producto que apareció (no es de seguridad): cuando un pedido ya
tiene un match, un proveedor que se registra después no se suma a ese pedido;
solo entra en los pedidos nuevos.

### 2 y 3. ~~n8n: H-01, H-03, CORS~~ — hecho el 25/09/2026 por la API de n8n

Antes de tocar nada se guardó una copia de los 50 workflows (fuera del repo:
tienen claves). Todo se probó en producción con cuentas temporales, que
después se borraron.

| Workflow | Cambio |
|---|---|
| `mp-conectar` | **H-01 cerrado.** Busca el nonce en `oauth_states` (un solo uso, vence a los 30 min), usa el `user_id` guardado ahí, lo borra al terminar. Enlace vencido o código rechazado por Mercado Pago → página de error propia (400; un 502 lo tapa Cloudflare). |
| `tasar` | **H-03 cerrado.** Exige sesión válida y una foto del bucket `publicaciones`; si no, 401. |
| `asistente` | El `user_id` sale del token validado, nunca del cuerpo. Sigue respondiendo sin sesión (preguntas generales). Tenía una clave de Supabase inválida: nunca había guardado una consulta; ahora sí. |
| `matching` | **Hallazgo nuevo (alto).** Aceptaba cualquier aviso: cualquiera podía inventar un pedido y hacer que Tratto creara conexiones y mandara mails desde info@trattoapp.com.ar. Ahora exige el encabezado `x-tratto-secreto` (lo mandan los triggers de la base, migración `matching_webhook_con_secreto`) y vuelve a leer el registro de la base; del aviso solo usa tabla e id. |
| `mp-iniciar` | El 401 devolvía 200. |
| Los 7 webhooks que usa la app | CORS limitado a `https://www.trattoapp.com.ar` y `https://trattoapp.com.ar` (probado en navegador: desde otro sitio se bloquea). |
| VIDEO IA 01, 02, 03 | Desactivados: el 01 fallaba todos los días (sin crédito de Veo) y el 02 y 03 corrían cada 5 y 15 minutos (~11.500 ejecuciones por mes), con riesgo de agotar el cupo de n8n y frenar la app. Se reactivan desde n8n. |

Falta probar de punta a punta **conectar una cuenta real de Mercado Pago**
(necesita iniciar sesión en Mercado Pago): Cuenta → Conectar Mercado Pago.

### 4. Credenciales (M-05)

Pasar `service_role` y las API keys de los nodos "Configuracion" de los
workflows de video a **Credentials** de n8n, y después regenerar la
`service_role` en Supabase (Settings → API).

### 5. En el panel de Supabase

Authentication → Policies → activar **Leaked password protection** (bloquea
contraseñas filtradas conocidas).

### 6. Claves compartidas por chat

Revocar y regenerar la de ElevenLabs y cualquier otra que hayas pegado en el
chat o en capturas.
