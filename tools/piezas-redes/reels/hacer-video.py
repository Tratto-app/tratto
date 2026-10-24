"""Hace un video completo de punta a punta: música, efectos, mezcla y MP4.

Uso: python3 hacer-video.py video-quiz-perro-tt.html --musica tension [--previa 1,5,9]
     python3 hacer-video.py video-quiz-perro-tt.html --musica tension \
         --voz-gancho "¿Cuánto sale bañar al perro?" --voz-cierre "Pedilo gratis en Tratto."

1. Lee del HTML (con render-reel.py --info) la duración, el segundo del cierre,
   los efectos de sonido y los golpes que arma formatos.js para ese guion.
2. Genera la música propia con el estilo pedido (musica.py --estilo).
3. Con --voz-gancho / --voz-cierre, la voz clonada del fundador
   (tools/voz-en-off/clonar.py) dice esa frase al arrancar y al cierre, y la
   música baja mientras habla.
4. Mezcla música y efectos y normaliza a -14 LUFS (sonido.py).
5. Renderiza el MP4 con ese sonido (render-reel.py --audio).

Con --previa solo saca esos cuadros en PNG para revisar, sin sonido ni MP4.
Al final imprime en JSON lo que va en datos.video del item de la cola:
formato, música, duración, voz y archivo.
"""
import argparse, json, os, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
ESTILOS = ("pop", "lofi", "dembow", "house", "cumbia", "tension", "acustico", "silencio")
CLONAR = os.path.join(D, "..", "..", "voz-en-off", "clonar.py")
PY_VOZ = os.environ.get("TRATTO_PY_VOZ", "/root/venv-voz/bin/python")  # tools/voz-en-off/instalar-clon.sh


def correr(*args, py=sys.executable):
    r = subprocess.run([py, *args], cwd=D, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"Falló {args[0]}:\n{r.stdout[-1500:]}\n{r.stderr[-1500:]}")
    return r.stdout


def sumar_voz(musica, seg, cierre, gancho, final, nombre):
    """Pone la voz clonada sobre la música: el gancho en 0,3 s y la frase final
    0,25 s después de que entra el cierre. La música baja mientras habla."""
    if not os.path.exists(PY_VOZ):
        sys.exit("Falta la voz clonada: bash tools/voz-en-off/instalar-clon.sh")
    tomas = []
    for clave, frase, desde in (("gancho", gancho, 0.3), ("cierre", final, cierre + 0.25)):
        if not frase:
            continue
        wav = os.path.join("audio", f"voz-{nombre}-{clave}.wav")
        salida = correr(CLONAR, frase, wav, py=PY_VOZ)
        info = json.loads(next(l for l in salida.splitlines() if l.startswith("{")))
        if "Revisar" in salida:
            os.remove(os.path.join(D, wav))
            sys.exit(f"La voz del {clave} no salió prolija ({'; '.join(info['fallas'])}; se oye: "
                     f"{info['se_oye']}). Probá otra frase.")
        tope = (cierre - 0.2 if clave == "gancho" else seg - 0.1) - desde
        if info["duracion"] > tope:
            sys.exit(f"La frase del {clave} dura {info['duracion']} s y entran {tope:.1f} s: acortala.")
        tomas.append((wav, desde))
    if not tomas:
        return
    entradas, filtros = ["-i", musica], []
    for n, (wav, desde) in enumerate(tomas, 1):
        entradas += ["-i", wav]
        ms = int(desde * 1000)
        filtros.append(f"[{n}]aformat=sample_rates=48000:channel_layouts=stereo,adelay={ms}|{ms},apad[v{n}]")
    voces = "".join(f"[v{n}]" for n in range(1, len(tomas) + 1))
    filtros.append(f"{voces}amix=inputs={len(tomas)}:normalize=0:duration=longest,atrim=0:{seg},asplit[voz1][voz2]")
    filtros.append("[0]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.8[mus]")
    filtros.append("[mus][voz1]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[baja]")
    filtros.append(f"[baja][voz2]amix=inputs=2:normalize=0,atrim=0:{seg}[out]")
    con_voz = musica.replace(".wav", "-voz.wav")
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", *entradas, "-filter_complex", ";".join(filtros),
                        "-map", "[out]", con_voz], cwd=D, capture_output=True, text=True)
    if r.returncode:
        sys.exit("No se pudo mezclar la voz:\n" + r.stderr[-800:])
    os.replace(os.path.join(D, con_voz), os.path.join(D, musica))
    for wav, _ in tomas:
        os.remove(os.path.join(D, wav))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--musica", choices=ESTILOS, required=True)
    ap.add_argument("--previa")
    ap.add_argument("--voz-gancho", help="frase que dice la voz clonada del fundador al arrancar")
    ap.add_argument("--voz-cierre", help="frase que dice la voz clonada en el cierre")
    a = ap.parse_args()
    nombre = os.path.splitext(os.path.basename(a.html))[0]
    salida = correr("render-reel.py", a.html, "--info").strip().splitlines()[-1]
    info = json.loads(salida)
    if not info.get("duracion") or info.get("cierre") is None:
        sys.exit("El video no define PUBLI.duracion y PUBLI.cierre (¿carga formatos.js?)")
    seg, cierre = info["duracion"], info["cierre"]
    if a.previa:
        correr("render-reel.py", a.html, "--segundos", str(seg), "--previa", a.previa)
        print(f"previas en salida/ · {seg} s · cierre {cierre} s")
        return
    os.makedirs(os.path.join(D, "audio"), exist_ok=True)
    efectos = os.path.join("audio", nombre + ".efectos.json")
    with open(os.path.join(D, efectos), "w", encoding="utf-8") as f:
        json.dump(info["efectos"], f, ensure_ascii=False, indent=1)
    musica = os.path.join("audio", f"musica-{nombre}.wav")
    golpes = ",".join(str(g) for g in info.get("golpes", []))
    correr("musica.py", musica, "--segundos", str(seg), "--cierre", str(cierre), "--estilo", a.musica, *(["--golpes", golpes] if golpes else []))
    sumar_voz(musica, seg, cierre, a.voz_gancho, a.voz_cierre, nombre)
    mezcla = os.path.join("audio", nombre + "-mezcla.m4a")
    correr("sonido.py", musica, efectos, mezcla, "--segundos", str(seg))
    correr("render-reel.py", a.html, "--segundos", str(seg), "--audio", mezcla)
    os.remove(os.path.join(D, musica))  # el WAV pesa mucho; queda la mezcla
    mp4 = os.path.join("salida", nombre + ".mp4")
    voz = "clonada" if (a.voz_gancho or a.voz_cierre) else "sin voz"
    print(json.dumps({"formato": info["tema"], "musica": a.musica, "duracion": seg, "voz": voz, "archivo": mp4}, ensure_ascii=False))


main()
