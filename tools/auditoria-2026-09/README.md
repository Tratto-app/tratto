# Correcciones de seguridad — lo que falta aplicar manualmente

Esta carpeta es la continuación de `SECURITY-AUDIT.md` (que no está en el
repo porque es público). Acá está todo lo que **no pude ejecutar yo**: no
hay conector de Supabase autenticado en esta sesión, y no hay ningún
conector de n8n — los workflows de n8n siempre se editaron a mano, importando
JSON como estos.

Lo que **sí** ya quedó corregido y commiteado en el código (sin que tengas
que hacer nada): `vercel.json` (cabeceras de seguridad), fijar `supabase-js`
con hash de integridad, reducir los datos que le llegan al proveedor en el
chat, el service worker validando el origen del push, y que `index.html` ya
manda el token de sesión en `tasar` y `asistente` en vez de nada o de un
`userId` suelto. Todo eso está probado con Playwright contra la app real.

Lo de abajo, en cambio, **necesita que entres a Supabase y a n8n**. Va en
orden de severidad. Cada paso dice cómo confirmar que quedó bien.

---

## 1. H-02 — el bucket de fotos se puede listar sin sesión (el más rápido)

Abrí el SQL Editor de Supabase y corré `03-fix-storage.sql`. Te muestra el
nombre exacto de la política que hay que borrar y trae la línea de `drop
policy` comentada — descomentala con el nombre que te aparezca y correla.

**Verificar:** el propio archivo tiene los dos `curl` al final. El primero
tiene que devolver `[]`, el segundo tiene que seguir devolviendo `200`.

## 2. H-01 — conectar Mercado Pago con la cuenta de otro proveedor

**Ya hecho en el código:** `index.html` ya no manda el `user_id` como
`state`; ahora pide una URL a un webhook nuevo (`mp-iniciar`) mandando el
token de sesión, y abre esa URL en una pestaña.

**Te falta:**

1. Corré `04-oauth-mercadopago.sql` en Supabase (crea la tabla `oauth_states`).
2. Importá `n8n-mp-iniciar.json` en n8n como workflow nuevo. Completá en el
   nodo "Configuracion": tu `service_role`, y el **mismo** `MP_CLIENT_ID` y
   redirect URI que ya tiene el workflow `mp-conectar` de hoy (los vas a
   encontrar ahí adentro; tienen que ser idénticos o Mercado Pago va a emitir
   el código para una app y n8n va a intentar canjearlo con la otra).
