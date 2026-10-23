"""Música de fondo propia para los videos (sin licencias de terceros).

Uso: python3 musica.py salida.wav --segundos 23 --cierre 19.9 [--estilo pop]
         [--bpm N] [--golpes 8.5,14.2]

Hay varios estilos para que los videos no suenen todos iguales (pedido del
fundador del 21/10/2026: probar qué funciona y qué no). Cada uno tiene otra
tonalidad, otro ritmo y otros instrumentos:

  pop       pop electrónico liviano, La menor, 112 bpm (el de los primeros videos)
  lofi      lo-fi tranquilo: piano eléctrico, swing y ruido de vinilo, Do mayor, 82 bpm
  dembow    ritmo de reggaetón, La menor, 96 bpm
  house     house de cuatro tiempos, Mi menor, 124 bpm
  cumbia    güiro, bajo de tónica y quinta y acordeón, Re menor, 94 bpm
  tension   cuenta regresiva para preguntas: tic tac, bajo pulsante y golpes, Mi menor, 120 bpm
  acustico  guitarra punteada, palmas y shaker, Sol mayor, 100 bpm
  silencio  sin música (quedan solo los efectos)

En todos, el primer compás entra liviano y en el cierre (el logo) se corta el
ritmo y queda un acorde que se apaga. --golpes agrega un golpe grave con
platillo en esos segundos (sirve para las revelaciones de un quiz).
Solo numpy: la síntesis, los filtros y la reverberación se hacen acá.
"""
import argparse, wave
import numpy as np

SR = 48000
ESTILOS = ("pop", "lofi", "dembow", "house", "cumbia", "tension", "acustico", "silencio")
BPM = {"pop": 112, "lofi": 82, "dembow": 96, "house": 124, "cumbia": 94, "tension": 120, "acustico": 100, "silencio": 100}


def nota(n):  # número MIDI a Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def tiempo(dur):
    return np.arange(int(dur * SR)) / SR


def env(dur, ataque=.004, caida=3.0):
    t = tiempo(dur)
    return np.minimum(1, t / ataque) * np.exp(-caida * t), t


# ---------- instrumentos ----------

def piano(f, dur, vol=.18, caida=3.2):
    e, t = env(dur, .003, caida)
    s = sum((1 / k ** 1.4) * np.sin(2 * np.pi * f * k * t + k) * np.exp(-k * .8 * t) for k in range(1, 7))
    return vol * e * s


def rhodes(f, dur, vol=.14):
    e, t = env(dur, .004, 1.4)
    trem = 1 + .16 * np.sin(2 * np.pi * 4.5 * t)
    s = np.sin(2 * np.pi * f * t) + .22 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-3 * t) \
        + .10 * np.sin(2 * np.pi * f * 7 * t) * np.exp(-14 * t)
    return vol * e * trem * s


def colchon(f, dur, vol=.05):
    t = tiempo(dur)
    a = np.minimum(1, t / .5) * np.minimum(1, (dur - t) / .4).clip(0)
    vib = .002 * np.sin(2 * np.pi * 5 * t)
    s = sum(np.sin(2 * np.pi * f * d * (1 + vib) * t) for d in (1, 1.004, .996)) / 3
    s += .3 * np.sin(2 * np.pi * f * 2 * t)
    return vol * a * s


def acordeon(f, dur, vol=.06):
    t = tiempo(dur)
    a = np.minimum(1, t / .03) * np.minimum(1, (dur - t) / .06).clip(0)
    vib = 1 + .003 * np.sin(2 * np.pi * 5.5 * t)
    s = sum((1 / k) * (np.sin(2 * np.pi * f * k * vib * t) + np.sin(2 * np.pi * f * 1.006 * k * vib * t)) for k in range(1, 9))
    return vol * a * s / 2


