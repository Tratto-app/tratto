# Entrar con Google y con Apple

La app ya tiene los botones "Continuar con Google" y "Continuar con Apple".
Aparecen solos en cuanto cada uno se prende en Supabase: la app le pregunta a
Supabase cuáles están prendidos (`/auth/v1/settings`). Mientras no se prendan,
no se ve nada distinto.

## Cómo funciona

1. Google: en la web se usa el botón oficial de Google (Google Identity
   Services). La ventana de Google dice "continuar a trattoapp.com.ar" y
   devuelve un token que Supabase cambia por la sesión (`grant_type=id_token`,
   con nonce). Si ese botón no carga, queda el de siempre, que va a Google
   pasando por Supabase (flujo PKCE); ese muestra la dirección técnica de
   Supabase, que generaba desconfianza (fundador, 04/11/2026).
   Apple: flujo PKCE de Supabase.
2. Vuelve a `https://www.trattoapp.com.ar/` con su sesión.
3. Si es la primera vez, ve **"Completá tu cuenta"**: el mismo formulario del
   alta sin email ni contraseña (para qué usa Tratto, nombre, teléfono, oficio
   y CUIT si ofrece servicios, y la casilla de términos). Hasta que no lo
   completa no entra a la app.
4. Si ya tenía cuenta con ese mismo email, entra directo a su cuenta de
   siempre (Supabase une las dos formas de entrar).

Al completar la cuenta, la base la vuelve a pasar al CRM con lo que cargó
(trigger `crm_completar`).

En la app de iPhone, Google no deja entrar desde una vista web dentro de una
app y Apple dentro de esa vista terminaba en "Sin conexión". Por eso ahí van
con el **inicio nativo** (la hoja de Apple o la de Google), que llega con la
versión 1.2.0 de la app (complemento `@capgo/capacitor-social-login`). En las
versiones anteriores de la app no aparece ninguno de los dos. Google en la app
usa además la credencial de iPhone de Google Cloud ("Tratto iPhone", creada el
04/11/2026, `GOOGLE_IOS_CLIENT_ID` en `index.html` y su esquema en el
`Info.plist` de la app).

## Lo que tenés que hacer vos

### Google (gratis, unos 10 minutos)

Google pasó la configuración a "Google Auth Platform" (links al 29/10/2026).

1. https://console.cloud.google.com/auth/overview con tu cuenta de Google →
   **Comenzar**. Si te pide proyecto, creá uno llamado "Tratto". Nombre de la
   app **Tratto**, tu mail de soporte, público **Externo**, tu mail de
   contacto, aceptá y **Crear**.
2. https://console.cloud.google.com/auth/branding → en *Dominios
   autorizados* sumá `trattoapp.com.ar` (y si querés, el logo). Guardá.
3. https://console.cloud.google.com/auth/audience → **Publicar app**. Con
   nombre, mail y foto (lo único que pide Tratto) no hace falta verificación.
4. https://console.cloud.google.com/auth/clients/create → tipo **Aplicación
   web**, nombre "Tratto web".
   - Orígenes autorizados de JavaScript: `https://www.trattoapp.com.ar`
   - URI de redireccionamiento autorizados:
     `https://qglsonbcsncgekzbfafk.supabase.co/auth/v1/callback`
   - **Crear** y copiá el **ID de cliente** y el **Secreto del cliente**.
5. https://supabase.com/dashboard/project/qglsonbcsncgekzbfafk/auth/providers?provider=Google
   → prendelo, pegá el ID y el secreto, y **Guardar**.

### Apple (necesita la cuenta de Apple Developer, que ya tenés)

En https://developer.apple.com/account/resources/identifiers/list:

1. Abrí el App ID `ar.com.trattoapp`, tildá **Sign In with Apple** y guardá.
2. **+** → **Services IDs** → descripción "Tratto web", identificador
   `ar.com.trattoapp.web`. Tildá **Sign In with Apple** → **Configure**:
   - App ID principal: `ar.com.trattoapp`
   - Domains: `qglsonbcsncgekzbfafk.supabase.co`
   - Return URLs: `https://qglsonbcsncgekzbfafk.supabase.co/auth/v1/callback`
