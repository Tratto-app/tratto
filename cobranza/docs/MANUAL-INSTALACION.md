# Manual de instalación · Cobranza sin vueltas

Para instalar la app en las cuentas de un negocio nuevo. Todo se hace desde el
navegador, sin programar y sin instalar nada en la compu.

> **Antes de la primera venta:** hacé una instalación completa en cuentas
> tuyas siguiendo este manual. Este manual todavía no se probó contra cuentas
> reales de Cloudflare, Mercado Pago y Meta (las pruebas se hicieron con
> servicios simulados y con el motor local de Cloudflare). Los nombres de los
> botones de esos paneles cambian seguido: si alguno no coincide, buscá el
> equivalente y anotá la diferencia acá.

## Qué vas a necesitar del cliente

- Un mail del negocio al que tenga acceso (ahí se crean las cuentas).
- Su usuario de Mercado Pago (para que cobre con su cuenta).
- 45 minutos con el dueño al lado, o que te pase los códigos que le llegan por mail.
- Solo para el modo automático (parte B): un chip o línea que **no** esté usada
  en WhatsApp, una cuenta de Facebook y una tarjeta para pagarle a Meta.

Las cuentas quedan **a nombre del negocio**. Vos no guardás sus claves.

## Tiempos estimados

| Parte | Qué se hace | Tiempo |
|---|---|---|
| A | Cloudflare, la app y Mercado Pago (modo un toque) | 40 a 50 minutos |
| B | WhatsApp automático con Meta (opcional) | 60 a 90 minutos, más la espera de aprobación de Meta (de minutos a 1 día) |
| C | Mail de la mañana (opcional) | 5 minutos |
| D | Cargar los primeros deudores y capacitar | 30 minutos |

---

## Parte A · La app con modo un toque

### 1. Crear la cuenta de Cloudflare (5 minutos)

1. Entrá a `dash.cloudflare.com/sign-up` y creá la cuenta con el mail del negocio.
2. Confirmá el mail con el link que le llega.
3. Si pregunta por un dominio o un plan, elegí seguir sin dominio y con el plan **Free**. No hace falta tarjeta.

### 2. Crear la base de datos (3 minutos)

1. En el menú de la izquierda: **Storage & Databases → D1 SQL Database**.
2. **Create Database**. Nombre: `cobranza`. Ubicación: la que sugiera.
3. **Create**. No hay que cargar nada adentro: la app crea sus tablas sola la primera vez.

### 3. Crear la app (10 minutos)

1. Menú: **Workers & Pages → Create → Start with Hello World! → Deploy**.
   Nombre: el del negocio en minúsculas y sin espacios, por ejemplo `pilates-sur`.
   Ese nombre es parte de la dirección: `https://pilates-sur.CUENTA.workers.dev`.
2. Tocá **Edit code**. Borrá todo lo que hay en el editor.
3. Abrí el archivo `cobranza/dist/worker.js`, copiá **todo** su contenido y pegalo en el editor.
4. **Deploy**.
5. Volvé a la página del Worker y entrá a **Settings**.

### 4. Conectar la base (2 minutos)

1. En **Settings → Bindings → Add binding → D1 database**.
2. **Variable name:** `DB` (en mayúsculas, exactamente así).
3. **D1 database:** `cobranza`.
4. **Deploy** (o **Save**).

### 5. Cargar la clave de instalación (2 minutos)

1. En **Settings → Variables and Secrets → Add**.
2. **Type:** Secret. **Name:** `CLAVE_INSTALACION`.
3. **Value:** inventá una frase larga (por ejemplo cuatro palabras al azar). Anotala: se usa una sola vez, en el paso 8.
4. **Deploy**.

### 6. Programar la tarea de cada 15 minutos (2 minutos)

1. En **Settings → Trigger Events → Add → Cron Triggers**.
2. Elegí **Cron expression** y escribí: `*/15 * * * *`
3. **Add**.