def pluck(f, dur, vol=.25, brillo=.5, semilla=0):
    """Cuerda punteada (Karplus-Strong por bloques de un período)."""
    n, p = int(dur * SR), max(2, int(SR / f))
    buf = np.random.default_rng(semilla).uniform(-1, 1, p)
    buf = brillo * buf + (1 - brillo) * np.convolve(buf, np.ones(4) / 4, "same")
    bloques, decae = [], .996 ** (440 / f)
    for _ in range(n // p + 1):
        bloques.append(buf)
        buf = decae * .5 * (buf + np.roll(buf, -1))
    s = np.concatenate(bloques)[:n]
    return vol * s * np.minimum(1, tiempo(dur) / .002)


def bajo(f, dur, vol=.30):
    e, t = env(dur, .005, 6)
    s = sum((1 / k ** 2) * np.sin(2 * np.pi * f * k * t) for k in (1, 3, 5))
    return vol * e * np.tanh(1.6 * s)


def sub808(f, dur, vol=.45):
    t = tiempo(dur)
    fr = f * (1 + .6 * np.exp(-40 * t))
    e = np.minimum(1, t / .004) * np.exp(-1.6 * t)
    return vol * np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(fr) / SR)) * e


def bombo(vol=.9, grave=45, caida=7):
    t = tiempo(.45)
    fr = grave + 95 * np.exp(-30 * t)
    return vol * np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-caida * t)


def ruido_filtrado(dur, bajo_hz, alto_hz, semilla):
    n = int(dur * SR)
    r = np.random.default_rng(semilla).standard_normal(n)
    F = np.fft.rfft(r); fr = np.fft.rfftfreq(n, 1 / SR)
    F[(fr < bajo_hz) | (fr > alto_hz)] = 0
    return np.fft.irfft(F, n) / 3


def palma(vol=.35, semilla=1):
    t = tiempo(.25)
    r = ruido_filtrado(.25, 900, 3500, semilla)
    e = np.exp(-22 * t) + .6 * np.exp(-30 * np.abs(t - .012)) + .4 * np.exp(-30 * np.abs(t - .024))
    return vol * r * e


def caja(vol=.45, semilla=3, brillo=6000):
    t = tiempo(.22)
    return vol * (1.4 * ruido_filtrado(.22, 1200, brillo, semilla) * np.exp(-20 * t) + .5 * np.sin(2 * np.pi * 190 * t) * np.exp(-30 * t))


def platillo(vol=.10, semilla=2):
    t = tiempo(.09)
    return vol * ruido_filtrado(.09, 7000, 16000, semilla) * np.exp(-45 * t)


def hat_abierto(vol=.07, semilla=4):
    t = tiempo(.32)
    return vol * ruido_filtrado(.32, 6000, 15000, semilla) * np.exp(-9 * t)


def shaker(vol=.04, semilla=6):
    t = tiempo(.07)
    return vol * ruido_filtrado(.07, 4000, 9000, semilla) * np.sin(np.pi * t / .07)


def guiro(dur, vol=.10, semilla=7):
    t = tiempo(dur)
    raspa = .5 + .5 * np.sign(np.sin(2 * np.pi * 38 * t))
    return vol * ruido_filtrado(dur, 2200, 7500, semilla) * raspa * np.exp(-2.5 * t) * np.minimum(1, (dur - t) / .02).clip(0)


def cencerro(vol=.06):
    t = tiempo(.25)
    s = np.sign(np.sin(2 * np.pi * 545 * t)) + np.sign(np.sin(2 * np.pi * 815 * t))
    return vol * s * np.exp(-14 * t)


def tic(f=1900, vol=.12):
    t = tiempo(.05)
    return vol * np.sin(2 * np.pi * f * t) * np.exp(-90 * t)


def crash(vol=.22, semilla=9):
    t = tiempo(1.6)
    return vol * ruido_filtrado(1.6, 3500, 15000, semilla) * np.exp(-3 * t)


def vinilo(N, vol=.03, semilla=8):
    rng = np.random.default_rng(semilla)
    s = rng.standard_normal(N) * .08
    clics = rng.random(N) < 6 / SR
    s[clics] += rng.uniform(-1, 1, clics.sum()) * 6
    return vol * pasa_bajos(s, 3500)


