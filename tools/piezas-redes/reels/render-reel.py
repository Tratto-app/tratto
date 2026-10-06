"""Renderiza un reel animado (HTML con window.render(t)) a MP4 1080×1920.

Uso: python3 render-reel.py reel-pintura.html [--segundos 33] [--fps 30]
Salida: salida/<nombre>.mp4 (H.264, sin audio: el sonido se agrega al subirlo
en TikTok o Instagram) y salida/<nombre>-portada.jpg (primer cuadro).

Cada cuadro se dibuja con render(t) y se captura con Playwright, así el
video sale igual siempre, sin depender de la velocidad de la máquina.
"""
import argparse, asyncio, os, subprocess, sys
from playwright.async_api import async_playwright

D = os.path.dirname(os.path.abspath(__file__))
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--segundos", type=float, default=33)
    ap.add_argument("--fps", type=int, default=30)
    a = ap.parse_args()
    html = os.path.abspath(os.path.join(D, a.html))
    nombre = os.path.splitext(os.path.basename(html))[0]
    os.makedirs(os.path.join(D, "salida"), exist_ok=True)
    mp4 = os.path.join(D, "salida", nombre + ".mp4")
    portada = os.path.join(D, "salida", nombre + "-portada.jpg")
    cuadros = int(round(a.segundos * a.fps))

    ffmpeg = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(a.fps),
         "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-r", str(a.fps), "-movflags", "+faststart", mp4],
        stdin=subprocess.PIPE)

    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--disable-background-networking"]}
        if os.environ.get("HTTPS_PROXY"):
            kw["proxy"] = {"server": os.environ["HTTPS_PROXY"]}
        b = await p.chromium.launch(**kw)
        pg = await (await b.new_context(viewport={"width": 1080, "height": 1920}, ignore_https_errors=True)).new_page()
        await pg.goto("file://" + html, wait_until="networkidle")
        await pg.evaluate("document.fonts.ready")
        fuentes = await pg.evaluate("[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))]")
        print("fuentes:", fuentes)
        if not any("Plex" in f for f in fuentes):
            sys.exit("No cargaron las fuentes IBM Plex: revisar la conexión a Google Fonts")
        for i in range(cuadros):
            await pg.evaluate(f"render({i / a.fps})")
            jpg = await pg.screenshot(type="jpeg", quality=95)
            if i == 0:
                open(portada, "wb").write(jpg)
            ffmpeg.stdin.write(jpg)
            if i % (a.fps * 5) == 0:
                print(f"{i / a.fps:.0f} s")
        await b.close()
    ffmpeg.stdin.close()
    if ffmpeg.wait():
        sys.exit("ffmpeg falló")
    print("listo:", mp4)


asyncio.run(main())
