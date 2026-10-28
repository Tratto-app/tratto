# Entrar con Google y con Apple

La app ya tiene los botones "Continuar con Google" y "Continuar con Apple".
Aparecen solos en cuanto cada uno se prende en Supabase: la app le pregunta a
Supabase cuáles están prendidos (`/auth/v1/settings`). Mientras no se prendan,
no se ve nada distinto.

## Cómo funciona

1. La persona toca el botón y va a Google o a Apple (flujo PKCE de Supabase).
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
app, así que ahí solo aparece Apple, y recién desde la próxima build (la que
agrega `TrattoApp/2` y deja navegar a Supabase y a Apple sin salir de la app).

## Lo que tenés que hacer vos

### Google (gratis, unos 10 minutos)

1. Entrá a https://console.cloud.google.com/apis/credentials/consent con tu
   cuenta de Google y creá un proyecto "Tratto" si te lo pide.
2. Pantalla de consentimiento: tipo **Externo**, nombre **Tratto**, tu mail de
   soporte, dominio autorizado **trattoapp.com.ar**. Guardá y publicá la app
   (botón "Publicar app").
3. https://console.cloud.google.com/apis/credentials → **Crear credenciales**
   → **ID de cliente de OAuth** → tipo **Aplicación web**.
   - Orígenes autorizados de JavaScript: `https://www.trattoapp.com.ar`
   - URI de redireccionamiento autorizados:
     `https://qglsonbcsncgekzbfafk.supabase.co/auth/v1/callback`
4. Copiá el **ID de cliente** y el **Secreto**.
5. https://supabase.com/dashboard/project/qglsonbcsncgekzbfafk/auth/providers
   → **Google** → prendelo, pegá el ID y el secreto, y guardá.

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
   en *Secret Key* pegá la clave que se genera con el `.p8`, el Team ID, el
   Key ID y el Services ID (Supabase tiene la herramienta en su guía
   https://supabase.com/docs/guides/auth/social-sign-in/auth-apple).
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

### App de iPhone

Para que aparezca Apple dentro de la app hay que subir una build nueva desde
Codemagic (`ios-testflight`). La misma build trae el pedido de reseña de la
App Store.

## Dónde está el código

- `index.html`: `pintarSociales`, `entrarCon`, `volverDeOAuth`,
  `abrirCompletar`, `completarCuenta`; los datos del alta en `datosAlta`.
- `supabase/migrations/20261029150000_crm_completar_cuenta.sql`.
- `tools/ios-app/capacitor.config.json`: `allowNavigation` y `appendUserAgent`.
- Prueba: `tools/confianza/ideas.browser.test.mjs`.
