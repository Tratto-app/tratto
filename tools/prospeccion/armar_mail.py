"""Arma el mail a proveedores (versión 3, 8/10/2026) en HTML y en texto.

Lo usa el agente mkt-prospeccion antes de cada envío por Gmail:

    python3 tools/prospeccion/armar_mail.py '{"saludo": "ServiMAX Destapaciones",
      "gancho": "Vi en tu página que hacen destapaciones en Caballito.",
      "servicio": "plomería y destapaciones", "zona": "Caballito",
      "pedido": "una destapación o un arreglo de plomería",
      "donde": "tu página web (servimaxdestapaciones.com)"}'

Devuelve {"html": ..., "texto": ...}: el html va en htmlBody y el texto en body
de send_message. Pedidos del fundador que fija este formato:
- El link se ve como "www.trattoapp.com.ar", sin parámetros largos a la vista.
- Firma con el logo de Tratto al pie, para que no parezca una estafa.
- Sin la comisión: Tratto recién arranca; si se registra, publica su servicio y
  activa las notificaciones, le llega el aviso automáticamente cuando aparece un
  cliente (mail de n8n + notificación de matches_notificar_push), sin entrar a
  revisar; no pierde nada por registrarse.
"""
import html
import json
import sys

LINK = 'https://www.trattoapp.com.ar/?utm_source=prospeccion'
LOGO = 'https://www.trattoapp.com.ar/logo-mail.png'


def armar(saludo, gancho, servicio, zona, pedido, donde):
    parrafos = [
        f'Hola {saludo}, ¿cómo va?' if saludo else 'Hola, ¿cómo va?',
        f'{gancho} Te escribo de Tratto, una app donde gente de CABA y Provincia de Buenos Aires '
        'publica lo que necesita y recibe presupuestos de proveedores de su zona.',
        f'Tratto recién está arrancando y estamos sumando proveedores de {servicio} en {zona}. '
        'Si hoy te registrás, publicás tu servicio y activás las notificaciones, cada vez que un '
        f'cliente de tu zona pida {pedido} te llega el aviso automáticamente. No tenés que estar '
        'entrando a revisar la app.',
        'Con el cliente hablás por el chat de la app y, cuando terminás el trabajo, te paga por '
        'Mercado Pago, directo a tu cuenta.',
        'No perdés nada por registrarte: crear tu perfil y publicar tu servicio no tiene costo.',
    ]
    p = lambda t: f'<p style="margin:0 0 14px">{html.escape(t, quote=False)}</p>'
    cuerpo = ''.join(p(t) for t in parrafos)
    cuerpo += (f'<p style="margin:0 0 14px">Te podés registrar acá: '
               f'<a href="{LINK}" style="color:#1E5D49;font-weight:bold">www.trattoapp.com.ar</a></p>'
               '<p style="margin:0 0 22px">Si tenés alguna duda, respondé este mail.</p>')
    firma = (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0">'
        '<tr><td style="padding:0 0 10px;font:15px/1.5 Arial,Helvetica,sans-serif;color:#0E1815">'
        'Saludos,<br><b>Equipo de Tratto</b></td></tr>'
        f'<tr><td><a href="{LINK}"><img src="{LOGO}" alt="Tratto" width="150" height="50" '
        'style="display:block;border:0;border-radius:8px"></a></td></tr>'
        '<tr><td style="padding:8px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#5B6B64">'
        'Servicios para tu casa, tu negocio y más, en CABA y Provincia de Buenos Aires<br>'
        f'<a href="{LINK}" style="color:#1E5D49;text-decoration:none">www.trattoapp.com.ar</a>'
        ' · trattoapp1@gmail.com</td></tr></table>')
    pie = ('<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #E0DCD0;'
           'font:12px/1.5 Arial,Helvetica,sans-serif;color:#68766F">'
           f'Encontramos tu mail en {html.escape(donde, quote=False)}. Si no querés recibir más '
           'mensajes, respondé "no" y no te escribimos más.</p>')
    html_mail = ('<div style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#0E1815;max-width:560px">'
                 f'{cuerpo}{firma}{pie}</div>')
    texto = '\n\n'.join(parrafos) + (
        '\n\nTe podés registrar acá: www.trattoapp.com.ar'
        '\n\nSi tenés alguna duda, respondé este mail.'
        '\n\nSaludos,\nEquipo de Tratto\nwww.trattoapp.com.ar\n\n--\n'
        f'Encontramos tu mail en {donde}. Si no querés recibir más mensajes, respondé "no" '
        'y no te escribimos más.')
    return html_mail, texto


if __name__ == '__main__':
    datos = json.loads(sys.argv[1])
    h, t = armar(**datos)
    json.dump({'html': h, 'texto': t}, sys.stdout, ensure_ascii=False)
