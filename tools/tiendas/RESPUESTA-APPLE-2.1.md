# Respuesta a Apple · Guideline 2.1 (Information Needed) · 1.0.0 (1)

Apple no encontró un error: pide información porque la cuenta de desarrollador
es nueva. Hay que mandar un **video grabado en el iPhone** y estas respuestas.

## Pasos

1. Grabar el video (guion abajo).
2. App Store Connect → Tratto → la versión 1.0.0 → mensaje de Apple → **Responder al equipo de revisión de apps**. Pegar el texto de "Respuesta" y adjuntar el video. Si no deja adjuntarlo por el tamaño, subirlo a Google Drive con "Cualquier persona con el enlace" y pegar el link donde dice [VIDEO].
3. En la misma versión → **Información de revisión de la app** → **Notas**: borrar lo que hay y pegar el texto de "Notas". Revisar que la contraseña de la cuenta demo esté cargada y funcione.
4. Si aparece el botón **Volver a enviar para revisión** (o "Enviar para revisión"), tocarlo.

## Guion del video (4 o 5 minutos, de corrido)

Antes: actualizá el iPhone a la última versión de iOS (lo pide Apple), activá **No molestar** y tené abierta la app de Gmail por si la cuenta nueva pide confirmar el mail. Grabación: Centro de control → botón de grabar pantalla.

1. **Arranque**: empezar en la pantalla de inicio del iPhone y tocar el ícono de Tratto.
2. **Crear cuenta**: "Crear cuenta" con un mail de prueba nuevo (por ejemplo trattoapp1+revision@gmail.com). Completar y entrar.
3. **Cerrar sesión** y entrar con la cuenta demo de cliente (trattoapp1+demo-cliente@gmail.com).
4. **Precio de referencia** con foto (Fototeca o cámara) y después **Nuevo pedido** en **Techos e impermeabilización** (o Pintura o Limpieza): en unos 30 segundos queda conectado con los proveedores demo.
5. **Abrir el pedido existente**: los dos presupuestos, el comparador y el chat con un proveedor.
6. **Reportar y bloquear**: en el chat, "Ver ficha" → mostrar "Reportar" (abrir el formulario) y "Bloquear" (mostrar la confirmación y **cancelar**, para no romper la cuenta demo).
7. **Calificar** un trabajo terminado y **Pagar**: abrir el checkout de Mercado Pago y volver sin pagar.
8. **Lado proveedor**: cerrar sesión, entrar con trattoapp1+demo-techos@gmail.com, abrir el pedido de techos recién creado y mandarle un presupuesto.
9. **Borrar cuenta**: cerrar sesión, entrar con la cuenta creada en el paso 2 → "Cuenta" → "Borrar mi cuenta" → escribir BORRAR → confirmar. Terminar ahí.

## Respuesta (pegar en "Responder al equipo de revisión de apps")

```
Hello App Review team,

Thank you for reviewing Tratto. Below is the information you requested. We also added it to the Notes field of the App Review Information section.

1. SCREEN RECORDING
Recorded on a physical iPhone: [VIDEO]
It shows logging in with the demo customer account, creating a request with a photo from the photo library and the AI reference price, the request being matched with demo providers, the chat, reporting and blocking a user, the provider side (log in, dashboard, profile, account settings and sending a quote), accepting the quote, rating the provider and account deletion. Passwords are hidden in the video; the demo password is in the password field of the App Review Information section.

PURPOSE AND AUDIENCE
Tratto is a services marketplace for Argentina. Adults (18+) who need a service post a request, describing it or attaching a photo, and receive quotes from independent providers in their area and category. They compare the quotes, chat privately and choose one. Tratto covers more than 40 categories: home repairs, cleaning, car services and moving, private lessons, events, digital services, paperwork, accounting, beauty, fitness and pet care. Problem: people do not know whom to call or how much a job should cost, and providers depend on word of mouth. Value: a free reference price from a photo, quotes from nearby providers, an AI summary of what each quote includes and excludes, private in-app chat (no phone numbers exposed) and ratings from other customers. Licensed trades (gas, electrical, health) are not accepted.

DEMO ACCOUNTS (same password for both, see the password field)
Customer: trattoapp1+demo-cliente@gmail.com (open request with two quotes, chats and a rated job)
Provider: trattoapp1+demo-techos@gmail.com (Diego, roofing; the provider shown in the video)

HOW TO REVIEW
1. Open the app, tap "Iniciar sesión" and log in with the customer account.
2. "Nuevo pedido": describe a job or attach a photo (camera or photo library). A reference price appears in a few seconds.
3. Open the existing request to see the two quotes, the AI comparison and the chat with each provider.
4. In a chat, "Ver ficha" gives "Reportar" and "Bloquear". Profiles, requests and conversations have "Reportar".
5. "Calificar" rates a finished job.
6. "Pagar" opens the Mercado Pago checkout to pay the provider for the service (no need to complete it).
7. To see matching live: as the demo customer, create a request in "Pintura", "Limpieza" or "Techos e impermeabilización" (any zone). It is matched with demo providers within about 30 seconds. Then log in with the demo provider account to see it and send a quote. Demo accounts only match demo providers, so real providers never receive test requests.
8. Sign up: "Crear cuenta". Account deletion: "Cuenta" > "Borrar mi cuenta", type BORRAR to confirm; it deletes the user and their profile, requests, chats, photos and devices.

PAYMENTS
Jobs are physical services performed outside the app and paid to the provider through Mercado Pago or directly (Guideline 3.1.3(e)). No digital content is sold, so In-App Purchase is not used. Customers use Tratto for free; providers pay a 3% commission only when they get paid through the app.

EXTERNAL SERVICES
- Supabase: authentication, database, file storage and realtime chat.
- OpenAI (gpt-4o-mini), called from n8n Cloud: reference price from a photo or text, and the quote comparison summary.
- n8n Cloud: backend automations (notifications and emails).
- Mercado Pago: payments and provider account connection (OAuth).
- Apple Push Notification service: push notifications.
- Brevo: transactional email.
- Vercel: web hosting and anonymous usage analytics.

REGIONS
Built for Argentina: Spanish interface, prices in Argentine pesos and providers located in Argentina. Features are the same in every region; outside Argentina a request will not receive quotes because there are no providers there.

REGULATION
Tratto is not a regulated industry and does not include protected third-party material. Providers are independent; regulated trades are excluded. Payments are processed by Mercado Pago, a licensed payment provider.

MODERATION
Word filter in chat, "Reportar" on profiles, requests and conversations, user blocking from the chat, and an email alert to the team on every report.

Please let us know if you need anything else.
Agustin Omelenicki, Tratto
```

