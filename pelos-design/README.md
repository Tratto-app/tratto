# Pelo's Design — sitio web

Sitio de **Pelo's Design**, peluquería en Yerbal 880, Caballito, CABA.

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4

- [`PRODUCT.md`](./PRODUCT.md) — estrategia, objetivos y reglas de contenido
- [`DESIGN.md`](./DESIGN.md) — sistema de diseño y decisiones tipográficas

---

## Arranque rápido

```bash
npm install
cp .env.example .env.local     # opcional: el sitio funciona sin configurar nada
npm run dev                    # http://localhost:3000
```

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests end-to-end y accesibilidad (Playwright) |
| `npm run images` | Reprocesa las fotos originales del salón |
| `npm run brand` | Regenera favicon, apple-touch-icon y la imagen de Open Graph |
| `npm run precios` | Regenera `public/precios.pdf` |

## Estructura

```
src/
  app/                    Rutas (App Router)
    page.tsx              Home
    servicios/            Página de servicios
    precios/              Lista de precios completa
    legales/              Privacidad y términos
    llms.txt/             Resumen del negocio para asistentes con IA
    sitemap.ts robots.ts manifest.ts
  components/
    ui/                   Botón, Reveal, Section, Wordmark, Breadcrumbs
    sections/             Una por sección de la home
    site-header · site-footer · mobile-cta-bar
  data/                   FUENTE ÚNICA DE VERDAD
    business.ts           Dirección, contacto, enlaces, horarios
    services.ts           Servicios por categoría, con su evidencia
    gallery.ts            Fotos, alt y transformaciones
    prices.ts             Copia local de la lista de precios
    reviews.ts            Tipos y datos de respaldo de reseñas
    seo.ts                Metadata, preguntas frecuentes, keywords
    navigation.ts         Menú
  lib/
    google/places.ts      Cliente de Google Places (sólo servidor)
    prices/sheet.ts       Lectura de la planilla de precios (sólo servidor)
    seo/schema.ts         Constructores de JSON-LD
    price-list.ts         Verificación de existencia del PDF
  assets/images/          Masters procesados
  styles/globals.css      Design tokens
public/                   precios.pdf · og.jpg · iconos
scripts/                  Preparación de imágenes, marca y PDF
tests/unit · tests/e2e
```

## Editar el contenido

**Todo el contenido editable vive en `src/data/`.** Ningún componente hardcodea
datos del negocio.

- Cambiar un precio → la planilla de Google (ver más abajo)
- Cambiar el orden de las secciones → `src/app/page.tsx`
- Agregar un servicio → `src/data/services.ts`
- Cambiar la dirección o los enlaces → `src/data/business.ts`
- Sumar una foto → poner el master en `src/assets/images/` y sumarlo a
  `src/data/gallery.ts`
- Cambiar una pregunta frecuente → `src/data/seo.ts` (se actualiza también el
  JSON-LD y el `llms.txt`)

## Variables de entorno

Todas son **opcionales**: el sitio funciona sin ninguna. Cada una activa una
función extra. Ver [`.env.example`](./.env.example) para el detalle.

| Variable | Efecto si está vacía |
|----------|---------------------|
| `NEXT_PUBLIC_SITE_URL` | Usa `https://pelosdesign.com.ar` como canonical |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Usa el número del salón definido en `src/data/business.ts` |
| `NEXT_PUBLIC_PHONE` | Usa el teléfono definido en `src/data/business.ts` |
| `PRICES_SHEET_URL` | Los precios salen de la copia local de `src/data/prices.ts` |
| `PRICES_VALID_FROM` | No se muestra fecha de vigencia |
| `GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID` | Las opiniones enlazan a Google sin mostrar números |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Sin meta de Search Console |
| `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_META_PIXEL_ID` | No se carga ningún script de medición |

> `GOOGLE_MAPS_API_KEY` **no** lleva el prefijo `NEXT_PUBLIC_`: es una clave de
> servidor. `src/lib/google/places.ts` importa `server-only`, así que el build
> falla si alguien intenta usarla desde un componente cliente.

## Horarios

