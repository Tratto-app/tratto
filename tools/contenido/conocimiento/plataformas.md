# TikTok e Instagram: qué cambia entre una red y la otra

Revisado el 8/10/2026. Las redes cambian sus límites seguido: si algo no
coincide con lo que se ve en la app, corregilo acá y queda corregido para todas
las skills. Lo que dice "conviene" es criterio, no un límite.

## Cuentas de Tratto

| | TikTok | Instagram |
|---|---|---|
| Usuario | @trattoapp | @trattoapp_ |
| Link que se toca | En el texto, ninguno. En el perfil **todavía no** (protocolo, sección 8.2): el link va escrito en el texto y en pantalla | En el texto, ninguno. En el perfil, 3 links con nombre: la segunda línea dice "tocá @trattoapp_ y entrá al link «…»". En historias, el sticker de link |
| Links con nombre | `trattoapp.com.ar/r/tt-<pieza>` | `trattoapp.com.ar/r/ig-<pieza>` |
| Programar | Metricool (marca 7270470), publicación manual con aviso al teléfono | Metricool, igual |
| Mejores horarios | `config/estrategia.json` → `horarios` | `config/estrategia.json` → `horarios` |

## Formatos y límites

| | TikTok | Instagram |
|---|---|---|
| Video | Vertical 9:16, hasta 10 min. Conviene 15 a 35 s | Reel 9:16, hasta 3 min. Conviene 15 a 60 s |
| Carrusel | Modo foto: hasta 35 imágenes, 9:16 o 4:5, con música | Hasta 20 (por Metricool/API, 10). 4:5 (1080×1350) |
| Texto del post | Hasta 4.000 caracteres. Se ven ~2 renglones | Hasta 2.200. Se ven ~125 caracteres antes de "más" |
| Hashtags | 3 a 5. Además, **palabras clave dichas y escritas**: TikTok funciona como buscador | 3 a 5 con tamaño (nicho, medio, amplio). Más de 5 no suma |
| Bio | 80 caracteres | 150 caracteres |
| Nombre | 30 caracteres. Se busca por nombre | 30 caracteres. El campo "nombre" es buscable: poné qué hacés |
| Fijados | Hasta 3 videos | Hasta 3 publicaciones |
| Lo que más empuja | Retención completa, que lo vean de nuevo, compartidos | Envíos por DM y guardados, después comentarios |

## Primeros segundos y primera línea

- **TikTok:** el gancho tiene que estar dicho Y escrito en pantalla en el primer
  segundo. La primera línea del texto lleva la palabra clave que la gente
  buscaría ("cuánto sale un flete", "profe de inglés").
- **Instagram:** la primera línea del caption (hasta ~125 caracteres) tiene que
  entenderse sola, sin el "más". En un carrusel, la placa 1 promete y abre un
  bucle; nunca un título suelto.

## Fórmulas de gancho probadas

Las 12 categorías están en `hooks.json`. Las cuatro que más se repiten en
cuentas que crecen, con su versión para Tratto:

| Fórmula | Molde | Ejemplo para Tratto |
|---|---|---|
| Número primero | [N] [cosas] que [resultado/dolor] | "3 cosas que tiene que decir un presupuesto antes de aceptarlo" |
| Mito vs. realidad | "[Creencia]". Falso: [dato] | "'El más barato siempre sale caro.' No siempre: mirá qué incluye" |
| Antes / después | Antes [situación], ahora [resultado] | "Antes pedía 5 presupuestos por WhatsApp. Ahora los comparo en uno" |
| Confesión | Un hecho propio, concreto y con fecha, dicho sin vueltas | "Pagué $85.000 por un flete que valía $60.000" (solo si es real) |

## Reglas de voz (todas las redes)

- Castellano rioplatense con voseo: "pedí", "mirá", "sabés". Nunca "tú puedes".
- Números concretos antes que adjetivos: "$53.000 a $73.000" y no "barato".
- Una idea por pieza. Nombres de rubros reales, más de 40, no solo hogar.
- Antes de entregar, pasar el texto por `node tools/contenido/cli.mjs humanizar`
  (skill `contenido-humanizador`).
