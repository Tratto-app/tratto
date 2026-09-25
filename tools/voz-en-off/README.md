# Voz en off de Tratto

**Esta es la voz de todas las publicidades de Tratto.** Aprobada por el dueño
el 25/09/2026: su propia voz, grabada con el celular, con sonido de estudio.
No se usa voz de IA, ni clonada, ni con el tono o el timbre cambiados: esas
opciones se probaron y se descartaron por sonar artificiales o ajenas.

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
