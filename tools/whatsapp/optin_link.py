"""Genera un enlace de contacto; no manda mensajes ni concede consentimiento."""
import argparse
import re
from urllib.parse import quote

parser = argparse.ArgumentParser()
parser.add_argument('numero', help='Número propio de Tratto, formato +54 9 ...')
args = parser.parse_args()
number = re.sub(r'\D', '', args.numero)
if not re.fullmatch(r'549\d{10}', number):
    parser.error('Usar el número real de Tratto en formato internacional argentino +54 9 y 10 dígitos')
print('https://wa.me/' + number + '?text=' + quote('QUIERO RECIBIR INVITACIONES DE TRATTO POR WHATSAPP', safe=''))
