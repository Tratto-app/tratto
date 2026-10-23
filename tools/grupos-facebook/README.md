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

## Antes de mandar un grupo: que se pueda publicar

Pedido del fundador (23/10/2026): "revisá que sea un grupo que no necesite
aprobación y que se pueda publicar". Ese día, de 41 grupos, 15 lo dejaron
publicar, 21 no y 5 quedaron esperando que lo acepten. En los 21, Facebook
no mostraba dónde escribir, pedía aprobación del administrador o decía que el
grupo estaba en pausa.

- El fundador publica como la **Página de Tratto**. Un grupo tiene que
  aceptar Páginas para que la Página pueda escribir, y eso no se ve desde
  afuera: Facebook no muestra nada sin cuenta (responde con error) y Firecrawl
  no puede leer facebook.com. Lo único que se ve son los resultados del
  buscador.
- Con eso se filtra lo que se puede: una búsqueda `site:facebook.com/groups/<id>`
  por candidato. Pasa si hay publicaciones de miembros de los últimos 14 días
  (sin actividad suelen ser grupos en pausa) y alguna de alguien que ofrece su
  servicio. Se descarta si el grupo dice que no permite publicidad,
  autopromoción o Páginas, que hay que tener antigüedad o que solo publican
  los administradores.
- No alcanza para asegurarlo. "Herreros en Buenos Aires" y "Paseadores de
  perros y adiestradores en Argentina" tenían ofertas de miembros de esa
  misma semana y aun así no dejaron publicar a la Página. Por eso cuenta lo
  que marca el fundador: estado `descartado` con `motivo` "El grupo no
  permite publicar". Esos grupos no se vuelven a proponer y los lunes se
  cuenta cuántos se pudieron publicar y cuántos no.
- Cada grupo nuevo guarda `revision` = { fecha, actividad, motivo }.

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
