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
- Automático no es publicar: lo que se arma solo queda para aprobar, y en
  Metricool se programa solo lo aprobado, con `autoPublish: false`.
- Al entregar, decí en una línea qué piezas se aplicaron.

Dos controles en código lo sostienen: `node tools/contenido/cli.mjs verificar`
corre el humanizador, revisa los hashtags y (con `red`) el link de un toque, y
el hook de `.claude/settings.json` frena la programación en Metricool si el
texto suena a IA o le falta el link de un toque.
