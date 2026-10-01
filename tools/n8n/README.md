# Workflows de n8n

Copia de los 12 workflows de n8n Cloud (`marketplace-servicios.app.n8n.cloud`),
para tener historial en git y poder reconstruirlos si alguien rompe uno en el
editor. **n8n sigue siendo la fuente de verdad**: lo que corre es lo que está
allá, no estos archivos.

## Sin secretos

El repo es público. Al exportar, todo valor que sea una clave (Supabase,
OpenAI, Brevo, Mercado Pago, secretos de webhooks y de push) se reemplaza por
`<SECRETO_EN_N8N>`. Se verificó que ningún valor real quedó en los archivos y
el CI (`tools/ci/revisar.py`) los revisa en cada cambio.

Para restaurar uno: importarlo en n8n (*Import from file*) y volver a cargar
los valores marcados con `<SECRETO_EN_N8N>`. Están en los nodos
"Configuracion" o en los encabezados de los nodos HTTP. Ver
`docs/SECURITY.md` → "Si se filtra una credencial" para saber de dónde sale
cada uno.

## Qué hay

| Archivo | Qué hace | Cómo arranca |
|---|---|---|
| `matching-automatico-avisos.json` | Conecta pedidos con proveedores y avisa por mail | Webhook `matching` (lo llama la base) |
| `tasador-por-foto.json` | Precio de referencia por foto o por texto (IA) | Webhook `tasar` (app) |
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

Última exportación: 2026-10-01.
