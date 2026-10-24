#!/usr/bin/env python3
"""Voz clonada del fundador para los videos (pedido del 24/10/2026).

  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav
  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav --palabras salida.palabras.json
  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav --muestra otra-toma.m4a

Corre en un entorno aparte (torch + Chatterbox): una vez por sesion,
`bash tools/voz-en-off/instalar-clon.sh` (unos 4 minutos). Modelo: Chatterbox
multilingue de Resemble AI, licencia MIT (se puede usar en publicidad), sin
placa de video: unos 6 segundos de computo por segundo de voz.

Solo la voz del fundador, que lo pidio. Nunca la de otra persona.

1. Prepara el guion: "Tratto" se le pasa como "Trato" (si no, lo lee mal) y
   avisa si hay cifras o "$" (se leen mejor escritas con letras).
2. Lo corta en frases de hasta 220 caracteres y genera cada una con la muestra.
3. Control: transcribe cada frase con faster-whisper y la compara con el
   guion; si se parece menos de 85 %, la vuelve a generar (hasta 3 veces) y se
   queda con la mejor.
4. Une las frases con 0,25 s de pausa y masteriza como voz_en_off.py
   (-14 LUFS, pico real -1,5 dBTP).
5. Con --palabras guarda [inicio, fin, palabra] de cada palabra del guion,
   con la ortografia del guion (para los subtitulos de comun-voz.js).

El audio sale con la marca de agua inaudible de Chatterbox (Perth), que deja
saber que es voz hecha con IA.
"""
import argparse, difflib, json, os, re, sys, tempfile, unicodedata
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from voz_en_off import ff, SR  # noqa: E402

# Toma aprobada del fundador (primera frase de "Dos plomeros", 7,9 s).
MUESTRA = os.path.join(D, "..", "piezas-redes", "reels", "audio", "voz-dos-plomeros.m4a")
MUESTRA_SEG = 7.9
PRONUNCIA = {r"\bTratto\b": "Trato", r"\btratto\b": "trato"}
UMBRAL, INTENTOS, LARGO = 0.85, 3, 220


def normal(texto):
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", t.replace("tratto", "trato")).split()


def frases(guion):
    partes, actual = [], ""
    for f in re.split(r"(?<=[.!?…])\s+", guion.strip()):
        if actual and len(actual) + len(f) + 1 > LARGO:
            partes.append(actual)
            actual = f
        else:
            actual = f"{actual} {f}".strip()
    return partes + ([actual] if actual else [])