def pasa_bajos(x, fc):
    F = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(F / (1 + (fr / fc) ** 2), len(x))


def poner(pista, s, t0):
    i = int(t0 * SR)
    if i >= len(pista) or i < 0:
        return
    j = min(len(pista), i + len(s))
    pista[i:j] += s[:j - i]


def reverb(x, seg=2.2, mezcla=.22, semilla=5):
    n = int(seg * SR); t = np.arange(n) / SR
    ir = np.random.default_rng(semilla).standard_normal(n) * np.exp(-3.2 * t / seg * 3)
    ir[0] = 0
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)]
    y /= np.max(np.abs(y)) + 1e-9
    return x + mezcla * y * np.max(np.abs(x))


class Pistas:
    """Armonía (va con reverberación), graves, batería y compresión al ritmo del bombo."""

    def __init__(self, N):
        self.N = N
        self.arm, self.graves, self.bat = np.zeros(N), np.zeros(N), np.zeros(N)
        self.sc = np.ones(N)

    def bombeo(self, tb, profundidad=.35, dur=.25):
        i = int(tb * SR); j = min(self.N, i + int(dur * SR))
        if i < j:
            self.sc[i:j] = np.minimum(self.sc[i:j], profundidad + (1 - profundidad) * np.linspace(0, 1, j - i) ** .6)


def compases(cierre, compas):
    c, t0 = 0, 0.0
    while t0 < cierre - .01:
        yield c, t0
        c += 1; t0 += compas


# ---------- estilos ----------

def e_pop(p, seg, cierre, bpm):
    beat = 60 / bpm; compas = 4 * beat
    acordes = [([65, 69, 72, 76], 41), ([64, 67, 72, 76], 36), ([62, 67, 71, 74], 43), ([64, 69, 72, 76], 45)]
    for c, t0 in compases(cierre, compas):
        notas, raiz = acordes[c % 4]
        for n in notas:
            poner(p.arm, colchon(nota(n - 12), compas + .1), t0)
        for r in (0, 1.5, 3):
            if t0 + r * beat < cierre:
                for n in notas:
                    poner(p.arm, piano(nota(n), 1.2, .13), t0 + r * beat)
        if c >= 1:
            for r in (0, .5, 1.5, 2, 2.5, 3, 3.5):
                if t0 + r * beat < cierre:
                    poner(p.graves, bajo(nota(raiz), .3), t0 + r * beat)
            for b in range(4):
                if t0 + b * beat < cierre:
                    poner(p.bat, bombo(), t0 + b * beat); p.bombeo(t0 + b * beat)
        if c >= 2:
            for b in (1, 3):
                if t0 + b * beat < cierre:
                    poner(p.bat, palma(semilla=c * 4 + b), t0 + b * beat)
        for h in range(8):
            th = t0 + h * beat / 2
            if th < cierre and (c >= 1 or h % 2):
                poner(p.bat, platillo(.10 if h % 2 else .05, semilla=c * 8 + h), th)
    for n in [57, 64, 69, 72, 76, 83]:
        poner(p.arm, piano(nota(n), seg - cierre, .12, caida=.9), cierre + .1)
        poner(p.arm, colchon(nota(n - 12), seg - cierre, .04), cierre + .1)
    poner(p.graves, bajo(nota(33), 2.5, .35), cierre + .1)
    poner(p.bat, bombo(1.0), cierre + .1)


