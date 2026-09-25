# App de iPhone (App Store)

La web de `www.trattoapp.com.ar` dentro de una app nativa hecha con
[Capacitor](https://capacitorjs.com). Lo que agrega sobre la web:

- **Notificaciones nativas de Apple (APNs).** Dentro de una app de iPhone no
  existe Web Push, así que la web detecta que corre en la app
  (`window.Capacitor`) y registra el teléfono con Apple. La suscripción queda en
  `push_subscripciones` con endpoint `apns:<token>`, y la función
  `quick-service` (código en `tools/supabase-functions/`) manda por APNs.
- Ícono, pantalla de inicio y permisos de cámara y fotos en español.
- Pantalla propia si no hay conexión (`www/index.html`).

Datos fijos: bundle `ar.com.trattoapp`, versión 1.0.0, solo iPhone, iOS 15+.
La app carga la web en vivo, así que los cambios de la web llegan sin subir
una versión nueva. Solo hace falta una build nueva si cambia algo nativo.

## Qué hace falta, una sola vez

1. **Cuenta de Apple Developer** (US$ 99/año).
2. **Identificador de la app**: developer.apple.com → Certificates, IDs &
   Profiles → Identifiers → **+** → App IDs → `ar.com.trattoapp`, y tildar
   **Push Notifications**.
3. **Clave de notificaciones**: Keys → **+** → tildar *Apple Push
   Notifications service (APNs)* → descargar el `.p8` (se baja una sola vez).
   Cargar en Supabase → Edge Functions → Secrets:
   `APNS_KEY_ID` (el Key ID), `APNS_TEAM_ID` (el Team ID, arriba a la derecha
   en developer.apple.com) y `APNS_P8` (el contenido del `.p8`).
4. **La app en App Store Connect**: My Apps → **+** → New App → iOS, nombre
   *Tratto*, idioma español, bundle `ar.com.trattoapp`, SKU `tratto-ios`.
   Anotar el **Apple ID** numérico y ponerlo en `codemagic.yaml`
   (`APP_STORE_APPLE_ID`).
5. **Clave de API de App Store Connect**: Users and Access → Integrations →
   App Store Connect API → **+** con rol *App Manager*. Bajar el `.p8` y
   anotar Issuer ID y Key ID.
6. **Codemagic** (codemagic.io, plan gratis): conectar el repo de GitHub,
   Team settings → Integrations → Developer Portal → agregar la clave del paso
   5 con el nombre `Tratto App Store Connect`.

## Compilar y subir a TestFlight

En Codemagic → la app → **Start new build** → workflow *Tratto iOS →
TestFlight*. En unos 15 minutos aparece en TestFlight, lista para probar en un
iPhone y para mandar a revisión.

## Probar las notificaciones

Instalar desde TestFlight, entrar, aceptar el permiso, y desde otra cuenta
mandarle un presupuesto a un pedido propio. La respuesta de la función
(`net._http_response`) dice `enviados: 1`. Si dice `apns_sin_configurar`,
faltan los secretos del paso 3.

## Para la revisión de Apple

- Categoría: *Estilo de vida*. Edad: 4+.
- Pagos: los trabajos se pagan por Mercado Pago y son servicios físicos, así
  que no corresponde el sistema de compras de Apple (regla 3.1.3(e)).
- Cuenta de prueba para el revisor: un cliente con un pedido y un presupuesto
  recibido, para que vea el flujo completo.
- La cuenta se borra desde la app (Cuenta → Borrar mi cuenta), que Apple exige.
