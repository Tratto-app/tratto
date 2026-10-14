# WhatsApp de Tratto: preparado y desactivado

Preparado el 12/10/2026 por pedido del fundador. Capta proveedores nuevos de
CABA/PBA sin exigir cuenta en Tratto. El permiso para WhatsApp se obtiene antes
del envío mediante un mensaje entrante firmado por Meta; teléfono público y
permiso de email no lo sustituyen.

## Instalado

- Producción Supabase `qglsonbcsncgekzbfafk`: configuración, contactos con
  evidencia de permiso, cola, eventos y RPC internas.
- Endpoint `growth-whatsapp-webhook`: callbacks HMAC, verificación del webhook
  y endpoints internos de salud/despacho.
- n8n: [invitaciones diarias](https://marketplace-servicios.app.n8n.cloud/workflow/KW82xl69P8greJVr),
  [alta con permiso](https://marketplace-servicios.app.n8n.cloud/workflow/ef2tP4bnoQ9EzHPg),
  [diagnóstico](https://marketplace-servicios.app.n8n.cloud/workflow/CzVKF2MA6cLnL9t7).
  Los tres están **inactivos**. Los 13 workflows anteriores no se alteraron.
- Configuración: `enabled=false`, aprobación de plantilla falsa, cupo y
  presupuesto cero. El canal genérico del CRM sigue `whatsapp: mock`.

El endpoint está desplegado, pero no recibe mensajes reales hasta conectar
Meta. `verify_jwt=false` permite sus callbacks, autenticados con HMAC; los
endpoints `/health` y `/dispatch` exigen la credencial de servicio del servidor.
Ninguna clave se incluye en los JSON ni se entrega al navegador.

## Recorrido

1. El proveedor inicia una conversación con la frase de permiso.
   `optin_link.py` genera el enlace cuando exista el número real de Tratto.
   Se validan firma, WABA y número empresarial antes de registrar el permiso.
2. Completa el formulario con negocio, teléfono, rubro, zona y localidad.
   El formulario solo no concede permiso ni crea una cuenta en la app.
3. Se cotejan teléfono normalizado, email, nombre del negocio y fuente conocida.
   Se excluyen registrados, bajas y registros de prospección por mail, incluso
   rechazos y contactos de mail pendientes. Alias o datos incompletos del mismo
   negocio pueden requerir revisión humana.
4. El horario propuesto es **11:00 de Buenos Aires**. Antes del despacho se
   comprueban calidad GREEN, número verificado, cupo Meta y plantilla MARKETING
   APPROVED cuyo texto coincide con el aprobado e incluye BAJA.
5. Se reservan hasta 20 por tanda, con bloqueo de configuración y SKIP LOCKED,
   dentro del límite móvil de 24 horas y presupuesto mensual. La cantidad es
   configurable, máximo local 250; no garantiza evitar bloqueos.
6. Cada intento vuelve a comprobar permiso, registro, canal y pausa. El envío
   ocurre dentro de un endpoint idempotente: reintentar un nodo no puede repetir
   la invitación. Una invitación por teléfono/proveedor, sin seguimientos.
7. `accepted/sent` no prueba entrega final. El webhook aplica delivered/read,
   procesa bajas, guarda respuestas en Inbox y conserva registered/activated.
   Tolera duplicados, callbacks tempranos y fuera de orden.
8. Errores o resultados inciertos frenan la tanda. Reservas vencidas pasan a
   unknown y nunca vuelven solas a la cola. Cupos/costos reservados se conservan
   de manera conservadora. Los avisos de cuenta apagan el sistema hasta revisión.
   Las respuestas quedan para atención humana.

El informe se actualiza en CRM sin duplicación por día, separado de los
informes/créditos de recuperación por mail. Los tres workflows nuevos no
generan alertas automáticas por email.

## Completar con el chip

1. Alta de Meta Business y WhatsApp Business Platform; validar la línea propia
   por SMS/llamada y nombre visible **Tratto**. Completar lo que solicite Meta.
   La aplicación móvil gratuita sola no reemplaza la API.
2. Registrar IDs reales WABA/Phone Number y versión API vigente. Configurar en
   secrets de Edge Functions: `WHATSAPP_TOKEN`, `TRATTO_WA_APP_SECRET` y
   `TRATTO_WA_VERIFY_TOKEN`. La clave administrativa n8n no sustituye esos secretos.
3. Aprobar en CRM `template-draft.json` y crear MARKETING `tratto_proveedores_v1`
   en Meta. Esperar aprobación y guardar su texto exacto en template_body.
   Es un cuerpo estático sin parámetros.
4. Suscribir callbacks messages, account_alerts, calidad y estado de plantillas
   y capacidades en
   `https://qglsonbcsncgekzbfafk.supabase.co/functions/v1/growth-whatsapp-webhook`.
   Verificar desafío y un mensaje entrante real con permiso.
5. Definir cupo, presupuesto USD y precio máximo por mensaje según tarifa real.
   Hoy están en cero. La reserva calcula un techo conservador, no el importe
   facturado; Meta cobra según entregas, categoría y mercado.
6. Generar el enlace con la línea real, probar formulario y bajas y confirmar
   una entrega controlada con un destinatario autorizado elegible.
7. Después habilitar plantilla/configuración y activar los workflows necesarios.
   Mantener diagnóstico desactivado salvo pruebas. No reintentar ejecuciones
   con resultado incierto ni resetear reservas para forzar nuevos envíos.

No se compró línea, creó cuenta Meta, contrató Poli, envió un WhatsApp ni activó
campaña. La recuperación por mail conserva el cierre 13/10/2026 21:00 Buenos
Aires; este sistema nuevo no la prolonga.

## Verificación y reconstrucción

```bash
bash tools/whatsapp/tests/run_sql.sh
deno test growth/supabase/functions/growth-whatsapp-webhook/
deno check growth/supabase/functions/growth-whatsapp-webhook/index.ts
deno lint growth/supabase/functions/growth-whatsapp-webhook/
python3 tools/ci/revisar.py
```

SQL usa PostgreSQL 17.6 local sin red, roles reales, datos sintéticos y rollback.
Los tests de despacho usan dobles de Meta. Prueba viva n8n → Supabase: sistema
deshabilitado, cero reservas y cero permisos. Formulario GET validado; envío
sintético sin permiso rechazado sin crear proveedor, con mensaje visible al
visitante. No se verificó entrega real de Meta.

`build_workflows.py` reconstruye los tres JSON. Al importar hay que seleccionar
credenciales cifradas existentes, también las del diagnóstico; sus valores no
se exportan. Las migraciones coinciden con las versiones aplicadas. La función
privada de coincidencia con Auth devuelve sólo booleano y sólo service_role la
puede ejecutar; no se amplió la lectura directa de Auth.

## Traspaso

Responsable: Codex. Rama `codex/whatsapp-preparacion-2026-10-12`, base `b45f058`.
Archivos: migraciones `*_whatsapp_*`, nueva función growth-whatsapp-webhook,
tools/whatsapp y tres JSON nuevos en tools/n8n/workflows. No se cambió index.html,
crm/, vercel.json, la prospección de mail ni workflows anteriores. Commit final,
pruebas y estado instalado quedan en el PR y el plan de CRM.

Fuentes: [política](https://business.whatsapp.com/policy),
[precios](https://business.whatsapp.com/products/platform-pricing),
[límites](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits).
