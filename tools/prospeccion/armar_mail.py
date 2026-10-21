"""Arma el mail a proveedores (versión 4, 16/10/2026) en HTML y en texto.

Lo usa el agente mkt-prospeccion antes de cada envío por Gmail:

    python3 tools/prospeccion/armar_mail.py '{"saludo": "ServiMAX Destapaciones",
      "gancho": "Vi en tu página que hacen destapaciones en Caballito.",
      "servicio": "plomería y destapaciones", "zona": "Caballito",
      "pedido": "una destapación o un arreglo de plomería",
      "donde": "tu página web (servimaxdestapaciones.com)", "n": 0,
      "remitente": "<casilla de la campaña>"}'

Devuelve {"html", "texto", "asunto", "variante"}: el html va en htmlBody, el
texto en body y el asunto en subject de send_message. Pedidos del fundador que fija este formato:
- El link se ve como "www.trattoapp.com.ar", sin parámetros largos a la vista.
- Firma con el logo de Tratto al pie, para que no parezca una estafa.
- Sin la comisión: Tratto recién arranca; si se registra, publica su servicio y
  activa las notificaciones, le llega el aviso automáticamente cuando aparece un
  cliente (mail de n8n + notificación de matches_notificar_push), sin entrar a
  revisar; no pierde nada por registrarse.
- 16/10/2026: "cada 5 mails cambiamos un poco el formato, no los hacemos todos
  iguales". Hay 4 versiones (A, B, C, D) con el mismo contenido y distinto
  asunto, apertura y orden. Con "n" (número de envío del día, desde 0) elige
  sola. Todos los asuntos llevan "Tratto", porque las respuestas se buscan
  con subject:Tratto.
- 21/10/2026: "que cada 15 mails cambie el formato": (n div 15) mod 4.
- 16/10/2026: los mails en frío salen de una casilla aparte, no de
  trattoapp1@gmail.com (está vinculada a la app y a las tiendas). "remitente"
  es esa casilla y va en la firma.
"""
import html
import json
import sys

LINK = 'https://www.trattoapp.com.ar/?utm_source=prospeccion'
LOGO = 'https://www.trattoapp.com.ar/logo-mail.png'


VARIANTES = 'ABCD'


def _sin_punto(t):
    t = t.strip().rstrip('.')
    return t[:1].lower() + t[1:] if t else t


