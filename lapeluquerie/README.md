# Lapeluquerie · Studio Art — sitio web

Sitio estático, sin build ni dependencias. Se sube tal cual a cualquier hosting
(Netlify, Vercel, GitHub Pages, un FTP común).

```
lapeluquerie/
├── index.html          estructura y SEO
├── css/tokens.css      design system (colores, tipografía, espaciado, motion)
├── css/estilos.css     componentes y secciones
├── js/datos.js         👈 TODO el contenido y los datos del negocio
├── js/app.js           comportamiento (reservas, galería, diagnóstico, sliders)
├── assets/             fotos, identidad y tipografías autoalojadas
├── tests/e2e.mjs       suite end-to-end (95 chequeos)
├── robots.txt
└── sitemap.xml
```

No hay dependencias en runtime: cero librerías, cero requests a terceros.
Las tipografías (Bodoni Moda + Archivo, licencia OFL) están autoalojadas en
`assets/fuentes/` para no depender de Google Fonts y mejorar el LCP.

Para verlo en local hace falta un servidor (usa módulos ES):

```bash
cd lapeluquerie && python3 -m http.server 8080
```

---

## ⚠️ Datos que faltan antes de publicar

Todo lo que está entre `[corchetes]` es un placeholder. No se inventó ningún dato
del salón: dirección, precios, horarios, equipo y reseñas quedaron en blanco a
propósito. Se completan casi todos en **`js/datos.js`**.

| Dato | Dónde | Nota |
|---|---|---|
| WhatsApp | `js/datos.js` → `NEGOCIO.whatsapp` | Sólo dígitos: `5491123456789`. **Mientras esté vacío, todos los botones abren el mensaje directo de Instagram**, así el sitio funciona igual. |
| Dirección, zona, ciudad | `NEGOCIO.zona`, `NEGOCIO.ciudad`, `NEGOCIO.direccion` | También en el JSON-LD de `index.html`. |
| Horarios | `NEGOCIO.horarios` | El campo `texto` es lo que se ve; `abre`/`cierra` son para Google. |
| Teléfono | `NEGOCIO.telefonoVisible` | |
| Dominio | `NEGOCIO.dominio` + buscar `[DOMINIO]` en `index.html`, `robots.txt`, `sitemap.xml` | 4 archivos. |
| Duración y precio por servicio | `SERVICIOS[].duracion` / `.precio` | Están en `null`: si los completás aparecen solos en la ficha. Si los dejás en `null`, el sitio muestra "los valores dependen del largo…". |
| Equipo | `EQUIPO` | Nombres, especialidad y fotos. Poné la foto en `assets/` y escribí el nombre del archivo (sin extensión) en `foto`. |
| Reseñas | `RESENAS` | Copiar textuales desde el perfil de Google. Después poner `NEGOCIO.resenasReales = true` y agregar el bloque `aggregateRating` al JSON-LD. |

Buscar todos los pendientes de una:

```bash
grep -rn "\[" js/datos.js index.html robots.txt sitemap.xml | grep -v "\[\]"
```

---

## Cambiar de WhatsApp a un sistema de turnos

Toda la conversión pasa por una sola función (`reservar()` en `js/app.js`).
Para migrar a Fresha, Calendly, Booksy o agenda propia:

```js
// js/datos.js
reservas: { proveedor: 'url', url: 'https://tu-sistema-de-turnos.com/lapeluquerie' }
```

No hay que tocar ningún botón: los ~20 CTA del sitio salen todos por ahí.

## Mensajes contextuales

Cada botón manda un mensaje distinto según desde dónde se toca
(`MENSAJES` en `js/app.js`): servicio, galería, transformación, profesional
o resultado del diagnóstico (que además adjunta las respuestas de la clienta).

## Tests

```bash
npx http-server -p 8123 -s .          # en una terminal
npm i -D playwright && npx playwright install chromium
node tests/e2e.mjs                    # en otra
```

95 chequeos sobre Chromium: navegación y anchors, menú mobile, acordeón de
servicios, diagnóstico completo, filtros + lightbox (teclado incluido),
slider antes/después (mouse y teclado), los ~20 CTA de reserva y sus mensajes
contextuales, accesibilidad (nombres accesibles, foco, targets ≥24 px,
landmarks), contraste WCAG AA calculado sobre el render real, cinco viewports
(375 / 390 / 768 / 1440 / 1920) sin overflow y `prefers-reduced-motion`.

Medido en local: LCP 136 ms, CLS 0,0009, 138 KB en la primera pantalla y
255 KB con toda la página recorrida, 19 requests.

## Fotos

Las de `assets/` salieron del material del salón. `antes-1/2` y `despues-1/2`
son los cuatro cuadrantes del collage original, recortados para sacar la marca
de agua.

El sitio usa WebP en todo (el único JPEG es `og.jpg`, para los scrapers de
redes). Para sumar una foto nueva: exportala como `nombre-640.webp` y
`nombre.webp` (1100 px de ancho), poné `nombre` en `GALERIA` dentro de
`js/datos.js` y agregala a `DOS_ANCHOS` en `js/app.js` para que salga con
`srcset`.
