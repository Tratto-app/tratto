# Tratto en las tiendas: paso a paso

🟢 = lo hacés vos · 🔵 = lo hago yo · ⏳ = hay que esperar

Todo lo que se pega en los formularios (textos, respuestas, imágenes) está en
`tratto-tiendas.zip`, en el archivo `FICHA-TIENDAS-TRATTO.md`.

**Calendario aproximado**

| Semana | Android | Apple |
|---|---|---|
| 1 | Cuenta, ficha, prueba cerrada arranca | Cuenta de Apple (en paralelo) |
| 2 | Prueba cerrada (día 1 a 14) | Codemagic, TestFlight, pruebas |
| 3 | Prueba cerrada termina, pedís producción | Mandás a revisión |
| 4 | ✅ Publicada | ✅ Publicada |

Conviene crear la cuenta de Apple **mientras corren los 14 días de prueba de
Android**. Así las dos terminan más o menos juntas.

---

# PARTE 1 · ANDROID (Google Play)

## Paso 0 · Probar la app en tu celular (hoy mismo)
1. 🟢 Pasá `tratto-1.0.0-prueba.apk` a un celular Android (por WhatsApp a vos mismo o por cable).
2. 🟢 Abrilo y tocá "Instalar". Si pregunta, permití "instalar apps de origen desconocido".
3. 🟢 Fijate que abra a pantalla completa, sin la barra del navegador arriba, y con el ícono nuevo.
4. 🟢 Después desinstalala. La de Play Store la reemplaza.

## Paso 1 · Crear la cuenta de desarrollador (⏳ 1 a 3 días)
1. 🟢 Entrá a **play.google.com/console/signup** con **trattoapp1@gmail.com**.
2. 🟢 Elegí **"Para ti" (cuenta personal)**.
3. 🟢 Nombre de desarrollador: **Tratto**. Es el que ve la gente debajo del nombre de la app.
4. 🟢 Completá tus datos, verificá el teléfono y el mail, y pagá los **US$ 25**.
5. 🟢 Verificá tu identidad con foto del DNI.
6. 🟢 Google además pide confirmar que tenés un **celular Android**: instalá la app **Google Play Console** en tu celular y entrá con la misma cuenta.
7. ⏳ Esperá el mail de "cuenta verificada".

## Paso 2 · Crear la app en Play Console
1. 🟢 **Crear app**:
   - Nombre: `Tratto: arreglos del hogar`
   - Idioma: **Español (Latinoamérica) – es-419**
   - App o juego: **App** · Gratis o pagada: **Gratis**
   - Tildá las dos declaraciones y tocá **Crear app**.

## Paso 3 · Completar "Configurar tu app" (el panel te marca cada tarea)
Todas las respuestas están en la ficha, sección "1. Google Play":
1. 🟢 **Política de privacidad:** `https://www.trattoapp.com.ar/privacidad.html`
2. 🔵 **Acceso a la app:** te creo una **cuenta de prueba para los revisores** con un pedido y presupuestos, y te paso el mail y la contraseña para pegar ahí. **Avisame cuando llegues a este punto.**
3. 🟢 **Anuncios:** No.
4. 🟢 **Clasificación de contenido:** el cuestionario, con las respuestas de la ficha.
5. 🟢 **Público objetivo:** 18 años o más.
6. 🟢 **App de noticias / salud / gubernamental:** No. **Funciones financieras:** "Mi app no ofrece funciones financieras".
7. 🟢 **Seguridad de los datos:** la tabla de la ficha.
8. 🟢 **Ficha de Play Store** (Crecimiento → Presencia en Play Store → Ficha principal):
   - nombre, descripción breve y descripción completa;
   - ícono: `play-icono-512.png`;
   - gráfico destacado: `play-grafico-destacado-1024x500.png`;
   - capturas del teléfono: `play-1.png` a `play-5.png`, en ese orden.
9. 🟢 **Categoría:** Casa y hogar. **Contacto:** trattoapp1@gmail.com y `https://www.trattoapp.com.ar`.

