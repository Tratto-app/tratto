"""Exporta cada placa (<section class="placa">) de un carrusel a PNG 1080x1350.

    python3 render-carrusel.py precios-oct.html carrusel-precios-oct
    python3 render-carrusel.py precios-oct.html carrusel-precios-oct --solo 1,8 --salida /tmp/previa

Por defecto deja <prefijo>-01.png ... <prefijo>-NN.png en redes/ (la carpeta
pública: https://www.trattoapp.com.ar/redes/<archivo>) y una copia .jpg de
cada una (Instagram publica imágenes en JPG cuando se programa por API).
"""
import argparse, asyncio, os
from playwright.async_api import async_playwright
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
REDES = os.path.normpath(os.path.join(D, '..', '..', '..', 'redes'))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('prefijo')
    ap.add_argument('--salida', default=REDES)
    ap.add_argument('--solo', default='', help='números de placa separados por coma (1 = la primera)')
    ap.add_argument('--sin-jpg', action='store_true')
    a = ap.parse_args()
    solo = {int(x) for x in a.solo.split(',') if x.strip()}
    os.makedirs(a.salida, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                                    proxy={"server": os.environ["HTTPS_PROXY"]} if os.environ.get("HTTPS_PROXY") else None,
                                    args=["--disable-background-networking"])
        ctx = await b.new_context(viewport={"width": 1200, "height": 1500}, device_scale_factor=1, ignore_https_errors=True)
        pg = await ctx.new_page()
        await pg.goto(f"file://{os.path.join(D, a.html)}", wait_until="networkidle")
        await pg.evaluate("document.fonts.ready")
        await pg.wait_for_timeout(400)
        fuentes = await pg.evaluate("[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight))]")
        print('fuentes:', ', '.join(sorted(fuentes)))
        placas = pg.locator('section.placa')
        n = await placas.count()
        for i in range(n):
            if solo and (i + 1) not in solo:
                continue
            ruta = os.path.join(a.salida, f"{a.prefijo}-{i + 1:02d}.png")
            await placas.nth(i).screenshot(path=ruta)
            im = Image.open(ruta)
            assert im.size == (1080, 1350), (ruta, im.size)
            if not a.sin_jpg:
                im.convert('RGB').save(ruta[:-4] + '.jpg', quality=92, optimize=True, progressive=True)
            print(ruta, im.size)
        await b.close()

asyncio.run(main())
