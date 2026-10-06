"""Mezcla de sonido de un reel: voz + efectos sintetizados con ffmpeg.

Uso: python3 sonido.py audio/tratto-voz.m4a audio/reel-tratto-voz.efectos.json audio/reel-tratto-voz-mezcla.m4a [--segundos 37.5]

Los efectos se generan acá mismo (sin bancos de sonido ni licencias): latigazo
para los cambios de escena, pop para lo que aparece, golpe grave para el logo,
obturador para la foto, campanita para el precio, tic para los tachados y un
sello. El JSON dice qué efecto va en qué segundo y a qué volumen (dB).
La voz manda: los efectos quedan abajo y la mezcla se normaliza a -14 LUFS,
el nivel de las redes.
"""
import argparse, json, os, subprocess, sys, tempfile

D = os.path.dirname(os.path.abspath(__file__))
SR = 48000
EFECTOS = {
    "latigazo": "anoisesrc=color=pink:d=0.42:a=0.9,bandpass=f=2200:width_type=h:w=3200,afade=t=in:d=0.28:curve=exp,afade=t=out:st=0.28:d=0.14",
    "pop": "aevalsrc='0.9*sin(2*PI*(380+1400*exp(-40*t))*t)*exp(-26*t)':d=0.16",
    "golpe": "aevalsrc='0.95*sin(2*PI*(48+70*exp(-9*t))*t)*exp(-3.2*t)+0.25*sin(2*PI*1760*t)*exp(-6*t)':d=1.4",
    "obturador": "aevalsrc='0.8*(random(0)*2-1)*(exp(-90*t)+exp(-90*(t-0.075))*gte(t,0.075))':d=0.16,highpass=f=1800",
    "campanita": "aevalsrc='0.5*sin(2*PI*1568*t)*exp(-3.5*t)+0.32*sin(2*PI*2352*t)*exp(-4.5*t)+0.18*sin(2*PI*3136*t)*exp(-6*t)':d=1.3",
    "tic": "aevalsrc='0.7*sin(2*PI*2400*t)*exp(-70*t)':d=0.05",
    "sello": "aevalsrc='0.9*sin(2*PI*(90+120*exp(-25*t))*t)*exp(-14*t)+0.5*(random(0)*2-1)*exp(-45*t)':d=0.35",
}


def ff(*args):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[:1500])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("voz"); ap.add_argument("efectos"); ap.add_argument("salida")
    ap.add_argument("--segundos", type=float, default=0)
    a = ap.parse_args()
    cues = json.load(open(os.path.join(D, a.efectos), encoding="utf-8"))
    tmp = tempfile.mkdtemp(prefix="sonido-")
    for nombre, src in EFECTOS.items():
        ff("-f", "lavfi", "-i", src, "-ar", str(SR), "-ac", "2", os.path.join(tmp, nombre + ".wav"))
    entradas, filtros = ["-i", os.path.join(D, a.voz)], ["[0:a]aresample=%d,aformat=channel_layouts=stereo,volume=1.0[v]" % SR]
    for i, c in enumerate(cues, start=1):
        if c["efecto"] not in EFECTOS:
            sys.exit(f"Efecto desconocido: {c['efecto']}")
        entradas += ["-i", os.path.join(tmp, c["efecto"] + ".wav")]
        ms = int(round(c["t"] * 1000))
        filtros.append(f"[{i}:a]volume={c.get('db', -14)}dB,adelay={ms}|{ms}[e{i}]")
    mezcla = "[v]" + "".join(f"[e{i}]" for i in range(1, len(cues) + 1))
    pad = f",apad=whole_dur={a.segundos}" if a.segundos else ""
    filtros.append(f"{mezcla}amix=inputs={len(cues) + 1}:normalize=0:duration=first{pad},"
                   "loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000[out]")
    ff(*entradas, "-filter_complex", ";".join(filtros), "-map", "[out]", "-c:a", "aac", "-b:a", "192k", os.path.join(D, a.salida))
    print("listo:", a.salida)


main()
