# Tratto: reglas para Claude

## Contenido para TikTok e Instagram: se aplica solo

La persona no tiene que pedir cada pieza del sistema de contenido. Cada vez que
armes, adaptes, revises, planifiques o programes algo para TikTok o Instagram
(lo pida la persona, una rutina, el CMO o lo detectes vos), aplicá las piezas
que correspondan sin esperar que te las nombren. La tabla de cuándo va cada
una está en `.claude/skills/contenido/SKILL.md`, sección "Automático".

- Pieza nueva: ganchos → redactor → formato (carrusel, historia o video) →
  hashtags → humanizador → `verificar` y puntuar → versión para la otra red.
- Todo texto que va a salir publicado con el nombre de Tratto (redes, guías,
  anuncios, mails nuevos) pasa por el humanizador antes de entregarlo.
- Links: un link escrito en el texto no se puede tocar en ninguna de las dos
  redes. En Instagram la segunda línea dice "tocá @trattoapp_ y entrá al link
  «…»" y cada reel o carrusel lleva su historia con sticker de link. En TikTok,
  link escrito y en pantalla, sin prometer "link en la bio" hasta que TikTok
  lo habilite (`tools/contenido/conocimiento/protocolo.md`, sección 8.2).
- Lunes: radar viral y plan de la semana. Primer lunes del mes: perfil.
- Guía o página de precios nueva en la web: carrusel y reel para redes.
- Redes con permiso total (16/10/2026): la persona dijo "no requieras mi
  permiso para nada" en TikTok, Instagram y Facebook. Lo que pasa la cadena y
  los controles se programa en Buffer en modo automático (se publica solo),
  sin esperar aprobación, y se le avisa en una línea qué sale, en qué red y
  cuándo. Mails, anuncios, guías y gastos siguen esperando su aprobación.
  Metricool quedó sin cupo el 14/10 y sigue solo para métricas.
- Facebook (la Página) recibe la versión de Instagram de cada reel, con el
  link escrito en vez de la mención a @trattoapp_. Desde el 16/10/2026 sale por
  Composio (conexión oficial de Meta, gratis), no por Buffer:
  `FACEBOOK_CREATE_VIDEO_POST` con `page_id` 1315608798310221, `published`
  false y `scheduled_publish_time` (se programa en la misma Página). Como no
  pasa por el hook, antes de programar corré `verificar` sobre el texto.
- Instagram sale por Composio desde el 21/10/2026, no por Buffer. Composio no
  programa: el reel va a la cola (`growth_mkt_items` con `datos.red =
  'instagram'` y `datos.instagram = { estado: 'en_cola', publicar_el,
  video_url, texto, verificado: true }`) y lo publican a la hora las rutinas
  "Instagram · publicar el reel de la hora" (lunes a viernes 18:00, sábados y
  domingos 10:00). Antes de ponerlo en la cola, `verificar` con `red:
  'instagram'`. La historia con sticker de link la sube la persona desde el
  celular (la API no pone stickers).
- Buffer gratis tiene 3 lugares: TikTok, LinkedIn y X (el que dejó Instagram).
  Así las cinco redes salen solas sin pagar.
- Cada video nuevo cambia de formato y de música respecto de los últimos de
  esa red (fundador, 21/10/2026): `node tools/contenido/cli.mjs variedad`
  antes de hacerlo y `datos.video` en el item (skill `video-publicidad`).
- Al entregar, decí en una línea qué piezas se aplicaron.

Dos controles en código lo sostienen: `node tools/contenido/cli.mjs verificar`
corre el humanizador, revisa los hashtags y (con `red`) el link de un toque, y
el hook de `.claude/settings.json` frena la programación en Buffer o Metricool
si el texto suena a IA o le falta el link de un toque.

## LinkedIn

Todo lo de LinkedIn pasa por la skill `linkedin` (`.claude/skills/linkedin/SKILL.md`)
y la voz de `.claude/linkedin/voz.md`. Solo la página de Tratto (id 145304785):
nunca nada en el perfil personal del fundador. El fundador quiere LinkedIn
automático como las otras redes (16/10/2026: "no quiero hacerlo yo manual"):
se publica en la página por Buffer (canal `6ad288cd778b240e2f2ede28`, tipo
página, conectado el 16/10/2026) sin esperarlo, y se le avisa en una línea.
Responder comentarios todavía no se puede gratis: Buffer no tiene cómo por su
conexión y Composio no trae permisos de página. Seguir gente no se hace: una
página no puede seguir personas y automatizarlo por fuera de la conexión
oficial va contra las reglas de LinkedIn. Links con nombre de la fuente
`linkedin` (`/r/li-...`) al final del texto, antes de los hashtags: Buffer
gratis no permite primer comentario en LinkedIn.

## X (Twitter)

Skill `twitter-x` (`.claude/skills/twitter-x/SKILL.md`). Solo la cuenta de
Tratto, nunca la personal del fundador. La API de X es paga y el fundador no
la quiere: X va por Buffer gratis (en el lugar que dejó Instagram el
21/10/2026) y se publica sin esperarlo, avisándole en una línea. Buffer no responde
menciones: esas respuestas quedan listas para pegar. No se sigue gente, no se
dan "me gusta" ni se responde en masa a quien no nos mencionó (reglas de X
para cuentas automatizadas).

## Mapa del código (graphify): el mismo para Claude y Codex

Claude y Codex usan el mismo mapa del proyecto. Se arma con
`python3 tools/graphify/armar.py` (gratis, sin IA, unos 10 segundos; necesita
`pip install "graphifyy[sql]"`) y queda en `graphify-out/`, que no se sube al
repo: cada uno lo arma con el mismo código, así que es el mismo mapa.

- Para orientarte en una parte que no conocés (qué llama a qué, dónde vive
  algo, qué se rompe si tocás X), empezá por
  `graphify query "<pregunta>" --budget 1500`, `graphify explain "<función>"`
  o `graphify path "<A>" "<B>"` antes de leer archivos enteros.
- Si ya sabés el nombre exacto de lo que buscás, una búsqueda de texto (grep)
  gasta menos: usala.
- `graphify-src/index.html.js` es el código de `index.html` con los mismos
  números de línea: si el mapa dice L2901, es `index.html` línea 2901. Lo
  mismo para las otras páginas `.html`.
- Después de cambiar código, volvé a correr `python3 tools/graphify/armar.py`.
- Si graphify no está instalado y la tarea no lo necesita, seguí sin él.
