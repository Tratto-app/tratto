# Uso: npm run build && python3 tools/archivo-unico.py dist once-y-seis-muestra.html
# Arma un solo archivo HTML con todo adentro (estilos, tipografías y fotos)
# para mandarle la muestra al cliente por WhatsApp o mail.
import base64, re, sys, pathlib
dist = pathlib.Path(sys.argv[1]); salida = pathlib.Path(sys.argv[2])
html = (dist / 'index.html').read_text(encoding='utf-8')
TIPOS = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}

def data_uri(ruta):
    p = dist / ruta.lstrip('/')
    return f'data:{TIPOS[p.suffix]};base64,' + base64.b64encode(p.read_bytes()).decode()

# Estilos y tipografías
def css_inline(m):
    css = (dist / m.group(1).lstrip('/')).read_text(encoding='utf-8')
    css = re.sub(r'url\((/fuentes/[^)]+)\)', lambda f: f'url({data_uri(f.group(1))})', css)
    return f'<style>{css}</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_inline, html)
html = re.sub(r'url\((/fuentes/[^)"]+)\)', lambda f: f'url({data_uri(f.group(1))})', html)
html = re.sub(r'<link rel="preload"[^>]*>', '', html)
html = re.sub(r'<link rel="(?:icon|apple-touch-icon|sitemap|canonical)"[^>]*>', '', html)
html = html.replace('<head>', f'<head><link rel="icon" href="{data_uri("/favicon.svg")}">', 1)

# Scripts que Astro deja en archivos aparte
def js_inline(m):
    js = (dist / m.group(1).lstrip('/')).read_text(encoding='utf-8')
    return f'<script type="module">{js}</script>'
html = re.sub(r'<script type="module" src="([^"]+)"></script>', js_inline, html)

# Fotos: de cada srcset se elige una sola medida, suficiente para celular y compu
def elegir(srcset, objetivo):
    opciones = sorted((int(a.rstrip('w')), u) for u, a in (p.strip().rsplit(' ', 1) for p in srcset.split(',')))
    for ancho, url in opciones:
        if ancho >= objetivo: return url
    return opciones[-1][1]

def img_inline(m):
    tag = m.group(0)
    srcset = re.search(r'srcset="([^"]+)"', tag)
    if 'fetchpriority="high"' in tag: objetivo = 960
    elif 'sizes="112px"' in tag: objetivo = 224
    else: objetivo = 600
    url = elegir(srcset.group(1), objetivo) if srcset else re.search(r'src="([^"]+)"', tag).group(1)
    tag = re.sub(r'\s(srcset|sizes)="[^"]*"', '', tag)
    return re.sub(r'src="[^"]*"', f'src="{data_uri(url)}"', tag, count=1)
html = re.sub(r'<img [^>]*src="/_astro/[^"]*"[^>]*>', img_inline, html)

assert '"/_astro/' not in html and "'/_astro/" not in html, 'quedó algún archivo sin incluir'
salida.write_text(html, encoding='utf-8')
print(f'{salida.name}: {salida.stat().st_size/1e6:.1f} MB')
