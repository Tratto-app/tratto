"""Antes de mandar, revisa que el dominio del mail reciba correo (registro MX).

Uso: python3 tools/prospeccion/tiene_mx.py info@negocio.com.ar [otro@mail.com ...]
Imprime una línea JSON por dirección: {"mail", "dominio", "recibe", "detalle"}.

Si el dominio no tiene MX (ni un registro A que lo reemplace), el mail rebota
seguro: no se manda. Pedido del fundador del 16/10/2026 para bajar los rebotes
(cuidan la reputación de la cuenta que envía). Es gratis: consulta el DNS
público de Google por HTTPS. Si la consulta falla, dice "recibe": null y se
decide como siempre (no frena el envío por un error de red).
"""
import json
import sys
import urllib.parse
import urllib.request

DOH = 'https://dns.google/resolve?'


def consultar(nombre, tipo):
    url = DOH + urllib.parse.urlencode({'name': nombre, 'type': tipo})
    with urllib.request.urlopen(url, timeout=8) as r:
        return json.load(r)


def revisar(mail):
    dominio = mail.rsplit('@', 1)[-1].strip().lower().rstrip('.')
    try:
        mx = consultar(dominio, 'MX')
        if mx.get('Status') == 3:
            return {'mail': mail, 'dominio': dominio, 'recibe': False, 'detalle': 'el dominio no existe'}
        if any(a.get('type') == 15 for a in mx.get('Answer', [])):
            return {'mail': mail, 'dominio': dominio, 'recibe': True, 'detalle': 'tiene MX'}
        a = consultar(dominio, 'A')
        if any(x.get('type') == 1 for x in a.get('Answer', [])):
            return {'mail': mail, 'dominio': dominio, 'recibe': True, 'detalle': 'sin MX, con registro A'}
        return {'mail': mail, 'dominio': dominio, 'recibe': False, 'detalle': 'sin MX ni registro A'}
    except Exception as e:  # red o DNS caído: no se frena por esto
        return {'mail': mail, 'dominio': dominio, 'recibe': None, 'detalle': f'no se pudo consultar: {e.__class__.__name__}'}


if __name__ == '__main__':
    for m in sys.argv[1:]:
        print(json.dumps(revisar(m), ensure_ascii=False))