3. https://developer.apple.com/account/resources/authkeys/list → **+** →
   nombre "Tratto Sign in", tildá **Sign In with Apple** (con el App ID
   `ar.com.trattoapp`) → bajá el archivo `.p8` (se baja una sola vez) y anotá
   el **Key ID**. El **Team ID** está arriba a la derecha.
4. En https://supabase.com/dashboard/project/qglsonbcsncgekzbfafk/auth/providers
   → **Apple**: prendelo; en *Client IDs* poné `ar.com.trattoapp.web` primero;
   en *Secret Key* pegá la clave que arma la herramienta de la guía de
   Supabase (https://supabase.com/docs/guides/auth/social-sign-in/auth-apple,
   abajo de todo): le cargás el Team ID (*Account ID*), el Services ID, el
   Key ID y el archivo `.p8`. Corre en tu navegador: la clave no sale de tu
   computadora.
5. **Importante:** Apple obliga a generar esa clave de nuevo cada 6 meses con
   el mismo `.p8`. Si no se renueva, deja de andar el botón. Guardá el `.p8` en
   un lugar seguro.
6. Opcional, para quien elige ocultar su mail: en
   https://developer.apple.com/account/resources/services/list → *Sign in with
   Apple for Email Communication*, registrá el mail desde el que salen los
   avisos de Tratto, así le llegan.

### En los dos casos

En https://supabase.com/dashboard/project/qglsonbcsncgekzbfafk/auth/url-configuration
fijate que en *Redirect URLs* esté `https://www.trattoapp.com.ar/**`.

### App de iPhone (versión 1.2.0, inicio nativo)

1. **Apple:** en https://supabase.com/dashboard/project/qglsonbcsncgekzbfafk/auth/providers
   → **Apple** → *Client IDs*: dejá `ar.com.trattoapp.web` y agregá
   `ar.com.trattoapp` separado por una coma
   (`ar.com.trattoapp.web,ar.com.trattoapp`) → **Save**. El token que da el
   iPhone viene a nombre de la app (`ar.com.trattoapp`) y no del Services ID.
2. **Google:** https://console.cloud.google.com/auth/clients/create → tipo
   **iOS**, nombre "Tratto iPhone", ID del paquete `ar.com.trattoapp`, ID del
   equipo `X2Q35VKG23` → **Crear**. Copiá el **ID de cliente** (termina en
   `.apps.googleusercontent.com`; no es secreto). Va en `GOOGLE_IOS_CLIENT_ID`
   (`index.html`), en `CFBundleURLSchemes` de `tools/ios-app/ios/App/App/Info.plist`
   (al revés: `com.googleusercontent.apps.<número>`) y en Supabase → **Google**
   → *Client IDs*, después del de la web, separado por una coma.
3. **Codemagic:** https://codemagic.io → la app → **Start new build** →
   *Tratto iOS → TestFlight*. Tarda unos 15 minutos.
4. **App Store Connect:** https://appstoreconnect.apple.com → Tratto → **+**
   versión **1.2.0** → elegí la build nueva → en *Novedades*: "Ahora podés
   entrar con Apple y con Google desde la app." → **Enviar a revisión**.

## Dónde está el código

- `index.html`: `pintarSociales`, `entrarCon`, `prepararBotonGoogle`,
  `entrarConGoogleToken`, `entrarNativo` (app de iPhone), `volverDeOAuth`,
  `abrirCompletar`, `completarCuenta`; los datos del alta en `datosAlta`.
- `supabase/migrations/20261029150000_crm_completar_cuenta.sql`.
- `tools/ios-app/capacitor.config.json`: `allowNavigation`, `appendUserAgent`
  y `plugins.SocialLogin` (Apple y Google prendidos; Facebook y X afuera, así
  no se suma el kit de Facebook). Permiso de Apple en
  `tools/ios-app/ios/App/App/App.entitlements`.
- Pruebas: `tools/confianza/sociales.browser.test.mjs` y
  `tools/confianza/ideas.browser.test.mjs`.
