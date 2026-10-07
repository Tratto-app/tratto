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
- Texto en pantalla dentro de la zona segura: entre y = 250 y 1500, y lejos del
  borde derecho (botones de TikTok).

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
de −1 dBFS). Para programar en Metricool hace falta una URL pública: copiá el
MP4 a `redes/` y publicalo. Programá solo con aprobación de la persona.

Si piden otro estilo (con voz en off, el de los reels de la serie con voz),
usá `comun-voz.js` y la guía de `tools/piezas-redes/README.md`.
