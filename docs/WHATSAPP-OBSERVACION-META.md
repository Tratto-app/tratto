# Seguimiento de WhatsApp mediante Meta

Preparación iniciada el 14/10/2026 Buenos Aires y verificada localmente el 15/10.
Responsable: Codex.
No es prueba de conexión del número actual ni autorización de campañas.

El titular continúa escribiendo desde WhatsApp Business. La conexión oficial
de Coexistencia comparte entradas (`messages`), salidas del celular
(`smb_message_echoes`) e historial autorizado (`history`) con el CRM. El
observador sólo conserva conversaciones de negocios ya incluidos en las listas
manuales; no incorpora contactos desconocidos ni copia otras conversaciones.

## Aislamiento

- Endpoint nuevo `growth-whatsapp-observer`, separado del webhook anterior.
- Configuración independiente, apagada por defecto. No tiene token de envío,
  llamada Graph `/messages`, ruta dispatch ni acceso a colas de campañas.
- No escribe `growth_messages`: su trigger actual puede despertar workflows.
  Guarda eventos en `growth_wa_observer_events`, timeline y metadata de la ficha.
- HMAC SHA256 sobre el cuerpo original; cuenta y número coinciden con una
  configuración habilitada. El RPC vuelve a comprobar la pausa en transacción.
- Deduplicación por workspace/wamid compartida entre historial, entrada y eco.
  Eventos fuera de orden usan fecha original. Adjuntos sin texto no se transcriben.
- Teléfonos ambiguos o fuera de las listas se omiten sin guardar su contenido.
- Lectura del CRM limitada por miembro/workspace; las escrituras y RPC sólo
  corresponden a service_role. La comprobación de Auth tiene función mínima
  en esquema privado; el navegador no puede leer Auth ni llamarla.
- No cambia status, cuenta, fechas de registro/activación, contadores de contacto
  o campañas. Una baja real conserva el estado avanzado y marca exclusión.
  Un “no” aislado, “cancelar” o una baja importada del historial se señalan para
  revisión de contexto; sólo una baja explícita actual activa la exclusión.
  Los números argentinos se comparan igual con y sin el9, también en ecos e historial.

## Qué se puede afirmar

Cada ficha separa contacto observado, respuesta y registro comprobado.
`growth_wa_observer_refresh(workspace, corte, prospect_opcional)` actualiza la
metadata del seguimiento y comprueba cuentas reales, sin vincularlas ni crear
cuentas. Requiere servicio interno. `app_user_id` referencia `growth_app_users`,
su `external_user_id` identifica Auth. También admite coincidencia exacta de
email publicado o teléfono de proveedor no demo. Identidades múltiples se revisan.

El primer mensaje saliente observado fija el inicio; una respuesta posterior
sigue contando aunque el titular vuelva a escribir después. Sin salida o sin
cobertura comprobada, no se infiere “no respondió”. `coverage_since`,
`coverage_through` y `coverage_gap` deben reflejar una comprobación técnica real;
recibir un evento no acredita automáticamente cobertura completa. Cada cambio de
cuenta invalida la cobertura y apaga recepción hasta revisar el vínculo. Se
conserva el último aviso y su fecha para mostrar el motivo en la pantalla.

La pantalla `/crm/whatsapp-seguimiento` muestra fichas, evidencia y conversación
paginada de 100 en 100, sin botón de envío. No hay tope silencioso de mensajes.
Un registro previo no se atribuye a WhatsApp sin evidencia de origen.

## Pasos pendientes del titular y de la integración

1. Confirmar el número que funciona actualmente en la app. No reutilizar el
   número/IDs desconectados ni desinstalar o borrar la cuenta del celular.
2. En el panel de la app Meta, comprobar verificación empresarial y habilitación
   de Tech Provider/Embedded Signup con Advanced Access. Tener un token previo
   no prueba acceso a Coexistencia. No se comprobó aún el panel autenticado.
3. Preparar configuración Embedded Signup **v4** con la opción de conectar una
   cuenta existente de WhatsApp Business. Hace falta su configuration ID real;
   no se inventa un enlace de vinculación ni se reemplaza por alta exclusiva API.
4. El titular acepta el flujo oficial en Business app. Según la pantalla de Meta,
   recibe mensaje oficial/código y confirma conexión e historial opcional.
   Si solicita eliminar la cuenta móvil o un pago no autorizado, detenerse.
5. Comprobar número devuelto, `is_on_biz_app=true`, `platform_type=CLOUD_API`,
   campos de webhook y autorización del titular. Para Coexistencia no se usa
   POST `/register`. Los secretos siguen sólo en servidor, nunca en Git/CRM.
6. Configurar el callback nuevo y suscripciones; iniciar sincronización de
   historial dentro de 24h sólo si fue compartido. Confirmar qué se importó.
7. Habilitar únicamente observación después de probar firma, entrada y eco
   con conversación controlada autorizada. Las campañas y 3 workflows previos
   permanecen apagados. No se habilitan por esta configuración.

Argentina no figura excluida en la guía consultada; eso no confirma elegibilidad
de esta cuenta/número. Mensajes manuales de la app siguen gratuitos según Meta;
no se contrató BSP ni se comprobó costo total cero de habilitación/infraestructura.
Grupos, ciertos dispositivos vinculados y períodos no compartidos pueden faltar.
La conexión puede cambiar funciones de la app y desvincular dispositivos; el
titular debe revisar esos cambios en el flujo oficial antes de confirmar.

Fuentes oficiales consultadas:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions/
- https://supabase.com/docs/guides/functions/auth-headers

## Verificación local

```sh
cd tools/whatsapp-observer
npm ci --no-audit --no-fund
npm test
cd ../..
deno test growth/supabase/functions/growth-whatsapp-observer/core_test.ts
deno check growth/supabase/functions/growth-whatsapp-observer/index.ts
deno lint growth/supabase/functions/growth-whatsapp-observer
cd growth/web
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build
```

SQL se prueba en PostgreSQL embebido PGlite, con roles/RLS y datos ficticios;
no equivale a prueba de Meta ni de un teléfono real. La prueba de interfaz usa
transporte/sesión simulados; no acredita acceso autenticado del titular.

Resultados locales del 15/10: 10 pruebas del receptor, 7 pruebas SQL y 35 pruebas
del CRM pasaron; typecheck, lint/check Deno y build pasaron. El build versionado
reutiliza sólo la configuración pública de producción que ya estaba en el bundle.
Pantalla verificada en anchos 390 y 1440, con conversación de 101 mensajes y
paginación; cero errores de navegador y cero escrituras de la interfaz de prueba.
No se desplegó ni conectó Meta como parte de estas pruebas.
