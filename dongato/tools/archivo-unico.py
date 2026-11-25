#!/usr/bin/env python3
"""Arma dongato-muestra.html: la misma página con el logo y las fotos adentro
(como data URI), para mandarla por WhatsApp o mail y abrirla con doble clic.

Uso:  python3 dongato/tools/archivo-unico.py
"""
import base64, mimetypes, pathlib, re, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
html = (RAIZ / 'index.html').read_text(encoding='utf-8')

def data_uri(ruta):
    archivo = RAIZ / ruta
    tipo = mimetypes.guess_type(archivo.name)[0] or ('image/webp' if archivo.suffix == '.webp' else 'application/octet-stream')
    return f'data:{tipo};base64,' + base64.b64encode(archivo.read_bytes()).decode()

usadas = set()
def reemplazar(m):
    ruta = m.group(2)
    if not (RAIZ / ruta).exists():
        sys.exit(f'Falta el archivo {ruta}')
    usadas.add(ruta)
    return m.group(1) + data_uri(ruta) + m.group(3)

# atributos src/href y strings de JS ('fotos/x.webp')
html = re.sub(r'''((?:src|href)=")((?:fotos/[\w.-]+\.webp)|logo\.png|favicon\.png|apple-touch-icon\.png)(")''', reemplazar, html)
html = re.sub(r"""(foto: ')(fotos/[\w.-]+\.webp)(')""", reemplazar, html)

quedan = re.findall(r'''["'](fotos/[\w.-]+\.webp|logo\.png)["']''', html)
if quedan:
    sys.exit('Quedaron rutas sin incrustar: ' + ', '.join(sorted(set(quedan))))

salida = RAIZ / 'dongato-muestra.html'
salida.write_text(html, encoding='utf-8')
print(f'{salida.name}: {salida.stat().st_size / 1024 / 1024:.2f} MB, {len(usadas)} imágenes adentro')
