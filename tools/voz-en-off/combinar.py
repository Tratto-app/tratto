"""Prueba combinaciones de tomas que ya pasaron, sin regenerar la voz.

clonar.py deja en --trabajo la toma que pasó de cada frase (tramoN.json y
tramoN.wav), pero se pisa cuando cambia el texto de esa frase. Copialas a un
banco con el nombre <n>-<algo>.json/.wav (n = número de frase, desde 0) y
probá combinaciones: simula el pegado final de clonar.py (mismo recorte,
volumen, compresor y loudnorm) y dice si el tono queda parejo, cómo da GANAS
y el ritmo aproximado (el real, con el oído, sale unos 0,15 más bajo).

  python3 combinar.py <banco> 0-sentis 1-vecino 2-perro 3-tutorial 4-precio 5-cierre

La combinación que pase se usa copiando esas tomas a --trabajo como tramoN y
corriendo clonar.py con el guion de esas frases: no regenera nada y hace todos
los controles de verdad, oído incluido. Los controles no se aflojan.
"""
import sys, os, json, tempfile
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
os.chdir(AQUI)
src = open('clonar.py').read().split('\ndef main')[0]
g = {'__name__': 'clonar_eval', '__file__': os.path.join(AQUI, 'clonar.py')}
exec(compile(src, 'clonar.py', 'exec'), g)
import numpy as np, soundfile as sf
banco, claves = os.path.abspath(sys.argv[1]), sys.argv[2:]
ms = []
for c in claves:
    j = json.load(open(f'{banco}/{c}.json')); x, sr = sf.read(f'{banco}/{c}.wav', dtype='float32')
    ms.append((j, x, sr))
tonos = [j['f0'] for j, _, _ in ms if j.get('f0')]
med = float(np.median(tonos))
pareja = [(j['texto'][:28], round(j['f0']), round(abs(j['f0'] - med) / med * 100, 1)) for j, _, _ in ms]
trozos, pal, habla = [], 0, 0.0
for k, (j, x, sr) in enumerate(ms):
    y, corrido = g['recorte'](x, sr, j['ini'] - g['COLCHON'], j['fin'] - g['COLCHON'])
    paso = int(0.01 * sr); marcos = [y[i:i + paso] for i in range(0, len(y) - paso, paso)]
    fuertes = [f for f in marcos if g['db'](f) > max(g['db'](f2) for f2 in marcos) - 30]
    y = y * 10 ** ((-20 - g['db'](np.concatenate(fuertes))) / 20)
    if trozos: trozos.append(np.zeros(int(g['ENTRE_TRAMOS'] * sr), dtype=np.float32)); habla += g['ENTRE_TRAMOS']
    trozos.append(y.astype(np.float32)); habla += len(y) / sr; pal += len(j['texto'].split())
d = tempfile.mkdtemp()
sf.write(f'{d}/pegada.wav', np.concatenate(trozos), sr)
g['ff']('-i', f'{d}/pegada.wav', '-af', g['TERMINAR'], '-ac', '1', '-ar', str(g['SR']), f'{d}/terminada.wav')
med_ln = g['ff']('-i', f'{d}/terminada.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-', nivel='info')
jl = json.loads(med_ln[med_ln.rindex('{'):])
ln = ('loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true'
      % (jl['input_i'], jl['input_tp'], jl['input_lra'], jl['input_thresh'], jl['target_offset']))
g['ff']('-i', f'{d}/terminada.wav', '-af', ln + ',alimiter=limit=0.84:attack=2:release=40:level=false', '-ar', str(g['SR']), '-c:a', 'pcm_s24le', f'{d}/final.wav')
v = g['vida'](g['leer'](f'{d}/final.wav', 16000))
v['ritmo_aprox'] = pal / habla
falla_tono = [p for p in pareja if p[2] > 15]
mins = {k: val for k, val in g['GANAS'].items()}
flojas = {k: (round(v[k], 2), mins[k]) for k in mins if k in v and v[k] < mins[k]}
print(json.dumps({'mediana': round(med), 'pareja': pareja, 'falla_tono': falla_tono,
                  'ganas': {k: round(x, 2) for k, x in v.items()}, 'flojas': flojas}, ensure_ascii=False))
