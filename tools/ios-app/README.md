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
- **Pedido de reseña de la App Store** con la ventanita oficial de Apple
  (plugin `@capacitor-community/in-app-review`, desde el 28/10/2026). La web
  lo llama después de un trabajo pagado o de una calificación de 4 o 5
  estrellas, como mucho una vez cada 4 meses (`pedirResenaTienda` en
  `index.html`). Hasta que no se suba una build nueva, la web no hace nada.

Datos fijos: bundle `ar.com.trattoapp`, versión de este código 1.2.0, solo iPhone, iOS 15+.
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

Cuando Apple aprueba una versión, no acepta más compilaciones con ese número
(error 90062 / 90186 al publicar): hay que subir `MARKETING_VERSION` en
`ios/App/App.xcodeproj/project.pbxproj` (1.0.0 aprobada en octubre de 2026;
1.1.0 trae entrar con Apple y el pedido de reseña). El número de build lo
pone solo el workflow.

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

## Acceso social: corrección del 30/10/2026 (requiere build nueva)

`TrattoApp/3` registra el plugin local `TrattoAuth`. Google usa
`ASWebAuthenticationSession` y PKCE, con regreso exclusivo a
`ar.com.trattoapp.auth://callback`; nunca navega a Google dentro de WKWebView.
Apple usa `ASAuthorizationAppleIDProvider`, nonce SHA-256 y validación del
ID token en Supabase. No necesita copiar claves privadas al teléfono.
Ambos caminos conservan el rol elegido y exigen completar los datos y aceptar
los términos cuando corresponde. La web mantiene su OAuth existente. Las
builds anteriores no adquieren este plugin por actualizar la web.

**Estado comprobado, no asumir resuelto:** el 30/10 la web ocultaba Google
deliberadamente en iOS y ocultaba los dos botones durante la elección de rol.
Los dos proveedores estaban habilitados en Auth y Google web tenía accesos
exitosos. Apple redirigía con Services ID `ar.com.trattoapp.web` y callback
`https://qglsonbcsncgekzbfafk.supabase.co/auth/v1/callback`, pero los intentos
observados no completaban el regreso. Eso no prueba que falte una cuenta.
La solicitud pública directa a Apple con ese Services ID y esa Return URL
reprodujo `errorCode: invalid_client` / `errorMessage: Invalid client.` antes
de iniciar sesión, sin utilizar credenciales de ninguna persona. Queda
confirmado el rechazo de esa configuración, pero distinguir entre Services
ID, asociación al App ID y Return URL requiere revisar el portal.
La consulta pública de App Store devolvía versión 1.0.0; no informa el estado
de una compilación pendiente en App Store Connect.

### Configuración que hay que comprobar antes de publicar

1. **Supabase → Authentication → URL Configuration:** agregar el redirect
   exacto `ar.com.trattoapp.auth://callback`, preservando todas las URLs web y
   de recuperación existentes. No usar un comodín para cualquier esquema.
2. **Apple Developer → App IDs → `ar.com.trattoapp`:** habilitar *Sign in with
   Apple*. Regenerar el perfil de distribución para incluir
   `com.apple.developer.applesignin`. El entitlement ya está en este código;
   agregarlo al archivo no configura el portal ni valida un perfil existente.
3. **Supabase → Authentication → Providers → Apple:** conservar el Services
   ID web `ar.com.trattoapp.web` primero y agregar `ar.com.trattoapp` a los
   Client IDs admitidos (lista separada por comas), para validar la audiencia
   del token nativo. No desactivar la verificación del nonce.
4. **Apple Developer → Services IDs → `ar.com.trattoapp.web`:** comprobar que
   existe, está asociado al App ID principal correcto y tiene habilitado
   Sign in with Apple. En Website URLs, comprobar el dominio
   `qglsonbcsncgekzbfafk.supabase.co` y la Return URL exacta
   `https://qglsonbcsncgekzbfafk.supabase.co/auth/v1/callback`.
   Verificar también el dominio web si se configuró como dominio adicional.
5. Comprobar la vigencia y correspondencia de Team ID, Key ID y secreto web
   de Apple en sus paneles. Si requieren rotación, hacerlo allí: no guardar
   `.p8`, JWT, tokens o secretos en Git, informes ni chats. La corrección de
   código por sí sola no demuestra la causa exacta de `invalid_client`.

**Actualización tras conectar Supabase el 30/10:** proyecto ACTIVE_HEALTHY;
se agregaron los redirects `https://www.trattoapp.com.ar`,
`https://www.trattoapp.com.ar/**` y `ar.com.trattoapp.auth://callback`,
preservando las dos entradas existentes del dominio sin `www`. Se agregó
`ar.com.trattoapp` a Client IDs de Apple, conservando `ar.com.trattoapp.web`
primero. Una lectura posterior confirmó ambos cambios y que Google, el
Services ID web y `site_url` permanecieron iguales. La solicitud pública de
Apple sigue devolviendo `invalid_client`; falta verificar la configuración
en Apple Developer. No se leyeron ni cambiaron claves privadas.

### Validación y condición de salida

- Pruebas aisladas: `tools/confianza/auth-social.browser.test.mjs` comprueba
  botones en ambas pestañas, roles, PKCE, nonce, cancelación, doble toque,
  errores y rechazo de callbacks inesperados. Son simulaciones, no una prueba
  de que Apple o Google hayan aceptado credenciales reales.
- En Mac: ejecutar `npm ci && npx cap sync ios`, compilar con Xcode, comprobar
  firma y entitlement y subir a TestFlight sólo después de los ajustes.
  El workflow `iOS — compilar sin firma` comprueba por separado la compilación
  para simulador en macOS, sin certificados, secretos ni subida a Apple; no
  acredita el funcionamiento real del login ni la firma de distribución.
- En iPhone real: probar Google y Apple desde **Iniciar sesión** y **Crear
  cuenta**, con cada rol, cuenta nueva y existente, cancelar/reintentar,
  cierre/reapertura y notificaciones. Probar compartir/ocultar email en Apple.
  Verificar también web Safari/Chrome y recuperación por email.
- No borrar cuentas ni vincular dos cuentas distintas para hacer pasar una
  prueba. Apple con email oculto puede tener una identidad distinta: revisar
  la identidad autenticada, sin unirla por nombre.
- Publicar sólo cuando el retorno cree/recupere la sesión correcta, conserve
  la aceptación de términos y los datos existentes, y no haya `invalid_client`.

Fuentes oficiales:
[Apple en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-apple),
[Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google),
[ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession).
