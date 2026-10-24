#!/usr/bin/env python3
"""Voz clonada del fundador para los videos (aprobada el 24/10/2026; en pausa
desde esa noche: ningun video sale con ella sin que el fundador lo escuche y
lo apruebe).

  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav
  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav --palabras salida.palabras.json
  /root/venv-voz/bin/python clonar.py "Guion..." salida.wav --muestra toma.m4a --muestra-texto "lo que dice"

Corre en un entorno aparte: una vez por sesion,
`bash tools/voz-en-off/instalar-clon.sh` (unos 5 minutos). Modelo: Qwen3-TTS
1.7B Base, licencia Apache 2.0 (se puede usar en publicidad), sin placa de
video: unos 7 segundos de computo por segundo de voz, por cada toma.

Solo la voz del fundador, que lo pidio. Nunca la de otra persona.

Lo que pidio el fundador: que no se trabe, que no cambie la voz en el medio,
que se entienda todo y que se escuche pareja. El primer reel salio con una
traba al principio, una frase con otra voz y partes que no se entendian: los
controles lo habian marcado y se aflojaron para que pasara. Nunca mas: si un
control falla, la voz no sale (codigo de salida 2, sin archivo).

1. La muestra va con las palabras exactas que dice (modo ICL): asi copia el
   timbre, el ritmo y el acento, no solo el timbre.
2. El guion se genera por tramos (una frase; las de menos de 6 palabras van
   con la siguiente, porque solas salian con otra voz). Generado entero de
   una vez, una frase floja arruinaba la toma y no se podia cambiar sola.
   Cada tramo sale de la misma muestra, asi que es la misma voz.
3. De cada tramo, 2 tomas a la vez con menos azar que el de fabrica (sale mas
   pareja). Cada toma tiene que pasar TODOS los controles (CONTROL), medidos
   contra las grabaciones reales del fundador el 24/10/2026:
   - se entiende: lo que oye faster-whisper medium (sin pista del guion, para
     que no adivine) es el guion del tramo, sin palabras de mas ni repetidas,
     y lo oye seguro;
   - no se traba: ningun silencio de mas de 0,45 s en el medio de una frase
     (despues de una coma, 0,75 s; el fundador llega a 0,72), medido en el
     audio y no en lo que dice el oido (que a veces estira las palabras y
     tapa la pausa), ninguna palabra estirada, nada antes o despues;
   - misma voz: parecido con la muestra (huella de voz del propio modelo)
     de 0,975 o mas; tono a menos de 22 % del de la muestra y ritmo normal.
   Si ninguna pasa, otras 2 (hasta 6 rondas, 12 tomas). Si un tramo no pasa,
   la voz entera no sale.
4. Entre las que pasan, la mas parecida a la muestra. Despues, que los tramos
   elegidos sean parejos entre ellos (tono a menos de 15 % de la mediana).
5. Se pegan con 0,45 s entre tramos, cada uno al mismo volumen, compresion
   suave y master como voz_en_off.py (-14 LUFS, pico real -1,5 dBTP). Al
   final se escucha entera otra vez y tiene que entenderse el guion.
6. Con --palabras guarda [inicio, fin, palabra] de cada palabra del guion,
   con la ortografia del guion (para los subtitulos de comun-voz.js).
"""
import argparse, ctypes, difflib, gc, json, os, re, shutil, subprocess, sys, tempfile, unicodedata
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
OIDO = "medium"          # small dejaba pasar frases que no se entendian
TOMAS = 2                # por tramo y por ronda, generadas juntas (4 juntas no entran en memoria)
RONDAS = 6
MIN_PALABRAS = 6         # frases mas cortas van con la siguiente
SORTEO = {"temperature": 0.7, "top_p": 0.9, "subtalker_temperature": 0.7, "subtalker_top_p": 0.9}
CONTROL = {
    "texto": 0.95,          # parecido de lo que se oye con el guion del tramo
    "seguro": 0.80,         # seguridad media del oido en las palabras del tramo
    "seguro_3": 0.70,       # ni 3 palabras seguidas con menos: asi sono la traba de "Si mandas, se" (0,46 a 0,65)
    "pausa": 0.45, "pausa_coma": 0.75, "pausa_punto": 0.95,  # silencios medidos en el audio
    "palabra_larga": 0.90,
    "ruido_db": -38.0,      # nada que suene antes de la primera palabra o despues de la ultima
    "voz": 0.975,           # parecido con la muestra (reales 0,97 a 0,99; la frase con otra voz dio 0,944)
    "tono": 0.22,           # contra la muestra
    "tono_pareja": 0.15,    # entre los tramos elegidos
    "ritmo": (1.8, 5.0),    # palabras por segundo (el fundador: 2,1 a 4,1)
}
ENTRE_TRAMOS = 0.45
COLCHON = 0.5            # silencio delante de cada toma al escucharla: sin el, el oido duda de la primera palabra
TERMINAR = "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:knee=4:makeup=2"

