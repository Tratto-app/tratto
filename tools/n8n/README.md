# Workflows de n8n

Copia de los 12 workflows de n8n Cloud (`marketplace-servicios.app.n8n.cloud`),
para tener historial en git y poder reconstruirlos si alguien rompe uno en el
editor. **n8n sigue siendo la fuente de verdad**: lo que corre es lo que está
allá, no estos archivos.

## Las claves están en credenciales de n8n

Desde el 2026-10-05 ningún workflow tiene claves escritas en sus nodos: todas
están en **credenciales** de n8n (Overview → Credentials), que n8n guarda
cifradas y no aparecen en el editor, en las exportaciones ni en el historial
de ejecuciones. Para cambiar una clave se edita la credencial y listo: todos
los workflows que la usan toman el valor nuevo.

| Credencial | Tipo | Qué guarda | La usan |
|---|---|---|---|
| Tratto · Supabase (service role) | Supabase API | URL y clave service role | casi todos (lecturas y escrituras en la base) |
| Tratto · OpenAI | OpenAI | API key | tasador, comparador, asistente, reputación |
| Tratto · Brevo API | Brevo | API key | matching (mail de aviso) |
| Tratto · Firma de novedades (x-tratto-firma) | Header Auth | secreto de la función `quick-service` | novedades por mail y por push |
| Tratto · Secreto del aviso de matching (x-tratto-secreto) | Header Auth | secreto que manda la base | webhook `matching` (si no coincide, n8n responde 403) |
| Tratto · Mercado Pago client secret | Custom Auth | `{"body":{"client_secret":"…"}}` | canje del código de OAuth |
| Brevo SMTP (alertas) | SMTP | usuario y clave SMTP | alerta de errores |

La validación de sesión (`/auth/v1/user`) usa la clave **pública** de Supabase
(`anonKey`, en los nodos "Configuracion"): con el token del usuario alcanza.

El repo es público: al exportar, la clave pública también se tapa con
`<SECRETO_EN_N8N>` y el CI (`tools/ci/revisar.py`) revisa cada cambio. Para
restaurar un workflow: importarlo, volver a poner la `anonKey` donde dice
`<SECRETO_EN_N8N>` y elegir las credenciales en los nodos que las piden. Ver
`docs/SECURITY.md` → "Si se filtra una credencial" para saber de dónde sale
cada valor.

## Qué hay

| Archivo | Qué hace | Cómo arranca |
|---|---|---|
| `matching-automatico-avisos.json` | Conecta pedidos con proveedores y avisa por mail | Webhook `matching` (lo llama la base) |
| `tasador-por-foto.json` | Precio de referencia por foto o por texto (IA), con base en la tabla `precios_referencia` ajustada por inflación | Webhook `tasar` (app) |
| `comparador-de-presupuestos.json` | Compara presupuestos con IA | Webhook `comparar` (app) |
| `asistente-tratto.json` | Asistente con IA | Webhook `asistente` (app) |
| `reputacion-desde-el-chat.json` | Calificaciones a partir del chat | Webhook `calificar` (app) |
| `conectar-mercado-pago-oauth.json` | Vuelta del OAuth de Mercado Pago | Webhook `mp-conectar` |
| `mp-00-iniciar-conexion-con-nonce.json` | Inicio del OAuth (con `state` de un solo uso) | Webhook `mp-iniciar` (app) |
| `mp-clave-publica-del-proveedor-mp-clave.json` | Clave pública del proveedor para el checkout | Webhook `mp-clave` (app) |
| `mp-reservar-el-pago-con-comision-mp-pagar.json` | Cobro con la comisión de Tratto | Webhook `mp-pagar` (app) |
| `novedades-mail-cada-15-dias.json` | Mail de novedades (solo a quien aceptó) | Programado |
| `novedades-push-cada-11-dias.json` | Push de novedades (solo a quien aceptó) | Programado |
| `alerta-aviso-por-mail-cuando-falla-un-workflow.json` | Mail al equipo cuando falla un workflow | Error de otro workflow |

Todos los workflows, salvo el de alerta, tienen como *Error workflow* el de
alerta. Si se sube un workflow por la API, hay que mandar sus `settings`
completos: si no, se pierde esa opción.

## Actualizar esta copia

Exportar de nuevo desde la API de n8n después de cambiar un workflow, tapando
los secretos de la misma forma, y correr `python3 tools/ci/revisar.py` antes
del commit.

Última exportación: 2026-10-05 (claves pasadas a credenciales).
