---
name: video-publicidad
description: Hace los videos de Tratto para TikTok, Instagram y Facebook. Desde el 07/11/2026 (fundador) TODOS los videos son en 3D, graciosos y contando una historia (formato "3d", sección de abajo): un video 3D distinto por día, de un rubro con gente registrada, que sale el mismo día en las tres redes con la voz Tratto 3D. Los formatos viejos (producto, chat, quiz, lista, nota y voz) ya no se usan para redes. Usar SIEMPRE que se pida un video, una publicidad, un anuncio o un reel nuevo.
---

# Videos de Tratto

## Solo videos 3D, graciosos y que cuenten una historia (fundador, 07/11/2026)

"A partir de ahora no subamos ningún video más como los que subíamos antes.
Quiero que los hagamos todos así en 3D… gracioso y que cuente una historia."
El 3D de jardinería tuvo 1.334 vistas en Instagram en unas horas; los de
plantilla, de 26 a 60. Desde ese día **todo video para redes es del formato
"3d"** (sección "Formato 3d"): historia en escalera con testigo, carteles
chistosos y remate. Los formatos de abajo (producto, chat, quiz, lista, nota,
voz del fundador) quedan solo como referencia: no se hacen para redes. Lo que
varía de un video a otro es el rubro, el lugar, la cámara, la música y el
gancho.

## La voz del fundador en todos los videos (24/10/2026)

> **Frenada el 28/10/2026: ningún video con voz clonada se programa sin que
> el fundador escuche ese audio y diga que sí.** Borró de TikTok el reel
> "Pedido claro" (había pasado todos los controles): "se trabó, habló mal,
> parezco re apagado, deprimido. Necesito algo con más carisma, con más
> ganas". Medido contra sus grabaciones reales, la clonada era más lenta,
> más plana de tono y de volumen; además leyó la lista ("Qué pasa", "Dónde
> estás") como preguntas y se trabó al arrancar ("Si mandás, se…").
> Desde ese día:
> - `clonar.py` controla las **ganas** (`GANAS`: tono, rango, volumen y
>   ritmo, lo mínimo de sus grabaciones reales) y elige la toma más viva.
> - Pasar los controles no alcanza: se le manda el audio y espera su sí. Sin
>   su sí, va una grabación suya (desde el 14/11/2026 nunca sin voz).
> - Guion para la voz: frases afirmativas; las listas con "Primero,
>   segundo…" (nunca ítems que empiezan con "Qué" o "Dónde", que lee como
>   pregunta); sin citas entre comillas; el gancho, una pregunta directa.
> - Lo que más rinde es su voz de verdad: si puede grabar el guion con el
>   celular (30 segundos), va esa.
>
> **Voz nueva aprobada el 28/10/2026 a la tarde** ("ahora sí quedó
> perfecto"): la muestra es el tramo más vivo de sus grabaciones (presupuesto
> barato, desde 15,45 s, la de fábrica en `clonar.py`) y el guion de "Pedido
> claro" reescrito con "Primero, segundo…". Medida: tono 3,97, rango 11,2,
> volumen 7,13, ritmo 2,86 (`GANAS` quedó calibrado con eso).
>
> **Sin escuchar cada audio, pero muy estricto (28/10/2026):** "no quiero
> escuchar cada audio con mi voz. Que seas muy estricto con la voz y que
> quede exactamente igual". Los videos vuelven a salir con su voz clonada sin
> esperarlo, solo si `clonar.py` pasa todo: parecido con la muestra 0,98 o
> más, tono medio 110 Hz o más, `GANAS` (y para frases cortas, la variación
> de tono contra sus frases cortas reales). Con la misma frase y la misma
> muestra la voz sale idéntica (el gancho de "Cómo se cobra" se regeneró de
> cero y dio el mismo audio). Nunca se afloja un control; si no pasa, otra
> frase hasta que pase (desde el 14/11/2026 nunca sin voz).
>
> **Nunca un video sin voz (fundador, 14/11/2026):** "estás sacando todos
> los videos sin sonido, el que subiste recién lo borré porque salió sin sonido
> y el de ayer también". Los 3D de aire (13/11) y carpintería (14/11) salieron
> solo con música porque la voz no pasó los controles, y los borró. Desde ese
> día no existe la salida "sin voz": si la voz falla, se reescribe el guion y
> se vuelve a generar hasta que pase todo, sin aflojar ningún control. Lo que
> más falla es `GANAS` (voz plana: la de carpintería dio tono 3,42 contra 3,6).
> Para levantarla, en este orden: una o dos comas más donde lo pida la frase,
> remates con "¡…!", un "Tranqui:" antes del precio, otra forma de decir la
> frase más plana. Si falla un tramo, se cambia esa frase.
> Si ese día no hay voz que pase, el video no se publica y se avisa en una línea.