Esa tarea crea las cuotas que se repiten, manda el mail de la mañana y, en modo
automático, los avisos. Corre todo el día, pero la app solo manda avisos de
lunes a sábado de 9 a 20.

### 7. Mercado Pago (15 minutos)

Si el negocio no quiere cobrar con Mercado Pago, salteá este paso: el link de
pago va a mostrar sus datos para transferir.

1. Entrá a `mercadopago.com.ar/developers` con el usuario de Mercado Pago del negocio.
2. **Tus integraciones → Crear aplicación.** Nombre: `Cobranza`. Tipo de pago: pagos online. Producto: **Checkout Pro**.
3. En la aplicación, **Credenciales de producción**. Si pide completar datos del negocio (rubro, sitio web), completalos; como sitio web sirve la dirección de la app.
4. Copiá el **Access Token** (empieza con `APP_USR-`).
5. En Cloudflare, cargalo como en el paso 5: Secret, nombre `MP_ACCESS_TOKEN`.
6. De vuelta en Mercado Pago: **Webhooks → Configurar notificaciones**, modo productivo.
   - **URL:** `https://DIRECCION-DE-LA-APP/webhook/mp`
   - **Eventos:** Pagos.
   - Guardá y copiá la **clave secreta** que muestra.
7. En Cloudflare, cargala como Secret con el nombre `MP_WEBHOOK_SECRET`. **Deploy**.

### 8. Primera entrada (5 minutos)

1. Abrí la dirección de la app. Tiene que aparecer **Primera vez**.
2. Completá la clave de instalación (la del paso 5), el nombre del negocio, un usuario y una contraseña de 10 letras o más. La contraseña la elige y la escribe el dueño.
3. Entrá a **Ajustes** y cargá:
   - el color y el logo;
   - los datos para transferir (alias y titular);
   - el código de área de sus clientes (por ejemplo `11`).
4. En **Cómo te pagan**, tocá **Probar** al lado de Mercado Pago. Tiene que decir a qué cuenta está conectado.

### 9. Prueba real de punta a punta (5 minutos)

1. Cargá una deuda de $ 100 a nombre tuyo, con tu celular, que venza hoy, y marcá que aceptaste recibir recordatorios.
2. En **Avisos**, tocá **Enviar por WhatsApp**: se abre WhatsApp con el mensaje listo. Mandalo.
3. Abrí el link desde tu celular y pagá los $ 100 con Mercado Pago.
4. En menos de un minuto la deuda tiene que aparecer como pagada y sumar en **Entró este mes**.
5. Si no se marca sola, revisá el paso 7 (URL del webhook y `MP_WEBHOOK_SECRET`). Devolvé los $ 100 desde Mercado Pago.

En el celular del dueño: abrí la app en el navegador y usá **Agregar a la
pantalla de inicio** para que quede como un ícono.

---

## Parte B · WhatsApp automático (opcional)

Solo si el negocio quiere que los avisos salgan solos. Meta cobra cada mensaje
a la tarjeta del negocio.

**Importante antes de empezar:**

- El número tiene que ser uno que **no** esté usado en WhatsApp ni en WhatsApp
  Business. Usar el mismo número del negocio en los dos lados solo se puede a
  través de un socio de Meta, que cobra cuota mensual.
- Las respuestas de los clientes a ese número llegan a la app (a la ficha de
  cada cliente), no al WhatsApp del dueño. Para contestar, el dueño le escribe
  desde su WhatsApp de siempre con el botón de la ficha.
- Meta prohíbe usar WhatsApp para negocios de **cobranza de deudas**. Esto es un
  comercio recordando sus propios pagos, que Meta acepta como mensaje de
  utilidad. Por eso: en el nombre visible y en la descripción del negocio en
  Meta, poné el rubro real (peluquería, taller), nunca la palabra "cobranza".
- Si Meta rechaza los avisos de "vencido" o "último aviso", esos dos se siguen
  mandando con un toque. Avisale al cliente antes de cobrarle esta parte.