## Notas (pegar en "Información de revisión de la app" → "Notas")

```
PURPOSE AND AUDIENCE
Tratto is a services marketplace for Argentina. Adults (18+) who need a service post a request, describing it or attaching a photo, and receive quotes from independent providers in their area and category. They compare the quotes, chat privately and choose one. Tratto covers more than 40 categories: home repairs, cleaning, car services and moving, private lessons, events, digital services, paperwork, accounting, beauty, fitness and pet care. Problem: people do not know whom to call or how much a job should cost, and providers depend on word of mouth. Value: a free reference price from a photo, quotes from nearby providers, an AI summary of what each quote includes and excludes, private in-app chat (no phone numbers exposed) and ratings from other customers. Licensed trades (gas, electrical, health) are not accepted.

DEMO ACCOUNTS (same password for both, see the password field)
Customer: trattoapp1+demo-cliente@gmail.com (open request with two quotes, chats and a rated job)
Provider: trattoapp1+demo-techos@gmail.com (Diego, roofing; the provider shown in the video)

HOW TO REVIEW
1. Open the app, tap "Iniciar sesión" and log in with the customer account.
2. "Nuevo pedido": describe a job or attach a photo (camera or photo library). A reference price appears in a few seconds.
3. Open the existing request to see the two quotes, the AI comparison and the chat with each provider.
4. In a chat, "Ver ficha" gives "Reportar" and "Bloquear". Profiles, requests and conversations have "Reportar".
5. "Calificar" rates a finished job.
6. "Pagar" opens the Mercado Pago checkout to pay the provider for the service (no need to complete it).
7. To see matching live: as the demo customer, create a request in "Pintura", "Limpieza" or "Techos e impermeabilización" (any zone). It is matched with demo providers within about 30 seconds. Then log in with the demo provider account to see it and send a quote. Demo accounts only match demo providers, so real providers never receive test requests.
8. Sign up: "Crear cuenta". Account deletion: "Cuenta" > "Borrar mi cuenta", type BORRAR to confirm; it deletes the user and their profile, requests, chats, photos and devices.

PAYMENTS
Jobs are physical services performed outside the app and paid to the provider through Mercado Pago or directly (Guideline 3.1.3(e)). No digital content is sold, so In-App Purchase is not used. Customers use Tratto for free; providers pay a 3% commission only when they get paid through the app.

EXTERNAL SERVICES
- Supabase: authentication, database, file storage and realtime chat.
- OpenAI (gpt-4o-mini), called from n8n Cloud: reference price from a photo or text, and the quote comparison summary.
- n8n Cloud: backend automations (notifications and emails).
- Mercado Pago: payments and provider account connection (OAuth).
- Apple Push Notification service: push notifications.
- Brevo: transactional email.
- Vercel: web hosting and anonymous usage analytics.

REGIONS
Built for Argentina: Spanish interface, prices in Argentine pesos and providers located in Argentina. Features are the same in every region; outside Argentina a request will not receive quotes because there are no providers there.

REGULATION
Tratto is not a regulated industry and does not include protected third-party material. Providers are independent; regulated trades are excluded. Payments are processed by Mercado Pago, a licensed payment provider.

MODERATION
Word filter in chat, "Reportar" on profiles, requests and conversations, user blocking from the chat, and an email alert to the team on every report.
```
