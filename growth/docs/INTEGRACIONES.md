# Integraciones: qué funciona de verdad y qué no

Regla del proyecto: ninguna credencial en el código ni en el navegador. Todo va como secret de las Edge Functions (`supabase/functions/.env.example`). Si un canal está en modo "real" pero le faltan los secrets, **simula** y lo registra así (`mock_sent`, "Simulado: faltan credenciales").

| Integración | Estado | Probado | Detalle |
|---|---|---|---|
| Links trackeados (`growth-go`) | Real | Sí, en producción | Redirige por dispositivo, pasa UTM/`gid` a Play y `ct` a App Store |
| Eventos de la app (`growth-event`) | Real | Sí, en staging | Falta que **la app de Tratto** los mande (no se tocó la app sin autorización) |
| Automatizaciones + cron | Real | Sí, en producción (`pg_cron` cada 5 min) | |
| Captura desde la app y la calculadora | Real | Sí, en producción | Triggers de la base (no hace falta `growth-event`); guardan el origen. Ver `CAPTACION.md` |
| IA (OpenAI) | Implementado | Solo el modo por reglas | Staging no tiene `OPENAI_API_KEY` |
| Email (Brevo) | Real | Sí, en producción | SMTP relay con la clave SMTP (`xsmtpsib…`) guardada en `config_app`; con una clave de API (`xkeysib…`) usa la API transaccional. Asuntos con tildes codificados a mano (`encodeSubject`) porque denomailer los rompía (error 554) |
| WhatsApp Cloud API | Implementado | No en vivo | Necesita número aprobado por Meta; fuera de 24 h solo plantillas aprobadas; requiere opt-in |
| SMS (Twilio) | Implementado | No en vivo | Requiere opt-in |
| Instagram Messaging | Parcial | No en vivo | La API solo permite responder a quien escribió primero (IGSID). El primer DM es manual y la respuesta se carga en el Inbox |
| TikTok | Simulado | — | No hay API pública de mensajes directos |
| Google Play Console / App Store Connect | No implementado | — | Requieren cuenta de servicio / API key. Mientras tanto se usan clicks propios y eventos `install` |
| Google Ads | No implementado | — | El gasto se carga a mano en Sources |
| Install Referrer (atribución en Android) | Lado app | — | La app debe leer `gid` del referrer y mandarlo como `click_token` |

## Conectar la app de Tratto

**Hecho en producción (7/10/2026)** con triggers en la base: registro, permiso de publicidad, inicio de sesión y primer pedido/servicio llegan solos al CRM. Lo de abajo sigue sirviendo para el Install Referrer de Android y para otros proyectos.

Mínimo necesario, sin cambiar la lógica actual de la app:
1. En Settings → Integrations del workspace **Tratto**, generar la clave de ingesta.
2. Desde un lugar con la clave (por ejemplo, un workflow de n8n o una función de Supabase de producción — nunca el navegador), mandar a `growth-event`:
   - `register` cuando se crea una cuenta (`external_user_id` = id de `auth.users`, `email`).
   - `first_action` cuando hace su primer pedido (evento de activación).
   - `session_start` al abrir la app (o una vez por día).
   - `install` / `click_token` desde la app Android leyendo el Install Referrer.
3. Cargar las URLs de Google Play / App Store cuando estén publicadas.

El Install Referrer (punto 2, último ítem) todavía no está: la app Android no lee el `gid`.
