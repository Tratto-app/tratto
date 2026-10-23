"""Hace un video completo de punta a punta: música, efectos, mezcla y MP4.

Uso: python3 hacer-video.py video-quiz-perro-tt.html --musica tension [--previa 1,5,9]

1. Lee del HTML (con render-reel.py --info) la duración, el segundo del cierre,
   los efectos de sonido y los golpes que arma formatos.js para ese guion.
2. Genera la música propia con el estilo pedido (musica.py --estilo).
3. Mezcla música y efectos y normaliza a -14 LUFS (sonido.py).
4. Renderiza el MP4 con ese sonido (render-reel.py --audio).

Con --previa solo saca esos cuadros en PNG para revisar, sin sonido ni MP4.
Al final imprime en JSON lo que va en datos.video del item de la cola:
formato, música, duración y archivo.
"""
import argparse, json, os, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
ESTILOS = ("pop", "lofi", "dembow", "house", "cumbia", "tension", "acustico", "silencio")


def correr(*args):
    r = subprocess.run([sys.executable, *args], cwd=D, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"Falló {args[0]}:\n{r.stdout[-1500:]}\n{r.stderr[-1500:]}")
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--musica", choices=ESTILOS, required=True)
    ap.add_argument("--previa")
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
    mezcla = os.path.join("audio", nombre + "-mezcla.m4a")
    correr("sonido.py", musica, efectos, mezcla, "--segundos", str(seg))
    correr("render-reel.py", a.html, "--segundos", str(seg), "--audio", mezcla)
    os.remove(os.path.join(D, musica))  # el WAV pesa mucho; queda la mezcla
    mp4 = os.path.join("salida", nombre + ".mp4")
    print(json.dumps({"formato": info["tema"], "musica": a.musica, "duracion": seg, "archivo": mp4}, ensure_ascii=False))


main()
