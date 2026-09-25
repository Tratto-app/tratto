#!/usr/bin/env python3
"""Voz en off de Tratto: la cadena de estudio aprobada el 25/09/2026.

  python3 voz_en_off.py grabacion.m4a salida.wav
  python3 voz_en_off.py grabacion.m4a salida.wav --enfasis "Tratto,foto,al toque,sin vueltas"

No cambia el tono ni el timbre (la voz sigue siendo la del dueño). Lo que hace:
  1. Ritmo: saca el silencio de las puntas, acorta pausas de mas de 0,6 s a
     0,48 s y acelera 4 % sin cambiar el tono.
  2. Limpieza: filtro de retumbe, compuerta suave en las pausas, reduccion de
     ruido leve.
  3. EQ: la toma casera carga todo en 250-500 Hz (suena "a placard") y le falta
     2-5 kHz (diccion). Se corrige eso y se suma cuerpo y aire.
  4. De-esser, compresion en dos etapas.
  5. Enfasis: +1,8 dB con rampas de 40 ms en las palabras de --enfasis
     (se ubican con faster-whisper; si no esta instalado, se saltea).
  6. Master: -14 LUFS integrados, pico real -1,5 dBTP (estandar de redes).

Requiere ffmpeg y numpy. faster-whisper es opcional (solo para el enfasis).
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np

SR = 48000
ENFASIS_POR_DEFECTO = ("Tratto,foto,al toque,referencia,tu zona,elegís vos,"
                       "diez personas,10 personas,de más,sin vueltas")

RITMO = ("silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.12,"
         "areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.35,areverse,"
         "silenceremove=stop_periods=-1:stop_duration=0.6:stop_threshold=-42dB:stop_silence=0.48,"
         "atempo=1.04")

ESTUDIO = ",".join([
    "highpass=f=70:poles=2",
    "agate=threshold=0.008:ratio=2:range=0.2:attack=4:release=180:knee=3",
    "afftdn=nr=8:nf=-60:tn=1",
    "equalizer=f=115:t=q:w=0.9:g=1.5",      # cuerpo
    "equalizer=f=320:t=q:w=1.1:g=-4",       # barro
    "equalizer=f=520:t=q:w=1.4:g=-1.5",     # caja
    "equalizer=f=3200:t=q:w=1.0:g=3.5",     # presencia / diccion
    "equalizer=f=5200:t=q:w=1.2:g=1.5",
    "highshelf=f=10000:g=2.5",              # aire
    "deesser=i=0.45:m=0.5:f=0.55:s=o",
    "acompressor=threshold=-24dB:ratio=3:attack=10:release=150:knee=6:makeup=4",
    "acompressor=threshold=-14dB:ratio=2.5:attack=3:release=60:knee=4:makeup=1.5",
])


def ff(*args, nivel="error"):
    r = subprocess.run(["ffmpeg", "-y", "-v", nivel, *args], capture_output=True)
    if r.returncode:
        sys.exit("ffmpeg fallo:\n" + r.stderr.decode()[:800])
    return r.stderr.decode()


def tramos_de_enfasis(wav, frases):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper no esta instalado: sin enfasis")
        return []
    modelo = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = modelo.transcribe(wav, language="es", word_timestamps=True,
                                initial_prompt="Tratto, app de presupuestos.")
    palabras = [(w.start, w.end, w.word.strip(" ¿?¡!.,;:").lower())
                for s in segs for w in s.words]
    tramos = []
    for frase in frases:
        partes = frase.lower().split()
        for i in range(len(palabras) - len(partes) + 1):
            if [p[2] for p in palabras[i:i + len(partes)]] == partes:
                tramos.append((palabras[i][0], palabras[i + len(partes) - 1][1]))
    return tramos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada")
    ap.add_argument("salida")
    ap.add_argument("--enfasis", default=ENFASIS_POR_DEFECTO,
                    help="palabras o frases separadas por coma ('' para ninguna)")
    a = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        editado = os.path.join(tmp, "editado.wav")
        ff("-i", a.entrada, "-af", RITMO, "-ac", "1", "-ar", str(SR), editado)

        crudo = os.path.join(tmp, "estudio.raw")
        ff("-i", editado, "-af", ESTUDIO, "-ac", "1", "-ar", str(SR), "-f", "f32le", crudo)
        x = np.fromfile(crudo, dtype=np.float32)

        frases = [f.strip() for f in a.enfasis.split(",") if f.strip()]
        env = np.zeros(len(x))
        for ini, fin in tramos_de_enfasis(editado, frases) if frases else []:
            env[int(ini * SR):int(fin * SR)] = 1
        k = int(0.04 * SR)
        env = np.convolve(env, np.ones(k) / k, "same")
        enf = os.path.join(tmp, "enfasis.raw")
        (x * 10 ** (1.8 * env / 20)).astype(np.float32).tofile(enf)

        entrada_raw = ["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", enf]
        med = ff(*entrada_raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json",
                 "-f", "null", "-", nivel="info")
        j = json.loads(med[med.rindex("{"):])
        ln = ("loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=%s:measured_TP=%s:measured_LRA=%s:"
              "measured_thresh=%s:offset=%s:linear=true"
              % (j["input_i"], j["input_tp"], j["input_lra"], j["input_thresh"], j["target_offset"]))
        ff(*entrada_raw, "-af", ln + ",alimiter=limit=0.84:attack=2:release=40:level=false",
           "-ar", str(SR), "-c:a", "pcm_s24le" if a.salida.endswith(".wav") else "libmp3lame",
           *([] if a.salida.endswith(".wav") else ["-b:a", "256k"]), a.salida)
    print("listo:", a.salida)


if __name__ == "__main__":
    main()
