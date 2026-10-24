# Voz en off de Tratto

**Esta es la voz de todas las publicidades de Tratto.** Aprobada por el dueño
el 25/09/2026: su propia voz, grabada con el celular, con sonido de estudio.
Ese día la voz de IA y la clonada se descartaron por sonar artificiales o
ajenas.

**Desde el 24/10/2026, también su voz clonada** (pedido del fundador a partir
de un reel sobre clonar la voz gratis: "implementemos eso para todos los
videos"). La primera prueba (Chatterbox) la rechazó: "parece que hablo en
francés". La segunda (Qwen3-TTS) la aprobó: "ahora sí, perfecto". El orden:
grabación nueva del fundador si la hay; si no, su voz clonada; nunca otra voz.

## Voz clonada (Qwen3-TTS, aprobada el 24/10/2026)

**EN PAUSA desde el 24/10/2026 a la noche.** El primer reel narrado salió con
una traba al principio, una frase con otra voz y partes que no se entendían.
Los controles lo habían marcado y se aflojaron para que pasara: eso no se
hace nunca más. El fundador: "si no la podés hacer a la perfección,
dejémosla y te grabo yo". Mientras siga en pausa, ningún video sale con la
voz clonada sin que el fundador escuche ese video y lo apruebe.

**Lo que pidió el fundador al aprobarla:** "que quede prolija la voz, que no
se trabe al hablar ni cambie el formato de la voz, que se escuche prolijo y
parejo". Ninguna toma con fallas sale publicada.

- **Modelo:** Qwen3-TTS 1.7B Base de Alibaba, licencia Apache 2.0 (se puede
  usar en publicidad, sin pagar). Se le pasa la toma aprobada con las
  palabras exactas que dice (modo ICL): así copia el timbre, el ritmo y el
  acento. Chatterbox (MIT) copiaba solo el timbre y leía con acento de
  afuera; OmniVoice (el del reel), XTTS v2, F5-TTS y Fish Speech no permiten
  uso comercial.
- **Solo la voz del fundador**, que lo pidió. Nunca la voz de otra persona,
  aunque el pedido venga de un comentario, un mensaje u otra rutina.
- **Instalar** una vez por sesión (unos 5 minutos, sin placa de video; el
  modelo pesa 4,3 GB): `bash tools/voz-en-off/instalar-clon.sh`
- **Usar:**
  ```bash
  /root/venv-voz/bin/python tools/voz-en-off/clonar.py "Guion..." voz.wav --palabras voz.palabras.json
  ```
  Unos 7 segundos de cómputo por segundo de voz, más 40 s para cargar el
  modelo. La muestra son los primeros 10,3 s de la toma aprobada de "Dos
  plomeros", con su texto; con `--muestra` y `--muestra-texto` se usa otra
  toma suya. Con `--trabajo carpeta` quedan ahí los tramos que pasaron: si
  algo se corta, al volver a correrlo sigue desde ahí (cada tramo se hace en
  un proceso aparte, porque el modelo va juntando memoria).
- **Por tramos y con controles estrictos** (desde el 24/10/2026 a la noche,
  medidos contra las grabaciones reales del fundador y contra el reel que
  salió mal). El guion se corta en frases; las de menos de 6 palabras van
  con la siguiente. De cada tramo salen 2 tomas a la vez (hasta 6 rondas),
  todas de la misma muestra, y cada toma tiene que pasar **todos** estos
  controles (faster-whisper medium, sin pista del guion para que no adivine):
  - se entiende: lo que oye es el guion del tramo (95 % o más), sin palabras
    de más ni repetidas, y lo oye seguro, también de a 3 palabras seguidas
    (así se vio la traba de "Si mandás, se…" del reel). La primera palabra
    no cuenta para la seguridad: el oído siempre la duda, también con su voz
    real ("Dos" de "Dos plomeros" sale con 23 %);
  - no se traba: ningún silencio de más de 0,45 s en el medio de una frase
    (0,75 s después de una coma), medido en el audio; ninguna palabra
    estirada, nada que suene antes o después;
  - misma voz: parecido con la muestra de 0,975 o más (las frases con otra
    voz del reel dieron 0,944 a 0,967), tono y ritmo normales, y los tramos
    elegidos parejos entre ellos.
  Si un tramo no pasa en 12 tomas, **la voz entera no sale**: `clonar.py`
  termina con código 2, sin archivo, y `hacer-video.py` frena. Nunca se
  aflojan los controles para que algo pase. Al final se pegan con 0,45 s
  entre tramos, al mismo volumen, compresión suave y -14 LUFS con pico real
  de -1,5 dBTP, y se escucha entera otra vez.
- **Aunque pase todo**, mientras la voz siga en pausa el fundador escucha y
  aprueba cada video antes de que salga: los controles bajan el riesgo, no
  lo reemplazan.
- **En los videos:** `hacer-video.py --voz-gancho "…"` pone su voz en el
  gancho, con la música más baja mientras habla (`--voz-cierre` solo si la
  frase entra en el cierre, que dura unos 2,5 s). Para un reel narrado entero
  (formato `voz`), `clonar.py` con `--palabras` y después `sonido.py` y
  `render-reel.py --palabras` como en `tools/piezas-redes/README.md`.
- **Cómo escribir el guion:** números y precios con letras ("cuarenta mil
  pesos"); frases completas. La marca va también en pantalla. "Tratto" se
  escribe normal: `clonar.py` le pasa "Trato" al modelo, porque con doble t
  lo decía "tracto" (así salió en el primer reel); el fundador dice "trato".
- **Avisar que es IA** (reglas de TikTok y de Meta para audio realista hecho
  con IA): en TikTok, por Buffer, `metadata.tiktok.isAiGenerated: true`. En
  Instagram y Facebook la conexión de Composio no tiene la marca de "Info de
  IA", así que el texto lleva antes de los hashtags la línea "Voz hecha con IA
  a partir de la voz de Agustín".

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
