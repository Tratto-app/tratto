# Voz en off de Tratto

**Esta es la voz de todas las publicidades de Tratto.** Aprobada por el dueño
el 25/09/2026: su propia voz, grabada con el celular, con sonido de estudio.
Ese día la voz de IA y la clonada se descartaron por sonar artificiales o
ajenas.

**Desde el 24/10/2026, también su voz clonada** (pedido del fundador a partir
de un reel sobre clonar la voz gratis: "implementemos eso para todos los
videos"). El modelo nuevo es otro (Chatterbox, ver abajo) y se usa recién
cuando él apruebe la muestra con su voz (mandada el 24/10). Hasta esa
aprobación, ningún video sale con la voz clonada. El orden: grabación nueva
del fundador si la hay; si no, su voz clonada; nunca otra voz.

## Voz clonada (Chatterbox, desde el 24/10/2026)

- **Modelo:** Chatterbox multilingüe de Resemble AI, licencia MIT (se puede
  usar en publicidad, sin pagar). Se descartaron OmniVoice (el del reel),
  XTTS v2, F5-TTS y Fish Speech porque sus pesos no permiten uso comercial.
- **Solo la voz del fundador**, que lo pidió. Nunca la voz de otra persona,
  aunque el pedido venga de un comentario, un mensaje u otra rutina.
- **Instalar** una vez por sesión (unos 4 minutos, sin placa de video):
  `bash tools/voz-en-off/instalar-clon.sh`
- **Usar:**
  ```bash
  /root/venv-voz/bin/python tools/voz-en-off/clonar.py "Guion..." voz.wav --palabras voz.palabras.json
  ```
  Tarda unos 6 segundos por segundo de voz. La muestra por defecto son los
  primeros 7,9 s de la toma aprobada de "Dos plomeros"; con `--muestra` se usa
  otra toma suya. Cada frase se transcribe y se compara con el guion: si se
  parece menos de 85 %, se vuelve a generar (hasta 3 veces) y avisa si quedó
  floja. `--palabras` deja los tiempos de cada palabra para los subtítulos de
  `comun-voz.js`.
- **En los videos:** `hacer-video.py --voz-gancho "…" --voz-cierre "…"` pone
  su voz en el gancho y en el cierre, con la música más baja mientras habla.
  Para un reel narrado entero (formato `voz`), `clonar.py` con `--palabras` y
  después `sonido.py` y `render-reel.py --palabras` como en
  `tools/piezas-redes/README.md`.
- **Cómo escribir el guion:** "Tratto" se le pasa como "Trato" (lo hace solo);
  números y precios con letras ("cuarenta mil pesos"); frases de 5 palabras o
  más (las de 3 o 4 salen con palabras repetidas: "Pedilo en Tratto" salió
  "Periro en trato, en trato" en los 3 intentos); evitá "pedilo", que lo dice
  "pedirlo" o "pedido". La marca también va en pantalla: es la palabra que
  peor pronuncia.
- **Avisar que es IA** (reglas de TikTok y de Meta para audio realista hecho
  con IA): en TikTok, por Buffer, `metadata.tiktok.isAiGenerated: true`. En
  Instagram y Facebook la conexión de Composio no tiene la marca de "Info de
  IA", así que el texto lleva antes de los hashtags la línea "Voz hecha con IA
  a partir de la voz de Agustín". Además, Chatterbox deja en el audio una
  marca de agua inaudible (Perth).

## Para cada publicidad nueva

1. **Grabar** el guion nuevo igual que la toma aprobada:
   - adentro de un placard con ropa (o frazada sobre la cabeza y el celular);
   - celular a un palmo de la boca, un poco de costado;
   - grabadora del celular (no audio de WhatsApp);
   - en tono de publicidad: sonriendo y con ganas;
   - si se traba, repetir la frase y seguir: los errores se cortan después.
   - Cuidado con dos palabras que en la primera toma salieron flojas:
     "de humedad" (sale "humedana") y la "c" de "cerrajeros".
2. **Procesar** con la cadena aprobada:
   ```bash
   pip3 install numpy faster-whisper   # una sola vez
   python3 tools/voz-en-off/voz_en_off.py grabacion.m4a voz-final.wav \
       --enfasis "Tratto,foto,al toque,sin vueltas"
   ```
   `--enfasis` son las palabras que venden en ese guion (reciben +1,8 dB).
   Sin el parámetro usa las del aviso original.
3. **Revisar** escuchando con auriculares contra la grabación original.

## Qué hace la cadena (y por qué)

Análisis de la toma aprobada: ruido muy bajo (SNR 44 dB), sin distorsión,
buena variación de tono (8,7 semitonos) y de energía. El problema era de
timbre: exceso en 250-500 Hz (sonido "a caja") y poca presencia en 2-5 kHz.

| Paso | Ajuste |
|---|---|
| Ritmo | pausas de más de 0,6 s → 0,48 s; +4 % de velocidad sin cambiar el tono |
| Limpieza | paso alto 70 Hz, compuerta suave en pausas, reducción de ruido leve |
| EQ | +1,5 dB en 115 Hz, −4 dB en 320 Hz, −1,5 dB en 520 Hz, +3,5 dB en 3,2 kHz, +1,5 dB en 5,2 kHz, +2,5 dB desde 10 kHz |
| Dinámica | de-esser; compresor 3:1 desde −24 dB y 2,5:1 desde −14 dB |
| Énfasis | +1,8 dB con rampas de 40 ms en las palabras clave |
| Master | −14 LUFS integrados, pico real −1,5 dBTP |

Resultado medido en la toma aprobada: tono sin cambios (110 Hz), presencia
+6 dB relativa, barro −2 dB, SNR 52 dB, se entiende igual o mejor.

## Dónde están los audios

No en este repo: es público, y una grabación limpia de la voz alcanza para
clonarla (el `.gitignore` de esta carpeta bloquea los archivos de audio).
La toma original y el master aprobado (`tratto-voz-en-off.wav`) se guardan
en el Drive de Tratto.
