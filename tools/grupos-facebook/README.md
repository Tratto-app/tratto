# Grupos de Facebook para sumar a quienes ofrecen servicios

Pedido del fundador (21/10/2026): llegar a mucha gente de una vez publicando
en grupos de Facebook de oficios. Publicar en grupos no se puede automatizar
por la conexión oficial (Facebook cerró esa opción en 2024 y Composio solo
publica en la Página), así que Claude prepara todo y el fundador hace el
último toque desde el celular: unirse y pegar el texto.

## Cómo se reparte

- `semanas.json`: una familia de rubros por semana (oficios, clases, hogar y
  cuidados, autos y traslados, eventos y belleza, profesionales y digitales),
  desde el 22/10/2026, y después vuelve a empezar.
- Cada día, uno o dos rubros de la familia de esa semana: el fundador se une a
  sus grupos ese día y publica en ellos al día siguiente (muchos grupos
  aprueban el ingreso en unas horas).
- Hasta 8 grupos nuevos por día y hasta 8 publicaciones por día, todas con
  textos distintos.
- **Nunca gasistas ni electricistas**: requieren matrícula y no están en la
  app (fundador, 21/10/2026). Ni en las búsquedas ni en los textos.

## Los textos

- Variante 1, "Se busca": "Se busca pintor en CABA." y en la segunda línea
  "No es un empleo", para que nadie se sienta engañado. Dice cuántos hay
  anotados en ese rubro y zona solo si es verdad ese día (consulta a
  `proveedores`, sin demo). Con cero: "todavía no hay ningún…"; con pocos en
  todo Buenos Aires: "hay solo 2 en toda Buenos Aires".
- Variante 2, "Tu posteo se entierra": en un par de horas este posteo queda
  tapado; en Tratto el aviso le llega a quien hace ese trabajo en su zona.
- Se alternan; la 1 va sobre todo en grupos de una zona.
- Formato (fundador, 21/10/2026: "más llamativo y que explique mejor la
  app"): primera línea con 📢 y "Se busca…" en minúsculas normales (el
  humanizador frena las mayúsculas y más de 3 emojis); un párrafo con el
  dato real de la zona; "Cómo funciona:" con 4 puntos (•): el vecino publica
  lo que necesita y puede sumar una foto, te llega el aviso y mandás el
  presupuesto desde el celular, arreglan por el chat de la app sin dar tu
  número, calificaciones y fotos de trabajos en el perfil; "gratis y sin
  abono, en App Store y en la web"; y la última línea "👉 Anotate acá:
  https://www.trattoapp.com.ar/r/<slug>" con https y www, así Facebook lo
  muestra como link que se toca y arma la vista previa con el logo.
  Variar el orden y las palabras de los puntos entre grupos.
- Nunca se promete trabajo ni pedidos: solo que el aviso llega cuando un
  vecino pide. Nunca la palabra "proveedor". Sin hashtags.
- Cada texto pasa por `node tools/contenido/cli.mjs humanizar` y lleva su
  link con nombre `trattoapp.com.ar/r/fbg-<rubro>-<zona>` (fuente Facebook,
  `utm_medium` grupo) en `growth_tracking_links`, así se ve qué grupo trae
  registros.

## Dónde está cada cosa

- La página del fundador: https://claude.ai/artifact/UwKXamTH4mSt1MAY9RW7xR
  (privada, con base de datos). Colección `grupos`: un
  documento por grupo con `nombre`, `url`, `rubro`, `zona`, `familia`,
  `unirse_el`, `publicar_el`, `estado` (`unirse`, `pedido`, `publicado`,
  `descartado`), `texto`, `link`, `variante` y fechas. Documento
  `plan/actual`: familia de la semana y rubros del día.
- La rutina diaria (8:07 de Argentina) lee la página, busca grupos nuevos
  del rubro que toca con Firecrawl (`site:facebook.com/groups` + términos de
  `buscar` + Buenos Aires o la zona), descarta los que no son de CABA o del
  Gran Buenos Aires, los que ya están cargados y los que prohíben publicidad
  según su descripción, y carga los textos.