Están en `src/data/business.ts`, tomados de la ficha de Google del salón:
martes, miércoles y viernes de 10:00 a 17:30; sábado de 10:00 a 16:00. Lunes,
jueves y domingo cerrado.

Se muestran los siete días —incluidos los cerrados— más un indicador de
**"abierto ahora"** que se calcula en el navegador, en hora de Buenos Aires.
Se calcula en el cliente a propósito: la página es estática, así que un estado
resuelto en el build quedaría congelado y mentiría.

Cambiar un horario es editar `openingHours` en ese archivo. Se actualizan solos
la sección Encontranos, el `openingHoursSpecification` del JSON-LD, la pregunta
frecuente de horarios y el `llms.txt`.

## Cómo conectar las reseñas de Google

1. Crear un proyecto en Google Cloud y habilitar **Places API (New)**.
2. Generar una API key y restringirla a esa API.
3. Buscar el Place ID del salón con el
   [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id).
4. Cargar `GOOGLE_MAPS_API_KEY` y `GOOGLE_PLACE_ID` en el entorno.

Si la API falla, tiene timeout o devuelve un error, la sección cae al respaldo
sin romper la página.

**Hoy están cargadas a mano** en `src/data/reviews.ts`, transcriptas de la ficha
de Google: 5,0 sobre 176 reseñas, con cuatro opiniones. Ese archivo documenta
exactamente qué se transcribió y qué se ajustó (tildes, saltos de línea), y
marca con `truncated` las que Google muestra cortadas: la interfaz les agrega
los puntos suspensivos y el enlace, en lugar de completar lo que no se pudo leer.

Conectar la API reemplaza esa carga manual y mantiene todo al día solo.

Si algún día los tres campos vuelven a `null`, la sección degrada a una
invitación a leerlas en Google: nunca muestra un número sin respaldo.

## Precios: cómo los edita el salón

La lista vive en su propia página, `/precios`, enlazada desde la home, desde el
menú y desde el hero. También se descarga en PDF. Las dos salen de la **misma**
fuente, así que no pueden contradecirse.

Se sacó de la home a propósito: 23 servicios por cuatro largos cortan la lectura
de la página, y como página propia se comparte sola y posiciona en Google por
búsquedas del tipo «precios peluquería Caballito».

### Puesta en marcha (una sola vez)

1. Crear una planilla en Google Sheets con **una fila por servicio y una
   columna por largo de cabello**, igual que la lista impresa del salón:

   | Categoria | Servicio | Corto | Mediano | Largo | Extra largo | Nota |
   |-----------|----------|-------|---------|-------|-------------|------|
   | Corte y peinado | Corte | $40.000 | $40.000 | $40.000 | $40.000 | |
   | Corte y peinado | Brushing | $24.000 | $26.000 | $28.000 | $35.000 | |
   | Color | Balayage | | $200.000 | $250.000 | $300.000 | |

   Así, cambiar el precio de un servicio es tocar **una sola fila**.

   - La columna **Nota** es opcional y se imprime debajo del servicio.
   - Si una celda de precio queda **vacía**, el sitio muestra "Consultar" en
     lugar de inventar un número.
   - Los **largos se leen del encabezado**: el salón puede renombrarlos o
     agregar uno nuevo sin que haya que tocar código.

2. En la planilla: **Archivo → Compartir → Publicar en la Web**, elegir la hoja
   y el formato **CSV**, y copiar el link.

3. Pegar ese link en la variable `PRICES_SHEET_URL` del entorno.

### Día a día

El salón abre la planilla, cambia el precio, y listo. La web se actualiza sola
**en menos de 10 minutos**, sin tocar código ni pedirle nada a nadie. La lista
que ve la clienta y el PDF descargable salen de la misma planilla, así que no
pueden quedar desfasados.

### Qué pasa si algo falla

Si la planilla no está configurada, está caída, o alguien rompe el formato, el
sitio usa la copia local de `src/data/prices.ts` y sigue funcionando. Nunca
queda sin precios ni muestra un error.

### El PDF

`npm run precios` regenera `public/precios.pdf` leyendo la misma planilla (o la
copia local si no está configurada). Son cuatro hojas, una por largo de cabello,
a dos columnas como la lista original del salón. Conviene correrlo cuando
cambien los precios, para que el PDF descargable acompañe.

