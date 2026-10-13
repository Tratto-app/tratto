# Recuperación de contraseña

La app usa la API Auth existente de Supabase, sin un backend nuevo ni cambios
de esquema. En el acceso, «¿Olvidaste tu contraseña?» pide el email y llama
a `/auth/v1/recover`. El enlace vuelve a la raíz con `?recuperar=1`; también
se reconoce `type=recovery` si Supabase vuelve a su Site URL configurada.

Al volver, la app retira los tokens de la URL antes de inicializar el cliente
Realtime. Verifica el bearer del enlace en `/auth/v1/user` y pide una nueva
contraseña y su repetición. El PUT usa ese bearer, **nunca el de una cuenta
guardada en el dispositivo**. Los tokens de recuperación quedan en memoria,
se descartan al cancelar y no se guardan en localStorage. Después de guardar,
se solicita el logout global de Supabase y se vuelve al inicio de sesión.
El logout revoca refresh tokens; los access tokens ya emitidos pueden seguir
válidos hasta su expiración, según el comportamiento de Supabase.

La respuesta a la solicitud de email es genérica para no revelar cuentas.
Se contemplan enlaces vencidos, errores de red, rate limits, contraseñas
rechazadas por el servidor y respuestas tardías después de cancelar. El
alta y su confirmación por código conservan su flujo.

## Prueba en navegador sin tocar usuarios

Con las dependencias fijadas de `growth/web`:

```bash
cd growth/web
npm ci
npx playwright install chromium
node --test ../../tools/auth/probar-recuperacion.mjs
```

Las ocho pruebas usan el HTML real en un servidor temporal y un Chromium.
Interceptan Auth y las demás conexiones externas: no mandan mails ni cambian
contraseñas de personas. Verifican el flujo a 390 px y 1280 px, la identidad
del token utilizado y las regresiones de login/confirmación por código.
CI ejecuta estas pruebas y los controles habituales del repositorio.

En entornos cloud se puede seleccionar un módulo Playwright ya instalado con
`TRATTO_PLAYWRIGHT_MODULE` y el bundle UMD público fijado con
`TRATTO_SUPABASE_BUNDLE`. El bundle tiene que coincidir con el SRI del HTML.

## Verificación del correo real

La entrega real depende del SMTP y de la plantilla «Reset Password» de
Supabase Auth. Esa plantilla debe conservar `{{ .ConfirmationURL }}`.
Las URLs de retorno son la raíz de Tratto y la raíz con `?recuperar=1`.
No cambies el SMTP, plantillas ni allowlist para probar contra usuarios reales.
Usá una cuenta de prueba controlada, verificá la llegada del correo y el
retorno a la pantalla, sin guardar tokens ni links de recuperación en el repo.

No se agregaron service-role keys, endpoints de administración ni consultas
de existencia de cuentas en la interfaz.
