# Piezas gráficas de lanzamiento

Con la misma identidad que la app: verde bosque, latón e IBM Plex.

| Archivo | Uso | Tamaño |
|---|---|---|
| `01-foto-de-perfil.png` | Foto de perfil de Instagram, Facebook, TikTok y WhatsApp | 1080×1080 |
| `01-foto-de-perfil-circular.png` | Foto de perfil para redes que recortan en círculo (TikTok, Instagram, WhatsApp): solo el símbolo, centrado. Sale de `foto-perfil.html`. | 1080×1080 |
| `02-portada-facebook.png` | Portada de la página de Facebook | 1640×624 |
| `03-post-presentacion.png` | Primer post: qué es Tratto | 1080×1350 |
| `04-post-como-funciona.png` | Cómo funciona en 3 pasos | 1080×1350 |
| `05-post-proveedores.png` | Para sumar proveedores | 1080×1350 |
| `06-cartel-proveedores-A4` | Cartel para ferreterías y corralones (PDF para imprimir, PNG a 300 dpi) | A4 |
| `07-cartel-vecinos-A4` | Cartel para comercios del barrio | A4 |

Los QR de los carteles llevan a `trattoapp.com.ar` con
`utm_source=cartel&utm_medium=qr&utm_campaign=proveedores|vecinos`, así Vercel
Analytics muestra cuánta gente entró por cada cartel. Se verificó que se
leen bien y que la redirección a `www` conserva esos parámetros.

Para cambiar un texto: editar `piezas.html` y correr `python3 render.py`
(Playwright + Chromium). Las imágenes quedan en `salida/`.

## Carruseles de Instagram (`carruseles/`)

Placas de 1080×1350 (4:5) con la misma base que las publicidades: fondo claro
con manchas de color que siguen de una placa a la otra al deslizar (panorama
continuo), títulos en Plex Sans Condensed, precios y URL en Plex Mono, sello
de latón y cierre oscuro con la URL. `carrusel.css` y `carrusel.js` (íconos,
logo, cabecera con el número de placa) son comunes; cada carrusel es un HTML
con una `<section class="placa">` por placa.

```bash
cd tools/piezas-redes/carruseles
python3 render-carrusel.py precios-oct.html carrusel-precios-oct      # → redes/carrusel-precios-oct-01..10.png (+ .jpg)
python3 render-carrusel.py presupuesto.html carrusel-presupuesto --solo 10 --salida /tmp/previa   # revisar una sola
```

| Carrusel | Item de la cola | Link con nombre |
|---|---|---|
| `precios-oct.html` "Cuánto sale en octubre: 7 servicios de 7 rubros" | `5ebe9d95` | `ig-precios-oct` |
| `presupuesto.html` "Te lo dejo en 80. ¿80 qué?" | `f7eb3020` | `ig-presupuesto` |

Los textos salen tal cual del `cuerpo` aprobado; los precios, de
`precios_referencia` ajustados al mes. La barra "cuánto varía" muestra el más
caro respecto del más barato del rango, con tope en "el doble". Se exporta en
PNG y en JPG (Instagram toma JPG cuando se programa por API).

## Reels animados (`reels/`)

Reels de texto animado con la misma identidad, en 1080×1920 y listos para
subir a TikTok o Instagram. Cada reel es un HTML con una función `render(t)`.
`render-reel.py` lo dibuja cuadro por cuadro y lo pasa a MP4 con ffmpeg:

```bash
cd tools/piezas-redes/reels && python3 render-reel.py reel-pintura.html --segundos 33
```

Salen `salida/<nombre>.mp4` (sin audio: el sonido se elige al subirlo, mejor
uno en tendencia) y `salida/<nombre>-portada.jpg`. El texto queda dentro de
la zona que no tapan los botones de la app: entre y=260 e y=1460, sin pasar
de x=930.