def e_lofi(p, seg, cierre, bpm):
    beat = 60 / bpm; compas = 4 * beat; sw = .66  # corchea con swing
    acordes = [([62, 65, 69, 72, 76], 38), ([55, 59, 65, 69, 76], 43), ([60, 64, 67, 71, 74], 36), ([57, 60, 64, 67, 72], 45)]
    for c, t0 in compases(cierre, compas):
        notas, raiz = acordes[c % 4]
        for r, v in ((0, .13), (2 + sw, .09)):
            if t0 + r * beat < cierre:
                for k, n in enumerate(notas):
                    poner(p.arm, rhodes(nota(n), 2.2, v), t0 + r * beat + k * .012)
        if c >= 1:
            for r, n in ((0, raiz), (2 + sw, raiz + 7)):
                if t0 + r * beat < cierre:
                    poner(p.graves, bajo(nota(n), beat * 1.4, .26), t0 + r * beat)
            for r in (0, 2 + sw):
                if t0 + r * beat < cierre:
                    poner(p.bat, bombo(.7, 50, 9), t0 + r * beat)
            for r in (1, 3):
                if t0 + r * beat < cierre:
                    poner(p.bat, caja(.22, semilla=c * 4 + r, brillo=3500), t0 + r * beat)
        for b in range(4):
            for r, v in ((0, .05), (sw, .03)):
                tb = t0 + (b + r) * beat
                if tb < cierre:
                    poner(p.bat, platillo(v, semilla=c * 8 + b * 2 + int(r > 0)), tb)
    for k, n in enumerate([48, 60, 64, 67, 71, 74]):
        poner(p.arm, rhodes(nota(n), seg - cierre, .12), cierre + .1 + k * .03)
    poner(p.graves, bajo(nota(36), 2.5, .3), cierre + .1)
    p.extra = vinilo(p.N)
    p.pasa_bajos = 5200


def e_dembow(p, seg, cierre, bpm):
    beat = 60 / bpm; compas = 4 * beat; s16 = beat / 4
    acordes = [([69, 72, 76], 45), ([65, 69, 72], 41), ([60, 64, 67, 72], 36), ([67, 71, 74], 43)]
    for c, t0 in compases(cierre, compas):
        notas, raiz = acordes[c % 4]
        for n in notas:
            poner(p.arm, colchon(nota(n - 12), compas + .1, .035), t0)
        for k, paso in enumerate((0, 3, 6, 8, 11, 14)):
            tp = t0 + paso * s16
            if tp < cierre:
                poner(p.arm, pluck(nota(notas[k % len(notas)] + 12), .5, .16, .8, semilla=c * 6 + k), tp)
        if c >= 1:
            for paso in (0, 4, 8, 12):
                tp = t0 + paso * s16
                if tp < cierre:
                    poner(p.bat, bombo(.95, 48, 8), tp); p.bombeo(tp, .5, .18)
            for paso in (3, 6, 11, 14):
                tp = t0 + paso * s16
                if tp < cierre:
                    poner(p.bat, caja(.42, semilla=c * 16 + paso, brillo=8000), tp)
            for paso in (0, 8):
                tp = t0 + paso * s16
                if tp < cierre:
                    poner(p.graves, sub808(nota(raiz - 12), beat * 1.9, .42), tp)
        for paso in range(0, 16, 2):
            tp = t0 + paso * s16
            if tp < cierre and (c >= 1 or paso % 4 == 2):
                poner(p.bat, platillo(.07 if paso % 4 else .04, semilla=c * 16 + paso), tp)
    for n in [57, 64, 69, 72, 76]:
        poner(p.arm, colchon(nota(n), seg - cierre, .05), cierre + .1)
        poner(p.arm, pluck(nota(n + 12), 2.0, .14, .7, semilla=n), cierre + .1)
    poner(p.graves, sub808(nota(33), 2.5, .5), cierre + .1)