El fundador mandó un reel sobre clonar la voz gratis y pidió: "implementemos
eso para todos los videos que hagamos". Su voz clonada sale de
`tools/voz-en-off/clonar.py` (Qwen3-TTS, licencia Apache 2.0; instalación,
controles y reglas en `tools/voz-en-off/README.md`).

- **Habilitada de nuevo el 24/10/2026 a la noche, tomándolo muy en serio.**
  El primer reel narrado salió con una traba al principio, una parte con otra
  voz y "tracto" en vez de Tratto; los controles lo habían marcado y se
  aflojaron para que pasara (eso no se hace nunca más) y se pausó. Rehecho
  con `clonar.py` por tramos y controles estrictos, el fundador lo puntuó 8
  de 10: "para los videos que apliques, hacelo así. Subí con mi voz. Pero
  concentrate siempre en que salga bien la voz. Tomatelo muy en serio, porque
  se van a cagar de risa si subo un video y tiene la voz en cualquier cosa".
  Desde entonces los videos salen con su voz clonada sin esperar su
  aprobación, con estas reglas:
  - Siempre con `clonar.py` tal como está. **Nunca se afloja un control** (ni
    `CONTROL`, ni `TOMAS`/`RONDAS` para menos) para que algo pase. Si la voz
    no pasa, se cambia la frase (más corta, más simple, sin citas raras) y se
    prueba otra vez, las veces que haga falta. **Nunca sin voz** (14/11/2026,
    abajo): si ese día no pasa, el video no se publica y se avisa.
  - Antes de programar, mirá el informe de `clonar.py` (lo que se oye en
    cada tramo y entera): tiene que decir el guion, palabra por palabra.
    Ante la duda, no se publica: ni con la voz rara ni sin voz.
  - Al avisarle lo programado, decí que lleva su voz clonada.
- La condición de cuando aprobó la muestra sigue igual: "que quede prolija la
  voz, que no se trabe al hablar ni cambie el formato de la voz, que se
  escuche prolijo y parejo". `clonar.py` lo controla; si un control falla,
  la voz no se usa, sin excepciones.
- Cada video lleva su voz: en el formato `voz`, el guion entero con
  subtítulos; en los demás formatos, el gancho
  (`hacer-video.py --voz-gancho "…"`). La frase del cierre (`--voz-cierre`)
  solo si entra: el cierre de `formatos.js` dura unos 2,5 s. Números en
  letras y frases completas. Si la voz no pasa los controles, `hacer-video.py`
  frena: cambiá la frase y probá de nuevo; nunca sin voz.
- Si hay una grabación nueva suya, va esa y no la clonada. Nunca otra voz.
- Avisar que es IA: en TikTok, `metadata.tiktok.isAiGenerated: true` en Buffer;
  en Instagram y Facebook, la línea "Voz hecha con IA a partir de la voz de
  Agustín" antes de los hashtags (la conexión de Composio no tiene la marca).
- `datos.video.voz` = `clonada`, `grabada` o `sin voz` (lo devuelve
  `hacer-video.py`), para medir si la voz rinde más.

## Formato "3d": animación low-poly con voz (fundador, 05/11/2026)