def armar(saludo, gancho, servicio, zona, pedido, donde, variante=None, n=None, oficio=None, remitente=None):
    if not remitente:
        raise SystemExit('falta "remitente": la casilla de la campaña (growth_mkt_ajustes.prospeccion.cuenta_envio)')
    if variante is None:
        variante = VARIANTES[(int(n) // 15) % 4] if n is not None else 'A'
    variante = str(variante).upper()
    if variante not in VARIANTES:
        raise SystemExit(f'variante desconocida: {variante}')
    hola = saludo or ''
    if variante == 'A':
        asunto = f'Clientes que buscan {oficio or servicio} en {zona} · Tratto'
        parrafos = [
            f'Hola {hola}, ¿cómo va?' if hola else 'Hola, ¿cómo va?',
            f'{gancho} Te escribo de Tratto, una app donde gente de CABA y Provincia de Buenos Aires '
            'publica lo que necesita y recibe presupuestos de quienes ofrecen el servicio en su zona.',
            f'Tratto recién está arrancando y estamos sumando a quienes ofrecen {servicio} en {zona}. '
            'Si hoy te registrás, publicás tu servicio y activás las notificaciones, cada vez que un '
            f'cliente de tu zona pida {pedido} te llega el aviso automáticamente. No tenés que estar '
            'entrando a revisar la app.',
            'Con el cliente hablás por el chat de la app y, cuando terminás el trabajo, te paga por '
            'Mercado Pago, directo a tu cuenta.',
            'No perdés nada por registrarte: crear tu perfil y publicar tu servicio no tiene costo.',
        ]
        link_antes, link_despues = 'Te podés registrar acá: ', ' (si tenés iPhone, también está en la App Store).'
        cierre = 'Si tenés alguna duda, respondé este mail.'
    elif variante == 'B':
        asunto = f'{hola + ", p" if hola else "P"}edidos de {servicio} en {zona} · Tratto'
        parrafos = [
            f'Hola {hola}, ¿cómo estás?' if hola else 'Hola, ¿cómo estás?',
            f'{gancho} Te cuento rápido: en Tratto la gente de CABA y Provincia de Buenos Aires publica '
            'lo que necesita y le llegan presupuestos de quienes ofrecen el servicio cerca.',
            f'Estamos arrancando y buscamos a quienes hacen {servicio} en {zona}. Te registrás, publicás '
            f'tu servicio, activás las notificaciones y, cuando alguien de tu zona pide {pedido}, te llega '
            'el aviso al celular.',
            'Arreglás todo por el chat de la app y cobrás por Mercado Pago, directo a tu cuenta. '
            'Registrarte y publicar no cuesta nada.',
        ]
        link_antes, link_despues = 'Entrá acá: ', ' (en iPhone también la encontrás en la App Store).'
        cierre = 'Cualquier cosa, respondeme este mail.'
    elif variante == 'C':
        asunto = f'¿Tomás trabajos nuevos de {servicio} en {zona}? · Tratto'
        parrafos = [
            f'Hola {hola},' if hola else 'Hola,',
            f'¿Estás tomando trabajos nuevos de {servicio} en {zona}? Te pregunto porque '
            f'{_sin_punto(gancho)} y estamos sumando gente de tu rubro en la zona.',
            'Tratto es una app nueva: la gente publica lo que necesita y recibe presupuestos de quienes '
            'ofrecen el servicio. Si te registrás y activás las notificaciones, te avisamos al celular '
            f'cada vez que aparece un pedido de {servicio} en tu zona.',
            'Hablás con el cliente por el chat y te paga por Mercado Pago. Crear el perfil es gratis.',
        ]
        link_antes, link_despues = 'Registrate en ', ' (en iPhone está en la App Store).'
        cierre = 'Si tenés dudas, respondé y te contesto.'
    else:
        asunto = f'Tratto: avisos de clientes de {zona} para {servicio}'
        parrafos = [
            f'Hola {hola}, ¿qué tal?' if hola else 'Hola, ¿qué tal?',
            f'{gancho} Te escribo de Tratto porque estamos sumando a quienes ofrecen {servicio} en {zona}.',
            'Así funciona:\n1. Te registrás y publicás tu servicio, gratis.\n'
            f'2. Cuando alguien de tu zona pide {pedido}, te llega el aviso al celular.\n'
            '3. Mandás tu presupuesto y hablás con el cliente por el chat de la app.\n'
            '4. Cobrás por Mercado Pago, directo a tu cuenta.',
            'Tratto recién arranca, así que es buen momento para tener tu perfil listo.',
        ]
        link_antes, link_despues = 'Entrá a ', ' (en iPhone también está en la App Store).'
        cierre = 'Cualquier duda, respondé este mail.'
    p = lambda t: f'<p style="margin:0 0 14px">{html.escape(t, quote=False).replace(chr(10), "<br>")}</p>'
    cuerpo = ''.join(p(t) for t in parrafos)
    cuerpo += (f'<p style="margin:0 0 14px">{html.escape(link_antes, quote=False)}'
               f'<a href="{LINK}" style="color:#1E5D49;font-weight:bold">www.trattoapp.com.ar</a>'
               f'{html.escape(link_despues, quote=False)}</p>'
               f'<p style="margin:0 0 22px">{html.escape(cierre, quote=False)}</p>')
    firma = (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0">'
        '<tr><td style="padding:0 0 10px;font:15px/1.5 Arial,Helvetica,sans-serif;color:#0E1815">'
        'Saludos,<br><b>Equipo de Tratto</b></td></tr>'
        f'<tr><td><a href="{LINK}"><img src="{LOGO}" alt="Tratto" width="150" height="50" '
        'style="display:block;border:0;border-radius:8px"></a></td></tr>'
        '<tr><td style="padding:8px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#5B6B64">'
        'Servicios para tu casa, tu negocio y más, en CABA y Provincia de Buenos Aires<br>'
        f'<a href="{LINK}" style="color:#1E5D49;text-decoration:none">www.trattoapp.com.ar</a>'
        f' · {html.escape(remitente)}</td></tr></table>')
    pie = ('<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #E0DCD0;'
           'font:12px/1.5 Arial,Helvetica,sans-serif;color:#68766F">'
           f'Encontramos tu mail en {html.escape(donde, quote=False)}. Si no querés recibir más '
           'mensajes, respondé "no" y no te escribimos más.</p>')
    html_mail = ('<div style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#0E1815;max-width:560px">'
                 f'{cuerpo}{firma}{pie}</div>')
    texto = '\n\n'.join(parrafos) + (
        f'\n\n{link_antes}www.trattoapp.com.ar{link_despues}'
        f'\n\n{cierre}'
        '\n\nSaludos,\nEquipo de Tratto\nwww.trattoapp.com.ar\n\n--\n'
        f'Encontramos tu mail en {donde}. Si no querés recibir más mensajes, respondé "no" '
        'y no te escribimos más.')
    return html_mail, texto, asunto, variante


if __name__ == '__main__':
    datos = json.loads(sys.argv[1])
    h, t, a, v = armar(**datos)
    json.dump({'html': h, 'texto': t, 'asunto': a, 'variante': v}, sys.stdout, ensure_ascii=False)
