---
name: linkedin
description: LinkedIn de Tratto (la página de la empresa y, si el fundador quiere, su perfil personal). Escribe publicaciones con ganchos probados, comenta publicaciones de otros, responde los comentarios propios, puntúa y reescribe la página o el perfil, planifica la semana, arma carruseles en PDF, convierte un video o una guía en varias publicaciones, escribe mensajes privados, ordena la bandeja y analiza lo publicado. Todo en castellano rioplatense y pasado por el humanizador. Usar con "LinkedIn", "publicación para LinkedIn", "qué publico en LinkedIn", "mejorá la página de LinkedIn", "comentá esto en LinkedIn".
---

# LinkedIn de Tratto

Pedido del fundador (16/10/2026): armar para LinkedIn lo mismo que muestra el
reel de "linkedin-agent" (11 funciones para que Claude maneje LinkedIn). La idea
sale del paquete libre de Jake Schincariol (licencia MIT,
github.com/Jakeschincariol/linkedin-agent-skill). Esta versión está escrita
para Tratto y no usa sus scripts.

Antes de cualquier cosa:
1. Leé `.claude/linkedin/voz.md` (cómo habla Tratto en LinkedIn, para quién,
   qué se puede afirmar y qué no).
2. `node tools/contenido/cli.mjs contexto` para la marca, los segmentos y los
   datos reales.
3. Nada se publica sin el "sí" del fundador. LinkedIn no está en el permiso
   total de redes del 16/10 (ese es para TikTok, Instagram y Facebook). Cada
   función termina con un bloque listo para copiar y pegar.

## Reglas para todo lo que sale

- **Castellano rioplatense, con voseo.** Nunca "proveedor": "quien ofrece el
  servicio" o el rubro.
- **Nada inventado.** Ni números, ni clientes, ni resultados. Si hace falta un
  dato que no está en la base (precios_referencia, growth_*, proveedores) ni en
  voz.md, queda `{{dato}}` marcado y se avisa.
- **Humanizador siempre:**
  `node tools/contenido/cli.mjs humanizar --texto "<texto>"`. Si marca algo,
  se reescribe antes de mostrarlo. Además, a mano: sin rayas largas (—), sin
  comillas tipográficas, sin caracteres invisibles, sin "no es solo X, es Y",
  sin tríos de adjetivos y sin preguntas de una palabra.
- **Links:** LinkedIn muestra menos las publicaciones con link en el texto. El
  link va en el primer comentario, con un link con nombre
  (`/r/li-<pieza>` en growth_tracking_links, fuente `linkedin`; la página usa `/r/li-pagina`) y se avisa en el
  recibo.
- **Hashtags:** hasta 3, al final, y solo categorías reales que la gente sigue.
- **Largo:** 900 a 1.300 caracteres para una publicación de texto. La primera
  línea se tiene que entender sola (en el celular se corta a ~140 caracteres).

## Página de empresa o perfil personal

En LinkedIn rinde mucho más lo que publica una persona que lo que publica una
página. La página de Tratto sirve de vidriera (para quien busca la empresa, para
inversores y para prensa) y para compartir. Lo que más alcance trae es que el
fundador publique desde su perfil y la página lo comparta. Si el fundador quiere
publicar desde su perfil, su voz es la suya: pedile tres publicaciones propias
y agregá su sección en voz.md. No escribas como él sin eso.

## Las once funciones

**1. Publicación** ("haceme una publicación sobre X").
Una idea por publicación. Si la idea es floja, una sola pregunta: qué pasó, a
quién, y qué costó o qué dio. Tres ganchos con categorías distintas de la skill
`contenido-hooks` (número primero, error, historia, comparación, confesión,
antes y después, contrarian), decí cuál elegís y por qué en una línea. Forma:
gancho solo en la primera línea, la segunda paga lo que prometió, párrafos de 1
a 3 líneas con un renglón en blanco entre cada uno, un giro y un cierre con UNA
pregunta que solo esta publicación puede hacer (nunca "¿qué opinan?").
Recibo debajo del bloque: gancho usado, largo, resultado del humanizador,
link para el primer comentario y cuándo publicarla.

**2. Comentarios en publicaciones de otros.** Leé la publicación entera y
elegí el tipo: sumar un dato, contar un caso, discrepar con respeto, hacer una
pregunta concreta, completar un punto, contar qué hacemos distinto. Nunca
"¡Gran publicación!" ni venta directa. 2 a 4 líneas.

**3. Respuestas debajo de las publicaciones propias.** Ordená los comentarios
en: posible cliente o socio, aporte de fondo, colega, apoyo y ruido. Respondé
en ese orden. Al posible cliente, una respuesta útil y la invitación a
escribir por privado, sin link.

**4. Página (o perfil) con puntaje sobre 100.** Página: nombre, eslogan (hasta
120 caracteres, que diga qué hace y para quién), descripción (hasta 2.000, las
primeras 2 líneas valen más), sitio web con link con nombre, sector, tamaño,
ubicación, botón (Visitar sitio web), logo y portada. Perfil personal: titular,
acerca de, experiencia y aptitudes. Puntuá cada parte, decí qué perdió puntos y
reescribí empezando por lo que más suma.

**5. Plan de la semana.** Qué publicar, cuándo y con quién interactuar.
Ritmo inicial: 3 publicaciones por semana (martes, miércoles y jueves entre las
8 y las 9 de Argentina) y 10 cuentas para comentar (cámaras de oficios,
administraciones de consorcios, inmobiliarias, ecosistema emprendedor
argentino). Guardalo en `.claude/linkedin/plan.md`.

**6. Humanizador.** El de arriba. Mostrá el antes y el después del puntaje.

**7. Carrusel en PDF (publicación de documento).** 6 a 10 páginas
cuadradas o 4:5, portada que haga deslizar, una idea por página y cierre con
qué hacer. Mismo estilo visual que los carruseles de Instagram
(`contenido-carruseles`), exportado a PDF.

**8. Reutilizar.** Un video, una guía de precios o una nota en varias
publicaciones que se entienden solas, sin repetir el mismo gancho. Las guías
de precios de la web y los reels que mejor rindieron son la primera fuente.

**9. Mensajes privados.** Nota de invitación (hasta 200 caracteres), primer
mensaje y como mucho dos seguimientos. Sin plantillas que se noten: cada uno
nombra algo real de la persona. No se mandan solos: los manda el fundador.

**10. Bandeja.** Ordená lo que llega en posible cliente, búsqueda laboral,
colega, pedido y spam, y proponé respuesta solo para los primeros.

**11. Auditoría de lo publicado.** Con los números que pase el fundador (o los
de Buffer si la página está conectada): ordená por tasa de interacción y por
alcance comparado con la mediana, no por impresiones. Guardá lo aprendido en la
memoria del motor (`node tools/contenido/cli.mjs registrar aprendizaje`).

## Cómo se publica

Hoy: el fundador copia y pega desde el bloque. LinkedIn prohíbe automatizar el
sitio con navegador o herramientas no autorizadas, y eso puede restringir la
cuenta. Las formas permitidas de programar una página son por su conexión
oficial:
- Buffer, si la página se conecta como canal. El plan gratis permite 3 canales
  y ya están TikTok, Instagram y Facebook, así que haría falta el plan pago o
  sacar uno.
- Codex, si tiene LinkedIn conectado por Composio.
Cuando haya una de las dos, se programa igual que en las otras redes, con el
"sí" del fundador por publicación.

Registrá cada pieza en growth_mkt_items (departamento redes, datos.red =
'linkedin') y, cuando salga, su link y sus números.
