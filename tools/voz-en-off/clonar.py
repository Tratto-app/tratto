#!/usr/bin/env python3
"""Voz clonada del fundador para los videos (aprobada el 24/10/2026).

  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav
  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav --palabras salida.palabras.json
  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav --muestra toma.m4a --muestra-texto "lo que dice"

Corre en un entorno aparte: una vez por sesion,
`bash tools/voz-en-off/instalar-clon.sh` (unos 5 minutos). Modelo: Qwen3-TTS
1.7B Base, licencia Apache 2.0 (se puede usar en publicidad), sin placa de
video: unos 7 segundos de computo por segundo de voz.

Solo la voz del fundador, que lo pidio. Nunca la de otra persona.

El fundador aprobo esta voz y pidio (24/10/2026) que siempre salga "prolija y
pareja": que no se trabe, que no cambie la voz en el medio y que se escuche
pareja. Por eso:

1. La muestra va con las palabras exactas que dice (modo ICL): asi copia el
   timbre, el ritmo y el acento, no solo el timbre.
2. El guion se genera entero de una sola vez (empalmar tomas cambia la voz).
3. Control de cada toma, frase por frase (faster-whisper):
   - texto: que se entienda lo mismo que el guion (parecido >= 90 %);
   - trabas: palabras de mas o repetidas, palabras estiradas (> 1,1 s),
     pausas raras en el medio de una frase (> 0,7 s);
   - pareja: tono de cada frase a menos de 12 % del tono de toda la toma,
     volumen a menos de 5 dB y ritmo (palabras por segundo) a menos de 35 %.
   Si algo falla, otra toma (hasta 3) y se queda con la de menos fallas.
4. Termina pareja: pausas de mas de 0,6 s a 0,45 s, compresion suave y
   master como voz_en_off.py (-14 LUFS, pico real -1,5 dBTP).
5. Con --palabras guarda [inicio, fin, palabra] de cada palabra del guion,
   con la ortografia del guion (para los subtitulos de comun-voz.js).
"""
import argparse, difflib, json, os, re, sys, tempfile, unicodedata
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from voz_en_off import ff, SR  # noqa: E402

MODELO = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
# Toma aprobada del fundador: los primeros 10,3 s de "Dos plomeros" y lo que dice.
MUESTRA = os.path.join(D, "..", "piezas-redes", "reels", "audio", "voz-dos-plomeros.m4a")
MUESTRA_SEG = 10.3
MUESTRA_TEXTO = ("Dos plomeros, el mismo caño tapado. Uno te cobra $40.000 y el otro $120.000. "
                 "¿Cuál te está viendo la cara? Una destapación simple hoy sale")
TOMAS = 3
PAREJA = {"parecido": 0.90, "tono": 0.12, "volumen_db": 5.0, "ritmo": 0.35,
          "palabra_larga": 1.1, "pausa_rara": 0.7}
TERMINAR = ",".join([
    "silenceremove=stop_periods=-1:stop_duration=0.6:stop_threshold=-40dB:stop_silence=0.45",
    "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:knee=4:makeup=2",
])


def normal(texto):
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", t.replace("tratto", "trato")).split()


def tono(x, sr=16000):
    """Tono medio (Hz) de un tramo, por autocorrelacion."""
    f = []
    for i in range(0, len(x) - 1024, 512):
        w = x[i:i + 1024]
        if np.sqrt((w ** 2).mean()) < 0.02:
            continue
        c = np.correlate(w, w, "full")[1023:]
        lo, hi = sr // 300, sr // 70
        k = lo + int(np.argmax(c[lo:hi]))
        if c[k] > 0.3 * c[0]:
            f.append(sr / k)
    return float(np.median(f)) if f else None


def alinear(guion, oidas):
    """Para cada palabra del guion, [inicio, fin] de la palabra oida que le
    corresponde (None si no se oyo) y cuantas palabras se oyeron de mas."""
    g = [(normal(p) or [""])[0] for p in guion]
    o = [(normal(w[2]) or [""])[0] for w in oidas]
    tiempos, usadas = [None] * len(guion), 0
    for b in difflib.SequenceMatcher(None, g, o, autojunk=False).get_matching_blocks():
        for k in range(b.size):
            tiempos[b.a + k] = [oidas[b.b + k][0], oidas[b.b + k][1]]
        usadas += b.size
    return tiempos, len(oidas) - usadas


