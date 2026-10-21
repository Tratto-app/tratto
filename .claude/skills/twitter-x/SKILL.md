---
name: twitter-x
description: X (Twitter) de Tratto, solo la cuenta de la empresa (nunca la personal del fundador). Escribe y publica posteos e hilos, responde menciones y comentarios en nuestras publicaciones y reutiliza lo que sale en TikTok, Instagram y LinkedIn, todo en castellano rioplatense y pasado por el humanizador. Publica por Buffer (conexión oficial, gratis). Usar con "X", "Twitter", "tuit", "hilo", "publicá en X".
---

# X (Twitter) de Tratto

Pedido del fundador (16/10/2026): "todas las redes sociales automatizadas",
también X. Composio no sirve gratis para X (pide una app propia con la API
paga), así que va por Buffer, igual que LinkedIn.

Antes de cualquier cosa:
1. `node tools/contenido/cli.mjs contexto` (marca, segmentos, datos reales) y
   `.claude/linkedin/voz.md` para las posturas y lo que no se dice (vale igual
   para X).
2. Solo la cuenta de Tratto en X (`tools/contenido/config/marca.json`,
   `links.x`). Nunca la cuenta personal del fundador, igual que en LinkedIn.
3. Automático: se publica sin esperar al fundador y se le avisa en una línea
   qué salió. La API de X es paga y el fundador no la quiere (16/10/2026), así
   que X va por Buffer gratis, en el lugar que dejó Instagram al pasar a
   Composio el 21/10/2026. Buffer no responde menciones: las
   respuestas quedan como bloque listo para pegar. Sin canal, bloque listo
   para pegar.

## Reglas para todo lo que sale

- Castellano rioplatense, con voseo. Nunca "proveedor".
- Nada inventado: precios solo de precios_referencia, sin cifras de usuarios ni
  de pedidos. Si falta un dato, `{{dato}}` y aviso.
- Humanizador siempre: `node tools/contenido/cli.mjs humanizar --texto "<texto>"`.
- Hasta 280 caracteres por posteo. La primera línea tiene que funcionar sola.
- Link con nombre `/r/x-<pieza>` (fuente `twitter` en growth_sources y
  growth_tracking_links), en la primera respuesta del propio posteo, no en el
  texto principal. En Buffer eso es un hilo de dos (`metadata.twitter.thread`
  con los dos posteos, y el texto de afuera igual al primero). Buffer gratis
  permite un solo hilo programado por canal a la vez (revisado el 21/10/2026):
  si ya hay uno esperando, el link va al final del posteo.
- Hashtags: uno o ninguno.

## Qué hace

1. **Posteo.** Una idea, un dato real o una pregunta. Tres ganchos de
   `contenido-hooks`, elegí uno.
2. **Hilo.** 4 a 8 posteos para una guía de precios, una comparación o un
   "cómo elegir". El primero se entiende solo y promete lo que el hilo da.
3. **Respuestas.** A quien nos menciona o comenta nuestras publicaciones:
   útil, corta y sin vender. Ignorá el spam y los ataques.
4. **Reutilizar.** Cada reel que sale en TikTok e Instagram puede ir como video
   nativo en X con su texto propio. Cada publicación de LinkedIn, como hilo
   corto.
5. **Plan.** 1 a 2 posteos por día, horarios de mañana y de tarde de
   Argentina. Guardalo en growth_mkt_items con datos.red = 'x'.

## Lo que no se hace (reglas de X para cuentas automatizadas)

- Seguir o dejar de seguir gente en masa o de forma automática.
- "Me gusta", reposteos o respuestas automáticas a gente que no nos mencionó
  (por ejemplo, buscando palabras clave).
- Mensajes directos que nadie pidió.
- Publicar lo mismo una y otra vez, o en varias cuentas.
- Nada desde la cuenta personal del fundador.

Registrá cada pieza en growth_mkt_items (departamento redes, datos.red = 'x')
con su link y, cuando salga, sus números.
