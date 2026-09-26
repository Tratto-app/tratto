"""Prueba de carga de Tratto contra STAGING, imitando lo que hace la app.

Cada usuario virtual (VU) es una sesión real distinta y repite lo que hace la
web (index.html):
  * Al entrar: sus pedidos, sus servicios y sus conexiones (matches con los
    datos de proveedor y pedido embebidos).
  * Latido cada 12 s (mirarSiHayNovedades): sus pedidos + sus servicios; si es
    proveedor y está en el Panel, además el feed pedidos_abiertos.
  * El 30 % está con un chat abierto: sondeo cada 6 s de mensajes nuevos y de
    presupuestos pendientes (arrancarSondeo), y cada ~60 s manda un mensaje.
  * Cada ~5 min abre el Panel de estadísticas (visitas, matches, presupuestos).

Uso: python3 carga.py <dir_datos> <VUs> <duracion_s> <rampa_s> <salida.json>
Variable opcional CONEXIONES=N: reusar como máximo N conexiones HTTP entre
todos los VUs (por defecto, una por pedido en curso, como navegadores distintos).
"""
import asyncio, json, os, random, sys, time, pathlib, statistics
import aiohttp

d = pathlib.Path(sys.argv[1])
env = dict(l.split('=', 1) for l in (d / '.env').read_text().split() if '=' in l)
URL, ANON = env['URL'], env['ANON']
assert 'qglsonbcsncgekzbfafk' not in URL, 'esto es solo para staging'
VUS, DUR, RAMPA, SALIDA = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
SESIONES = json.loads((d / '.tokens.json').read_text())
random.Random(7).shuffle(SESIONES)   # mezcla clientes y proveedores (60/40)
EMB = ('select=id,estado,proveedores(nombre,zona,rubro,descripcion,precio_desde,precio_hasta,disponibilidad),'
       'solicitudes(user_id,nombre_cliente,servicio_necesitado,zona,presupuesto,urgencia,descripcion)&order=created_at.desc')

med = []            # (t_rel, nombre, ms, status)
T0 = None
fin = None

async def pedir(s, ses, nombre, ruta, metodo='GET', cuerpo=None):
    h = {'apikey': ANON, 'Authorization': 'Bearer ' + ses['token'], 'content-type': 'application/json'}
    if metodo == 'POST':
        h['Prefer'] = 'return=representation'
    t = time.perf_counter()
    st = 0
    try:
        async with s.request(metodo, f'{URL}/rest/v1/{ruta}', headers=h, json=cuerpo,
                             timeout=aiohttp.ClientTimeout(total=30)) as r:
            datos = await r.read()
            st = r.status
    except Exception as e:
        datos = b''
        st = -1 if isinstance(e, asyncio.TimeoutError) else -2
    ms = (time.perf_counter() - t) * 1000
    med.append((time.time() - T0, nombre, ms, st))
    if 200 <= st < 300 and datos:
        try: return json.loads(datos)
        except Exception: return None
    return None