Si preferís el PDF propio del salón, alcanza con reemplazar el archivo en
`public/precios.pdf`. Si el archivo no existe, la sección lo detecta y cambia el
CTA por uno de contacto en lugar de dejar un enlace roto.

## Deployment

### Vercel (recomendado)

```bash
npm i -g vercel
vercel
```

Cargar las variables de entorno en el panel del proyecto. `next.config.ts` ya
define las cabeceras de seguridad y los formatos de imagen.

### Cualquier host con Node

```bash
npm ci && npm run build && npm run start
```

Todas las rutas se generan estáticas; la home se revalida cada 12 horas para
refrescar las reseñas.

### Después de publicar

1. Apuntar `NEXT_PUBLIC_SITE_URL` al dominio real **antes** del primer deploy
   (define el canonical, el sitemap y las URLs del JSON-LD).
2. Dar de alta el sitio en Google Search Console y enviar `/sitemap.xml`.
3. Validar el JSON-LD con la
   [prueba de resultados enriquecidos](https://search.google.com/test/rich-results).
4. Cargar la URL del sitio en la ficha de Google Business y en el perfil de Instagram.

## Performance

Medido con Chromium sobre el build de producción, no estimado:

| | Escritorio 1440 | Mobile 375, 3G lento + CPU 4× |
|---|---|---|
| LCP | ~200 ms | ~2550 ms |
| FCP | ~200 ms | ~2470 ms |
| CLS | 0 | 0.0001 |

- **Cero terceros.** Las fuentes las autohospeda `next/font` (no hay pedido a
  Google en runtime) y el mapa se carga en un iframe diferido.
- **CLS ~0**: todas las imágenes se importan de forma estática, así que
  `next/image` reserva el espacio exacto antes de cargar.
- Las fuentes pesan **67 kB** entre las tres familias. Ver `DESIGN.md` para el
  detalle de cómo se bajó desde 549 kB.

El escenario móvil es deliberadamente pesimista: 400 kbps, **400 ms de latencia**
y CPU limitada 4×. Con esa latencia el primer pintado está dominado por los
viajes de ida y vuelta, no por el peso: bajar las fuentes de 190 kB a 67 kB casi
no movió el número, porque el cuello ya no son los bytes.

En una conexión móvil real de Argentina (latencia de 50-100 ms) los tiempos son
una fracción de eso. **No se midió con Lighthouse ni sobre el dominio final**,
así que conviene volver a correrlo una vez publicado.

## Tests

```bash
npm test          # 81 tests unitarios
npm run test:e2e  # 118 tests E2E (escritorio + móvil)
```

Los E2E levantan el servidor de producción solos. Cubren navegación, menú móvil,
CTAs, enlaces internos, PDF, mapa y su respaldo, reseñas, metadata, JSON-LD,
`llms.txt`, siete anchos de viewport y accesibilidad con axe-core (WCAG 2.2 AA).

El contenedor de CI puede traer un Chromium que no coincide con la build que
espera Playwright; `playwright.config.ts` apunta a `/opt/pw-browsers/chromium` y
se puede sobrescribir con `PLAYWRIGHT_CHROMIUM_PATH`.

## Datos pendientes de confirmar

Ver la sección correspondiente en [`PRODUCT.md`](./PRODUCT.md#7-reglas-de-contenido-innegociables).
Ya confirmados:

- **Teléfono**: +54 9 11 6794-1212, en `src/data/business.ts`.
- **Horarios**: de la ficha de Google, en `src/data/business.ts`.
- **Reseñas**: 5,0 sobre 176, con cuatro opiniones, en `src/data/reviews.ts`.
- **Lista de precios**: transcripta de la lista oficial del salón, en
  `src/data/prices.ts`. Ver las notas de ese archivo: hay dos importes de la
  lista original que conviene que el salón revise.

Sigue pendiente:

- **Textos legales** de privacidad y términos.
- Revisar dos importes de la lista de precios (ver `src/data/prices.ts`).
- Opcional: conectar la API de Places para que las reseñas se actualicen solas.

Hasta entonces el sitio no publica ninguno de esos datos.
