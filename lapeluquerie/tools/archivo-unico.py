#!/usr/bin/env python3
"""
Arma lapeluquerie-cliente.html: un solo archivo con todo adentro
(CSS, JS, fotos y tipografías como data URI) para mandar por mail o
WhatsApp. Se abre con doble clic, sin servidor.

    python3 tools/archivo-unico.py

Dos cosas que hay que respetar y que no son obvias:

1. `srcset` NO admite data URIs. El atributo separa candidatos con comas
   y `data:image/webp;base64,` tiene una coma adentro, así que el
   navegador parte la URL al medio y la imagen no carga nunca, sin
   tirar ningún error. Por eso acá se elimina srcset/sizes y queda
   sólo el src.

2. El sitio servido usa módulos ES; el archivo único no puede, porque
   `import` no funciona sobre file://. Se concatenan datos.js y app.js
   en un script clásico.
"""
import base64, mimetypes, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'lapeluquerie-cliente.html')


def data_uri(ruta):
    mime = mimetypes.guess_type(ruta)[0] or 'application/octet-stream'
    with open(ruta, 'rb') as f:
        return f'data:{mime};base64,{base64.b64encode(f.read()).decode()}'


def leer(rel):
    with open(os.path.join(RAIZ, rel), encoding='utf-8') as f:
        return f.read()


def construir():
    html = leer('index.html')

    for href in re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">', html):
        html = html.replace(f'<link rel="stylesheet" href="{href}">',
                            f'<style>{leer(href)}</style>')

    fuentes = re.sub(r'url\(fuentes/([^)]+)\)',
                     lambda m: f'url({data_uri(os.path.join(RAIZ, "assets/fuentes", m.group(1)))})',
                     leer('assets/fuentes.css'))
    html = html.replace('<link rel="stylesheet" href="assets/fuentes.css">',
                        f'<style>{fuentes}</style>')

    # Los preload apuntan a archivos que ya no existen aparte.
    html = re.sub(r'<link rel="preload"[^>]*>\n?', '', html)

    # srcset y sizes se van: ver nota 1 del encabezado.
    html = re.sub(r'\s*srcset="[^"]*"', '', html)
    html = re.sub(r'\s*sizes="[^"]*"', '', html)

    def incrustar(m):
        ruta = os.path.join(RAIZ, m.group(2))
        return f'{m.group(1)}="{data_uri(ruta)}"' if os.path.isfile(ruta) else m.group(0)
    html = re.sub(r'(src|href)="(assets/[^"]+)"', incrustar, html)

    datos = re.sub(r'^export const ', 'const ', leer('js/datos.js'), flags=re.M)
    app = re.sub(r"^import \{\n.*?\n\} from '\./datos\.js';\n", '', leer('js/app.js'),
                 flags=re.S | re.M)
    # El helper srcset() arma rutas a archivos que acá no existen, y además
    # data URI en srcset no funciona (nota 1). Se anula para el archivo único.
    app = re.sub(r'const srcset = \(base, sizes\) =>.*?: \'\';',
                 "const srcset = () => '';", app, flags=re.S)
    html = html.replace('<script type="module" src="js/app.js"></script>',
                        f'<script>{datos}\n{app}</script>')

    # En el visor interno de algunas apps el IntersectionObserver no dispara
    # y el contenido quedaría invisible para siempre.
    html = html.replace('</head>',
                        '<style>.rv{opacity:1!important;transform:none!important}</style></head>', 1)
    return html


if __name__ == '__main__':
    salida = construir()
    with open(SALIDA, 'w', encoding='utf-8') as f:
        f.write(salida)
    assert 'srcset=' not in salida, 'quedó un srcset con data URI'
    assert '<script type="module"' not in salida, 'quedó un módulo ES'
    print(f'{os.path.relpath(SALIDA, RAIZ)} · {len(salida) / 1024 / 1024:.2f} MB')