### B1. Cuentas de Meta (20 minutos)

1. Con la cuenta de Facebook del dueño, entrá a `business.facebook.com` y creá el **portfolio del negocio** (nombre real del negocio y su mail).
2. Entrá a `developers.facebook.com` → **Mis apps → Crear app**. Elegí el caso de uso de **WhatsApp** (conectar con clientes) y asociá el portfolio del paso 1.
3. En la app, entrá a **WhatsApp → Configuración de la API**.
4. **Agregar número de teléfono**: cargá el número nuevo, el nombre visible (el del negocio) y verificalo con el código que llega por SMS o llamada.
5. Anotá estos dos datos que muestra esa pantalla:
   - **Identificador del número de teléfono** → va a ser `WA_PHONE_ID`
   - **Identificador de la cuenta de WhatsApp Business** → va a ser `WA_WABA_ID`

### B2. Clave permanente (15 minutos)

1. En `business.facebook.com` → **Configuración → Usuarios → Usuarios del sistema → Agregar**. Nombre: `cobranza`. Rol: Administrador.
2. **Asignar activos**: la app (control total) y la cuenta de WhatsApp (control total).
3. **Generar token**: elegí la app, vencimiento **Nunca**, y marcá los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Copiá el token → va a ser `WA_TOKEN`. Meta lo muestra una sola vez.
5. En `developers.facebook.com` → tu app → **Configuración de la app → Básica → Clave secreta de la app → Mostrar** → va a ser `WA_APP_SECRET`.
6. Inventá una palabra larga cualquiera → va a ser `WA_VERIFY_TOKEN`.

### B3. Cargar las cinco claves en Cloudflare (5 minutos)

Como en el paso 5, todas de tipo Secret: `WA_TOKEN`, `WA_PHONE_ID`,
`WA_WABA_ID`, `WA_APP_SECRET` y `WA_VERIFY_TOKEN`. **Deploy**.

### B4. Conectar las respuestas (10 minutos)

1. En `developers.facebook.com` → tu app → **WhatsApp → Configuración → Webhook → Editar**.
2. **URL de devolución de llamada:** `https://DIRECCION-DE-LA-APP/webhook/whatsapp`
3. **Token de verificación:** el `WA_VERIFY_TOKEN` que inventaste.
4. **Verificar y guardar.** Si falla, revisá que las claves estén cargadas y con Deploy hecho.
5. En **Campos del webhook**, suscribite a **messages**.
6. Poné la app de Meta en modo **Activo** (arriba, el interruptor "Modo de la app"). Pide un link de política de privacidad: usá el del sitio del negocio.

### B5. Medio de pago en Meta (5 minutos)

En `business.facebook.com` → **Configuración → Cuentas de WhatsApp → la cuenta →
Configuración de pagos**, agregá la tarjeta del negocio.

### B6. Crear los mensajes y activar (10 minutos, más la espera)

1. En la app, **Ajustes → Avisos por WhatsApp → Probar**. Tiene que mostrar el número conectado.
2. **Crear los 4 mensajes en Meta.** Quedan "En revisión".
3. Esperá la aprobación (de unos minutos a un día) y tocá **Ver si están aprobados**.
4. Con los cuatro aprobados, elegí **Automático**.
5. Prueba: cargá una deuda a tu nombre que venza hoy, andá a **Avisos** y tocá **Mandar ahora**. Te tiene que llegar el WhatsApp con el botón **Pagar ahora**. Respondé `BAJA` y revisá que en tu ficha aparezca "Pidió no recibir más avisos".

Sin verificar el negocio en Meta se puede escribir a 250 clientes distintos por
día. Para un negocio chico alcanza.

---

## Parte C · Mail de la mañana (opcional, 5 minutos)

En modo un toque, manda al dueño un mail a las 8:30 con los avisos del día.

