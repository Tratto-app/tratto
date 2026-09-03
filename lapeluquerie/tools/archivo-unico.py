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

3. Las rutas que arma el JavaScript no las ve una búsqueda de texto sobre
   el HTML. Por eso app.js hace pasar TODAS las imágenes por foto(), y acá
   se reemplaza esa función por un mapa de imágenes incrustadas. Si alguna
   plantilla vuelve a escribir 'assets/...' a mano, el archivo suelto queda
   sin esa foto: hay un assert al final que lo detecta.
"""
import base64, mimetypes, os, re, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MARCA_INI = '/*MAPA-IMAGENES-INI*/'
MARCA_FIN = '/*MAPA-IMAGENES-FIN*/'

# Las fotos que no están en la grilla (el visor abre la versión grande)
# caen en la de 640, que es la que sí viaja.
FOTO_LOOKUP = ("const foto = nombre =>\n"
               "  IMAGENES[nombre] || IMAGENES[nombre.replace('.webp', '-640.webp')] || '';")

COSECHA = (MARCA_INI + 'const IMAGENES = {};\n'
           "document.querySelectorAll('img[data-foto]').forEach(i => {\n"
           '  IMAGENES[i.dataset.foto] = i.getAttribute("src");\n'
           '});' + MARCA_FIN)
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

    # foto() pasa a leer de un mapa de imágenes incrustadas. Sin esto, todo
    # lo que dibuja el JS (galería, antes/después, logo) apuntaría a la
    # carpeta assets/, que no viaja con el archivo. Ver nota 3.
    # Etapa 1: foto() sale de un mapa de imágenes incrustadas, para que el
    # pre-render pueda dibujar la galería. La etapa 2 (abajo, después del
    # pre-render) cambia ese mapa por una cosecha del propio HTML, así cada
    # foto viaja una sola vez en lugar de estar duplicada.
    assets = os.path.join(RAIZ, 'assets')
    usadas = sorted(n for n in os.listdir(assets)
                    if n.endswith('-640.webp')
                    or re.match(r'(antes|despues)-\d\.webp$', n)
                    or n == 'marca-blanca.png')
    mapa = ',\n  '.join(f"'{n}': '{data_uri(os.path.join(assets, n))}'" for n in usadas)
    app = re.sub(
        r'const foto = nombre => `assets/\$\{nombre\}`;',
        MARCA_INI + 'const IMAGENES = {\n  ' + mapa + '\n};' + MARCA_FIN + '\n' + FOTO_LOOKUP,
        app)

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

    # Deja el HTML ya armado adentro: si el navegador del cliente bloquea el
    # JavaScript, la página se ve completa igual.
    pre = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prerender.mjs')
    if subprocess.run(['node', pre, SALIDA]).returncode == 0:
        with open(SALIDA, encoding='utf-8') as f:
            salida = f.read()
        # Etapa 2: las fotos ya están en el HTML, así que el script las lee
        # de ahí en vez de llevar una segunda copia adentro.
        salida = re.sub(re.escape(MARCA_INI) + '.*?' + re.escape(MARCA_FIN),
                        COSECHA, salida, flags=re.S)
        with open(SALIDA, 'w', encoding='utf-8') as f:
            f.write(salida)
    assert 'srcset=' not in salida, 'quedó un srcset con data URI'
    assert '<script type="module"' not in salida, 'quedó un módulo ES'
    # Las rutas absolutas (og:image con el dominio futuro) son metadata, no
    # imágenes de la página: esas sí pueden quedar.
    sueltas = [m for m in re.findall(r'.{28}assets/', salida)
               if 'https://' not in m and 'http://' not in m]
    assert not sueltas, (
        'quedó una ruta local a assets/: el archivo suelto se vería sin esa foto')
    print(f'{os.path.relpath(SALIDA, RAIZ)} · {len(salida) / 1024 / 1024:.2f} MB')

    # Se verifica copiándolo a una carpeta vacía. Probarlo acá al lado de
    # assets/ daba falsos positivos: las rutas que arma el JavaScript se
    # resolvían contra esa carpeta, que en el celular del cliente no viaja.
    verificador = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               'verificar-archivo-unico.mjs')
    sys.exit(subprocess.run(['node', verificador, SALIDA]).returncode)