UNIDADES = ("cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince "
            "dieciseis diecisiete dieciocho diecinueve veinte").split()
DECENAS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa"}
CENTENAS = {2: "doscientos", 3: "trescientos", 4: "cuatrocientos", 5: "quinientos", 6: "seiscientos",
            7: "setecientos", 8: "ochocientos", 9: "novecientos"}


def letras(n):
    """Un numero escrito con letras, sin tildes (el oido a veces escribe cifras)."""
    if n <= 20:
        return UNIDADES[n]
    if n < 30:
        return "veinti" + UNIDADES[n - 20]
    if n < 100:
        d, u = divmod(n, 10)
        return DECENAS[d] + (f" y {UNIDADES[u]}" if u else "")
    if n < 1000:
        c, r = divmod(n, 100)
        if n == 100:
            return "cien"
        return ("ciento" if c == 1 else CENTENAS[c]) + (f" {letras(r)}" if r else "")
    if n < 1000000:
        m, r = divmod(n, 1000)
        return ("mil" if m == 1 else f"{letras(m)} mil") + (f" {letras(r)}" if r else "")
    return str(n)


def normal(texto):
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"(\d)[.,](\d{3})", r"\1\2", t)
    t = re.sub(r"\d+", lambda m: f" {letras(int(m.group()))} ", t)
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
    corresponde (None si no se oyo) y cuantas palabras se oyeron de mas: las
    que sobran de verdad (si oye "Entrato" por "En Tratto" no sobra nada) mas
    las repetidas seguidas que el guion no tiene."""
    g = [" ".join(normal(p)) for p in guion]
    o = [" ".join(normal(w[2])) for w in oidas]
    tiempos, usadas = [None] * len(guion), 0
    for b in difflib.SequenceMatcher(None, g, o, autojunk=False).get_matching_blocks():
        for k in range(b.size):
            tiempos[b.a + k] = [oidas[b.b + k][0], oidas[b.b + k][1]]
        usadas += b.size
    sobran = max(0, (len(o) - usadas) - (len(g) - usadas))
    repetidas = sum(1 for i in range(1, len(o)) if o[i] and o[i] == o[i - 1]) - \
        sum(1 for i in range(1, len(g)) if g[i] and g[i] == g[i - 1])
    return tiempos, sobran + max(0, repetidas)


def tramos(guion):
    """Frases del guion (cortadas en . ? ! …); las cortas van con la siguiente."""
    frases, actual = [], []
    for p in guion.split():
        actual.append(p)
        if re.search(r"[.?!…][»”\"]?$", p):
            frases.append(actual)
            actual = []
    if actual:
        frases.append(actual)
    unidos = []
    for fr in frases:
        if unidos and len(unidos[-1]) < MIN_PALABRAS:
            unidos[-1] = unidos[-1] + fr
        else:
            unidos.append(fr)
    if len(unidos) > 1 and len(unidos[-1]) < MIN_PALABRAS:
        unidos[-2] += unidos.pop()
    return unidos


def db(x):
    return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9) if len(x) else -120.0


def silencios(x, sr=16000, minimo=0.25):
    """[(desde, largo)] de los silencios de mas de `minimo` s dentro de x."""
    paso = int(0.01 * sr)
    d = np.array([db(x[i:i + paso]) for i in range(0, len(x) - paso, paso)])
    if not len(d):
        return []
    voz = np.where(d > d.max() - 35)[0]
    out = []
    for a, b in zip(voz, voz[1:]):
        if (b - a - 1) * 0.01 >= minimo:
            out.append(((a + 1) * 0.01, (b - a - 1) * 0.01))
    return out


def revisar(x16, palabras, oidas, voz, f0_muestra):
    """Fallas de una toma de un tramo. x16: la toma a 16 kHz (con 0,5 s de
    silencio adelante, como la escucho el oido); oidas: (inicio, fin,
    palabra, seguridad); voz: parecido con la muestra."""
    r = {"fallas": [], "parecido": 0.0, "f0": None, "ini": 0.0, "fin": 0.0, "tiempos": []}
    if not oidas:
        r["fallas"].append("no se oye nada")
        return r
    texto = " ".join(palabras)
    r["parecido"] = difflib.SequenceMatcher(None, normal(texto), normal(" ".join(w[2] for w in oidas))).ratio()
    if r["parecido"] < CONTROL["texto"]:
        r["fallas"].append(f"se entiende distinto ({r['parecido']:.0%})")
    r["tiempos"], de_mas = alinear(palabras, oidas)
    if de_mas:
        r["fallas"].append(f"{de_mas} palabras de más o repetidas")
    # La marca le cuesta al oido tambien con el fundador de verdad, y la
    # primera palabra de un audio siempre la duda (en su toma real de "Dos
    # plomeros", "Dos" sale con 23 %): si las oyo bien, no cuentan.
    seg = [1.0 if k == 0 or normal(w[2])[:1] in (["trato"], ["tratoapp"]) else w[3] for k, w in enumerate(oidas)]
    if float(np.mean(seg)) < CONTROL["seguro"]:
        r["fallas"].append(f"no se entiende claro (seguridad {np.mean(seg):.0%})")
    for i in range(1, len(oidas) - 2):
        if np.mean(seg[i:i + 3]) < CONTROL["seguro_3"]:
            r["fallas"].append("se traba o no se entiende en «"
                               + " ".join(f"{w[2].strip()} {w[3]:.0%}" for w in oidas[i:i + 3]) + "»")
            break
    for (ini, fin, w, p) in oidas:
        if fin - ini > CONTROL["palabra_larga"]:
            r["fallas"].append(f"palabra estirada: {w.strip()}")
    # Pausas: los silencios de verdad (el oido a veces estira las palabras y
    # tapa la pausa), cada uno con la palabra que termina mas cerca.
    t = r["tiempos"]
    ini, fin = r["ini"], r["fin"] = oidas[0][0], oidas[-1][1]
    for desde, largo in silencios(x16[int(ini * 16000):int(fin * 16000)]):
        desde += ini
        cerca = [i for i in range(len(palabras) - 1) if t[i]]
        i = min(cerca, key=lambda i: abs(t[i][1] - desde)) if cerca else None
        p = palabras[i] if i is not None and abs(t[i][1] - desde) < 0.3 else ""
        cita = p and palabras[i + 1][:1] in "«“\""   # antes de una cita se lee ":"
        tope = CONTROL["pausa_punto"] if re.search(r"[.?!…][»”\"]?$", p) else \
            CONTROL["pausa_coma"] if re.search(r"[,:;»”\"]$", p) or cita else CONTROL["pausa"]
        if largo > tope:
            r["fallas"].append(f"se frena {largo:.1f} s" + (f" después de «{p}»" if p else ""))
    if db(x16[int(0.5 * 16000):max(int(0.5 * 16000), int((ini - 0.25) * 16000))]) > CONTROL["ruido_db"]:
        r["fallas"].append("suena algo antes de la primera palabra")
    if db(x16[int((fin + 0.35) * 16000):]) > CONTROL["ruido_db"]:
        r["fallas"].append("suena algo después de la última palabra")
    if voz < CONTROL["voz"]:
        r["fallas"].append(f"no suena igual a la muestra (parecido {voz:.3f})")
    r["f0"] = tono(x16[int(ini * 16000):int(fin * 16000)])
    if r["f0"] and f0_muestra and abs(r["f0"] - f0_muestra) / f0_muestra > CONTROL["tono"]:
        r["fallas"].append(f"cambia la voz (tono {r['f0']:.0f} Hz contra {f0_muestra:.0f})")
    ritmo = len(palabras) / max(fin - ini, 0.3)
    if not CONTROL["ritmo"][0] <= ritmo <= CONTROL["ritmo"][1]:
        r["fallas"].append(f"ritmo raro ({ritmo:.1f} palabras por segundo)")
    return r


def recorte(x, sr, ini, fin):
    """Del tramo, solo la voz: desde un poco antes de la primera palabra hasta
    que se apaga la ultima, con fundidos cortos."""
    a = max(0, int((ini - 0.30) * sr))
    b = min(len(x), int((fin + 0.40) * sr))
    paso = int(0.01 * sr)
    marcos = [db(x[i:i + paso]) for i in range(a, b - paso, paso)]
    umbral = max(-48.0, max(marcos) - 40)
    voz = [k for k, v in enumerate(marcos) if v > umbral]
    a2 = max(0, a + voz[0] * paso - int(0.04 * sr))
    b2 = min(len(x), a + (voz[-1] + 1) * paso + int(0.08 * sr))
    y = x[a2:b2].astype(np.float32).copy()
    n1, n2 = int(0.01 * sr), int(0.03 * sr)
    y[:n1] *= np.linspace(0, 1, n1)
    y[-n2:] *= np.linspace(1, 0, n2)
    return y, a2 / sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("guion")
    ap.add_argument("salida")
    ap.add_argument("--palabras")
    ap.add_argument("--muestra", help=f"otra toma del fundador (por defecto {MUESTRA_SEG} s de voz-dos-plomeros)")
    ap.add_argument("--muestra-texto", help="lo que dice la muestra, palabra por palabra")
    ap.add_argument("--guardar-tomas", help="carpeta donde dejar todas las tomas, para revisarlas")
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
    oido = WhisperModel(OIDO, device="cpu", compute_type="int8")
    sr_voz = modelo.model.speaker_encoder_sample_rate

    def escuchar(wav):
        segs, _ = oido.transcribe(wav, language="es", word_timestamps=True, condition_on_previous_text=False)
        return [(w.start, w.end, w.word, w.probability) for s in segs for w in s.words]

    def leer(wav, sr):
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", wav, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                           capture_output=True, check=True)
        return np.frombuffer(r.stdout, dtype=np.float32).copy()

    def huella(x):
        with torch.no_grad():
            e = modelo.model.extract_speaker_embedding(audio=x, sr=sr_voz).float().flatten()
        return e / e.norm()

    partes = tramos(a.guion)
    elegidos, informe = [], []
    with tempfile.TemporaryDirectory() as tmp:
        muestra = os.path.join(tmp, "muestra.wav")
        ff("-i", a.muestra or MUESTRA, *([] if a.muestra else ["-t", str(MUESTRA_SEG)]),
           "-ac", "1", "-ar", "24000", muestra)
        prompt = modelo.create_voice_clone_prompt(ref_audio=muestra, ref_text=a.muestra_texto or MUESTRA_TEXTO)
        h_muestra = huella(leer(muestra, sr_voz))
        f0_muestra = tono(leer(muestra, 16000))

        for n, palabras in enumerate(partes):
            # Las comillas no se leen: donde abre una cita va un ":" (sin eso lo
            # leia de corrido y se trababa: "Si mandas se me rompio...").
            texto = re.sub(r"(\w)\s+[«“\"]", r"\1: ", " ".join(palabras))
            texto = re.sub(r"[«»“”\"]", "", texto)
            esperado = len(texto) / 14
            buenas, probadas = [], []
            for ronda in range(RONDAS):
                torch.manual_seed(1000 * (n + 1) + ronda)
                wavs, sr = modelo.generate_voice_clone(
                    text=[texto] * TOMAS, language=["Spanish"] * TOMAS, voice_clone_prompt=prompt,
                    max_new_tokens=int(12 * (esperado * 1.6 + 2)), **SORTEO)
                for k, w in enumerate(wavs):
                    toma = os.path.join(tmp, f"t{n}-{ronda}-{k}.wav")
                    sf.write(toma, np.concatenate([np.zeros(int(COLCHON * sr), dtype=np.float32),
                                                   np.asarray(w, dtype=np.float32)]), sr)
                    oidas = [(max(o[0], COLCHON), max(o[1], COLCHON + 0.05), o[2], o[3]) for o in escuchar(toma)]
                    voz = float(h_muestra @ huella(leer(toma, sr_voz)[int(COLCHON * sr_voz):]))
                    r = revisar(leer(toma, 16000), palabras, oidas, voz, f0_muestra)
                    if len(w) / sr > esperado * 1.5 + 1:
                        r["fallas"].insert(0, f"se fue de largo ({len(w) / sr:.0f} s para unos {esperado:.0f})")
                    r.update(wav=w, sr=sr, voz=voz, se_oye=" ".join(o[2].strip() for o in oidas))
                    probadas.append(r)
                    if a.guardar_tomas:
                        os.makedirs(a.guardar_tomas, exist_ok=True)
                        shutil.copyfile(toma, os.path.join(a.guardar_tomas, os.path.basename(toma)))
                    print(f"  tramo {n + 1} toma {len(probadas)}: voz {voz:.3f} · "
                          + ("pasa" if not r["fallas"] else "; ".join(r["fallas"])), file=sys.stderr, flush=True)
                    if not r["fallas"]:
                        buenas.append(r)
                # Sin esto la memoria crece en cada ronda hasta que el sistema corta el proceso.
                del wavs
                gc.collect()
                ctypes.CDLL("libc.so.6").malloc_trim(0)
                if buenas:
                    break
            texto_corto = " ".join(palabras)[:60]
            if not buenas:
                peor = min(probadas, key=lambda p: (len(p["fallas"]), -p["voz"]))
                informe.append({"tramo": texto_corto, "tomas": len(probadas), "pasaron": 0,
                                "mejor_fallida": {"fallas": peor["fallas"], "voz": round(peor["voz"], 3),
                                                  "se_oye": peor["se_oye"]}})
                break
            mejor = max(buenas, key=lambda b: b["voz"])
            elegidos.append((palabras, mejor))
            informe.append({"tramo": texto_corto, "tomas": len(probadas), "pasaron": len(buenas),
                            "voz": round(mejor["voz"], 3), "se_oye": mejor["se_oye"]})
            print(f"tramo {n + 1}/{len(partes)}: {len(buenas)} de {len(probadas)} tomas pasaron "
                  f"(voz {mejor['voz']:.3f})", file=sys.stderr, flush=True)

        fallas = []
        if len(elegidos) < len(partes):
            t = informe[-1]
            fallas.append(f"el tramo «{t['tramo']}» no pasó en {t['tomas']} tomas: "
                          f"{'; '.join(t['mejor_fallida']['fallas'])}")
        else:
            tonos = [m["f0"] for _, m in elegidos if m["f0"]]
            med = float(np.median(tonos)) if tonos else None
            for palabras, m in elegidos:
                if m["f0"] and med and abs(m["f0"] - med) / med > CONTROL["tono_pareja"]:
                    fallas.append(f"el tramo «{' '.join(palabras)[:40]}» tiene otro tono "
                                  f"({m['f0']:.0f} Hz contra {med:.0f})")
        if fallas:
            print(json.dumps({"salida": None, "fallas": fallas, "tramos": informe}, ensure_ascii=False))
            print(f"Revisar: la voz no salió prolija y no se usa: {'; '.join(fallas)}")
            sys.exit(2)

        # Pegar: cada tramo al mismo volumen y 0,45 s entre tramos.
        sr = elegidos[0][1]["sr"]
        trozos, tiempos, pos = [], [], 0.0
        for palabras, m in elegidos:
            # Los tiempos del oido cuentan el colchon de silencio; la toma no lo tiene.
            y, corrido = recorte(np.asarray(m["wav"], dtype=np.float32), sr, m["ini"] - COLCHON, m["fin"] - COLCHON)
            corrido += COLCHON
            paso = int(0.01 * sr)
            marcos = [y[i:i + paso] for i in range(0, len(y) - paso, paso)]
            fuertes = [f for f in marcos if db(f) > max(db(f2) for f2 in marcos) - 30]
            y *= 10 ** ((-20 - db(np.concatenate(fuertes))) / 20)
            if trozos:
                trozos.append(np.zeros(int(ENTRE_TRAMOS * sr), dtype=np.float32))
                pos += ENTRE_TRAMOS
            trozos.append(y)
            propios = [None if t is None else [max(t[0] - corrido + pos, pos + 0.04), t[1] - corrido + pos]
                       for t in m["tiempos"]]
            tiempos += propios
            pos += len(y) / sr
        pegada = os.path.join(tmp, "pegada.wav")
        sf.write(pegada, np.concatenate(trozos), sr)

        terminada = os.path.join(tmp, "terminada.wav")
        ff("-i", pegada, "-af", TERMINAR, "-ac", "1", "-ar", str(SR), terminada)
        med = ff("-i", terminada, "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-", nivel="info")
        j = json.loads(med[med.rindex("{"):])
        ln = ("loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=%s:measured_TP=%s:measured_LRA=%s:"
              "measured_thresh=%s:offset=%s:linear=true"
              % (j["input_i"], j["input_tp"], j["input_lra"], j["input_thresh"], j["target_offset"]))
        final = os.path.join(tmp, "final.wav")
        ff("-i", terminada, "-af", ln + ",alimiter=limit=0.84:attack=2:release=40:level=false",
           "-ar", str(SR), "-c:a", "pcm_s24le", final)

        # Entera otra vez: tiene que entenderse el guion.
        oidas = escuchar(final)
        parecido = difflib.SequenceMatcher(None, normal(a.guion), normal(" ".join(w[2] for w in oidas))).ratio()
        if parecido < CONTROL["texto"]:
            print(json.dumps({"salida": None, "fallas": [f"entera se entiende distinto ({parecido:.0%})"],
                              "se_oye": " ".join(w[2].strip() for w in oidas), "tramos": informe}, ensure_ascii=False))
            print(f"Revisar: la voz entera se entiende distinto ({parecido:.0%}) y no se usa.")
            sys.exit(2)
        shutil.copyfile(final, a.salida)

    duracion = sf.info(a.salida).duration
    if a.palabras:
        guion = a.guion.split()
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
            for i in range(k, fin_tramo):
                tiempos[i] = [antes + paso * (i - k), antes + paso * (i - k + 1)]
            k = fin_tramo
        # Whisper a veces encima palabras cortas: cada una empieza cuando
        # termina la anterior.
        for k in range(1, len(tiempos)):
            tiempos[k][0] = max(tiempos[k][0], tiempos[k - 1][1])
            tiempos[k][1] = max(tiempos[k][1], tiempos[k][0] + 0.05)
        with open(a.palabras, "w", encoding="utf-8") as f:
            json.dump([[round(t[0], 2), round(t[1], 2), p] for t, p in zip(tiempos, guion)], f, ensure_ascii=False)

    print(json.dumps({"salida": a.salida, "duracion": round(duracion, 2), "parecido": round(parecido, 2),
                      "voz_min": min(t["voz"] for t in informe), "fallas": [],
                      "se_oye": " ".join(w[2].strip() for w in oidas), "tramos": informe}, ensure_ascii=False))


if __name__ == "__main__":
    main()
