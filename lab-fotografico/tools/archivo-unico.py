# Uso: npm run build && python3 tools/archivo-unico.py dist laboratorio-fotografico-muestra.html
# Arma un solo archivo HTML con todo adentro (estilos, tipografías y fotos)
# para mandarle la muestra al cliente por WhatsApp o mail.
import base64, re, sys, pathlib, mimetypes
dist = pathlib.Path(sys.argv[1]); salida = pathlib.Path(sys.argv[2])
html = (dist / 'index.html').read_text(encoding='utf-8')

def data_uri(ruta):
    p = dist / ruta.lstrip('/')
    tipo = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}[p.suffix]
    return f'data:{tipo};base64,' + base64.b64encode(p.read_bytes()).decode()

# Estilos y tipografías
def css_inline(m):
    css = (dist / m.group(1).lstrip('/')).read_text(encoding='utf-8')
    css = re.sub(r'url\((/fuentes/[^)]+)\)', lambda f: f'url({data_uri(f.group(1))})', css)
    return f'<style>{css}</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_inline, html)
html = re.sub(r'<link rel="preload"[^>]*>', '', html)
html = re.sub(r'<link rel="(?:icon|apple-touch-icon|sitemap|canonical)"[^>]*>', '', html)
html = html.replace('<head>', f'<head><link rel="icon" href="{data_uri("/favicon.svg")}">', 1)

# Fotos: de cada srcset se elige una sola medida, suficiente para celular y compu
def elegir(srcset, objetivo):
    opciones = []
    for parte in srcset.split(','):
        url, ancho = parte.strip().rsplit(' ', 1)
        opciones.append((int(ancho.rstrip('w')), url))
    opciones.sort()
    for ancho, url in opciones:
        if ancho >= objetivo: return url
    return opciones[-1][1]

def img_inline(m):
    tag = m.group(0)
    srcset = re.search(r'srcset="([^"]+)"', tag)
    clase = re.search(r'class="([^"]*)"', tag)
    objetivo = 1280 if (clase and ('capa' in clase.group(1))) or 'fetchpriority="high"' in tag else 720
    if 'sizes="(min-width: 1280px) 290px' in tag or '46vw"' in tag and 'galeria' in tag: objetivo = 480
    url = elegir(srcset.group(1), objetivo) if srcset else re.search(r'src="([^"]+)"', tag).group(1)
    tag = re.sub(r'\s(srcset|sizes)="[^"]*"', '', tag)
    tag = re.sub(r'src="[^"]*"', f'src="{data_uri(url)}"', tag, count=1)
    return tag
html = re.sub(r'<img [^>]*src="/_astro/[^"]*"[^>]*>', img_inline, html)
def grande_chica(ruta):
    # La foto ampliada de la galería, achicada a 1100 px para que el archivo pese menos
    import io
    from PIL import Image
    im = Image.open(dist / ruta.lstrip('/'))
    if im.width > 1100: im = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=72)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
html = re.sub(r'data-grande="(/_astro/[^"]+)"', lambda m: f'data-grande="{grande_chica(m.group(1))}"', html)

assert '/_astro/' not in html.replace('https://lab-fotografico.vercel.app/_astro/', ''), 'quedó algún archivo sin incluir'
salida.write_text(html, encoding='utf-8')
print(f'{salida.name}: {salida.stat().st_size/1e6:.1f} MB')
