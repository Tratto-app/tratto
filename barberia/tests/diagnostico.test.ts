/**
 * Diagnóstico de WhatsApp al arrancar: acceso del token al número y
 * suscripción de la cuenta de WhatsApp Business a la app.
 *
 * Motivó esto un caso real: el número se dio de alta desde el Administrador de
 * WhatsApp (no desde la app), así que su cuenta quedó sin suscribir y el bot
 * no recibía nada, sin un solo error en el log.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-prueba';
process.env.WHATSAPP_PHONE_NUMBER_ID = '111';
process.env.WHATSAPP_VERIFY_TOKEN = 'verify';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '222';

const { diagnosticarWhatsApp } = await import('../src/whatsapp/diagnostico.js');

type Llamada = { metodo: string; url: string };
let llamadas: Llamada[];
let original: typeof fetch;

function responder(mapa: Record<string, { status: number; body: unknown }>) {
  llamadas = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({ metodo, url: String(url) });
    const clave = Object.keys(mapa).find((k) => `${metodo} ${url}`.includes(k));
    const r = clave ? mapa[clave] : { status: 404, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
}

describe('diagnosticarWhatsApp', () => {
  before(() => {
    original = globalThis.fetch;
  });
  after(() => {
    globalThis.fetch = original;
  });

  test('todo bien: llega al número y suscribe la cuenta', async () => {
    responder({
      'GET https://graph.facebook.com/v26.0/111': {
        status: 200,
        body: { display_phone_number: '+54 9 11 6858-1736', verified_name: 'Barbería Panamá', quality_rating: 'GREEN' },
      },
      'POST https://graph.facebook.com/v26.0/222/subscribed_apps': { status: 200, body: { success: true } },
    });
    const r = await diagnosticarWhatsApp();
    assert.ok(r);
    assert.deepEqual(r.numero, { ok: true, telefono: '+54 9 11 6858-1736', nombre: 'Barbería Panamá', calidad: 'GREEN' });
    assert.deepEqual(r.suscripcion, { ok: true });
    assert.ok(llamadas.some((l) => l.metodo === 'POST' && l.url.endsWith('/222/subscribed_apps')));
  });

  test('token sin acceso al número: lo informa con el mensaje de Meta y sigue', async () => {
    responder({
      'GET https://graph.facebook.com/v26.0/111': {
        status: 400,
        body: { error: { message: 'Unsupported get request. Object with ID 111 does not exist', code: 100 } },
      },
      'POST https://graph.facebook.com/v26.0/222/subscribed_apps': {
        status: 403,
        body: { error: { message: 'Permissions error', code: 200 } },
      },
    });
    const r = await diagnosticarWhatsApp();
    assert.ok(r);
    assert.equal(r.numero.ok, false);
    assert.match((r.numero as { error: string }).error, /código 100/);
    assert.equal((r.suscripcion as { ok: boolean }).ok, false);
    assert.match((r.suscripcion as { error: string }).error, /Permissions error/);
  });

  test('Meta caído: no tira excepción, lo deja registrado', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;
    const r = await diagnosticarWhatsApp();
    assert.ok(r);
    assert.equal(r.numero.ok, false);
    assert.equal((r.suscripcion as { ok: boolean }).ok, false);
  });
});
