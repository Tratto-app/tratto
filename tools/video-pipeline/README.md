# Pipeline de edición para redes (TikTok/Reels/Shorts)

Edita automáticamente videos crudos: saca silencios largos, recorta a 9:16
centrado en la cara (si el original es horizontal), agrega un zoom sutil y
quema subtítulos generados por transcripción automática.

No se publica en `www.trattoapp.com.ar` — está excluido del deploy de Vercel
(`.vercelignore`) y los videos en sí no se suben al repo (`.gitignore`).

## Uso

```bash
# una sola vez
pip3 install opencv-python-headless faster-whisper

# cada vez que agregues contenido nuevo
cp tus_videos_crudos/*.mp4 tools/video-pipeline/input/
python3 tools/video-pipeline/scripts/procesar.py
```

Los resultados quedan en `output/` como `video_01_editado.mp4`,
`video_02_editado.mp4`, etc. Los originales en `input/` nunca se tocan ni se
borran — podés volver a correr el script las veces que quieras.

## Qué hace, en orden

1. Lee cada video con `ffprobe` (duración, resolución, fps, si tiene audio).
2. Si tiene audio, detecta silencios (`silencedetect`) y arma la lista de
   tramos a conservar — sin re-codificar de más, corta con un filtro
   `select`/`aselect` en una sola pasada.
3. Si el original es horizontal, busca la cara con OpenCV (Haar cascade,
   muestreada en 12 puntos del video) y centra el recorte a 9:16 ahí. Si ya
   es vertical, solo ajusta a 1080x1920.
4. Aplica un empuje de zoom lento y constante (no es tracking cuadro a
   cuadro — es un acercamiento sutil tipo Ken Burns).
5. Transcribe con `faster-whisper` (modelo `small`, corre en CPU) y quema
   subtítulos en formato ASS, agrupados de a 3 palabras, en la zona segura
   inferior.
6. Codifica a H.264 + AAC, 1080x1920, y verifica con `ffprobe` que el
   archivo de salida sea válido antes de darlo por terminado.

## Limitaciones a tener en cuenta

- El "seguimiento de cara" es un centrado estático por video, no sigue el
  movimiento cuadro a cuadro. Si la persona camina mucho por el encuadre
  original, puede convenir revisar el recorte a mano.
- La transcripción es automática: conviene repasar los subtítulos antes de
  publicar, sobre todo con nombres propios o jerga.
- El modelo de Whisper (`small`) se descarga la primera vez que corrés el
  script (necesita internet esa vez; después queda cacheado localmente).
- Si un video falla (archivo corrupto, sin pista de video, etc.), el script
  lo registra en el resumen final y sigue con los demás — no corta todo el
  proceso.
