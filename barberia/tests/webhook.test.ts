/**
 * Seguridad y parseo del webhook de WhatsApp.
 * El módulo lee la configuración al importarse, así que las variables se
 * definen antes del import dinámico.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const SECRETO = 'secreto-de-prueba-del-app-de-meta';
process.env.WHATSAPP_APP_SECRET = SECRETO;
process.env.WHATSAPP_VERIFY_TOKEN = 'token-de-verificacion';
process.env.NODE_ENV = 'test';

type ModuloWebhook = typeof import('../src/whatsapp/webhook.js');
let webhook: ModuloWebhook;

before(async () => {
  webhook = await import('../src/whatsapp/webhook.js');
});

function firmar(cuerpo: string): string {
  return `sha256=${createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex')}`;
}

describe('verificación de la suscripción', () => {
  test('acepta el token correcto y devuelve el challenge', () => {
    const r = webhook.verificarSuscripcion({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'token-de-verificacion',
      'hub.challenge': '1234567890',
    });
    assert.equal(r.ok, true);
    assert.equal(r.challenge, '1234567890');
  });

  test('rechaza un token equivocado', () => {
    const r = webhook.verificarSuscripcion({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'token-trucho',
      'hub.challenge': 'x',
    });
    assert.equal(r.ok, false);
  });

  test('rechaza si el modo no es subscribe', () => {
    assert.equal(webhook.verificarSuscripcion({ 'hub.mode': 'otro', 'hub.verify_token': 'token-de-verificacion' }).ok, false);
  });
});

describe('firma del webhook', () => {
  const cuerpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  test('acepta una firma válida', () => {
    assert.equal(webhook.firmaValida(Buffer.from(cuerpo), firmar(cuerpo)), true);
  });

  test('rechaza una firma inválida', () => {
    assert.equal(webhook.firmaValida(Buffer.from(cuerpo), 'sha256=0000'), false);
  });

  test('rechaza si falta la firma', () => {
    assert.equal(webhook.firmaValida(Buffer.from(cuerpo), undefined), false);
  });

  test('rechaza si el cuerpo fue modificado después de firmar', () => {
    const firma = firmar(cuerpo);
    const alterado = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'inyectado' }] });
    assert.equal(webhook.firmaValida(Buffer.from(alterado), firma), false);
  });

  test('rechaza una firma con otro algoritmo', () => {
    assert.equal(webhook.firmaValida(Buffer.from(cuerpo), `sha1=${'a'.repeat(40)}`), false);
  });
});

describe('parseo de mensajes entrantes', () => {
  const armar = (mensaje: Record<string, unknown>, nombre = 'Agustín') => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              contacts: [{ profile: { name: nombre }, wa_id: '5491133334444' }],
              messages: [mensaje],
            },
          },
        ],
      },
    ],
  });

  test('extrae un mensaje de texto', () => {
    const [m] = webhook.extraerMensajes(
      armar({ id: 'wamid.1', from: '5491133334444', timestamp: '1', type: 'text', text: { body: 'Hola, quiero turno' } }) as never,
    );
    assert.equal(m?.texto, 'Hola, quiero turno');
    assert.equal(m?.telefono, '5491133334444');
    assert.equal(m?.nombrePerfil, 'Agustín');
    assert.equal(m?.noEsTexto, false);
  });

  test('una respuesta a un botón llega como el id del botón', () => {
    const [m] = webhook.extraerMensajes(
      armar({
        id: 'wamid.2',
        from: '5491133334444',
        timestamp: '1',
        type: 'interactive',
        interactive: { type: 'button_reply', button_reply: { id: 'confirmar_si', title: 'Sí, confirmar' } },
      }) as never,
    );
    assert.equal(m?.texto, 'confirmar_si');
  });

  test('una opción de lista llega como el id de la opción', () => {
    const [m] = webhook.extraerMensajes(
      armar({
        id: 'wamid.3',
        from: '5491133334444',
        timestamp: '1',
        type: 'interactive',
        interactive: { type: 'list_reply', list_reply: { id: 'hora_17:30', title: '17:30' } },
      }) as never,
    );
    assert.equal(m?.texto, 'hora_17:30');
  });

  test('un audio se marca como no-texto y no se intenta interpretar', () => {
    const [m] = webhook.extraerMensajes(
      armar({ id: 'wamid.4', from: '5491133334444', timestamp: '1', type: 'audio', audio: { id: 'x' } }) as never,
    );
    assert.equal(m?.noEsTexto, true);
    assert.equal(m?.texto, '');
  });

  test('un payload sin mensajes (por ejemplo, solo estados) no rompe', () => {
    assert.deepEqual(webhook.extraerMensajes({ entry: [{ id: '1', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp' } }] }] }), []);
    assert.deepEqual(webhook.extraerMensajes({}), []);
  });

  test('detecta entregas fallidas para poder loguearlas', () => {
    const fallos = webhook.extraerFallosDeEntrega({
      entry: [
        {
          id: '1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                statuses: [
                  { id: 'wamid.a', status: 'failed', recipient_id: '5491133334444', errors: [{ code: 131047, title: 'Re-engagement message' }] },
                  { id: 'wamid.b', status: 'delivered', recipient_id: '5491133334444' },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.equal(fallos.length, 1);
    assert.match(fallos[0]!.error, /131047/);
  });
});