**Un video 3D por día, cada uno de un rubro distinto** (fundador, 05/11/2026,
después de ver el del pasto: "me gustó… quiero que todos los días hagas un
video de ese estilo y lo subas con un rubro totalmente diferente, es decir hoy
hiciste jardinería, mañana clases de canto, después plomería y así"). El orden
está en `tools/piezas-redes/reels/rubros-3d.json` (rubro, servicio con precio
real e idea de partida; se marca "hecho" al publicarlo). Lo hace la rutina
"Redes · videos del día" y reemplaza a los videos de plantilla. Sale el mismo día en las
tres redes (fundador, 07/11/2026: el 3D de jardinería tuvo 1.334 vistas en
Instagram en unas horas): TikTok 20:00, Facebook 19:00 (21:00 si ya hay otro
video) e Instagram 18:00 (la cola; los carruseles pasan a las 12:00, fin de
semana 10:00). Los videos que a los 7 días tienen menos de 100 vistas y ningún
compartido, guardado ni comentario se borran: en Facebook lo hace la rutina; en
Instagram y TikTok lo hace el fundador desde la app (sus conexiones no dejan
borrar), con la lista que le pasa la rutina. Cada
uno con su versión (`video-3d-<tema>-tt/ig/fb.html`, misma escena
`escena-3d-<tema>.js`).

**Dos reglas del fundador (06/11/2026), después de ver el de canto:**

1. **Gracioso, no serio.** "Quiero que sea humorístico, que sea gracioso… No
   que sea serio, como el de la jardinería. Quiero que sea más entretenido."
   El de canto es el modelo (vecino golpeando la pared, el perro aullando,
   cartel "Afinación: dudosa", el vecino aplaudiendo al final). Cada video
   tiene que pasar esta lista antes de renderizar:
   - **Escalera de desastres exagerados:** tres intentos caseros, cada uno
     más ridículo que el anterior (no solo "sale peor": se va de las manos).
   - **Un testigo que reacciona:** un vecino, el perro, el gato, la abuela o
     las visitas, con una reacción física (se tapa los oídos, se desmaya, se
     muda, saca una foto).
   - **Dos o tres carteles chistosos** que señalan algo (`k.etiqueta`) con
     falso dato técnico o porcentaje absurdo: "Afinación: dudosa",
     "Cinta: 0 % efectiva", "Plic: 3.400".
   - **Remate con vuelta al final**, después del precio: el testigo cambia
     (aplaude, vuelve a ser sólido, se ofende y se va). La cámara termina en
     él, no en el problema resuelto.
   - **El chiste es la situación, nunca la persona que ofrece el servicio**
     (ella llega, lo resuelve y queda bien) ni quien mira el video.
   - El guion se cuenta tranquilo, como una anécdota, y el humor lo ponen la
     escena y las palabras ("te golpea la pared", "el perro se suma"), no los
     gritos: así la voz sigue pasando los controles (ver más abajo).
2. **Solo rubros con gente registrada.** "Quiero que lo hagas siempre con los
   rubros que ya tenemos en la app… gente registrada." Antes de elegir, la
   rutina consulta cuántas personas ofrecen cada rubro:
   `select r as rubro, count(*) n from growth_users_private.accounts() a,
   unnest(a.rubros) r where a.tipo='provider' group by r order by n desc;`
   y toma **el primero de `rubros-3d.json` sin "hecho" que tenga al menos
   una**. Los rubros sin nadie se saltean (quedan al final de la lista) hasta
   que alguien se registre. Cuando se terminen los rubros con gente, se vuelve
   a empezar por el que más personas tiene, con otra situación graciosa del
   mismo rubro. Nunca se promete en el video que hay mucha gente: "gente de
   tu zona" alcanza.

El fundador mandó un reel animado en 3D de otra app de servicios (patio lleno
de escombros, personaje de bloques, voz que lo cuenta, subtítulos palabra por
palabra; 25,6 mil me gusta, 4,1 mil guardados y 4,2 mil compartidos) y pidió:
"quiero que a partir de ahora hagamos todos videos así para subir. Lo
repliquemos y lo hagamos así… con la voz y todo". Se copia la forma, nunca
el contenido ni la marca del otro: tema, escena, colores y textos son de
Tratto (verde bosque, latón, IBM Plex).

- **Cómo es:** escena 3D low-poly de una casa o un lugar de todos los días
  (patio, cocina, auto, vereda…), cámara alta de 3/4, personajes de bloques,
  un problema que se ve (pasto alto, humedad, una pérdida…) y alguien que
  ofrece el servicio y lo resuelve. Voz que lo cuenta, con subtítulos karaoke
  arriba (la palabra que se dice, en una caja verde bosque con filo de latón),
  tarjeta con el precio real (`precios_referencia` con el ajuste mensual) y
  cierre con el ícono y el link. De 20 a 30 segundos.
- **Archivos:** `comun-3d.js` (kit: patio, personajes, pasto, cortadora,
  recortes, subtítulos, tarjeta, chip y cierre), `comun-3d.css` y
  `lib/three-0.170.0.min.js` (three.js, licencia MIT, armado como script común
  para que ande desde `file://`). Cada video es un HTML con su escena y sus
  tiempos tomados de la voz (`k.palabra('…')`). Muestra:
  `video-3d-pasto-tt.html`. Para otra escena se agregan piezas al kit (no se
  arranca de cero).
- **Pasos:** guion (gancho con pregunta directa, número en letras, frases
  afirmativas) → `clonar.py "<guion>" audio/voz-3d-<tema>.wav --palabras
  audio/voz-3d-<tema>.palabras.json` → cuadros sueltos con `render-reel.py …
  --palabras … --previa` → música (`musica.py`, suave debajo de la voz) +
  voz con `sidechaincompress` + efectos (`sonido.py`) → `render-reel.py …
  --palabras … --audio …` → prueba del cerebro.
- **Voz: la "voz Tratto 3D", no la del fundador** (05/11/2026: "No quiero
  que le pongas mi voz. Quiero que quede… con la misma voz que tiene el del
  video de aLaburar"). La voz de ese reel no se clona (es de otra persona o de
  otra marca, y la gente confundiría los videos): se escuchó para describir su
  estilo (hombre de unos 30, porteño, 132 Hz, unas 3 palabras por segundo,
  canchero, contando una anécdota) y `tools/voz-en-off/disenar_voz.py`
  (Qwen3-TTS VoiceDesign, Apache 2.0) creó una voz nueva con esa descripción.
  La toma elegida es la muestra fija `tools/voz-en-off/muestra-voz-3d.wav`
  (texto en `muestra-voz-3d.txt`): 138 Hz, con voseo. Cada video:
  `clonar.py "<guion>" … --muestra ../../voz-en-off/muestra-voz-3d.wav
  --muestra-texto "$(cat ../../voz-en-off/muestra-voz-3d.txt)"`, con todos los
  controles de siempre. Avisar que es IA: en TikTok `isAiGenerated`; en
  Instagram y Facebook, "Voz hecha con IA" (no "a partir de la voz de
  Agustín"). `datos.video.voz = "tratto-3d"`.
- **Guion como el de referencia:** una historia en escalera, en segunda
  persona, graciosa (lista de arriba): cada intento sale peor (llovió el finde, y el otro
  también; la máquina del vecino, sin nafta) y recién ahí aparece quien
  ofrece el servicio, el precio real y el pedido gratis. Frases cortas; nada
  de palabras que el oído escriba separado ("finde" → "fin de semana",
  "Pedila" → se oye "Pedí la": usar "Pedilo").
- **Cómo hacer que la voz 3D pase los controles** (aprendido el 06/11 con el
  de canto, 12 intentos): con esta voz, una frase con "¡…!" sale unos 160 Hz y
  una tranquila unos 120 a 130, así que mezclar las dos rompe el tono parejo
  (15 %). Sin "¡…!" el tono queda parejo pero suena apagada (volumen menor a
  7,1). Lo que funcionó: **todas tranquilas y con comas que les den subidas y
  bajadas** ("El vecino, cansado, te golpea la pared."; "Pedilo gratis en
  Tratto, y te pasan…"): volumen 7,67. Pero cada coma suma pausa y el ritmo
  baja (mínimo 2,8): dos o tres comas en total, no en todas las frases.
  Si con esas sigue apagada, mirá el ritmo que dio: en el de plomería (07/11)
  tres comas dieron volumen 7,01 con ritmo 3,03; sumando una coma en el
  gancho y otra en la frase 4 pasó (7,3, ritmo 2,97). Se cambian solo esas
  frases: las demás quedan guardadas en `--trabajo` y no se regeneran.
  Si una corrida falla, no regenerar a ciegas: `clonar.py` guarda la toma
  que pasó de cada frase en la carpeta `--trabajo` (se pisa al cambiar el
  texto), así que conviene copiarlas a un banco y probar combinaciones con
  `tools/voz-en-off/combinar.py` (simula el pegado final y da tono, volumen y
  ritmo aproximado; el ritmo real sale unos 0,15 más bajo).
- **Carteles que señalan objetos** (`k.etiqueta`), lluvia, humo y cortes de
  cámara en cada frase: la escena toma el comienzo de cada frase de la voz
  (`k.frase(n)`).
- **Variedad dentro del 3D:** cambia el tema, el lugar, la cámara, la música
  y el tipo de gancho respecto del video anterior de esa red (`variedad`
  sigue eligiendo música, gancho y largo).

## Ningún video igual al anterior (fundador, 21/10/2026)

"Estás haciendo todas las publicaciones iguales, cambiando solo el texto, con
la misma música y la misma modalidad. Quiero que cada una sea diferente a la
anterior para probar qué se pega y qué no." Desde entonces:

1. **Antes de cada video**, armá el historial de la red donde va a salir (las
   piezas de growth_mkt_items con `datos.video`, su fecha de publicación y las
   reproducciones como `vistas`) y corré
   `node tools/contenido/cli.mjs variedad` con `{ red, historial }`. Devuelve
   el formato, la música, el tipo de gancho y el largo, y por qué. No repite
   lo de los últimos videos de esa red; explora hasta tener 3 videos medidos
   de cada formato y después da 6 de cada 10 al que mejor rinde. El catálogo
   está en `tools/contenido/conocimiento/variedad.json`.
2. **Hacelo con eso**: el gancho, con esa categoría de `contenido-hooks`; el
   largo, dentro de esos segundos.
3. **Guardá en el item** `datos.video = { formato, musica, gancho, duracion }`
   (lo devuelve `variedad` en `datos_video`) y el archivo. Sin eso la rotación
   no aprende.

| Formato | Cómo se ve | Archivos |
|---|---|---|
| `producto` | Fondo claro con manchas, títulos con desenfoque, teléfono 3D (abajo) | `publicidad-comun.js` + un `.js` por video |
| `chat` | Conversación en modo oscuro que cuenta una historia (POV), con "escribiendo…", cortes ("3 días después…") y un remate | `formatos.js` |
| `quiz` | Adiviná el precio: opciones A/B/C, cuenta regresiva y revelación con el precio real | `formatos.js` |
| `lista` | Cortes secos de color con números gigantes, sin desenfoque | `formatos.js` |
| `nota` | Notas del celular que se escriben solas y se tildan | `formatos.js` |
| `voz` | La voz del fundador con subtítulos (grabación nueva o su voz clonada, `clonar.py --palabras`) | `comun-voz.js` |

Los formatos de `formatos.js` son solo datos: un HTML chico con
`window.RED = { url, ig? }` y `window.GUION = { formato, ... }` (mirá los
ejemplos `video-chat-visto-tt.html`, `video-quiz-precios-tt.html`,
`video-lista-errores-tt.html` y `video-nota-antes-tt.html`; el comentario de
arriba de `formatos.js` explica cada campo). En el texto, `*así*` resalta con
el color de acento. Se hacen de punta a punta con:

```bash
cd tools/piezas-redes/reels
python3 hacer-video.py video-<formato>-<tema>-<red>.html --previa 1,4,8   # cuadros sueltos para revisar
python3 hacer-video.py video-<formato>-<tema>-<red>.html --musica <estilo>  # música, efectos, mezcla y MP4
```

Músicas propias (`musica.py --estilo`): `pop`, `lofi`, `dembow`, `house`,
`cumbia`, `tension`, `acustico` y `silencio` (solo efectos). Los sonidos en
tendencia de TikTok o Instagram no se pueden poner por Buffer: se publica con
la música propia del video.

## Formato "presentación de producto"

Lo pidió el fundador el 2026-10-07 a partir de un anuncio de respond.io ("me
gustó este estilo, guardalo para los próximos"). Ya no es el de todos los
videos: es uno de los formatos de la rotación. Los dos primeros:
`tools/piezas-redes/reels/publicidad-calculadora.html` y `publicidad-app.html`.
Copiá su estructura; no arranques de cero.

## Cómo se ve

- **Fondo claro** (`#F3F6F2`) con tres manchas desenfocadas que se mueven
  lento (verde claro y latón claro) y un grano sutil. Nada de fondo oscuro
  hasta el cierre.
- **Títulos grandes** en IBM Plex Sans Condensed 700 (clases `t-xl` 150 px,
  `t-l` 112 px, `t-m` 74 px), centrados, que **entran con desenfoque y suben**
  (`entra`) y salen igual (`sale`). Una idea por pantalla, 2 a 3 segundos.
- **Palabra que se reemplaza en el lugar** (`cambia`): "¿Necesitás / un DJ? /
  clases de inglés? / una manicura?…", "Tratto es / simple / de tu zona / para
  46 rubros". La palabra que cambia va en verde vivo (`acento`) o latón (`oro`).
- **Lista con íconos** que se reemplazan de a uno: un cuadrado blanco con el
  ícono (`fila` + `ico`) y la frase al lado. Íconos en `publicidad-comun.js`.
- **Pantallas reales** en un teléfono con perspectiva 3D que entra girando
  (`tel`), con un **chip flotante** tipo notificación ("Presupuesto nuevo ·
  $68.000") y el **ícono de la app** que aparece de golpe.
- **Sello** para un resultado ("+37% · caro"): entra grande, rebota y queda
  levemente girado.
- **Cierre**: una cortina oscura (noche) se abre en círculo, aparece el ícono,
  el texto de cierre y la URL en mono verde claro.
- **Música y efectos** (debajo de la voz, nunca solos). Música propia (el estilo que diga `variedad`) + efectos (pop en
  lo que aparece, latigazo en los cambios de escena, campanita para precios,
  sello para sellos).
- Duración: 20 a 25 segundos, 1080×1920, 30 fps.

## Reglas de contenido (no negociables)

- Más de 40 rubros: mostrá variedad (eventos, clases, belleza, autos, mascotas,
  trámites, hogar). Nunca solo oficios del hogar.
- Solo datos reales: precios de `precios_referencia` (con el ajuste mensual) o
  de pantallas reales. Las pantallas de la app salen de `tools/tiendas/ios-*.png`
  recortadas (ver `reels/img/`); las de páginas web, de capturas de la página
  real con la respuesta simulada para no ensuciar la base.
- No decir "Descargala en App Store / Google Play" hasta que la app esté
  publicada en las tiendas: el cierre lleva la URL.
- **Nada de "link en la bio" en TikTok** (protocolo de contenido, sección 8.2): @trattoapp no tiene link clickeable
  (hace falta el Registro de empresas aprobado o 1.000 seguidores). El link va
  escrito en el video: `PUBLI.url = ['trattoapp.com.ar/…', desde]` muestra una
  etiqueta fija con el link durante todo el video, y el cierre repite la URL.
  En el texto de la publicación: "Entrá a trattoapp.com.ar/…".
- **En Instagram el cierre dice dónde tocar**: "Link en el perfil → @trattoapp_"
  y el nombre del link («Calculadora de precios», «Pedí un servicio» o «Soy
  proveedor»), además de la URL. El texto de la publicación lleva la segunda
  línea "tocá @trattoapp_ y entrá al link «…»" (sección 8.2).
- Texto en pantalla dentro de la zona segura: entre y = 250 y 1500, y lejos del
  borde derecho (botones de TikTok).

## Prueba del cerebro (antes de dejarlo para aprobar)

Pedido del fundador (14/10/2026), a partir del video "Esta IA predice
VIRALIDAD" sobre el Virality Predictor de Higgsfield. Esa herramienta es paga
(y el modelo que usaría, TRIBE v2 de Meta, tiene licencia no comercial), así
que armamos **una propia y gratis**: mide señales del video (movimiento,
cambios de plano o de texto, color, contraste, sonido y voz) y devuelve lo
mismo que mostraba el video: puntaje viral, gancho, retención, cuánto se
activa cada zona (visual, atención, auditiva, dispersión del foco, lenguaje y
memoria), la atención segundo a segundo y qué cambiar. **No es un modelo del
cerebro**: el dibujo ubica cada señal en la zona que se asocia con ese
estímulo. Decilo así cuando lo muestres.

- **Cómo se corre:**
  - Agentes: `node tools/contenido/cli.mjs cerebro <video.mp4> --json` (ffmpeg,
    sin conexión). Lo que devuelve va tal cual en `datos.cerebro` del item.
  - Personas: CRM → Cerebro → "Probar un video". Se analiza en el navegador
    (el video no se sube) y se guarda en la pieza con "Guardar en la pieza".
  - Es el mismo analizador (`growth/web/src/lib/cerebro-core.ts`). Entre el
    CRM y la CLI puede variar unos puntos por cómo cada uno lee los cuadros.
- **Mira hasta 30 segundos, con foco en los primeros 15.** Lo que decide si el
  video funciona (el gancho, la promesa y la primera vez que se ve el producto)
  tiene que pasar ahí.
- **Cada video o publicidad nueva pasa por la prueba** antes de dejarla para
  aprobar.
- **Gancho por debajo de 50:** rehacé los primeros 3 segundos con
  `contenido-hooks` y `contenido-optimizacion` y volvé a probar. Si probaste
  dos versiones, guardá la anterior en `datos.cerebro.versiones` (el CRM lo
  hace solo) y proponé la que dio mejor.
- **Es un filtro previo, no un oráculo.** No reemplaza `puntuar` ni la
  aprobación de la persona. Cuando la pieza se publica, comparalo con las
  métricas reales para ver si acierta con nuestra cuenta.
- **Qué mueve cada zona:**
  - Visual: color, contraste y movimiento.
  - Atención: un cambio de plano o de texto cada 1 o 2 segundos y movimiento
    desde el primer cuadro.
  - Auditiva: sonido desde el primer cuadro, con subidas y bajadas.
  - Dispersión del foco (más es peor): segundos en que no pasa nada.
  - Lenguaje: voz y texto en pantalla. Los videos solo con música la dejan
    baja: probá también una versión con voz (`comun-voz.js`) y subtítulos
    palabra por palabra, como el video de referencia.
  - Memoria: voz y texto con el mensaje, y cierre con la marca quieta 1 o 2
    segundos.
- **Si no se puede correr** (sin ffmpeg ni CRM a mano), guardá
  `datos.cerebro = {"estado": "pendiente", "notas": "por qué"}` y decilo en el
  item. Nunca inventes números.
- Higgsfield queda como opción solo si algún día hay una cuenta paga; no es
  parte del proceso.

Formato de `datos.cerebro` (lo arma la CLI o el CRM; no se escribe a mano):

```json
{ "herramienta": "Análisis de Tratto (señales del video)", "version": 1, "fecha": "2026-10-14",
  "segundos": "0-25", "duracion": 25, "viral": 0, "gancho": 0, "retencion": 0,
  "regiones": { "visual": 0, "atencion": 0, "auditiva": 0, "foco": 0, "lenguaje": 0, "memoria": 0 },
  "pico_gancho": 0, "linea": [], "zonas_por_segundo": [], "senales": {}, "consejos": [],
  "archivo": "reel.mp4", "estado": "hecho", "versiones": [] }
```

## Cómo se hace

```bash
cd tools/piezas-redes/reels
# 1. Escribir publicidad-<nombre>.html copiando la estructura de las existentes:
#    window.PUBLI = { cierre: <segundo>, escenas: [{ a, b, html: () => `...`, animar(t, r) {...} }] }
# 2. Revisar cuadros sueltos
python3 render-reel.py publicidad-<nombre>.html --segundos 25 --previa 1,4,8,12,16,20,23
# 3. Música propia y efectos (el JSON dice qué efecto va en qué segundo)
python3 musica.py audio/musica-<nombre>.wav --segundos 25 --cierre <segundo del cierre> --estilo <estilo>
python3 sonido.py audio/musica-<nombre>.wav audio/publicidad-<nombre>.efectos.json audio/publicidad-<nombre>-mezcla.m4a --segundos 25
# 4. Video final
python3 render-reel.py publicidad-<nombre>.html --segundos 25 --audio audio/publicidad-<nombre>-mezcla.m4a
```

Antes de entregar: mirá cuadros en las transiciones (no tiene que quedar texto
cortado ni fuera de la zona segura) y medí el audio (−14 LUFS, pico por debajo
de −1 dBFS). Para programar en Buffer hace falta una URL pública: copiá el
MP4 a `redes/`, hacé commit y push, y usá
`https://raw.githubusercontent.com/tratto-app/tratto/<sha completo>/redes/<archivo>.mp4`
(comprobá que responda 200; no uses jsDelivr, con este repo falla a veces). Las redes tienen permiso total de
la persona desde el 16/10/2026: lo que pasa los controles se programa solo
(`.claude/agents/mkt-redes.md`, puntos 2 y 2b).

Si piden otro estilo (con voz en off, el de los reels de la serie con voz),
usá `comun-voz.js` y la guía de `tools/piezas-redes/README.md`.