def e_house(p, seg, cierre, bpm):
    beat = 60 / bpm; compas = 4 * beat
    acordes = [([64, 67, 71, 74], 40), ([60, 64, 67, 72], 36), ([62, 67, 71, 74], 43), ([62, 66, 69, 74], 38)]
    for c, t0 in compases(cierre, compas):
        notas, raiz = acordes[c % 4]
        for n in notas:
            poner(p.arm, colchon(nota(n - 12), compas + .1, .06), t0)
        for r in (.5, 1.5, 2.5, 3.25):
            if t0 + r * beat < cierre:
                for n in notas:
                    poner(p.arm, piano(nota(n), .35, .10, caida=9), t0 + r * beat)
        if c >= 1:
            for b in range(4):
                tb = t0 + b * beat
                if tb < cierre:
                    poner(p.bat, bombo(1.0, 50, 8), tb); p.bombeo(tb, .25, .3)
                    if t0 + (b + .5) * beat < cierre:
                        poner(p.bat, hat_abierto(.07, semilla=c * 4 + b), t0 + (b + .5) * beat)
                        poner(p.graves, bajo(nota(raiz), beat * .4, .3), t0 + (b + .5) * beat)
            for b in (1, 3):
                if t0 + b * beat < cierre:
                    poner(p.bat, palma(.4, semilla=c * 4 + b), t0 + b * beat)
        for h in range(16):
            th = t0 + h * beat / 4
            if th < cierre and c >= 2:
                poner(p.bat, platillo(.035, semilla=c * 16 + h), th)
    for n in [52, 59, 64, 67, 71, 76]:
        poner(p.arm, piano(nota(n), seg - cierre, .11, caida=.8), cierre + .1)
        poner(p.arm, colchon(nota(n - 12), seg - cierre, .04), cierre + .1)
    poner(p.graves, bajo(nota(28), 2.5, .35), cierre + .1)
    poner(p.bat, bombo(1.0), cierre + .1)


def e_cumbia(p, seg, cierre, bpm):
    beat = 60 / bpm; compas = 4 * beat
    acordes = [([62, 65, 69], 38), ([60, 64, 67], 36), ([58, 62, 65], 34), ([57, 61, 64], 33)]
    melodia = [[74, 72, 70, 69], [72, 70, 69, 67], [70, 69, 67, 65], [69, 70, 72, 73]]
    for c, t0 in compases(cierre, compas):
        notas, raiz = acordes[c % 4]
        for b in range(4):
            tb = t0 + b * beat
            if tb < cierre:
                poner(p.bat, guiro(beat * .45, .09, semilla=c * 8 + b), tb)
                poner(p.bat, guiro(beat * .2, .06, semilla=c * 8 + b + 4), tb + beat * .5)
                if tb + beat * .5 < cierre:
                    for n in notas:
                        poner(p.arm, acordeon(nota(n), beat * .32, .045), tb + beat * .5)
        if c >= 1:
            for r, n in ((0, raiz), (2, raiz + 7), (3.5, raiz + 12)):
                if t0 + r * beat < cierre:
                    poner(p.graves, bajo(nota(n), beat * .9, .3), t0 + r * beat)
            for r in (0, 2):
                if t0 + r * beat < cierre:
                    poner(p.bat, bombo(.55, 60, 10), t0 + r * beat)
                    poner(p.bat, cencerro(.05), t0 + r * beat)
            for r in (1.5, 3.5):
                if t0 + r * beat < cierre:
                    poner(p.bat, bombo(.45, 120, 12), t0 + r * beat)
        if c >= 2:
            for k, n in enumerate(melodia[c % 4]):
                if t0 + k * beat < cierre:
                    poner(p.arm, acordeon(nota(n), beat * .85, .05), t0 + k * beat)
    for n in [50, 62, 65, 69, 74]:
        poner(p.arm, acordeon(nota(n), seg - cierre - .2, .05), cierre + .1)
    poner(p.graves, bajo(nota(26), 2.5, .35), cierre + .1)
    poner(p.bat, bombo(.9), cierre + .1)


def e_tension(p, seg, cierre, bpm):
    beat = 60 / bpm; compas = 4 * beat
    for n in (40, 47, 52):
        poner(p.arm, colchon(nota(n), cierre + .2, .05), 0)
    sube = np.linspace(.55, 1.0, p.N)
    for c, t0 in compases(cierre, compas):
        for b in range(4):
            tb = t0 + b * beat
            if tb < cierre:
                poner(p.bat, tic(1900 if b % 2 == 0 else 1300, .14), tb)
                if c >= 1:
                    for r in (0, .5):
                        poner(p.graves, bajo(nota(28), beat * .45, .28), tb + r * beat)
        if c >= 1 and c % 2 == 1:
            poner(p.bat, bombo(.8, 40, 5), t0)
    p.graves *= sube
    for n in [40, 52, 55, 59, 64]:
        poner(p.arm, colchon(nota(n), seg - cierre, .05), cierre + .1)
        poner(p.arm, piano(nota(n + 12), seg - cierre, .09, caida=1.2), cierre + .1)
    poner(p.bat, bombo(1.0, 40, 3.5), cierre + .1)


