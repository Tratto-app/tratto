"""Inicia sesión con los usuarios de prueba de STAGING y guarda sus tokens.

Uso: python3 login.py <dir_datos> <cantidad_clientes> <cantidad_proveedores>
Lee URL/ANON de <dir_datos>/.env y la contraseña de <dir_datos>/.pass.
Escribe <dir_datos>/.tokens.json. Nunca apuntar esto a producción.
"""
import asyncio, json, sys, time, pathlib
import aiohttp

d = pathlib.Path(sys.argv[1])
env = dict(l.split('=', 1) for l in (d / '.env').read_text().split() if '=' in l)
URL, ANON = env['URL'], env['ANON']
assert 'qglsonbcsncgekzbfafk' not in URL, 'esto es solo para staging'
PASS = (d / '.pass').read_text().strip()
nc, np_ = int(sys.argv[2]), int(sys.argv[3])
usuarios = [(n, 'cliente') for n in range(1, nc + 1)] + [(n, 'proveedor') for n in range(2001, 2001 + np_)]

async def uno(s, sem, n, rol, out):
    async with sem:
        for intento in range(8):
            async with s.post(f'{URL}/auth/v1/token?grant_type=password',
                              headers={'apikey': ANON, 'content-type': 'application/json'},
                              json={'email': f'carga{n}@staging.trattoapp.test', 'password': PASS}) as r:
                if r.status == 200:
                    j = await r.json()
                    out.append({'n': n, 'rol': rol, 'uid': j['user']['id'], 'token': j['access_token'],
                                'refresh': j['refresh_token'], 'vence': j['expires_at']})
                    return
                if r.status == 429:
                    await asyncio.sleep(2 ** intento)
                    continue
                print('falla', n, r.status, (await r.text())[:120]); return
        print('sin suerte', n)

async def main():
    out, sem = [], asyncio.Semaphore(4)
    t = time.time()
    async with aiohttp.ClientSession(trust_env=True) as s:
        await asyncio.gather(*(uno(s, sem, n, rol, out) for n, rol in usuarios))
    (d / '.tokens.json').write_text(json.dumps(out))
    print(f'{len(out)}/{len(usuarios)} sesiones en {time.time()-t:.0f}s')

asyncio.run(main())
