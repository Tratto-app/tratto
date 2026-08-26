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
    reviews.ts            Tipos y datos de respaldo de reseñas
    seo.ts                Metadata, preguntas frecuentes, keywords
    navigation.ts         Menú
  lib/
    google/places.ts      Cliente de Google Places (sólo servidor)
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
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Los CTA de contacto usan Instagram |
| `NEXT_PUBLIC_PHONE` | No se muestra teléfono ni se emite en el schema |
| `GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID` | Las opiniones enlazan a Google sin mostrar números |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Sin meta de Search Console |
| `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_META_PIXEL_ID` | No se carga ningún script de medición |

> `GOOGLE_MAPS_API_KEY` **no** lleva el prefijo `NEXT_PUBLIC_`: es una clave de
> servidor. `src/lib/google/places.ts` importa `server-only`, así que el build
> falla si alguien intenta usarla desde un componente cliente.

## Cómo conectar las reseñas de Google

1. Crear un proyecto en Google Cloud y habilitar **Places API (New)**.
2. Generar una API key y restringirla a esa API.
3. Buscar el Place ID del salón con el
   [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id).
4. Cargar `GOOGLE_MAPS_API_KEY` y `GOOGLE_PLACE_ID` en el entorno.

La home revalida cada 12 horas. Si la API falla, tiene timeout o devuelve un
error, la sección cae al respaldo sin romper la página.

## Cómo publicar la lista de precios

Dos caminos:

1. **Reemplazar el archivo.** Poner el PDF del salón en `public/precios.pdf`.
2. **Regenerarlo.** Cargar los importes en `PRICES` dentro de
   `scripts/generate-price-list.mjs` y correr `npm run precios`.

Si el archivo no existe, la sección de precios lo detecta y cambia el CTA por
"Pedir la lista de precios" en lugar de dejar un enlace roto.

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

## Tests

```bash
npm test          # 30 tests unitarios
npm run test:e2e  # 92 tests E2E (escritorio + móvil)
```

Los E2E levantan el servidor de producción solos. Cubren navegación, menú móvil,
CTAs, enlaces internos, PDF, mapa y su respaldo, reseñas, metadata, JSON-LD,
`llms.txt`, siete anchos de viewport y accesibilidad con axe-core (WCAG 2.2 AA).

El contenedor de CI puede traer un Chromium que no coincide con la build que
espera Playwright; `playwright.config.ts` apunta a `/opt/pw-browsers/chromium` y
se puede sobrescribir con `PLAYWRIGHT_CHROMIUM_PATH`.

## Datos pendientes de confirmar

Ver la sección correspondiente en [`PRODUCT.md`](./PRODUCT.md#7-reglas-de-contenido-innegociables).
En resumen, el salón todavía tiene que confirmar: **teléfono/WhatsApp**,
**horarios**, **lista de precios**, **promedio y cantidad de reseñas**, y los
**textos legales**. Hasta entonces el sitio no publica ninguno de esos datos.