| Reel | Guion |
|---|---|
| `reel-pintura` | "¿Te pidieron $250.000 por pintar una pieza?" (memoria de contenido `c-20261006-bc4d69`). Solo texto, sin voz. |
| `reel-tratto-voz` | Qué es Tratto, con la voz del fundador, subtítulos palabra por palabra, 11 escenas animadas y efectos de sonido. |
| `reel-dos-plomeros` | "Dos plomeros, el mismo caño tapado" (voz, 31 s, `c-20261006-5c331a`). |
| `reel-presupuesto-barato` | "El presupuesto más barato te puede salir el doble" (voz, 31 s, `c-20261006-c448fd`). |
| `reel-manana-paso` | "Mañana a primera hora paso" (voz, 27 s, `c-20261006-b4aded`). |
| `reel-proveedores` | "Si ofrecés un servicio y el teléfono no suena" (voz, 37 s, para proveedores de todos los rubros, `c-20261006-b1b538`). |

Reel con voz:

```bash
python3 sonido.py audio/tratto-voz.m4a audio/reel-tratto-voz.efectos.json audio/reel-tratto-voz-mezcla.m4a --segundos 37.5
python3 render-reel.py reel-tratto-voz.html --segundos 37.5 --palabras audio/tratto-voz.palabras.json --audio audio/reel-tratto-voz-mezcla.m4a
```

- `audio/*.palabras.json`: cada palabra con su inicio y fin en segundos, para los subtítulos y para sincronizar las animaciones.
- `audio/*.efectos.json`: qué efecto suena en qué segundo y a qué volumen. Los efectos se sintetizan en `sonido.py`, sin bancos de sonido ni licencias.
- `--previa 0,5.2,13.4` saca solo esos cuadros en PNG, para revisar antes del render completo, que tarda unos 4 minutos.

Los cuatro reels de la serie con voz (`reel-dos-plomeros`, `reel-presupuesto-barato`,
`reel-manana-paso`, `reel-proveedores`) usan la misma base que `reel-tratto-voz`:
`comun-voz.css` y `comun-voz.js` ponen el fondo, la marca, los subtítulos, la
entrada de las escenas, los golpes de cámara y el cierre; cada HTML define solo
sus escenas en `window.REEL`. La voz pasa por `tools/voz-en-off/voz_en_off.py`
(la cadena aprobada) y los tiempos de cada palabra salen de faster-whisper,
corregidos contra el guion:

```bash
python3 sonido.py audio/voz-dos-plomeros.m4a audio/reel-dos-plomeros.efectos.json audio/reel-dos-plomeros-mezcla.m4a --segundos 31.1
python3 render-reel.py reel-dos-plomeros.html --segundos 31.1 --palabras audio/voz-dos-plomeros.palabras.json --audio audio/reel-dos-plomeros-mezcla.m4a
```

Duraciones: dos-plomeros 31.1, presupuesto-barato 31.4, manana-paso 26.6, proveedores 37.1.

## Publicidades estilo presentación de producto (sin voz)

Inspiradas en un anuncio de respond.io: fondo claro con manchas de color en
movimiento, títulos que entran con desenfoque, palabras que se reemplazan,
lista de funciones con íconos, pantallas reales en un teléfono en 3D y cierre
oscuro con el logo. Base común: `reels/publicidad-comun.js` + `reels/publicidad.css`.

| Pieza | Duración | Para qué |
|---|---|---|
| `reels/publicidad-calculadora.html` | 23 s | Llevar gente a trattoapp.com.ar/calculadora (ejemplo real: DJ para un 15 en Morón, +37 %) |
| `reels/publicidad-app.html` | 25 s | Publicidad general de la app (rubros variados) |

Las pantallas están en `reels/img/` (las de la app salen de las capturas de la
ficha de las tiendas; las de la calculadora, de la página real con la
respuesta simulada). La música es propia (`reels/musica.py`, sin licencias) y
los efectos se mezclan con `sonido.py`:

```bash
cd tools/piezas-redes/reels
python3 musica.py audio/musica-app.wav --segundos 25 --cierre 20.6
python3 sonido.py audio/musica-app.wav audio/publicidad-app.efectos.json audio/publicidad-app-mezcla.m4a --segundos 25
python3 render-reel.py publicidad-app.html --segundos 25 --audio audio/publicidad-app-mezcla.m4a
```

Copias con URL pública (para Metricool) en `redes/publicidad-*.mp4`.
