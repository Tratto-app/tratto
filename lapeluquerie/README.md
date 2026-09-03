# La Peluquerie · Studio Art — sitio web

Sitio estático, sin build y sin dependencias. Se sube tal cual a cualquier
hosting que sirva archivos (Netlify, Vercel, Cloudflare Pages, GitHub Pages,
un hosting compartido). No hay backend ni base de datos.

```
lapeluquerie/
├─ index.html            Todo el contenido editorial, en HTML semántico
├─ robots.txt
├─ sitemap.xml
├─ site.webmanifest
├─ favicon.ico
└─ assets/
   ├─ css/main.css       Sistema visual completo, ordenado en @layer
   ├─ fonts/*.woff2      Bodoni Moda y Archivo, servidas desde el propio dominio
   ├─ img/               Fotos (hoy, marcadores de reemplazo)
   └─ js/
      ├─ config.js       ⬅ ÚNICO archivo que hay que editar para poner el sitio en marcha
      ├─ booking.js      Capa de reservas (WhatsApp hoy, agenda online mañana)
      ├─ datos.js        Vuelca los datos del negocio en la página y en el schema
      ├─ nav.js  servicios.js  finder.js  galeria.js  antesdespues.js
      ├─ form.js  barra.js  reveal.js
      ├─ revisar.js      Panel de datos pendientes (solo con ?revisar=1)
      └─ main.js         Arranque
```

---

## 1 · Lo primero: poner el WhatsApp

Sin esto el sitio funciona pero los botones de reserva abren un aviso en vez de
abrir el chat. En `assets/js/config.js`:

```js
contacto: {
  whatsapp: '5491155554444',        // país + área + número, solo dígitos
  whatsappVisible: '11 5555-4444',  // cómo se muestra en pantalla
}
```

El formato es **código de país + código de área + número, sin `+`, sin `0`, sin
`15` y sin espacios**. Buenos Aires `11 5555-4444` → `5491155554444`.
Córdoba `351 555-4444` → `5493515554444`.

## 2 · Ver qué falta cargar

Abrí el sitio agregando `?revisar=1` al final de la dirección:

```
https://tudominio.com.ar/?revisar=1
```

Aparece abajo a la izquierda un panel con todo lo que todavía está pendiente y
el nombre exacto del campo que hay que completar. Ese panel **no se carga nunca
en una visita normal**: solo existe si está ese parámetro en la URL.

## 3 · Datos pendientes de confirmar

Están todos en `config.js`, marcados con `PENDIENTE`. Ninguno se completó a ojo:

| Dato | Campo en `config.js` | Mientras esté vacío |
|---|---|---|
| WhatsApp | `contacto.whatsapp` | Los CTA abren un aviso |
| Teléfono y email | `contacto.telefono` / `.email` | No se muestran |
| Dirección y zona | `local.calle`, `local.zona`, `local.ciudad` | Dice "pendiente de confirmar" |
| Mapa | `local.mapsEmbed`, `local.mapsUrl` | El recuadro del mapa avisa que falta |
| Horarios | `horarios` + `horariosConfirmados: true` | No se publican |
| Precios | `precios.lista` + `mostrarPrecios: true` | Dice "Se cierra en la consulta" |
| Reseñas | `reviews.lista` + `verificadas: true` | Sección honesta que deriva a Instagram |
| Equipo | `equipo[].confirmado: true` + nombre y bio | Ficha marcada como plantilla |
| Marcas de producto | `marcas` | Texto genérico sin nombrar marcas |
| Formas de pago | `formasDePago` | La FAQ dice que se consulten |
| Dominio final | `marca.dominio` | Ver el punto 6 |

> **Nada de esto se inventa.** Si un dato falta, el sitio lo dice; nunca publica
> un horario, un precio, una reseña o una dirección que no haya confirmado el
> salón.

## 4 · Reemplazar las fotos

Todas las imágenes de `assets/img/` son marcadores: llevan un sello
`REEMPLAZAR · …` encima justamente para que no se publiquen por descuido.

Para cambiarlas, **guardá la foto real con el mismo nombre de archivo** y no hay
que tocar ni una línea de código:

| Archivo | Dónde va | Proporción |
|---|---|---|
| `hero-wide-960/1440/1920.webp` | Portada en escritorio | 16:9 |
| `hero-portrait-640/860/1080.webp` | Portada en celular | 3:4 |
| `srv-*.webp` | Ficha de cada servicio | 4:5 |
| `gal-*.webp` | Galería de trabajos | 4:5 o 3:2 |
| `ba-N-antes.webp` / `ba-N-despues.webp` | Comparador | 3:2, **mismo encuadre** |
| `team-0N.webp` | Equipo | 4:5 |
| `exp-0N.webp` | Ambiente del salón | 3:2 |
| `ig-0N.webp` | Tira de Instagram | 1:1 |

Guardá en **WebP** con calidad 75–80. Del hero hacen falta las tres medidas para
que en celular no baje una foto de escritorio.

En el antes/después las dos fotos tienen que estar tomadas **desde el mismo
ángulo y a la misma distancia**, o el deslizador no compara nada.

Al cambiar una foto, actualizá también su texto alternativo en `index.html`
(el atributo `alt`): describe lo que se ve, y es lo que lee quien usa un lector
de pantalla.

## 5 · Cambiar de WhatsApp a una agenda online

El sitio no sabe que reserva por WhatsApp: llama a `abrirReserva()` y listo.
Para migrar a Calendly, Fresha, Treatwell o un sistema propio:

```js
reservas: {
  proveedor: 'calendly',                       // 'whatsapp' | 'calendly' | 'fresha' | 'externo'
  url: 'https://calendly.com/lapeluquerie/turno',
}
```

Eso es todo: los CTA del hero, de cada servicio, de la galería, del comparador,
del equipo, del buscador y del formulario pasan a apuntar a la agenda nueva sin
tocar el HTML. Si el proveedor que usás no está, se agrega en `booking.js`
(bloque `proveedores`) escribiendo una función que arme la URL.

## 6 · Antes de publicar

1. Poner el dominio real en `config.js` → `marca.dominio`.
2. Buscar y reemplazar `https://lapeluquerie.com.ar` por el dominio real en
   `index.html` (canonical, Open Graph y datos estructurados), `sitemap.xml` y
   `robots.txt`.
3. Activar **compresión gzip o brotli** en el hosting. El HTML, el CSS y el JS
   pesan unos 190 KB sin comprimir y bajan a unos 45 KB con compresión.
4. Servir con **HTTPS** y cacheo largo para `assets/` (las fuentes y las
   imágenes no cambian de nombre).
5. Revisar con `?revisar=1` que no quede ningún dato pendiente.
6. **Sumar la zona al `<title>` y a la `<meta name="description">`** de
   `index.html` en cuanto esté confirmada: `… — Estudio de color en Palermo`.
   Es lo que decide si el sitio aparece en "peluquería en \[zona\]".
7. Dar de alta el **perfil de Google Business** y pegar el link en
   `reviews.googleUrl`. Junto con el punto anterior, es lo que más mueve la
   aguja en las búsquedas locales.

## 7 · Pruebas

La suite cubre navegación, menú, acordeón, buscador, galería, comparador,
formulario, links de WhatsApp, teclado, movimiento reducido, funcionamiento sin
JavaScript, accesibilidad con axe-core y responsive en cinco medidas.

```bash
python3 -m http.server 8099        # servir el sitio desde esta carpeta
npm i -D playwright axe-core       # una sola vez
node test.mjs                      # correr la suite
```

## 8 · Decisiones tomadas

- **Sin modo oscuro.** La marca es negro y hueso en las dos direcciones; un modo
  automático rompería la identidad en vez de sumar.
- **Contenido en el HTML, no generado por JavaScript.** Los servicios, la
  galería y las preguntas frecuentes se leen sin ejecutar nada: es lo que
  necesitan los buscadores y los asistentes de IA.
- **Sin librerías.** Todo el movimiento y las interacciones son CSS y unos pocos
  módulos propios. Cargar un framework para un acordeón no se paga.
- **Tipografías propias.** Servidas desde el dominio, solo el subconjunto latino:
  sin conexión a terceros y sin bloquear el dibujado.
- **Reseñas y equipo apagados hasta tener datos reales.** Es una decisión, no un
  olvido.
