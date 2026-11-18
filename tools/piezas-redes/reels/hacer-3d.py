"""Hace de punta a punta un video del formato 3d (comun-3d.js).

Uso (desde tools/piezas-redes/reels):
  python3 hacer-3d.py video-3d-pasto-tt.html --voz audio/voz-3d-pasto.wav \
      --palabras audio/voz-3d-pasto.palabras.json --musica acustico
  python3 hacer-3d.py video-3d-pasto-tt.html --palabras ... --previa 1,6,12   # solo cuadros

1. Lee de la escena (con los tiempos de la voz) la duración, el cierre y los
   efectos (render-reel.py --info).
2. Música propia (musica.py) del largo del video.
3. La voz encima: la música baja sola cuando habla (sidechaincompress).
4. Efectos (sonido.py) y mezcla a -14 LUFS.
5. Video final (render-reel.py con --palabras y --audio).
La voz sale de clonar.py --palabras (con todos sus controles). Sin --voz no
arma nada: el 14/11/2026 el fundador borró los videos que salieron solo con
música ("salió sin sonido"). Si la voz no pasa, se cambia el guion y se prueba
de nuevo; nunca un video sin voz.
Imprime en JSON lo que va en datos.video del item.
"""
import argparse, json, os, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))


def correr(*args):
    r = subprocess.run([sys.executable, *args], cwd=D, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"Falló {' '.join(args[:2])}:\n{(r.stderr or r.stdout)[-1500:]}")
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--palabras", required=True, help="tiempos de cada palabra (clonar.py --palabras)")
    ap.add_argument("--voz", required=True, help="la voz que pasó los controles de clonar.py (obligatoria: nunca un video sin voz)")
    ap.add_argument("--musica", default="acustico")
    ap.add_argument("--voz-nombre", default="tratto-3d", help="qué voz es, para datos.video.voz (tratto-3d, clonada, grabada)")
    ap.add_argument("--previa")
    a = ap.parse_args()
    nombre = os.path.splitext(os.path.basename(a.html))[0]
    if a.previa:
        print(correr("render-reel.py", a.html, "--segundos", "40", "--palabras", a.palabras, "--previa", a.previa))
        return
    salida_info = correr("render-reel.py", a.html, "--palabras", a.palabras, "--info")
    info = json.loads(salida_info.strip().splitlines()[-1])
    seg, cierre = round(info["duracion"], 2), round(info["cierre"], 2)

    musica = f"audio/musica-{nombre}.wav"
    correr("musica.py", musica, "--segundos", str(seg), "--cierre", str(cierre), "--estilo", a.musica)

    base = musica
    if a.voz:
        base = f"audio/{nombre}-base.wav"
        filtro = (f"[0:a]volume=-3dB,aresample=48000,aformat=channel_layouts=stereo[mus];"
                  f"[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:{seg},asplit[v1][v2];"
                  "[mus][v1]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[baja];"
                  f"[baja][v2]amix=inputs=2:normalize=0,atrim=0:{seg}[out]")
        r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", musica, "-i", a.voz,
                            "-filter_complex", filtro, "-map", "[out]", base], cwd=D, capture_output=True, text=True)
        if r.returncode:
            sys.exit("No se pudo mezclar la voz:\n" + r.stderr[-800:])

    efectos = f"audio/{nombre}.efectos.json"
    json.dump(info["efectos"], open(os.path.join(D, efectos), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    mezcla = f"audio/{nombre}-mezcla.m4a"
    correr("sonido.py", base, efectos, mezcla, "--segundos", str(seg))
    correr("render-reel.py", a.html, "--segundos", str(seg), "--palabras", a.palabras, "--audio", mezcla)
    print(json.dumps({"formato": "3d", "musica": a.musica, "duracion": seg, "voz": a.voz_nombre if a.voz else "sin voz",
                      "archivo": f"salida/{nombre}.mp4"}, ensure_ascii=False))


main()
