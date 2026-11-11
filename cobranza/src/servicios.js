// Llamadas a los servicios de afuera: Mercado Pago, WhatsApp (API oficial de
// Meta) y Resend (el mail de la mañana). Cada negocio usa SUS cuentas: las
// claves llegan por `e.env` (secretos del Worker) y nunca se guardan en la base
// ni se mandan al navegador. `e.salir` es fetch; las pruebas lo reemplazan.

import { PLANTILLA, CUERPO_PLANTILLA, EJEMPLO_PLANTILLA, PIE_PLANTILLA, BOTON_PLANTILLA, ETAPAS } from './logica.js';

// ── Utilidades de cifrado ──────────────────────────────────────────────────
const aHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const bytes = (t) => new TextEncoder().encode(t);

export async function sha256(texto) {
  return aHex(await crypto.subtle.digest('SHA-256', bytes(texto)));
}
export async function hmac(clave, mensaje) {
  const k = await crypto.subtle.importKey('raw', bytes(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return aHex(await crypto.subtle.sign('HMAC', k, bytes(mensaje)));
}
// Comparación que tarda lo mismo acierte o no (no filtra la clave por tiempos).
export function igualSeguro(a, b) {
  const x = String(a ?? ''), y = String(b ?? '');
  let r = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) r |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return r === 0;
}
export function aleatorio(cantidad = 16) {
  const b = crypto.getRandomValues(new Uint8Array(cantidad));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pedirJson(e, url, opciones) {
  const r = await e.salir(url, opciones);
  let datos = {};
  try { datos = await r.json(); } catch { datos = {}; }
  return { ok: r.ok, estado: r.status, datos };
}

// ── Mercado Pago ───────────────────────────────────────────────────────────
export const mpConectado = (env) => !!env.MP_ACCESS_TOKEN;
const cabecerasMp = (env) => ({ Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' });

export async function mpCrearPreferencia(e, { deuda, origen }) {
  const { ok, estado, datos } = await pedirJson(e, 'https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: cabecerasMp(e.env),
    body: JSON.stringify({
      items: [{ title: String(deuda.concepto).slice(0, 120), quantity: 1, unit_price: deuda.monto / 100, currency_id: 'ARS' }],
      external_reference: deuda.token,
      notification_url: `${origen}/webhook/mp`,
      back_urls: { success: `${origen}/p/${deuda.token}`, pending: `${origen}/p/${deuda.token}`, failure: `${origen}/p/${deuda.token}` },
      auto_return: 'approved',
    }),
  });
  if (!ok || !datos.init_point) throw new Error(`Mercado Pago no pudo armar el link (${estado}${datos.message ? ': ' + datos.message : ''}).`);
  return { id: String(datos.id || ''), link: datos.init_point };
}

export async function mpPago(e, id) {
  const { ok, datos } = await pedirJson(e, `https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: cabecerasMp(e.env) });
  return ok ? datos : null;
}

export async function mpProbar(e) {
  const { ok, estado, datos } = await pedirJson(e, 'https://api.mercadopago.com/users/me', { headers: cabecerasMp(e.env) });
  return ok ? { ok: true, detalle: `Conectado a la cuenta ${datos.nickname || datos.email || datos.id}.` }
    : { ok: false, detalle: `Mercado Pago rechazó la clave (${estado}).` };
}

// Mercado Pago firma cada aviso: cabecera x-signature "ts=…,v1=…" con el HMAC
// de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" y la clave secreta.
export async function mpFirmaValida(request, url, secreto) {
  const partes = Object.fromEntries((request.headers.get('x-signature') || '').split(',').map((p) => p.trim().split('=')));
  if (!partes.ts || !partes.v1) return false;
  const id = (url.searchParams.get('data.id') || '').toLowerCase();
  const pedido = request.headers.get('x-request-id') || '';
  const manifiesto = `${id ? `id:${id};` : ''}${pedido ? `request-id:${pedido};` : ''}ts:${partes.ts};`;
  return igualSeguro(await hmac(secreto, manifiesto), partes.v1);
}

// ── WhatsApp (API oficial en la nube de Meta) ──────────────────────────────
export const waConectado = (env) => !!(env.WA_TOKEN && env.WA_PHONE_ID);
const waBase = (env) => `https://graph.facebook.com/${env.WA_API_VERSION || 'v24.0'}`;
const cabecerasWa = (env) => ({ Authorization: `Bearer ${env.WA_TOKEN}`, 'Content-Type': 'application/json' });

// Errores que no son del destinatario sino de la cuenta (clave vencida, sin
// medio de pago, plantilla sin aprobar o pausada): frenan toda la tanda.
const ERRORES_DE_CUENTA = new Set([0, 3, 10, 190, 200, 131031, 131042, 132000, 132001, 132015, 132016, 133010]);

function errorWa(estado, datos) {
  const err = datos.error || {};
  const codigo = Number(err.code ?? -1);
  return {
    ok: false,
    codigo,
    mensaje: String(err.error_data?.details || err.message || `Error ${estado}`).slice(0, 300),
    deCuenta: ERRORES_DE_CUENTA.has(codigo) || estado === 401,
  };
}

export async function waEnviarPlantilla(e, { telefono, etapa, variables, token }) {
  const { ok, estado, datos } = await pedirJson(e, `${waBase(e.env)}/${e.env.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: cabecerasWa(e.env),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'template',
      template: {
        name: PLANTILLA[etapa],
        language: { code: 'es_AR' },
        components: [
          { type: 'body', parameters: variables.map((text) => ({ type: 'text', text })) },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: token }] },
        ],
      },
    }),
  });
  if (ok && datos.messages?.[0]?.id) return { ok: true, id: datos.messages[0].id };
  return errorWa(estado, datos);
}

export async function waEnviarTexto(e, telefono, texto) {
  const { ok, estado, datos } = await pedirJson(e, `${waBase(e.env)}/${e.env.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: cabecerasWa(e.env),
    body: JSON.stringify({ messaging_product: 'whatsapp', to: telefono, type: 'text', text: { body: texto } }),
  });
  return ok ? { ok: true, id: datos.messages?.[0]?.id || '' } : errorWa(estado, datos);
}

export async function waProbar(e) {
  const { ok, estado, datos } = await pedirJson(e, `${waBase(e.env)}/${e.env.WA_PHONE_ID}?fields=display_phone_number,verified_name`, { headers: cabecerasWa(e.env) });
  return ok ? { ok: true, detalle: `Conectado al número ${datos.display_phone_number || ''} (${datos.verified_name || 'sin nombre'}).` }
    : { ok: false, detalle: `Meta rechazó la clave: ${errorWa(estado, datos).mensaje}` };
}

// Da de alta en Meta los cuatro mensajes (quedan "en revisión" hasta que Meta
// los aprueba). El botón lleva al link de pago de esta misma instalación.
export async function waCrearPlantillas(e, origen) {
  const salida = [];
  for (const etapa of ETAPAS) {
    const { ok, estado, datos } = await pedirJson(e, `${waBase(e.env)}/${e.env.WA_WABA_ID}/message_templates`, {
      method: 'POST',
      headers: cabecerasWa(e.env),
      body: JSON.stringify({
        name: PLANTILLA[etapa],
        language: 'es_AR',
        category: 'UTILITY',
        components: [
          { type: 'BODY', text: CUERPO_PLANTILLA[etapa], example: { body_text: [EJEMPLO_PLANTILLA[etapa]] } },
          { type: 'FOOTER', text: PIE_PLANTILLA },
          { type: 'BUTTONS', buttons: [{ type: 'URL', text: BOTON_PLANTILLA, url: `${origen}/p/{{1}}`, example: [`${origen}/p/ejemplo123`] }] },
        ],
      }),
    });
    salida.push(ok ? { etapa, nombre: PLANTILLA[etapa], ok: true, estado: datos.status || 'PENDING' }
      : { etapa, nombre: PLANTILLA[etapa], ok: false, error: errorWa(estado, datos).mensaje });
  }
  return salida;
}

export async function waEstadoPlantillas(e) {
  const { ok, estado, datos } = await pedirJson(e, `${waBase(e.env)}/${e.env.WA_WABA_ID}/message_templates?fields=name,status,category&limit=100`, { headers: cabecerasWa(e.env) });
  if (!ok) return { ok: false, error: errorWa(estado, datos).mensaje, plantillas: [] };
  const nuestras = new Map((datos.data || []).filter((p) => Object.values(PLANTILLA).includes(p.name)).map((p) => [p.name, p]));
  return {
    ok: true,
    plantillas: ETAPAS.map((etapa) => ({ etapa, nombre: PLANTILLA[etapa], estado: nuestras.get(PLANTILLA[etapa])?.status || 'FALTA', categoria: nuestras.get(PLANTILLA[etapa])?.category || '' })),
  };
}

// Meta firma cada aviso con la clave secreta de la app: "sha256=<hmac del cuerpo>".
export async function waFirmaValida(cuerpoCrudo, cabecera, secreto) {
  if (!secreto || !cabecera) return false;
  return igualSeguro('sha256=' + await hmac(secreto, cuerpoCrudo), cabecera);
}

// ── Mail de la mañana (Resend) ─────────────────────────────────────────────
export const mailConectado = (env) => !!env.RESEND_API_KEY;

export async function enviarMail(e, { para, asunto, html }) {
  const { ok, estado, datos } = await pedirJson(e, 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: e.env.MAIL_DESDE || 'Cobranza sin vueltas <onboarding@resend.dev>', to: [para], subject: asunto, html }),
  });
  return ok ? { ok: true } : { ok: false, detalle: `Resend rechazó el mail (${estado}${datos.message ? ': ' + datos.message : ''}).` };
}
