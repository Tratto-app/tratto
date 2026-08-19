#!/usr/bin/env python3
"""
Rearma los archivos de para-mandar/ a partir del sitio actual.

Correlo cada vez que cambien las fotos o los textos, si no lo que mandás
queda con la versión vieja adentro:

    python3 hair-beauty/armar-para-mandar.py

Deja en hair-beauty/para-mandar/:
  - hair-beauty-para-mostrar.html   el sitio entero en un solo archivo
  - Hair-Beauty-que-tiene-el-sitio.html   el documento para la clienta

El PDF del documento se hace aparte, abriéndolo en el navegador e
imprimiendo a PDF (con "Gráficos de fondo" activado, si no sale en blanco).
"""
import base64, pathlib, re, sys

AQUI = pathlib.Path(__file__).resolve().parent
SALIDA = AQUI / 'para-mandar'

def incrustar(texto, carpeta, mime, patrones):
    """Reemplaza las rutas a archivos por el archivo entero, en base64."""
    for archivo in sorted((AQUI / carpeta).iterdir()):
        if archivo.suffix not in ('.woff2', '.jpg', '.jpeg', '.png'):
            continue
        dato = base64.b64encode(archivo.read_bytes()).decode()
        uri = f'data:{mime};base64,{dato}'
        for patron in patrones:
            texto = texto.replace(patron.format(c=carpeta, a=archivo.name), uri)
    return texto

def main():
    SALIDA.mkdir(exist_ok=True)

    sitio = (AQUI / 'index.html').read_text()
    sitio = incrustar(sitio, 'fuentes', 'font/woff2', ["url('{c}/{a}')"])
    sitio = sitio.replace("url('data:font", "url('data:font")  # ya quedaron incrustadas
    for foto in sorted((AQUI / 'fotos').glob('*.jpg')):
        dato = base64.b64encode(foto.read_bytes()).decode()
        sitio = sitio.replace(f'src="fotos/{foto.name}"', f'src="data:image/jpeg;base64,{dato}"')
        sitio = sitio.replace(f'data-foto="fotos/{foto.name}"', 'data-foto=""')
    (SALIDA / 'hair-beauty-para-mostrar.html').write_text(sitio)

    doc = (AQUI / 'para-didy.html').read_text()
    doc = incrustar(doc, 'fuentes', 'font/woff2', ["url('{c}/{a}')"])
    (SALIDA / 'Hair-Beauty-que-tiene-el-sitio.html').write_text(doc)

    for f in sorted(SALIDA.iterdir()):
        if f.suffix == '.html':
            print(f'{f.name}: {round(f.stat().st_size/1024)} KB')

    # Solo importan las referencias que el navegador sale a buscar de verdad:
    # src=, href= y url(). Los comentarios y los textos que nombran la carpeta
    # no cargan nada.
    sueltas = re.findall(r'''(?:src|href)=["'](?:fotos|fuentes)/[^"']+|url\(["']?(?:fotos|fuentes)/[^)]+''', sitio)
    if sueltas:
        print('\nOJO: quedaron archivos sin incrustar:', file=sys.stderr)
        for x in dict.fromkeys(sueltas):
            print('  ', x[:90], file=sys.stderr)
        sys.exit(1)
    print('\nSin archivos sueltos: los dos se abren solos en cualquier carpeta.')

if __name__ == '__main__':
    main()