async def vu(s, i):
    ses = SESIONES[i % len(SESIONES)]
    await asyncio.sleep(RAMPA * i / max(VUS, 1))
    uid, prov = ses['uid'], ses['rol'] == 'proveedor'
    en_chat = random.random() < 0.30
    en_panel = prov and random.random() < 0.5
    sel_sol = 'select=id,created_at,nombre_cliente,servicio_necesitado,zona,presupuesto,urgencia,descripcion,estado,user_id,foto_url,cupo&order=created_at.desc'
    # entrada
    peds = await pedir(s, ses, 'mis_pedidos', f'solicitudes?user_id=eq.{uid}&{sel_sol}') or []
    servs = await pedir(s, ses, 'mis_servicios', f'proveedores?user_id=eq.{uid}&order=created_at.desc') or []
    cons = []
    if peds:
        cons += await pedir(s, ses, 'conexiones', 'matches?solicitud_id=in.(' + ','.join(str(p['id']) for p in peds) + ')&' + EMB) or []
    if servs:
        cons += await pedir(s, ses, 'conexiones', 'matches?proveedor_id=in.(' + ','.join(str(p['id']) for p in servs) + ')&' + EMB) or []
    chat, ultimo, presus = None, 0, []
    if en_chat and cons:
        chat = random.choice(cons)['id']
        msgs = await pedir(s, ses, 'abrir_chat', f'mensajes?match_id=eq.{chat}&order=created_at.asc') or []
        if msgs:
            ultimo = max(m['id'] for m in msgs)
            presus = [m['id'] for m in msgs if m.get('tipo') == 'presupuesto']
    prox_latido = time.time() + random.uniform(0, 12)
    prox_sondeo = time.time() + random.uniform(0, 6)
    prox_msg = time.time() + random.uniform(20, 90)
    prox_panel = time.time() + random.uniform(30, 300)
    while time.time() < fin:
        ahora = time.time()
        if chat is None and ahora >= prox_latido:        # en el chat el latido no corre
            prox_latido = ahora + 12
            await pedir(s, ses, 'latido_pedidos', f'solicitudes?user_id=eq.{uid}&{sel_sol}')
            await pedir(s, ses, 'latido_servicios', f'proveedores?user_id=eq.{uid}&order=created_at.desc')
            if en_panel:
                await pedir(s, ses, 'feed_pedidos_abiertos', 'pedidos_abiertos?order=created_at.desc&limit=20')
        if chat is not None and ahora >= prox_sondeo:
            prox_sondeo = ahora + 6
            nuevos = await pedir(s, ses, 'sondeo_chat', f'mensajes?match_id=eq.{chat}&id=gt.{ultimo}&order=created_at.asc') or []
            if nuevos: ultimo = max(m['id'] for m in nuevos)
            if presus:
                await pedir(s, ses, 'sondeo_presupuestos', 'mensajes?id=in.(' + ','.join(map(str, presus)) + ')&tipo=eq.presupuesto')
        if chat is not None and ahora >= prox_msg:
            prox_msg = ahora + random.uniform(45, 90)
            await pedir(s, ses, 'enviar_mensaje', 'mensajes', 'POST',
                        {'match_id': chat, 'contenido': 'mensaje de carga', 'tipo': 'texto'})
        if prov and ahora >= prox_panel:
            prox_panel = ahora + 300
            await pedir(s, ses, 'panel_visitas', f'visitas_perfil?perfil_user_id=eq.{uid}&select=id')
            if servs:
                ms = await pedir(s, ses, 'panel_matches', 'matches?proveedor_id=in.(' + ','.join(str(p['id']) for p in servs) + ')&select=id') or []
                if ms:
                    await pedir(s, ses, 'panel_presupuestos', 'mensajes?match_id=in.(' + ','.join(str(m['id']) for m in ms) + ')&tipo=eq.presupuesto&select=id,estado_presupuesto,pago_estado,monto')
        await asyncio.sleep(0.25)

def pct(v, p):
    v = sorted(v)
    return round(v[min(len(v) - 1, int(len(v) * p / 100))], 1) if v else None

def resumir(filas):
    ms = [m for _, _, m, _ in filas]
    err = [f for f in filas if not (200 <= f[3] < 300)]
    return {'n': len(filas), 'p50': pct(ms, 50), 'p95': pct(ms, 95), 'p99': pct(ms, 99),
            'max': round(max(ms), 1) if ms else None, 'errores': len(err),
            'tasa_error_%': round(100 * len(err) / len(filas), 2) if filas else None}

async def main():
    global T0, fin
    T0 = time.time()
    fin = T0 + RAMPA + DUR
    con = aiohttp.TCPConnector(limit=int(os.environ.get('CONEXIONES', '0')), ttl_dns_cache=300)
    async with aiohttp.ClientSession(connector=con, trust_env=True) as s:
        await asyncio.gather(*(vu(s, i) for i in range(VUS)))
    estable = [f for f in med if f[0] >= RAMPA]      # solo la meseta, sin la rampa
    por = {}
    for f in estable: por.setdefault(f[1], []).append(f)
    codigos = {}
    for f in estable: codigos[str(f[3])] = codigos.get(str(f[3]), 0) + 1
    res = {'vus': VUS, 'duracion_meseta_s': DUR, 'rampa_s': RAMPA,
           'req_por_s': round(len(estable) / DUR, 1), 'total': resumir(estable),
           'por_operacion': {k: resumir(v) for k, v in sorted(por.items())}, 'codigos': codigos,
           'serie_10s': [dict(t=int(b * 10), **resumir([f for f in med if int(f[0] // 10) == b]))
                         for b in range(int((RAMPA + DUR) // 10) + 1)]}
    pathlib.Path(SALIDA).write_text(json.dumps(res, indent=1, ensure_ascii=False))
    t = res['total']
    print(f"VUs={VUS} req/s={res['req_por_s']} p50={t['p50']} p95={t['p95']} p99={t['p99']} max={t['max']} errores={t['tasa_error_%']}% codigos={codigos}")

asyncio.run(main())