def recortar(x, umbral=0.01):
    voz = np.flatnonzero(np.abs(x) > umbral)
    if not len(voz):
        return x
    margen = int(0.05 * SR)
    return x[max(voz[0] - margen, 0):voz[-1] + margen]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("guion")
    ap.add_argument("salida")
    ap.add_argument("--palabras")
    ap.add_argument("--muestra", help=f"toma de referencia (por defecto los primeros {MUESTRA_SEG} s de voz-dos-plomeros)")
    ap.add_argument("--emocion", type=float, default=0.5, help="0,25 sereno a 0,9 muy expresivo")
    a = ap.parse_args()

    if re.search(r"\d|\$", a.guion):
        print("Aviso: el guion tiene cifras o $; se leen mejor escritas con letras.")
    texto_modelo = a.guion
    for patron, reemplazo in PRONUNCIA.items():
        texto_modelo = re.sub(patron, reemplazo, texto_modelo)

    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    from faster_whisper import WhisperModel
    modelo = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    oido = WhisperModel("small", device="cpu", compute_type="int8")

    def escuchar(wav, palabras=False):
        segs, _ = oido.transcribe(wav, language="es", word_timestamps=palabras,
                                  initial_prompt="Tratto, app de presupuestos.")
        return list(segs)

    with tempfile.TemporaryDirectory() as tmp:
        muestra = os.path.join(tmp, "muestra.wav")
        ff("-i", a.muestra or MUESTRA, *([] if a.muestra else ["-t", str(MUESTRA_SEG)]),
           "-ac", "1", "-ar", "24000", muestra)
        trozos, informe = [], []
        for i, frase in enumerate(frases(texto_modelo)):
            mejor = (-1, None)
            for intento in range(INTENTOS):
                torch.manual_seed(1000 * i + intento)
                wav = modelo.generate(frase, language_id="es", audio_prompt_path=muestra,
                                      exaggeration=a.emocion, cfg_weight=0.5)
                x = wav.squeeze().numpy().astype(np.float32)
                prueba = os.path.join(tmp, f"f{i}.wav")
                x.tofile(prueba + ".raw")
                ff("-f", "f32le", "-ar", str(modelo.sr), "-ac", "1", "-i", prueba + ".raw", "-ar", str(SR), prueba)
                oyo = " ".join(s.text for s in escuchar(prueba))
                parecido = difflib.SequenceMatcher(None, normal(frase), normal(oyo)).ratio()
                if parecido > mejor[0]:
                    mejor = (parecido, prueba, oyo)
                if parecido >= UMBRAL:
                    break
            informe.append({"frase": frase, "parecido": round(mejor[0], 2), "intentos": intento + 1, "se_oye": mejor[2].strip()})
            crudo = os.path.join(tmp, f"c{i}.raw")
            ff("-i", mejor[1], "-ac", "1", "-ar", str(SR), "-f", "f32le", crudo)
            trozos.append(recortar(np.fromfile(crudo, dtype=np.float32)))

        pausa = np.zeros(int(0.25 * SR), dtype=np.float32)
        voz = np.concatenate([np.concatenate([t, pausa]) for t in trozos])[:-len(pausa)]
        unida = os.path.join(tmp, "unida.raw")
        voz.tofile(unida)
        entrada = ["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", unida]
        med = ff(*entrada, "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-", nivel="info")
        j = json.loads(med[med.rindex("{"):])
        ln = ("loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=%s:measured_TP=%s:measured_LRA=%s:"
              "measured_thresh=%s:offset=%s:linear=true"
              % (j["input_i"], j["input_tp"], j["input_lra"], j["input_thresh"], j["target_offset"]))
        ff(*entrada, "-af", ln + ",alimiter=limit=0.84:attack=2:release=40:level=false",
           "-ar", str(SR), "-c:a", "pcm_s24le", a.salida)

    if a.palabras:
        oidas = [(w.start, w.end, w.word) for s in escuchar(a.salida, palabras=True) for w in s.words]
        guion = a.guion.split()
        g, o = [normal(p)[0] if normal(p) else "" for p in guion], [(normal(w[2]) or [""])[0] for w in oidas]
        tiempos = [None] * len(guion)
        for bloque in difflib.SequenceMatcher(None, g, o, autojunk=False).get_matching_blocks():
            for k in range(bloque.size):
                ini, fin, _ = oidas[bloque.b + k]
                tiempos[bloque.a + k] = [round(ini, 2), round(fin, 2)]
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
                tiempos[n] = [round(antes + paso * (n - k), 2), round(antes + paso * (n - k + 1), 2)]
            k = fin_tramo
        # Whisper a veces encima palabras cortas: cada una empieza cuando
        # termina la anterior.
        for k in range(1, len(tiempos)):
            tiempos[k][0] = max(tiempos[k][0], tiempos[k - 1][1])
            tiempos[k][1] = round(max(tiempos[k][1], tiempos[k][0] + 0.05), 2)
        with open(a.palabras, "w", encoding="utf-8") as f:
            json.dump([[t[0], t[1], p] for t, p in zip(tiempos, guion)], f, ensure_ascii=False)

    print(json.dumps({"salida": a.salida, "duracion": round(len(voz) / SR, 2), "frases": informe}, ensure_ascii=False))
    flojas = [f for f in informe if f["parecido"] < UMBRAL]
    if flojas:
        print(f"Revisar: {len(flojas)} frase(s) por debajo de {UMBRAL:.0%} (ver 'se_oye').")


if __name__ == "__main__":
    main()
