"""Diseña una voz nueva para Tratto a partir de una descripción (no copia a nadie).

Pedido del fundador (05/11/2026): los videos 3D con una voz como la del reel de
otra app de servicios, no con la suya. Esa voz no se clona (es de otra persona
o de otra marca): se describe cómo suena (hombre de unos 30, porteño, tono
medio, rápido y canchero, como contando una anécdota) y Qwen3-TTS VoiceDesign
(Apache 2.0, gratis) crea una voz nueva con esa descripción. La mejor toma
queda como muestra fija (tools/voz-en-off/voz-tratto-3d.wav + su texto) y los
videos se hacen con clonar.py --muestra, así suena siempre igual y pasa por
todos los controles de siempre.

Uso:
  /root/venv-voz/bin/python tools/voz-en-off/disenar_voz.py salida_dir --tomas 4
Deja tomaN.wav y un informe con lo que se oye, el tono y las ganas de cada una.
"""
import argparse, difflib, json, os, re, sys, unicodedata
import numpy as np

MODELO = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
DESCRIPCION = (
    "A friendly Argentine man in his early thirties from Buenos Aires, speaking Rioplatense Spanish "
    "with a natural porteño accent (voseo, 'sh' sound for 'll' and 'y'). Medium pitch, warm and bright "
    "timbre, relaxed and witty, a bit fast, like telling a funny everyday story to a friend, with a smile "
    "in his voice and lively, varied intonation. Clear diction, no shouting."
)
TEXTO_MUESTRA = ("¿Viste cuando dejás algo para el finde y el finde se complica? Bueno, nos pasa a todos. "
                 "Por eso te cuento cuánto sale cada cosa, así nadie te agarra desprevenido.")


def normal(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", t).split()


def vida(x, sr=16000):
    import librosa
    f0, voiced, _ = librosa.pyin(x, fmin=70, fmax=300, sr=sr, frame_length=1024, hop_length=160)
    f0 = f0[voiced & ~np.isnan(f0)]
    if len(f0) < 20:
        return {}
    st = 12 * np.log2(f0 / np.median(f0))
    rms = librosa.feature.rms(y=x, frame_length=1024, hop_length=160)[0]
    nivel = 20 * np.log10(rms + 1e-9)
    habla = nivel[nivel > nivel.max() - 35]
    return {"tono_hz": round(float(np.median(f0)), 1), "tono_semitonos": round(float(np.std(st)), 2),
            "tono_rango": round(float(np.percentile(st, 90) - np.percentile(st, 10)), 2),
            "volumen_db": round(float(np.std(habla)), 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("salida")
    ap.add_argument("--tomas", type=int, default=4)
    ap.add_argument("--texto", default=TEXTO_MUESTRA)
    ap.add_argument("--descripcion", default=DESCRIPCION)
    a = ap.parse_args()
    os.makedirs(a.salida, exist_ok=True)
    import torch, soundfile as sf, librosa
    from qwen_tts import Qwen3TTSModel
    from faster_whisper import WhisperModel
    modelo = Qwen3TTSModel.from_pretrained(MODELO, device_map="cpu", dtype=torch.float32)
    oido = WhisperModel("medium", device="cpu", compute_type="int8")
    informe = []
    for n in range(a.tomas):
        torch.manual_seed(1000 + n)
        wavs, sr = modelo.generate_voice_design(text=a.texto, instruct=a.descripcion, language="Spanish",
                                                do_sample=True, temperature=0.8 + 0.05 * (n % 3))
        x = np.asarray(wavs[0], dtype=np.float32)
        ruta = os.path.join(a.salida, f"toma{n}.wav")
        sf.write(ruta, x, sr)
        x16 = librosa.resample(x, orig_sr=sr, target_sr=16000)
        segs, _ = oido.transcribe(x16, language="es", word_timestamps=True)
        pal = [w for s in segs for w in s.words]
        oye = " ".join(w.word.strip() for w in pal)
        parecido = difflib.SequenceMatcher(None, normal(a.texto), normal(oye)).ratio()
        habla = (pal[-1].end - pal[0].start) if pal else 0
        r = {"toma": ruta, "se_oye": oye, "parecido_texto": round(parecido, 3),
             "ritmo": round(len(pal) / max(habla, 0.3), 2), "segundos": round(len(x) / sr, 2), **vida(x16)}
        informe.append(r)
        print(json.dumps(r, ensure_ascii=False), flush=True)
    json.dump(informe, open(os.path.join(a.salida, "informe.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.exit(main())