def e_acustico(p, seg, cierre, bpm):
    beat = 60 / bpm; compas = 4 * beat
    acordes = [([43, 47, 50, 55, 59, 67], 31), ([50, 54, 57, 62, 66, 69], 38), ([40, 47, 52, 55, 59, 64], 28), ([48, 52, 55, 60, 64, 67], 36)]
    patron = [0, 3, 4, 5, 2, 4, 3, 5]
    for c, t0 in compases(cierre, compas):
        notas, raiz = acordes[c % 4]
        for k, i in enumerate(patron):
            tp = t0 + k * beat / 2
            if tp < cierre:
                poner(p.arm, pluck(nota(notas[i]), 1.6, .20, .55, semilla=c * 8 + k), tp)
        if c >= 1:
            for r in (0, 2):
                if t0 + r * beat < cierre:
                    poner(p.graves, pluck(nota(raiz + 12), 1.2, .30, .3, semilla=c + r), t0 + r * beat)
            for r in (1, 3):
                if t0 + r * beat < cierre:
                    poner(p.bat, palma(.3, semilla=c * 4 + r), t0 + r * beat)
            for h in range(8):
                th = t0 + h * beat / 2
                if th < cierre:
                    poner(p.bat, shaker(.05 if h % 2 else .03, semilla=c * 8 + h), th)
    for k, n in enumerate([43, 47, 50, 55, 59, 67]):
        poner(p.arm, pluck(nota(n), seg - cierre, .2, .5, semilla=100 + k), cierre + .1 + k * .03)
    poner(p.graves, pluck(nota(43), 2.5, .3, .3, semilla=99), cierre + .1)


def e_silencio(p, seg, cierre, bpm):
    pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("salida"); ap.add_argument("--segundos", type=float, required=True)
    ap.add_argument("--cierre", type=float, required=True)
    ap.add_argument("--estilo", choices=ESTILOS, default="pop")
    ap.add_argument("--bpm", type=float)
    ap.add_argument("--golpes", default="", help="segundos separados por coma")
    a = ap.parse_args()
    N = int(a.segundos * SR)
    p = Pistas(N)
    p.extra, p.pasa_bajos = None, None
    globals()["e_" + a.estilo](p, a.segundos, a.cierre, a.bpm or BPM[a.estilo])
    for g in [float(x) for x in a.golpes.split(",") if x.strip()]:
        poner(p.bat, bombo(1.0, 42, 4), g); poner(p.bat, crash(), g)
        poner(p.graves, bajo(nota(28), 1.2, .3), g)
    # La reverberación va solo en la armonía: en la batería deja un siseo parejo
    arm = p.arm * p.sc
    mezcla = (reverb(arm, mezcla=.16) if np.any(arm) else arm) + p.graves * (.6 + .4 * p.sc) + p.bat
    if p.pasa_bajos:
        mezcla = pasa_bajos(mezcla, p.pasa_bajos)
    if p.extra is not None:
        mezcla += p.extra * (np.max(np.abs(mezcla)) + 1e-9)
    fin = int((a.segundos - .8) * SR)
    mezcla[fin:] *= np.linspace(1, 0, N - fin)
    pico = np.max(np.abs(mezcla))
    if pico > 0:
        mezcla /= pico * 1.12
    est = np.stack([mezcla, np.roll(mezcla, 18)], axis=1)  # leve apertura estéreo
    with wave.open(a.salida, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((est * 32767).astype("<i2").tobytes())
    print("listo:", a.salida, "·", a.estilo)


main()