## Paso 4 · Prueba cerrada (⏳ 14 días seguidos, con 12 personas o más)
1. 🟢 Juntá **12 a 15 personas con celular Android y cuenta de Gmail**: familia, amigos y tus primeros proveedores. Mejor 15 que 12, por si alguno se da de baja.
2. 🟢 Menú **Probar y publicar → Pruebas → Prueba cerrada** → **Crear segmento** (o usar "Alpha").
3. 🟢 **Verificadores:** creá una lista con los mails de esas personas.
4. 🟢 **Países:** Argentina.
5. 🟢 **Crear versión**:
   - Cuando pregunte por la firma, aceptá **"Firma de apps de Google Play"** (es lo recomendado).
   - Subí **`tratto-1.0.0.aab`**.
   - Nombre de la versión: `1.0.0`. Notas: `Primera versión de Tratto.`
   - Guardá → **Revisar versión** → **Iniciar lanzamiento**.
6. ⏳ Google revisa esta primera versión. Puede tardar de unas horas a unos días.
7. 🟢 Cuando esté aprobada, copiá el **link para unirse a la prueba** (en la misma página, "Cómo se unen los verificadores") y mandáselo a tus testers. Cada uno:
   1. abre el link desde su celular y toca **"Ser verificador"**;
   2. instala Tratto desde Play Store;
   3. **no se da de baja durante 14 días**. Si la abren de vez en cuando, mejor, porque Google mira que se use.
8. 🟢 **Importante:** entrá a **Prueba y lanzamiento → Configuración → Integridad de la app → Firma de apps** y copiame la **huella SHA-256 del "certificado de la clave de firma de apps"**.
9. 🔵 La agrego a la web. Sin eso, la app instalada desde Play muestra una barra de navegador arriba.

## Paso 5 · Pedir acceso a producción (⏳ hasta 7 días de revisión)
1. 🟢 Pasados los 14 días, en el **Panel** aparece **"Solicitar acceso a producción"**.
2. 🟢 Contestá el cuestionario de la prueba: quiénes probaron, qué te dijeron y qué cambiaste. Te ayudo a redactar las respuestas.
3. ⏳ Google responde en hasta 7 días.

## Paso 6 · Publicar
1. 🟢 **Producción** → **Crear versión** → **Agregar desde biblioteca** → la `1.0.0` que ya probaron.
2. 🟢 Países: **Argentina** → **Iniciar lanzamiento en producción**.
3. ⏳ Revisión (en general 1 a 3 días) y… **Tratto está en Play Store**. 🎉

Las actualizaciones de la web llegan solas a la app. Solo hay que subir una
versión nueva si cambia el ícono, el nombre o algo del paquete, y esa te la armo yo.

---

# PARTE 2 · APPLE (App Store), sin Mac

## Paso 1 · Crear la cuenta de Apple Developer (⏳ 1 a 2 días)
1. 🟢 En un iPhone (puede ser prestado), bajá la app **Apple Developer**.
2. 🟢 Entrá con tu **Apple ID**. Tiene que tener activada la verificación en dos pasos.
3. 🟢 **Cuenta → Inscribirse** → tipo **Individual** → escaneá el DNI → pagá los **US$ 99 por año**.
4. ⏳ Esperá el mail de bienvenida.

> ⚠️ Con una cuenta individual, en la App Store figura **tu nombre y apellido
> como vendedor** (debajo del nombre de la app). Para que diga "Tratto" hace
> falta una cuenta de organización, que pide una empresa constituida y un
> número D-U-N-S. Se puede pasar a organización más adelante.

## Paso 2 · Registrar la app en Apple (desde la compu, en el navegador)
En **developer.apple.com/account** → **Certificates, IDs & Profiles**:
1. 🟢 **Identifiers → +** → **App IDs** → **App** →
   - Description: `Tratto`
   - Bundle ID: **Explicit** → `ar.com.trattoapp`
   - En la lista de capacidades, tildá **Push Notifications**.
   - **Continue → Register**.
2. 🟢 **Keys → +** → nombre `Tratto notificaciones` → tildá **Apple Push Notifications service (APNs)** → **Continue → Register** → **Download**.
   - ⚠️ El archivo `.p8` se baja **una sola vez**. Guardalo junto a la clave de Android.
   - Anotá el **Key ID** (está en esa misma pantalla) y el **Team ID** (arriba a la derecha, o en *Membership*).
3. 🟢 **Cargar la clave de notificaciones en Supabase** (así el `.p8` no pasa por el chat):
   supabase.com → el proyecto → **Edge Functions → Secrets** (o *Manage secrets*) → agregá:
   - `APNS_KEY_ID` = el Key ID
   - `APNS_TEAM_ID` = el Team ID
   - `APNS_P8` = abrí el `.p8` con el Bloc de notas y pegá todo el contenido, incluidas las líneas `-----BEGIN…` y `-----END…`
   - 🔵 Avisame y compruebo que las notificaciones salgan.