1. Creá una cuenta gratis en `resend.com` **con el mail del dueño**. Sin dominio propio, Resend solo entrega a ese mismo mail, que es justo lo que hace falta.
2. **API Keys → Create API Key.** Copiala.
3. En Cloudflare, cargala como Secret con el nombre `RESEND_API_KEY`. **Deploy**.
4. En la app, **Ajustes → Tu mail**: el mismo mail de la cuenta de Resend. **Guardar** y después **Probar**.

---

## Parte D · Carga inicial y capacitación (30 minutos)

1. Pedile al dueño su lista de deudores (cuaderno, Excel o notas del celular).
2. **Cargar deuda → Tengo una lista** y pegala o subí el Excel. El orden es:
   nombre, celular, concepto, monto, vencimiento.
3. Revisá las filas con error antes de cargar.
4. Marcá "aceptaron recibir recordatorios" **solo** si el dueño confirma que sus clientes le dieron el número para eso.
5. Mostrale las tres cosas de todos los días:
   - **Inicio:** quién le debe y cuánto.
   - **Avisos:** un toque por cliente.
   - **Ficha → Ya me pagó:** cuando le pagan en efectivo o por transferencia.

## Qué entregarle al cliente

- La dirección de la app y su usuario (la contraseña la sabe solo él).
- El mail y la contraseña de Cloudflare (y de Meta y Resend si se usaron).
- La hoja `HOJA-CLIENTE.md` impresa o en PDF.

---

## Mantenimiento

**Actualizar la app.** Workers & Pages → el Worker → **Edit code** → borrar
todo → pegar el `dist/worker.js` nuevo → **Deploy**. Los datos no se tocan.

**El dueño olvidó la contraseña.** Cloudflare → D1 → `cobranza` → **Console**,
pegá esto y ejecutalo:

```sql
DELETE FROM config WHERE clave IN ('clave_hash', 'clave_sal', 'intentos', 'bloqueo_hasta');
```

La app vuelve a mostrar **Primera vez** y pide la clave de instalación. Los
clientes y las deudas no se borran.

**Copia de los datos.** Cloudflare guarda 7 días de historia de la base en el
plan gratis (D1 → Time Travel). Para una copia propia: D1 → `cobranza` → Export.

**Ver qué pasó si algo falla.** Workers & Pages → el Worker → **Logs**.

**Si la app deja de responder un rato.** El plan gratis tiene topes diarios
(100.000 visitas, 100.000 escrituras). Si se pasan, la app vuelve sola a las
21 h. No se pierde nada ni se cobra nada. Un negocio chico no debería llegar.

**Problemas frecuentes**

| Qué pasa | Qué revisar |
|---|---|
| "Falta conectar la base de datos" | Paso 4: el nombre tiene que ser `DB` |
| "Falta cargar CLAVE_INSTALACION" | Paso 5, y que después se haya hecho Deploy |
| Pagó por Mercado Pago y no se marcó | Paso 7: URL del webhook, evento Pagos y `MP_WEBHOOK_SECRET` |
| No se crean las cuotas del mes siguiente | Paso 6: la tarea de cada 15 minutos |
| Cartel rojo "WhatsApp frenó los avisos" | El texto dice el motivo: mensajes sin aprobar, tarjeta de Meta o clave vencida |
| El aviso automático figura "No llegó" | El número no tiene WhatsApp o está mal cargado: corregirlo en la ficha |

## Lista de control

- [ ] La app abre y pide usuario
- [ ] Color, logo y datos para transferir cargados
- [ ] Mercado Pago: **Probar** da bien
- [ ] Pago de prueba de $ 100 marcado solo y devuelto
- [ ] Aviso de prueba recibido en mi celular
- [ ] (Parte B) Los 4 mensajes aprobados y `BAJA` probado
- [ ] (Parte C) Mail de prueba recibido
- [ ] Deudores cargados y revisados con el dueño
- [ ] Ícono en la pantalla de inicio del celular del dueño
- [ ] Hoja del cliente entregada