3. Activá el workflow `mp-iniciar`.
4. En el workflow **`mp-conectar` que ya existe** (el que recibe el `code` y
   el `state` de vuelta), agregá, como primer paso después del Webhook y
   antes de usar el `state`:
   - Un nodo HTTP que busque el nonce:
     `GET {SUPABASE_URL}/rest/v1/oauth_states?nonce=eq.{{ $json.query.state }}&select=user_id`
     con `apikey` y `Authorization: Bearer` la `service_role`.
   - Un IF que chequee que devolvió exactamente una fila. Si no, respondé un
     error ("el link para conectar la cuenta venció o ya se usó, volvé a
     intentarlo desde la app") y no sigas.
   - Reemplazá, en todo el resto del workflow, cualquier lugar donde antes
     usabas `$json.query.state` como el `user_id` del proveedor, por el
     `user_id` que te devolvió esta consulta.
   - Al final (haya salido bien o mal), un nodo que borre el nonce:
     `DELETE {SUPABASE_URL}/rest/v1/oauth_states?nonce=eq.{{ ... }}`. Así no
     se puede reusar ni siquiera si alguien lo intercepta.

   No te doy el JSON completo de `mp-conectar` porque nunca lo vi — está
   solo en tu cuenta de n8n. Modificarlo a ciegas podría romper el canje de
   token que ya funciona. Los pasos de arriba son un agregado al principio
   del workflow existente, no un reemplazo.

**Verificar:** entrá al link de autorización con un `state` inventado
(cualquier texto que no sea un nonce real) → tiene que rechazarlo. Con un
nonce real recién generado → tiene que conectar la cuenta como antes.

## 3. H-03 — `tasar` y `asistente` no piden sesión

**Ya hecho en el código:** ambos mandan `token: sesion.access_token` (en
`asistente`, `token` puede ser `null` si nadie inició sesión — ese webhook
también lo puede usar un visitante sin cuenta para preguntas generales).

**Te falta, en cada uno de los dos workflows:**

1. Primer nodo después del Webhook: `GET {SUPABASE_URL}/auth/v1/user` con
   `Authorization: Bearer {{ $json.body.token }}` (igual que en
   `n8n-mp-iniciar.json`, nodo "Validar token de sesion" — podés copiarlo de
   ahí).
2. En `tasar`: si no hay token o la validación falla, respondé 401 y cortá
   ahí. Si tenés un límite de usos por día pensado, este es el lugar: contra
   el `id` que te devuelve Supabase, no contra nada que mande el navegador.
3. En `asistente`: si el token no valida, seguí igual pero como usuario
   anónimo (no le niegues el acceso a alguien sin cuenta) — lo que cambia es
   que ya no confiás en ningún `userId` que venga en el cuerpo para nada que
   necesite saber de quién es un pedido.
4. En los dos: **Settings → Allowed Origins (CORS)** → poné
   `https://www.trattoapp.com.ar` en vez de dejarlo abierto a cualquiera.
   Ahora mismo cualquier página web puede hacer que el navegador de sus
   visitantes te llame estos dos webhooks.
5. Si `tasar` descarga o reenvía la URL de la foto (`foto` en el body):
   validá que empiece con
   `https://qglsonbcsncgekzbfafk.supabase.co/storage/v1/object/public/publicaciones/`
   antes de usarla. Sin esto, cualquiera puede mandar la URL que quiera y
   hacer que tu workflow le pegue a un sitio arbitrario (SSRF).

**Verificar:** `POST` sin token → 401. `OPTIONS` con `Origin` de otro sitio →
la respuesta ya no debe reflejar ese origen.

## 4. M-05 — credenciales en texto plano en los workflows de video

En n8n: **Credentials → New** → creá una credencial de tipo genérico (Header
Auth o HTTP Header Auth) con tu `service_role`, y otra con cada API key de
IA. En los nodos HTTP de `tools/video-ia-n8n/*.json` que hoy tienen la clave
pegada en el nodo "Configuracion", cambiá la forma de autenticar por la
credencial en vez del valor pegado. Después, **regenerá la `service_role`**
en Supabase (Settings → API) — la vieja ya circuló en texto plano y no hay
forma de saber cuánto tiempo estuvo así.

## 5. Antes de eso — confirmar los hallazgos POTENCIALES

Los puntos 1 a 4 son hallazgos ya confirmados. Pero el más grave de todo el
reporte (**P-01**, que sería CRITICAL) todavía no está confirmado: si un
cliente puede bajarle el precio a un presupuesto ya aceptado antes de
pagarlo, con un PATCH directo. Antes de escribir cualquier trigger:

1. Corré `01-verificar-potenciales.sql` en Supabase y pegame o revisá el
   resultado de cada bloque.
2. Si confirma que no hay protección hoy, corré
   `02-triggers-proteger-columnas.sql`. Si ya hay algo (un trigger existente,
   permisos por columna), **no lo corras** — avisame primero para no duplicar
   lógica en dos lugares que después hay que mantener sincronizados.

**Verificar:** las tres pruebas que están comentadas al final de
`02-triggers-proteger-columnas.sql`.

---

## Orden sugerido

H-02 (5 minutos) → P-01/P-02 (confirmar y, si corresponde, corregir) → H-01
→ H-03 → M-05. Cada uno es independiente de los demás, así que si algún día
solo tenés tiempo para uno, empezá por H-02.
