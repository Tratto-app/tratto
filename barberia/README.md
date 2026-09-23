# Turnos de barbería por WhatsApp

Sistema de atención automática para una barbería: el cliente escribe por WhatsApp,
conversa en lenguaje natural con un asistente de IA y saca, consulta, cambia o
cancela su turno solo. El barbero ve todo en Google Sheets y en un panel web
pensado para el celular.

```
CLIENTE ──WhatsApp──▶ Webhook ──▶ Orquestador ──▶ Agente IA (interpreta)
                                       │                  │
                                       │                  ▼
                                       │          Funciones del backend (deciden y ejecutan)
                                       │                  │
                                       │                  ▼
                                       │          PostgreSQL / SQLite  ◀── fuente de verdad
                                       │                  │
                                       ▼                  ├──▶ Google Sheets (vista del barbero)
                              Respuesta al cliente        └──▶ Panel web (celular)
```

---

## Índice

1. [Qué hace](#qué-hace)
2. [Decisiones técnicas](#decisiones-técnicas)
3. [Arquitectura](#arquitectura)
4. [Instalación](#instalación)
5. [Configuración del negocio](#configuración-del-negocio)
6. [Variables de entorno](#variables-de-entorno)
7. [Base de datos](#base-de-datos)
8. [Conectar Google Sheets](#conectar-google-sheets)
9. [Conectar WhatsApp](#conectar-whatsapp)
10. [Configurar la IA (OpenAI o Claude)](#configurar-la-ia-openai-o-claude)
11. [Probar sin WhatsApp: el simulador](#probar-sin-whatsapp-el-simulador)
12. [Panel del barbero](#panel-del-barbero)
13. [Sitio público y política de privacidad](#sitio-público-y-política-de-privacidad)
14. [Reseñas y descuentos](#reseñas-y-descuentos)
15. [Recordatorios](#recordatorios)
16. [Cierre de semana](#cierre-de-semana)
17. [Tests](#tests)
18. [Despliegue](#despliegue)
19. [Costos](#costos)
20. [Seguridad](#seguridad)
21. [Problemas frecuentes](#problemas-frecuentes)
22. [Qué falta / próximos pasos](#qué-falta--próximos-pasos)

---

## Qué hace

- **Conversa en castellano rioplatense.** "Hola, quiero cortarme el pelo mañana a
  la tarde" alcanza: el bot entiende servicio, día y franja, y ofrece horarios reales.
- **Nunca genera dos turnos en el mismo horario.** Es la garantía central del
  sistema y está asegurada en la base de datos, no en el código del bot.
- **Reserva en dos pasos.** Primero aparta el horario unos minutos, muestra el
  resumen y pide confirmación. Recién ahí el turno existe.
- **Consulta, cambia y cancela** turnos por lenguaje natural.
- **Reconoce a los clientes** por su número: al que ya vino no le vuelve a
  preguntar el nombre.
- **Pide reseñas en Google** a los clientes nuevos, una hora después del corte,
  y les carga un 10% de descuento para el próximo. El turno con descuento queda
  marcado en otro color en la agenda y en la planilla.
- **Avisa el recordatorio de 24 h** antes del turno.
- **Responde consultas generales** (precios, dirección, horarios) leyendo la
  configuración, sin inventar nada.
- **Deriva a una persona** cuando el cliente lo pide, y pausa el bot en esa charla.
- **Sigue funcionando sin IA.** Si el modelo no responde, entra un menú con
  botones que permite reservar igual.
- **Escribe solo en Google Drive.** Cada turno aparece en la planilla a los
  pocos segundos de reservarse, sin que la planilla pueda frenar una reserva.
- **Cierre de semana los domingos.** Te arma el balance (cuántos atendiste,
  cuántos clientes nuevos, cuánto facturaste, cuánta agenda ocupaste) y recién
  después vacía la semana. En Drive queda el historial completo.
- **Panel web** para ver la agenda, cargar turnos a mano, bloquear horarios y
  cambiar precios y horarios sin tocar código.

---

## Decisiones técnicas

Las cinco decisiones que definen el sistema y por qué se tomaron así.

### 1. La fuente de verdad es una base de datos relacional, no Google Sheets

Google Sheets es cómodo para mirar, pero es malo como base de datos de turnos:
no tiene transacciones ni bloqueos, la API tiene cuota y latencia de cientos de
milisegundos, y dos escrituras concurrentes pueden pisarse. Si dos clientes
piden el mismo horario en el mismo segundo, con Sheets no hay forma limpia de
que gane uno solo.

Entonces: **PostgreSQL (o SQLite) manda, y Sheets es una proyección de solo
lectura** que se actualiza en segundo plano. El barbero ve lo mismo, pero si
Google se cae, los turnos se siguen tomando.

> Si el barbero edita una celda a mano, el próximo refresco la pisa. La planilla
> se mira, no se edita. Para cambiar algo está el panel.

### 2. Tres candados contra la doble reserva

| Capa | Mecanismo | Qué cubre |
|---|---|---|
| Transacción | `BEGIN IMMEDIATE` (SQLite) / `pg_advisory_xact_lock` (PostgreSQL) | Serializa el "mirar la agenda + escribir el turno" |
| Validación | Se releen turnos y bloqueos **dentro** de la transacción | Que nunca se decida con datos viejos |
| Motor | Índice único sobre el inicio + `EXCLUDE USING gist` sobre el rango (PostgreSQL) | Última línea: la base rechaza el solapamiento aunque falle todo lo anterior |

El test `dos clientes pidiendo el mismo horario a la vez` dispara cuatro
reservas en paralelo sobre el mismo horario y verifica que quede exactamente una.

### 3. La IA interpreta; el sistema decide

El modelo **no puede escribir en la base**. Solo puede pedir que se ejecute una
de las funciones de `src/ai/herramientas.ts`, y cada una:

- valida sus argumentos con `zod` (fecha, hora y servicio con formato exacto);
- **recibe el teléfono del cliente del canal, nunca del modelo**, así no puede
  consultar ni cancelar el turno de otra persona aunque alguien se lo pida;
- aplica las reglas de negocio del backend;
- devuelve un error entendible en vez de una excepción.

Las funciones del barbero (bloquear horarios, ver la agenda completa, cambiar
precios) **no están expuestas al agente**: viven en el panel, detrás del login.

### 4. Reserva en dos pasos (hold → confirmación)

`reservar_horario` crea una reserva temporal que ocupa el horario y vence sola
a los N minutos (`reglas.hold_minutos`). `confirmar_reserva` la convierte en
turno firme. Esto resuelve dos cosas a la vez: el resumen previo que pide el
flujo de conversación, y que nadie te robe el horario mientras escribís tu nombre.

### 5. Reservar nunca depende de un servicio externo

- **Si Google Sheets falla**, el turno igual se crea: el evento queda en una cola
  (`sheets_outbox`, escrita en la misma transacción que el turno) y se reintenta
  con backoff exponencial.
- **Si el modelo de IA falla**, entra el menú determinístico con botones.
- **Si falla la base de datos**, el bot NO confirma nada: avisa que hubo un
  problema y pide reintentar. Es el único caso donde se prefiere no atender antes
  que mentir.

---

## Arquitectura

```
barberia/
├── config/negocio.json        ← TODO lo comercial: servicios, precios, horarios, textos
├── src/
│   ├── config/                Carga y validación de configuración (negocio + entorno)
│   ├── shared/                Tiempo (zona horaria, fechas en castellano), errores, logs, textos
│   ├── database/              Drivers SQLite/PostgreSQL, esquema y repositorios
│   ├── booking/               Motor de disponibilidad + servicio de turnos (única puerta de escritura)
│   ├── ai/                    Agente, prompt, herramientas, menú de respaldo
│   │   └── proveedores/       Adaptadores de OpenAI y Claude (intercambiables)
│   ├── whatsapp/              Cliente de la Cloud API y verificación del webhook
│   ├── conversation/          Orquestador: idempotencia, contexto, derivación a persona
│   ├── google/                Autenticación, API de Sheets, proyección y worker de sincronización
│   ├── mantenimiento/         Liberar reservas abandonadas y cierre de semana
│   ├── reportes/              Balance semanal (turnos, clientes, facturación)
│   ├── backend/               Servidor HTTP, rutas y middlewares
│   ├── cli/                   `npm run revisar`: qué falta para producción
│   └── main.ts                Arranque
├── public/                    Panel del barbero y simulador de chat
└── tests/                     232 tests
```

**El flujo de un mensaje:**

1. `POST /webhook/whatsapp` valida la firma HMAC y responde 200 enseguida.
2. El mensaje se procesa aparte. Si su id ya se vio, se descarta (Meta reintenta).
3. El orquestador arma el contexto (cliente, turnos vigentes, historial).
4. El agente conversa con el modelo, que pide herramientas; el backend las ejecuta.
5. Si el modelo falla, el mismo mensaje entra al menú de respaldo.
6. La respuesta sale por la Cloud API (texto, botones o lista).

---

## Instalación

Requisitos: **Node.js 20.11 o superior** (probado en 22).

```bash
cd barberia
npm install
cp .env.example .env     # completar con tus datos
npm run db:migrate       # crea el esquema
npm run revisar          # dice qué falta para salir a producción
npm run dev              # http://localhost:3000
```

**`npm run revisar` es el atajo durante la puesta en marcha.** Mira la
configuración real, prueba la conexión a la base y lista con nombre y apellido
lo que falta, separando lo que bloquea (❌) de lo que solo conviene mirar (⚠️).
Corrélo después de cargar cada credencial.

Sin ninguna credencial configurada el sistema ya arranca: el panel funciona y el
simulador atiende en modo menú. Las credenciales se van agregando de a una.

---

## Configuración del negocio

**Todo lo comercial vive en `config/negocio.json`.** No hace falta tocar código
para cambiar un precio, un horario o un mensaje.

Lo que hay que completar antes de salir a producción (está marcado con `PLACEHOLDER`):

```json
"negocio": {
  "nombre": "PLACEHOLDER - Nombre de la Barbería",
  "direccion": "PLACEHOLDER - Calle 1234, Ciudad, Provincia",
  "telefono": "PLACEHOLDER - +54 9 11 0000 0000",
  "instagram": "PLACEHOLDER - @tubarberia"
}
```

Y los precios, que vienen en `0`:

```json
{ "id": "corte", "nombre": "Corte", "precio": 0, "duracion_min": 45 }
```

> **`precio: 0` significa "a confirmar".** El bot no inventa precios: dice que el
> precio lo confirma el barbero. Cargá los reales y los empieza a informar solo.

Los horarios vienen configurados como pidió el enunciado: **martes a sábado, de
10:00 a 13:00 y de 15:00 a 20:00; lunes y domingo cerrado.** Se cambian en
`horarios.dias` (`1` = lunes … `7` = domingo) o desde el panel.

Otras secciones: `horarios_especiales` (un día puntual con otro horario),
`feriados`, `vacaciones` (rango cerrado), `reglas` (anticipación mínima y máxima,
máximo de turnos por cliente, margen entre turnos, duración del hold),
`recordatorios` y `mensajes`.

El archivo se relee solo cuando cambia: no hace falta reiniciar el servidor.

---

## Variables de entorno

Todas las credenciales van en `.env` (ver `.env.example`, que las lista todas con
comentarios). Nunca en el código ni en `negocio.json`.

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL de producción | Recomendada en producción |
| `SQLITE_PATH` | Archivo SQLite (desarrollo) | No |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente de la Cloud API | Para WhatsApp |
| `WHATSAPP_PHONE_NUMBER_ID` | Id del número | Para WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | Palabra secreta para verificar el webhook | Para WhatsApp |
| `WHATSAPP_APP_SECRET` | Firma HMAC de los webhooks | **Sí en producción** |
| `WHATSAPP_GRAPH_VERSION` | Versión de la Graph API (`v26.0`) | No |
| `BARBERO_WHATSAPP` | Número del barbero, para los avisos | Recomendada |
| `AI_PROVEEDOR` | `openai` o `claude` | No (por defecto `claude`) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Si usás OpenAI | Para la IA con OpenAI |
| `AI_API_KEY` / `AI_MODEL` | Si usás Claude | Para la IA con Claude |
| `WHATSAPP_PLANTILLA_RECORDATORIO` | Plantilla del aviso de 24 h | Para los recordatorios |
| `WHATSAPP_PLANTILLA_RESENA` | Plantilla del pedido de reseña | Para las reseñas |
| `GOOGLE_SPREADSHEET_ID` | Id de la planilla | Para Sheets |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` | OAuth | Para Sheets (opción A) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON de cuenta de servicio | Para Sheets (opción B) |
| `DASHBOARD_PASSWORD` | Contraseña del panel | **Sí** |
| `SESSION_SECRET` | Firma de la cookie de sesión (32+ caracteres) | **Sí en producción** |

En producción el sistema **no arranca** si falta `WHATSAPP_APP_SECRET`,
`SESSION_SECRET` o `DASHBOARD_PASSWORD`: mejor fallar al arrancar que descubrir
a la noche que el webhook no valida firmas.

---

## Base de datos

### Desarrollo: SQLite (sin instalar nada)

```bash
npm run db:migrate   # crea ./data/barberia.sqlite
```

### Producción: PostgreSQL

Sirve cualquier Postgres gestionado (Supabase, Neon, Railway, RDS):

```bash
DATABASE_URL=postgresql://usuario:clave@host:5432/barberia npm run db:migrate
```

El driver se elige solo según `DATABASE_URL`. En PostgreSQL además se crea la
restricción de exclusión que hace **imposible** guardar dos turnos superpuestos.

**Cuándo alcanza SQLite:** una sola barbería, una sola instancia del backend, un
disco persistente. Es transaccional y seguro para este caso.
**Cuándo hace falta PostgreSQL:** más de una instancia (casi todos los PaaS
escalan horizontalmente), varias sucursales, o backups automáticos.

### Estados de un turno

`pendiente` (reserva temporal) → `reservado` → `confirmado` / `completado` /
`no_show`, más `cancelado` y `expirado` (hold vencido).

---

## Conectar Google Sheets

1. **Crear la planilla** en Drive. El id está en la URL:
   `docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`
2. **Elegir cómo autenticar:**

   **Opción A — Cuenta de servicio (más simple para un servidor)**
   1. [Google Cloud Console](https://console.cloud.google.com/) → nuevo proyecto.
   2. Habilitar **Google Sheets API**.
   3. *IAM y administración → Cuentas de servicio* → crear → *Claves* → **JSON**.
   4. Pegar el JSON entero (en una línea) en `GOOGLE_SERVICE_ACCOUNT_JSON`.
   5. **Compartir la planilla** con el mail de la cuenta de servicio, como *Editor*.

   **Opción B — OAuth (la planilla queda a nombre del barbero)**
   1. Crear credenciales OAuth de tipo *App de escritorio*.
   2. Obtener un `refresh_token` con scope
      `https://www.googleapis.com/auth/spreadsheets`.
   3. Completar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.

3. **Preparar las hojas:**

```bash
npm run sheets:setup
```

Crea y deja listas: **Hoy**, **Agenda semanal**, **Turnos**, **Clientes** y
**Configuración**.

| Hoja | Para qué |
|---|---|
| **Hoy** | Hoy, mañana y pasado mañana, hora por hora |
| **Agenda semanal** | Una columna por día, de lunes a domingo, con turnos, bloqueos y lugares libres |
| **Balance semanal** | Una fila por semana: turnos, clientes, nuevos, facturado, ocupación. Es el historial que sobrevive a la limpieza |
| **Turnos** | La base completa: ID, Fecha, Día, Hora, Hora fin, Cliente, WhatsApp, Servicio, Precio, Duración, Estado, Creación, Última modificación, Observaciones |
| **Clientes** | Quiénes son, cuántas veces vinieron, última visita |
| **Configuración** | Servicios, precios y horarios vigentes (informativa) |

**Cada turno que alguien reserva por WhatsApp aparece en la hoja "Turnos" a los
pocos segundos, solo.** No hay que hacer nada.

Si algo se desincronizó: `npm run sheets:sync` (o el botón **Resincronizar** del
panel). Es seguro apretarlo: actualiza y agrega filas, nunca borra.

---

## Conectar WhatsApp

Se usa la **WhatsApp Cloud API oficial de Meta**. No se automatiza WhatsApp Web
con Selenium ni Puppeteer: además de frágil, viola los términos y termina con el
número bloqueado.

### Paso a paso

1. **Cuenta de Meta for Developers** → [developers.facebook.com](https://developers.facebook.com/) → *Crear app* → tipo **Business**.
2. Agregar el producto **WhatsApp**.
3. En *Configuración de la API* vas a ver un **número de prueba** y su
   **Identificador del número de teléfono** → `WHATSAPP_PHONE_NUMBER_ID`.
4. **Token de acceso:** el de la pantalla dura 24 h y sirve para probar. Para
   producción: *Configuración de la empresa → Usuarios del sistema* → crear uno,
   asignarle la app de WhatsApp y generar un **token permanente** → `WHATSAPP_ACCESS_TOKEN`.
5. **App secret:** *Configuración → Básica → Clave secreta de la app* → `WHATSAPP_APP_SECRET`.
6. **Verify token:** inventalo vos (cualquier string largo) → `WHATSAPP_VERIFY_TOKEN`.
7. **Webhook.** Necesitás una URL pública con HTTPS. En desarrollo:

   ```bash
   npx ngrok http 3000
   ```

   En *WhatsApp → Configuración → Webhooks*:
   - **URL de devolución de llamada:** `https://TU-DOMINIO/webhook/whatsapp`
   - **Token de verificación:** el mismo `WHATSAPP_VERIFY_TOKEN`
   - Suscribirse al campo **`messages`** (sin esto no llega nada).

8. **Número propio:** *Agregar número de teléfono*, verificarlo y asociarlo a una
   cuenta de WhatsApp Business. El número no puede tener WhatsApp común activo.
9. **Verificar la empresa y publicar la app.** Mientras la app está en modo
   *desarrollo* **no llega ningún webhook de producción**, ni siquiera con el
   número de prueba. Meta pide la URL del negocio para la verificación y la de la
   política de privacidad para publicarla: las sirve este mismo servidor en `/` y
   `/privacidad` (ver [Sitio público](#sitio-público-y-política-de-privacidad)).

### Probar la conexión

```bash
curl "https://TU-DOMINIO/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=hola"
# Tiene que responder: hola
```

Después escribile al número desde tu celular. En los logs vas a ver
`mensaje enviado`.

### La ventana de 24 horas

Meta solo permite mandar texto libre dentro de las 24 h desde el último mensaje
del cliente. Para un recordatorio del día anterior hace falta una **plantilla
aprobada**: creala en *WhatsApp → Plantillas de mensajes* y poné su nombre en
`WHATSAPP_PLANTILLA_RECORDATORIO`. Sin plantilla, el recordatorio se intenta como
texto y puede rebotar (queda registrado en el log).

---

## Configurar la IA (OpenAI o Claude)

El motor se elige con **una variable**, sin tocar código:

```bash
AI_PROVEEDOR=openai        # o 'claude'
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-6-luna
```

| Proveedor | Modelos | Precio por millón de tokens | Cuándo |
|---|---|---|---|
| **OpenAI** | `gpt-6-luna` | $0,10 entrada / $0,50 salida | **El más barato con diferencia.** Para turnos alcanza de sobra |
| | `gpt-6-sol` | $2 / $10 | Más soltura conversando |
| | `gpt-6-astra` | $10 / $50 | Innecesario para esto |
| **Claude** | `claude-opus-5` | $5 / $25 | Muy bueno interpretando, más caro |
| | `claude-haiku-4-5` | $1 / $5 | La opción barata de Claude |

Los dos adaptadores están probados contra un servidor que imita cada API
(`tests/proveedores.test.ts`), así que la misma conversación funciona igual con
cualquiera de los dos. Podés probar uno, cambiar la variable y probar el otro en
`/test-chat` sin tocar nada más.

Si no configurás ninguna clave, **el sistema funciona igual** en modo menú.

## Probar sin WhatsApp: el simulador

```bash
npm run dev
# abrir http://localhost:3000/test-chat
```

Escribís como si fueras un cliente y ves exactamente lo que va a hacer el bot:
qué respondió, si contestó la IA o el menú, qué herramientas ejecutó y cómo
quedó la base.

- Cambiando el **número de prueba** simulás clientes distintos (uno nuevo, uno
  recurrente).
- Abriendo **dos pestañas con números distintos** probás dos personas peleando
  el mismo horario.
- **Reiniciar** borra la conversación (los turnos creados quedan).

En producción el simulador queda detrás del login del panel.

---

## Panel del barbero

`http://localhost:3000/panel` — entra con `DASHBOARD_PASSWORD`.

- **Hoy:** agenda de hoy y mañana. Por turno: abrir WhatsApp, marcar *Vino* /
  *No vino*, cancelar.
- **Semana:** los siete días con cantidad de turnos, horarios, clientes,
  servicios, cancelados y lugares libres.
- **Nuevo turno:** cargar uno a mano; los horarios libres se calculan solos.
- **Bloquear:** un rango ("martes de 16 a 17") o el día completo. El bot deja de
  ofrecerlo al instante. Si ya había turnos ahí, el panel avisa.
- **Ajustes:** servicios, precios, duraciones, horarios por día, feriados,
  vacaciones y reglas. Se guarda en `negocio.json` validado, y el bot lo usa
  enseguida, sin reiniciar. También: estado del sistema, resincronizar Sheets y
  devolverle al bot las charlas derivadas.

---

## Sitio público y política de privacidad

El servidor publica dos páginas abiertas, sin login:

| URL | Qué es |
|---|---|
| `/` | La página de la barbería: nombre, dirección, servicios con precio y duración, horarios, contacto y un botón para sacar turno por WhatsApp. |
| `/privacidad` | La política de privacidad: qué datos se guardan, para qué, con quién se comparten y cuánto duran. |

No son decoración: **sin ellas la app de Meta no se puede publicar, y sin la app
publicada el bot no recibe ni un mensaje.**

- Para **verificar la empresa**, Meta pide una URL del negocio. Una barbería casi
  nunca tiene sitio web; esta página alcanza.
- Para **publicar la app** (pasarla a modo *Live*), Meta pide una **URL de
  política de privacidad** en *Configuración → Básica*.

Las dos se arman desde `config/negocio.json`, así que un precio que cambiás en el
panel aparece cambiado en el sitio al instante, sin reiniciar ni tocar HTML. Lo
que todavía tiene un `PLACEHOLDER` simplemente no se muestra: la página sale más
corta, nunca con texto de relleno a la vista.

Las URLs exactas que le tenés que dar a Meta las imprime `npm run revisar`, a
partir de `APP_BASE_URL`.

> El panel del barbero sigue en `/panel`, detrás de la contraseña. El sitio
> público no muestra ni turnos, ni clientes, ni nada de la agenda.

---

## Reseñas y descuentos

Una hora después del corte, al **cliente nuevo** le llega:

```
¡Hola Lucas! ✂️ ¿Cómo te fue con el corte?

Si nos dejás tu opinión en Google nos ayudás un montón 🙌
https://g.page/r/tu-barberia/review

Y por dejarla te hacemos un 10% de descuento en tu próximo corte.
Avisame cuando la subas y te lo dejo cargado 👇

                                          [ ✅ Ya la dejé ]
```

Cuando el cliente avisa, el descuento queda cargado y se aplica **solo** en su
próximo turno: el bot le muestra el precio ya rebajado al confirmar.

### Lo que hay que saber antes de prenderlo

> **Google no permite verificar por API si alguien dejó una reseña.** Ningún
> sistema puede: no existe ese endpoint. El descuento se carga confiando en lo
> que dice el cliente. Lo que sí se verifica es que **de verdad le hayamos
> pedido una reseña hace menos de una semana** — nadie puede reclamar un
> descuento que nunca se le ofreció, ni el cliente ni el modelo de IA. Si ves
> que alguien mintió, se lo sacás desde el panel (*Ajustes → Descuentos por
> reseña*).

> **Hace falta una plantilla de WhatsApp.** El mensaje sale una hora después del
> corte, y para entonces suele haber pasado más de un día desde que el cliente
> escribió, así que Meta no deja mandar texto libre. Creá una plantilla de
> utilidad en *WhatsApp → Plantillas de mensajes* con tres variables — desde
> 2025 Meta exige que sean nombradas, ya no acepta `{{1}}`, `{{2}}`...:
> `{{nombre_cliente}}`, `{{link_resena}}`, `{{descuento}}` — y cargá su nombre en
> `WHATSAPP_PLANTILLA_RESENA`. El sistema intenta primero el mensaje normal y
> cae a la plantilla solo si Meta lo rechaza.

### Dónde lo ve el barbero

El turno con descuento aparece **en verde con 🎁 -10%**, tanto en el panel
(agenda del día y semanal) como en la planilla de Google, donde además la celda
queda pintada. Es para que sepas de un vistazo en cuál cobrás menos.

El descuento:

- se aplica **una sola vez** y se consume al confirmar el turno;
- **vuelve a estar disponible** si el turno se cancela;
- **viaja** si el turno se reprograma;
- **vence a los 90 días**;
- se puede sacar desde el panel.

```json
"resenas": {
  "activo": true,
  "horas_despues": 1,
  "solo_clientes_nuevos": true,
  "link_google_maps": "https://g.page/r/tu-barberia/review",
  "descuento_porcentaje": 10,
  "vence_dias": 90
}
```

El link se saca de tu ficha en Google Maps: **Compartir → Copiar vínculo**, o el
enlace corto `g.page/r/.../review` desde el perfil de empresa.

---

## Recordatorios

El aviso de **24 horas antes** está prendido:

```json
"recordatorios": {
  "activos": true,
  "avisos": [{ "id": "24h", "horas_antes": 24, "activo": true }],
  "no_enviar_antes_de": "09:00",
  "no_enviar_despues_de": "21:00"
}
```

Se programa al confirmar el turno y se cancela solo si el turno se cancela o se
mueve. Cada aviso se toma de forma atómica, así que aunque corran dos instancias
del backend el cliente recibe uno solo. Nunca salen de madrugada.

**También necesita plantilla** (`WHATSAPP_PLANTILLA_RECORDATORIO`), por la misma
regla de las 24 horas. Los mensajes de plantilla se cobran: ver
[COSTOS.md](./COSTOS.md).

Para apagarlo: `"activos": false`.

---

## Cierre de semana

**Todos los domingos a las 20:00** (el local está cerrado, así que no molesta),
el sistema hace tres cosas, en este orden:

1. **Arma el balance de la semana.**
2. Lo guarda en la hoja **"Balance semanal"** de Drive y te lo manda por WhatsApp.
3. **Recién ahí vacía la semana** de la base de datos.

El orden no es casual: si limpiara primero, el balance daría cero y esa
información se perdería para siempre.

### Qué te dice el balance

```
📊 Cómo te fue esta semana (14/09 al 20/09)

✂️ 23 turnos atendidos
👥 19 clientes, 5 nuevos
💰 $184.000 facturado
📈 62% de la agenda ocupada

Lo más pedido: Corte (14)
Tu día más fuerte: viernes (7 turnos)

❌ 2 cancelados · 1 no vino

Contra la semana pasada: +3 turnos, +$21.000
```

- **Clientes** son personas distintas, no turnos: si alguien vino dos veces,
  cuenta una. **Nuevos** son los que reservaron por primera vez esa semana.
- **Facturado** suma solo los turnos que se atendieron. Lo cancelado y el que
  no vino no suman.
- **Ocupación** es cuánto de tu agenda vendiste. Si bloqueaste un día, ese día
  no cuenta en contra.
- La comparación con la semana anterior aparece a partir de la segunda semana.

Lo mismo se ve **en el panel**, en la pestaña *Semana*, actualizado al momento
(sirve para mirar cómo viene la semana un miércoles, no solo el domingo).

### Verlo por WhatsApp cuando quieras

Escribile **"resumen"** al bot desde tu número (el de `BARBERO_WHATSAPP`) y te
contesta el balance de la semana en curso. También funciona con "balance" o
"cómo venimos".

> Esto existe por una razón práctica: WhatsApp solo deja mandar texto libre
> dentro de las 24 h desde el último mensaje de la persona. Si el domingo hace
> más de un día que no le escribís al bot, Meta puede rechazar el envío. El
> balance **nunca se pierde** — queda en Drive y en el panel —, pero si querés
> tenerlo seguro en el celular, escribile "resumen" y listo.

### Qué se borra y qué no

| | Se borra de la base | Queda |
|---|---|---|
| Turnos de la semana que terminó | ✅ el domingo | ✅ **en Drive, para siempre** |
| Turnos futuros | ❌ nunca | ✅ |
| Ficha de clientes (nombre, cuántas veces vino) | ❌ nunca | ✅ |
| Balance de cada semana | ❌ nunca | ✅ |

```json
"cierre_semanal": {
  "activo": true,
  "dia": 7,
  "hora": "20:00",
  "conservar_dias": 0,
  "avisar_al_barbero": true
}
```

- `dia`: 1 = lunes … 7 = domingo.
- `conservar_dias`: `0` vacía todo lo que ya pasó. Poné `30` si querés tener el
  último mes en la base.
- `activo: false` apaga el cierre entero (no arma balance ni limpia).

> **La planilla de Drive es el archivo del negocio.** La sincronización nunca
> borra filas: actualiza las que ya están y agrega las nuevas. Aunque la base se
> vacíe, o aunque apretés "Resincronizar", el historial de Drive queda intacto.

### Lo que sí corre solo, todos los días

El worker de mantenimiento **no es opcional** y anda siempre:

1. Libera los horarios que alguien empezó a reservar y abandonó a mitad de camino.
   Sin esto, la agenda se tapa sola con reservas fantasma.
2. Cierra los turnos que ya pasaron (a las 12 h, para darte tiempo a marcar
   "no vino").
3. Manda los recordatorios y los pedidos de reseña que toquen.
4. Los domingos, dispara el cierre de semana.

## Tests

```bash
npm test          # 232 tests (SQLite, sin dependencias externas)
npm run typecheck

# Opcional: los mismos candados contra la doble reserva, contra un PostgreSQL real
DATABASE_URL_TEST=postgresql://usuario@localhost:5432/barberia_test npm run test:postgres
```

`npm test` corre sobre SQLite en memoria y no necesita ningún servicio externo.
La suite de PostgreSQL se saltea sola si no le pasás `DATABASE_URL_TEST`.

Cubren lo que pide el enunciado y algo más:

| # | Caso | Dónde |
|---|---|---|
| 1 | Crear turno | `turnos.test.ts` |
| 2 | Consultar disponibilidad | `turnos.test.ts` |
| 3 | **Evitar doble reserva** (incluye superposición parcial) | `turnos.test.ts` |
| 4 | Cancelar turno | `turnos.test.ts`, `conversacion.test.ts` |
| 5 | Modificar turno (y que un intento fallido no deje al cliente sin turno) | `turnos.test.ts` |
| 6 | Turno fuera de horario y en la pausa del mediodía | `turnos.test.ts` |
| 7 | Día cerrado: domingo, feriado, vacaciones | `turnos.test.ts` |
| 8 | Servicio inexistente | `turnos.test.ts`, `herramientas.test.ts` |
| 9 | Cliente nuevo | `conversacion.test.ts` |
| 10 | Cliente recurrente (no le vuelve a pedir el nombre) | `conversacion.test.ts` |
| 11 | **Dos clientes reservando a la vez** (4 en paralelo, gana uno) | `turnos.test.ts` |
| 12 | Error de Google Sheets (cola, backoff, no bloquea la reserva) | `resiliencia.test.ts` |
| 13 | Error de base de datos (no se confirma nada) | `resiliencia.test.ts` |
| 14 | Mensaje ambiguo | `conversacion.test.ts` |
| 15 | Interpretación de fechas | `fechas.test.ts` |
| 16 | Bloqueo de horario | `turnos.test.ts` |
| + | **Turno por WhatsApp → fila en Google Drive**, de punta a punta | `sheets.test.ts` |
| + | **Cierre de semana**: balance antes de limpiar, no se repite, respeta lo futuro | `cierre-semanal.test.ts` |
| + | Cálculo del balance: clientes únicos, nuevos, facturación, ocupación | `cierre-semanal.test.ts` |
| + | **Reseña → descuento → turno marcado**, y que no se pueda cobrar dos veces | `resenas.test.ts` |
| + | **Los dos proveedores de IA** contra un servidor que imita cada API | `proveedores.test.ts` |
| + | Firma del webhook, idempotencia, derivación a persona, caída de la IA | `webhook.test.ts`, `agente.test.ts` |

### Sobre PostgreSQL

`tests/postgres.test.ts` corre contra un servidor real y verifica lo que SQLite
no puede verificar: que exista la restricción de exclusión, que **seis reservas
simultáneas del mismo horario dejen exactamente una**, y que el motor rechace un
solapamiento incluso si alguien lo inserta por SQL directo saltándose la
aplicación. Se ejecutó contra PostgreSQL 16 y pasa.

### Qué NO está probado

Conviene decirlo claro antes de conectar el número real:

- **Los dos proveedores se prueban contra un servidor que imita sus APIs**
  (`tests/modelo-falso.ts`): se verifica que cada adaptador arme bien el pedido
  y lea bien la respuesta, incluidas las diferencias de protocolo. Lo que no se
  ejecutó es una llamada real a OpenAI ni a Anthropic, por falta de claves:
  hacé un par de conversaciones en `/test-chat` antes de salir a producción.
- **El envío real de plantillas de WhatsApp** (recordatorio y reseña) no se pudo
  ejecutar sin un número. La lógica de reintento por ventana cerrada está
  escrita y testeada, pero la primera vez conviene mirar los logs.
- **El ida y vuelta real con WhatsApp** (webhook de Meta y envío de mensajes) no
  se pudo ejecutar sin un número y credenciales. La verificación del webhook, la
  firma HMAC y el parseo de los payloads sí están testeados con payloads reales
  de Meta; lo que falta probar es la red.
- **Google Sheets** se prueba contra un servidor que imita la API de Google
  (`tests/google-falso.ts`): se verifica que la fila llegue con los datos
  correctos, que se actualice al cancelar, que la cola aguante a Google caído y
  que el historial sobreviva a la limpieza. Lo que no se ejecutó es la red real
  contra Google, por falta de credenciales.

---

## Despliegue

**Recomendación para una barbería chica:** Render o Railway + Postgres gestionado.

| Opción | Cómo | Cuándo conviene |
|---|---|---|
| **Render** | `render.yaml` incluido, runtime Docker | La más simple. Ojo: el plan gratuito duerme el servicio y los recordatorios no salen a horario |
| **Railway** | `railway.json` incluido | Muy simple, Postgres en dos clics |
| **VPS propio** | `docker compose up -d` levanta app + PostgreSQL | Más barato a la larga, lo administrás vos |
| **Fly.io** | El `Dockerfile` corre tal cual | Más control, más trabajo |
| **Vercel** | ❌ **No sirve** | Es serverless: no hay proceso vivo para los workers de recordatorios y Sheets, ni disco para SQLite |

Pasos comunes:

1. Crear el Postgres y copiar su `DATABASE_URL`.
2. Cargar todas las variables de entorno.
3. Desplegar. El esquema se aplica solo al arrancar.
4. Apuntar el webhook de Meta a `https://TU-DOMINIO/webhook/whatsapp`.
5. Verificar `https://TU-DOMINIO/salud`.

### En un VPS propio, con Docker

```bash
cp .env.example .env          # completar claves y POSTGRES_PASSWORD
docker compose up -d
docker compose logs -f app
```

Levanta la app y su PostgreSQL. La configuración del negocio queda montada
afuera de la imagen, así que el panel la puede editar sin reconstruir nada.

### Backups

Los turnos viejos se borran cada domingo, pero **los clientes, los descuentos y
los balances no**: eso hay que respaldarlo.

```bash
./backup.sh                   # guarda un .sql.gz en ./backups
0 3 * * * /ruta/al/backup.sh  # todas las noches a las 3
```

Conserva los últimos 30 y borra los más viejos. Si usás un Postgres gestionado
(Supabase, Neon, Railway), los backups ya vienen incluidos y esto no hace falta.

---

## Costos

Ver **[COSTOS.md](./COSTOS.md)**: qué cobra cada servicio, cuánto sale
aproximadamente una barbería con ~300 conversaciones por mes y qué es gratis.

**Ningún servicio externo es gratis para siempre.** WhatsApp cobra por
conversación de servicio a partir de cierto volumen, la API de IA cobra por
token y el hosting con proceso vivo cobra desde el primer día.

---

## Seguridad

- **Webhook:** firma `X-Hub-Signature-256` validada con HMAC y comparación en
  tiempo constante. En producción, sin `WHATSAPP_APP_SECRET` el webhook se rechaza.
- **Panel:** contraseña por variable de entorno, cookie de sesión firmada
  (HMAC), `httpOnly`, `Secure` y `SameSite=strict`; las mutaciones exigen
  `Content-Type: application/json` (un formulario cross-site no puede mandarlo).
- **Rate limiting:** login 10 intentos cada 15 minutos; API 240/min; webhook
  300/min; simulador 60/min.
- **Autorización por teléfono:** un cliente solo puede tocar sus propios turnos.
  El teléfono lo pone el backend desde el canal, no el modelo.
- **Validación:** `zod` en el borde (webhook, panel, herramientas del agente).
  Todo SQL va con parámetros: no hay concatenación de strings.
- **Requests duplicadas:** cada mensaje de WhatsApp se procesa una sola vez.
- **Errores:** el cliente ve un mensaje amable; el detalle queda en el log.
  Los logs enmascaran los teléfonos y redactan tokens.
- **Cabeceras:** `helmet` con CSP estricta (sin `unsafe-inline`).

---

## Problemas frecuentes

**El webhook no verifica (Meta muestra error).**
`WHATSAPP_VERIFY_TOKEN` tiene que ser idéntico a los dos lados, la URL tiene que
terminar en `/webhook/whatsapp` y ser HTTPS pública.

**Verifica, pero no llegan los mensajes.**
Falta suscribirse al campo **`messages`** en la configuración del webhook.

**Llegan mensajes pero el bot no contesta.**
Mirá el log. Si dice `webhook con firma invalida`, `WHATSAPP_APP_SECRET` está mal.
Si dice `WhatsApp respondio 401`, el `WHATSAPP_ACCESS_TOKEN` venció (los de
prueba duran 24 h: generá uno permanente).

**`WhatsApp respondio 400` con código 131047.**
Pasaron más de 24 h desde el último mensaje del cliente: hace falta una plantilla
aprobada.

**El bot contesta con el menú en vez de conversar.**
No hay `AI_API_KEY`, o el modelo falló. El log lo dice: `la IA no pudo responder`.

**No se actualiza Google Sheets.**
`GET /api/estado` muestra los pendientes. Errores típicos: la planilla no está
compartida con la cuenta de servicio (403) o el id está mal (404). Los eventos no
se pierden: quedan en la cola.

**"El puerto ya está en uso".**
Hay otra instancia corriendo. Cerrala o cambiá `PORT`.

**Dice que un horario está ocupado y en la planilla se ve libre.**
Manda la base de datos, no la planilla. Mirá el panel, y si hace falta apretá
**Resincronizar**.

**Las fechas salen corridas.**
Revisá `negocio.timezone` (`America/Argentina/Buenos_Aires`). El sistema guarda
todo en UTC y razona en hora local; nunca asume la zona del servidor.

---

## Qué falta / próximos pasos

Cosas conscientemente fuera de alcance, ordenadas por lo que pediría primero un
barbero real:

1. **Verificar de verdad las reseñas.** Google no expone una API para saber si
   alguien dejó una. La única alternativa real sería pedirle al cliente una
   captura, que es peor experiencia. Por ahora: confianza + el botón para
   sacarlo desde el panel.
2. **Varios barberos / sillas.** Hoy la agenda es de una sola persona. El modelo
   de datos ya está casi listo: habría que agregar `barbero_id` al turno y a la
   restricción de exclusión.
3. **Señas o pagos.** Ningún cobro está implementado.
4. **Prueba de carga.** La concurrencia está verificada contra PostgreSQL real
   (`npm run test:postgres`), pero con decenas de reservas simultáneas, no con
   miles. Para una barbería sobra; si algún día son diez sucursales, medir.