## Paso 3 · Crear la app en App Store Connect
En **appstoreconnect.apple.com** → **Apps → + → Nueva app**:
1. 🟢 Plataforma **iOS** · Nombre `Tratto: arreglos del hogar` · Idioma **Español (México)** (es el español latinoamericano de Apple) · Bundle ID `ar.com.trattoapp` · SKU `tratto-ios` · Acceso completo.
2. 🟢 En **Información de la app**, copiá el **Apple ID** (un número de 10 dígitos) y pasámelo.
3. 🔵 Lo pongo en la configuración de Codemagic.

## Paso 4 · Clave para que Codemagic suba la app
En App Store Connect → **Usuarios y acceso → Integraciones → App Store Connect API**:
1. 🟢 La primera vez: **Solicitar acceso** y aceptar.
2. 🟢 **Generar clave (+)** → nombre `Codemagic` → acceso **App Manager** → **Generar**.
3. 🟢 **Descargá** el `.p8` (también se baja una sola vez) y anotá el **Issuer ID** (arriba) y el **Key ID**.

## Paso 5 · Codemagic (la "Mac en la nube")
1. 🟢 Entrá a **codemagic.io** → **Sign up with GitHub** → autorizá el repo **Tratto-app/tratto**.
2. 🟢 **Add application** → GitHub → `tratto` → tipo **codemagic.yaml** (ya está en el repo).
3. 🟢 **Teams → Integrations → Developer Portal → Manage keys → Add key**:
   - Nombre: **`Tratto App Store Connect`** (exacto, con mayúsculas y espacios)
   - Issuer ID, Key ID y el `.p8` del paso 4.
4. 🟢 **Teams → codemagic.yaml settings → Code signing identities**:
   - **iOS certificates → Generate certificate** → elegí la clave recién cargada → tipo **Apple Distribution** → guardá.
   - **iOS provisioning profiles → Fetch profiles** → elegí el de `ar.com.trattoapp` (App Store). Si no aparece, Codemagic lo crea en la primera compilación.
5. 🟢 En la app → **Start new build** → workflow **"Tratto iOS → TestFlight"** → **Start**.
6. ⏳ Unos 15 minutos. Si falla, copiame el mensaje de error y 🔵 lo arreglo. En la primera vez es normal.

## Paso 6 · Probar con TestFlight
1. ⏳ La compilación aparece en **App Store Connect → TestFlight** (Apple la procesa en 10 a 30 minutos).
2. 🟢 **Testers internos → +** → agregate vos, con tu Apple ID.
3. 🟢 En el iPhone, instalá **TestFlight**, aceptá la invitación e instalá Tratto.
4. 🟢 Probá: entrar, pedir un servicio, sacar una foto, aceptar las notificaciones. Desde otra cuenta, mandate un presupuesto y fijate que llegue el aviso al iPhone.

## Paso 7 · Mandar a revisión (⏳ 1 a 3 días)
Antes de este paso:
- 🔵 **Bloquear usuarios** (Apple lo exige en apps con chat): te lo agrego si me decís que sí.
- 🔵 **Cuenta de prueba para el revisor**: la misma que para Google.

En App Store Connect → la app → **versión 1.0**:
1. 🟢 Textos, palabras clave, URLs y capturas `ios-1.png` a `ios-5.png` (sección "2. App Store" de la ficha).
2. 🟢 **Privacidad de la app** (etiqueta nutricional), **clasificación por edad**, **precio: gratis**, **disponibilidad: Argentina**.
3. 🟢 **Información para la revisión:** tus datos de contacto, la cuenta de prueba y las notas de la ficha.
4. 🟢 **Compilación → +** → elegí la que probaste en TestFlight.
5. 🟢 **Agregar para revisión → Enviar**.
6. ⏳ Si Apple pide cambios, me pasás el mensaje y 🔵 lo resolvemos.
7. ✅ Aprobada → **Publicar** → **Tratto está en la App Store**. 🎉

---

## Para guardar en un lugar seguro (Drive privado + pendrive)
- `clave-android.zip` (clave de firma de Android y su contraseña)
- El `.p8` de notificaciones de Apple (paso 2 de Apple)
- El `.p8` de la API de App Store Connect (paso 4 de Apple)
