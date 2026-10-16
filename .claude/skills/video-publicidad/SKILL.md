---
name: video-publicidad
description: Hace videos y publicidades de Tratto para TikTok e Instagram (reels, anuncios, promociones de la app, de la calculadora o de una función) con el estilo que eligió el fundador, "presentación de producto": fondo claro con color en movimiento, títulos grandes que entran con desenfoque, palabras que se reemplazan, lista con íconos, pantallas reales en un teléfono 3D y cierre oscuro con el logo, con música propia. Usar SIEMPRE que se pida un video, una publicidad, un anuncio o un reel nuevo, salvo que la persona pida otro estilo (por ejemplo, con su voz en off).
---

# Videos de Tratto — estilo "presentación de producto"

Es el estilo por defecto para los videos nuevos. Lo pidió el fundador el
2026-10-07 a partir de un anuncio de respond.io ("me gustó este estilo, guardalo
para los próximos"). Los dos primeros: `tools/piezas-redes/reels/publicidad-calculadora.html`
y `publicidad-app.html`. Copiá su estructura; no arranques de cero.

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
- **Sin voz.** Música propia + efectos (pop en lo que aparece, latigazo en los
  cambios de escena, campanita para precios, sello para sellos).
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
python3 musica.py audio/musica-<nombre>.wav --segundos 25 --cierre <segundo del cierre>
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
