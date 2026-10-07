"""Música de fondo propia para las publicidades (sin licencias de terceros).

Uso: python3 musica.py salida.wav --segundos 23 --cierre 19.9 [--bpm 112]

Pop electrónico liviano en La menor (Fa - Do - Sol - Lam): acordes de piano
eléctrico con ritmo 3-3-2, colchón suave, bajo, bombo, palmas y platillos.
El primer compás va sin batería, entra de a poco, y en el cierre (el logo)
corta la batería y queda un acorde grande con un golpe grave que se apaga.
Solo numpy: la síntesis y la reverberación se hacen acá.
"""
import argparse, wave
import numpy as np

SR = 48000


def nota(n):  # número MIDI a Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def env(dur, ataque=.004, caida=3.0):
    t = np.arange(int(dur * SR)) / SR
    return np.minimum(1, t / ataque) * np.exp(-caida * t), t


def piano(f, dur, vol=.18, caida=3.2):
    e, t = env(dur, .003, caida)
    s = sum((1 / k ** 1.4) * np.sin(2 * np.pi * f * k * t + k) * np.exp(-k * .8 * t) for k in range(1, 7))
    return vol * e * s


def colchon(f, dur, vol=.05):
    t = np.arange(int(dur * SR)) / SR
    a = np.minimum(1, t / .5) * np.minimum(1, (dur - t) / .4).clip(0)
    vib = .002 * np.sin(2 * np.pi * 5 * t)
    s = sum(np.sin(2 * np.pi * f * d * (1 + vib) * t) for d in (1, 1.004, .996)) / 3
    s += .3 * np.sin(2 * np.pi * f * 2 * t)
    return vol * a * s


def bajo(f, dur, vol=.30):
    e, t = env(dur, .005, 6)
    s = sum((1 / k ** 2) * np.sin(2 * np.pi * f * k * t) for k in (1, 3, 5))
    return vol * e * np.tanh(1.6 * s)


def bombo(vol=.9):
    d = .45; t = np.arange(int(d * SR)) / SR
    fr = 45 + 95 * np.exp(-30 * t)
    return vol * np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-7 * t)


def ruido_filtrado(dur, bajo_hz, alto_hz, semilla):
    n = int(dur * SR)
    r = np.random.default_rng(semilla).standard_normal(n)
    F = np.fft.rfft(r); fr = np.fft.rfftfreq(n, 1 / SR)
    F[(fr < bajo_hz) | (fr > alto_hz)] = 0
    return np.fft.irfft(F, n) / 3


def palma(vol=.35, semilla=1):
    d = .25; t = np.arange(int(d * SR)) / SR
    r = ruido_filtrado(d, 900, 3500, semilla)
    e = np.exp(-22 * t) + .6 * np.exp(-30 * np.abs(t - .012)) + .4 * np.exp(-30 * np.abs(t - .024))
    return vol * r * e


def platillo(vol=.10, semilla=2):
    d = .09; t = np.arange(int(d * SR)) / SR
    return vol * ruido_filtrado(d, 7000, 16000, semilla) * np.exp(-45 * t)


def poner(pista, s, t0):
    i = int(t0 * SR)
    if i >= len(pista):
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("salida"); ap.add_argument("--segundos", type=float, required=True)
    ap.add_argument("--cierre", type=float, required=True); ap.add_argument("--bpm", type=float, default=112)
    a = ap.parse_args()
    N = int(a.segundos * SR)
    pad, keys, bass, drums = (np.zeros(N) for _ in range(4))
    beat = 60 / a.bpm; compas = 4 * beat
    # Fa, Do, Sol, Lam (notas MIDI del acorde y fundamental del bajo)
    acordes = [([65, 69, 72, 76], 41), ([64, 67, 72, 76], 36), ([62, 67, 71, 74], 43), ([64, 69, 72, 76], 45)]
    ritmo = [0, 1.5, 3]  # 3-3-2 en negras
    bajo_r = [0, .5, 1.5, 2, 2.5, 3, 3.5]
    sc = np.ones(N)  # compresión al ritmo del bombo
    c = 0; t0 = 0.0
    while t0 < a.cierre - .01:
        notas, raiz = acordes[c % 4]
        for n in notas:
            poner(pad, colchon(nota(n - 12), compas + .1), t0)
        for r in ritmo:
            if t0 + r * beat < a.cierre:
                for n in notas:
                    poner(keys, piano(nota(n), 1.2, .13), t0 + r * beat)
        if c >= 1:
            for r in bajo_r:
                if t0 + r * beat < a.cierre:
                    poner(bass, bajo(nota(raiz), .3), t0 + r * beat)
            for b in range(4):
                tb = t0 + b * beat
                if tb < a.cierre:
                    poner(drums, bombo(), tb)
                    i = int(tb * SR); j = min(N, i + int(.25 * SR))
                    sc[i:j] = np.minimum(sc[i:j], .35 + .65 * np.linspace(0, 1, j - i) ** .6)
        if c >= 2:
            for b in (1, 3):
                if t0 + b * beat < a.cierre:
                    poner(drums, palma(semilla=c * 4 + b), t0 + b * beat)
        for h in range(8):
            th = t0 + h * beat / 2
            if th < a.cierre and (c >= 1 or h % 2):
                poner(drums, platillo(.10 if h % 2 else .05, semilla=c * 8 + h), th)
        c += 1; t0 += compas
    # Cierre: acorde grande (La menor con novena) y golpe grave
    for n in [57, 64, 69, 72, 76, 83]:
        poner(keys, piano(nota(n), a.segundos - a.cierre, .12, caida=.9), a.cierre + .1)
        poner(pad, colchon(nota(n - 12), a.segundos - a.cierre, .04), a.cierre + .1)
    poner(bass, bajo(nota(33), 2.5, .35), a.cierre + .1)
    poner(drums, bombo(1.0), a.cierre + .1)
    # La reverberación va solo en los acordes: en la batería deja un siseo parejo
    mezcla = reverb((pad + keys) * sc, mezcla=.16) + bass * (.6 + .4 * sc) + drums
    fin = int((a.segundos - .8) * SR)
    mezcla[fin:] *= np.linspace(1, 0, N - fin)
    mezcla /= np.max(np.abs(mezcla)) * 1.12
    est = np.stack([mezcla, np.roll(mezcla, 18)], axis=1)  # leve apertura estéreo
    with wave.open(a.salida, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((est * 32767).astype("<i2").tobytes())
    print("listo:", a.salida)


main()
