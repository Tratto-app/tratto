#!/usr/bin/env python3
"""Mete productos_dnfragancias.json adentro de index.html (array PRODUCTOS).

Uso: python3 tools/incrustar-productos.py   (desde la carpeta dnfragancias)
Se puede correr las veces que haga falta: reemplaza lo que haya entre
"const PRODUCTOS = [" y "];".
"""
import json, pathlib, re, sys

base = pathlib.Path(__file__).resolve().parent.parent
datos = json.loads((base / 'productos_dnfragancias.json').read_text(encoding='utf-8'))
campos = ['id', 'nombre', 'categoria', 'precio', 'foto', 'descripcion', 'orden', 'destacado']
lineas = []
for p in datos:
    item = {'id': p.get('id')} if p.get('id') else {}
    item.update({
        'nombre': p['nombre'].strip(),
        'categoria': p['categoria'].strip(),
        'precio': p['precio'],
        'foto': p.get('foto', ''),
        'descripcion': (p.get('descripcion') or '').strip(),
    })
    if 'posicion' in p or 'orden' in p:
        item['orden'] = p.get('orden', p.get('posicion'))
    if p.get('destacado'):
        item['destacado'] = True
    for extra in ('nombreWeb', 'pedidos'):
        if extra in p:
            item[extra] = p[extra]
    lineas.append(json.dumps(item, ensure_ascii=False, separators=(',', ':')))

html_path = base / 'index.html'
html = html_path.read_text(encoding='utf-8')
patron = re.compile(r'(const PRODUCTOS = \[\n)(.*?)(\n\];)', re.S)
if not patron.search(html):
    sys.exit('No encontré "const PRODUCTOS = [" en index.html')
nuevo = patron.sub(lambda m: m.group(1) + ',\n'.join(lineas) + m.group(3), html, count=1)
html_path.write_text(nuevo, encoding='utf-8')
print(f'{len(lineas)} productos incrustados en {html_path.name} ({len(nuevo.encode()) // 1024} KB)')
