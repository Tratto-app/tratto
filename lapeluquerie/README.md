# Lapeluquerie — sitio web

Sitio estático, sin build ni dependencias. Se sube tal cual a cualquier hosting
(Netlify, Vercel, GitHub Pages, un FTP común).

```
lapeluquerie/
├── index.html          estructura y SEO
├── css/tokens.css      design system (colores, tipografía, espaciado, motion)
├── css/estilos.css     componentes y secciones
├── js/datos.js         👈 TODO el contenido y los datos del negocio
├── js/app.js           comportamiento (WhatsApp, galería, sliders)
├── assets/             fotos, identidad y tipografías autoalojadas
├── tests/e2e.mjs       suite end-to-end (91 chequeos)
├── robots.txt
└── sitemap.xml
```

No hay dependencias en runtime: cero librerías, cero requests a terceros.
Las tipografías (Fraunces + Karla, licencia OFL) están autoalojadas en
`assets/fuentes/` para no depender de Google Fonts y mejorar el LCP.

Para verlo en local hace falta un servidor (usa módulos ES):

```bash
cd lapeluquerie && python3 -m http.server 8080
```

---

## ⚠️ Lo único que falta

Todos los datos de contacto están cargados y confirmados: dirección, WhatsApp,
teléfono, horarios y reseñas reales de Google.

| Pendiente | Dónde | Nota |
|---|---|---|
| Duración y precio por servicio | `js/datos.js` → `SERVICIOS[].duracion` / `.precio` | Están en `null`. Si los completás aparecen solos como chips en la tarjeta; si los dejás en `null`, la página invita a consultar por WhatsApp. |
| Dominio | `NEGOCIO.dominio` + buscar `[DOMINIO]` en `index.html`, `robots.txt`, `sitemap.xml` | |

## Sin reservas online

El sitio **no** tiene sistema de turnos, calendario ni formulario. Todo el
contacto sale por WhatsApp, a través de una sola función (`consultar()` en
`js/app.js`) con mensajes distintos según desde dónde se toque: general,
un servicio puntual, una foto de la galería, un antes/después o precios.

Si el número cambia, se toca un solo lugar: `NEGOCIO.whatsapp` en `js/datos.js`.

## Tests

```bash
npx http-server -p 8123 -s .          # en una terminal
npm i -D playwright && npx playwright install chromium
node tests/e2e.mjs                    # en otra
```

91 chequeos sobre Chromium: navegación y anchors, menú mobile, filtros y
lightbox (teclado incluido), slider antes/después (mouse y teclado), los CTA de
WhatsApp y sus mensajes contextuales, ausencia total de reservas online,
datos reales del negocio en pantalla, accesibilidad (nombres accesibles, foco,
targets ≥24 px, landmarks), contraste WCAG AA calculado sobre el render real,
cinco viewports (375 / 390 / 768 / 1440 / 1920) sin overflow y
`prefers-reduced-motion`.

## Fotos

Las de `assets/` salieron del material del salón. `antes-1/2` y `despues-1/2`
son los cuatro cuadrantes del collage original, recortados para sacar la marca
de agua.

El sitio usa WebP en todo (el único JPEG es `og.jpg`, para los scrapers de
redes). Para sumar una foto nueva: exportala como `nombre-640.webp` y
`nombre.webp` (1100 px de ancho), poné `nombre` en `GALERIA` dentro de
`js/datos.js` y agregala a `DOS_ANCHOS` en `js/app.js` para que salga con
`srcset`.