def revisar(wav16, guion, oidas):
    """Fallas de una toma. wav16: la toma a 16 kHz en numpy."""
    palabras = guion.split()
    tiempos, de_mas = alinear(palabras, oidas)
    fallas = []
    parecido = difflib.SequenceMatcher(None, normal(guion), normal(" ".join(w[2] for w in oidas))).ratio()
    if parecido < PAREJA["parecido"]:
        fallas.append(f"se entiende distinto ({parecido:.0%})")
    if de_mas > 1:
        fallas.append(f"{de_mas} palabras de más o repetidas")
    for (ini, fin, w) in oidas:
        if fin - ini > PAREJA["palabra_larga"]:
            fallas.append(f"palabra estirada: {w.strip()}")
    # Frases: del guion, cortadas en . ? ! ; y sus tiempos.
    frases, actual = [], []
    for i, p in enumerate(palabras):
        actual.append(i)
        if re.search(r"[.?!;…]$", p):
            frases.append(actual)
            actual = []
    if actual:
        frases.append(actual)
    medidas = []
    for fr in frases:
        t = [tiempos[i] for i in fr if tiempos[i]]
        if len(t) < 2:
            continue
        for a, b in zip(t, t[1:]):
            if b[0] - a[1] > PAREJA["pausa_rara"]:
                fallas.append(f"pausa rara en: {' '.join(palabras[i] for i in fr)[:40]}")
                break
        x = wav16[int(t[0][0] * 16000):int(t[-1][1] * 16000)]
        if len(x) < 1600:
            continue
        medidas.append((fr, tono(x), 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9),
                        len(t) / max(t[-1][1] - t[0][0], 0.3)))
    if len(medidas) > 1:
        tonos = [m[1] for m in medidas if m[1]]
        t_med = float(np.median(tonos)) if tonos else None
        v_med = float(np.median([m[2] for m in medidas]))
        r_med = float(np.median([m[3] for m in medidas]))
        for fr, f0, vol, ritmo in medidas:
            cual = " ".join(palabras[i] for i in fr)[:40]
            if f0 and t_med and abs(f0 - t_med) / t_med > PAREJA["tono"]:
                fallas.append(f"cambia la voz ({f0:.0f} Hz contra {t_med:.0f}) en: {cual}")
            if abs(vol - v_med) > PAREJA["volumen_db"]:
                fallas.append(f"volumen dispar en: {cual}")
            if abs(ritmo - r_med) / r_med > PAREJA["ritmo"]:
                fallas.append(f"ritmo dispar en: {cual}")
    return fallas, round(parecido, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("guion")
    ap.add_argument("salida")
    ap.add_argument("--palabras")
    ap.add_argument("--muestra", help=f"otra toma del fundador (por defecto {MUESTRA_SEG} s de voz-dos-plomeros)")
    ap.add_argument("--muestra-texto", help="lo que dice la muestra, palabra por palabra")
    a = ap.parse_args()
    if a.muestra and not a.muestra_texto:
        sys.exit("Con --muestra hace falta --muestra-texto (lo que dice, palabra por palabra).")
    if re.search(r"\d|\$", a.guion):
        print("Aviso: el guion tiene cifras o $; se leen mejor escritas con letras.")

    import torch
    import soundfile as sf
    from qwen_tts import Qwen3TTSModel
    from faster_whisper import WhisperModel
    modelo = Qwen3TTSModel.from_pretrained(MODELO, device_map="cpu", dtype=torch.float32)
    oido = WhisperModel("small", device="cpu", compute_type="int8")

    def escuchar(wav):
        segs, _ = oido.transcribe(wav, language="es", word_timestamps=True,
                                  initial_prompt="Tratto, app de presupuestos.")
        return [(w.start, w.end, w.word) for s in segs for w in s.words]

    with tempfile.TemporaryDirectory() as tmp:
        muestra = os.path.join(tmp, "muestra.wav")
        ff("-i", a.muestra or MUESTRA, *([] if a.muestra else ["-t", str(MUESTRA_SEG)]),
           "-ac", "1", "-ar", "24000", muestra)
        prompt = modelo.create_voice_clone_prompt(ref_audio=muestra, ref_text=a.muestra_texto or MUESTRA_TEXTO)
        # Unos 14 caracteres por segundo. A veces el modelo no sabe cuándo
        # terminar y sigue generando: se corta en 1,6 veces lo esperado (12
        # códigos por segundo) y esa toma cuenta como fallada.
        esperado = len(a.guion) / 14
        tomas = []
        for n in range(TOMAS):
            torch.manual_seed(1000 + n)
            wavs, sr = modelo.generate_voice_clone(text=a.guion, language="Spanish", voice_clone_prompt=prompt,
                                                   max_new_tokens=int(12 * (esperado * 1.6 + 2)))
            toma = os.path.join(tmp, f"toma{n}.wav")
            sf.write(toma, wavs[0], sr)
            t16 = os.path.join(tmp, f"toma{n}.raw")
            ff("-i", toma, "-ac", "1", "-ar", "16000", "-f", "f32le", t16)
            oidas = escuchar(toma)
            fallas, parecido = revisar(np.fromfile(t16, dtype=np.float32), a.guion, oidas)
            if len(wavs[0]) / sr > esperado * 1.5 + 1:
                fallas.insert(0, f"se fue de largo ({len(wavs[0]) / sr:.0f} s para unos {esperado:.0f})")
            tomas.append({"archivo": toma, "fallas": fallas, "parecido": parecido,
                          "se_oye": " ".join(w[2].strip() for w in oidas)})
            if not fallas:
                break
        mejor = min(tomas, key=lambda t: (len(t["fallas"]), -t["parecido"]))

        terminada = os.path.join(tmp, "terminada.wav")
        ff("-i", mejor["archivo"], "-af", TERMINAR, "-ac", "1", "-ar", str(SR), terminada)
        med = ff("-i", terminada, "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-", nivel="info")
        j = json.loads(med[med.rindex("{"):])
        ln = ("loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=%s:measured_TP=%s:measured_LRA=%s:"
              "measured_thresh=%s:offset=%s:linear=true"
              % (j["input_i"], j["input_tp"], j["input_lra"], j["input_thresh"], j["target_offset"]))
        ff("-i", terminada, "-af", ln + ",alimiter=limit=0.84:attack=2:release=40:level=false",
           "-ar", str(SR), "-c:a", "pcm_s24le", a.salida)

    oidas = escuchar(a.salida)
    duracion = sf.info(a.salida).duration
    if a.palabras:
        guion = a.guion.split()
        tiempos, _ = alinear(guion, oidas)
        # Las palabras que no se reconocieron se reparten en partes iguales el
        # hueco entre la anterior y la siguiente que si se reconocieron.
        k = 0
        while k < len(tiempos):
            if tiempos[k] is not None:
                k += 1
                continue
            fin_tramo = k
            while fin_tramo < len(tiempos) and tiempos[fin_tramo] is None:
                fin_tramo += 1
            antes = tiempos[k - 1][1] if k else 0.0
            despues = tiempos[fin_tramo][0] if fin_tramo < len(tiempos) else antes + 0.3 * (fin_tramo - k)
            paso = max(despues - antes, 0.1 * (fin_tramo - k)) / (fin_tramo - k)
            for n in range(k, fin_tramo):
                tiempos[n] = [antes + paso * (n - k), antes + paso * (n - k + 1)]
            k = fin_tramo
        # Whisper a veces encima palabras cortas: cada una empieza cuando
        # termina la anterior.
        for k in range(1, len(tiempos)):
            tiempos[k][0] = max(tiempos[k][0], tiempos[k - 1][1])
            tiempos[k][1] = max(tiempos[k][1], tiempos[k][0] + 0.05)
        with open(a.palabras, "w", encoding="utf-8") as f:
            json.dump([[round(t[0], 2), round(t[1], 2), p] for t, p in zip(tiempos, guion)], f, ensure_ascii=False)

    print(json.dumps({"salida": a.salida, "duracion": round(duracion, 2), "tomas": len(tomas),
                      "parecido": mejor["parecido"], "fallas": mejor["fallas"], "se_oye": mejor["se_oye"]},
                     ensure_ascii=False))
    if mejor["fallas"]:
        print(f"Revisar: la mejor de {len(tomas)} tomas quedó con fallas: {'; '.join(mejor['fallas'])}")


if __name__ == "__main__":
    main()
