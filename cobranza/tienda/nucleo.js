// La venta automática de las micro apps. Tres pedidos, sin base de datos:
//   /api/comprar?app=cuotas     → arma el cobro en Mercado Pago y manda ahí al comprador
//   /api/activar?app=…&pago=…   → confirma el pago con Mercado Pago y entrega la licencia
//   /api/verificar?licencia=…   → dice si una licencia es válida (para activar otro celular)
// La licencia es el número de pago firmado con una clave que solo conoce el
// servidor: no se puede inventar, y si el pago se devuelve deja de activar.
// Claves (del lado del servidor, nunca en el repo): MP_ACCESS_TOKEN y LICENCIA_SECRETO.
import { RUBROS } from '../src/rubros.js';

export const APPS = Object.fromEntries(Object.values(RUBROS).filter((r) => r.archivo && r.precio).map((r) => [r.id, r]));

const json = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const aHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function firma(secreto, texto) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return aHex(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(texto))).slice(0, 40);
}
function iguales(a, b) {
  let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
export async function licenciaDe(env, app, pago) {
  const base = `${app}.${pago}`;
  return `${btoa(base).replace(/=+$/, '')}.${await firma(env.LICENCIA_SECRETO, base)}`;
}
export async function leerLicencia(env, codigo) {
  const [datos, sello] = String(codigo || '').split('.');
  let base = '';
  try { base = atob(datos || ''); } catch { return null; }
  const [app, pago] = base.split('.');
  if (!APPS[app] || !/^\d+$/.test(pago || '') || !sello || !env.LICENCIA_SECRETO) return null;
  return iguales(await firma(env.LICENCIA_SECRETO, base), sello) ? { app, pago } : null;
}

async function mercadoPago(e, ruta, opciones = {}) {
  const r = await e.salir(`https://api.mercadopago.com${ruta}`, { ...opciones, headers: { Authorization: `Bearer ${e.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } });
  let datos = {};
  try { datos = await r.json(); } catch { datos = {}; }
  return { ok: r.ok, estado: r.status, datos };
}
// El pago vale si está aprobado, es de esta app y alcanza el precio.
function pagoValido(pago, rubro) {
  return pago?.status === 'approved' && String(pago.external_reference || '').startsWith(`${rubro.id}:`) && Number(pago.transaction_amount) >= rubro.precio;
}

export async function manejarTienda(request, e) {
  const url = new URL(request.url);
  const conectada = !!(e.env.MP_ACCESS_TOKEN && e.env.LICENCIA_SECRETO);
  try {
    if (url.pathname === '/api/comprar') {
      const rubro = APPS[url.searchParams.get('app')];
      if (!rubro) return new Response('Esa app no existe.', { status: 404 });
      if (!conectada) return new Response('La tienda todavía no está conectada a Mercado Pago.', { status: 503 });
      const referencia = `${rubro.id}:${aHex(crypto.getRandomValues(new Uint8Array(10)))}`;
      const { ok, datos } = await mercadoPago(e, '/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ title: `${rubro.titulo || rubro.nombre} (pago único)`, quantity: 1, unit_price: rubro.precio, currency_id: 'ARS' }],
          external_reference: referencia,
          back_urls: { success: `${url.origin}/gracias.html?app=${rubro.id}`, pending: `${url.origin}/gracias.html?app=${rubro.id}`, failure: `${url.origin}/${rubro.archivo}/?pago=no` },
          auto_return: 'approved',
          binary_mode: true,          // se aprueba o se rechaza en el momento: la app se entrega al instante
          // Sin efectivo (Rapipago, Pago Fácil): tarda días en acreditarse y la app se promete al instante.
          payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
        }),
      });
      if (!ok || !datos.init_point) return new Response('Mercado Pago no pudo armar el cobro. Probá de nuevo en un rato.', { status: 502 });
      return new Response(null, { status: 302, headers: { Location: datos.init_point, 'Cache-Control': 'no-store' } });
    }

    if (url.pathname === '/api/activar') {
      const rubro = APPS[url.searchParams.get('app')];
      const pagoId = url.searchParams.get('pago') || '';
      if (!rubro || !/^\d{4,20}$/.test(pagoId)) return json({ ok: false, motivo: 'datos' }, 400);
      if (!conectada) return json({ ok: false, motivo: 'tienda' }, 503);
      const { ok, datos: pago } = await mercadoPago(e, `/v1/payments/${pagoId}`);
      if (!ok) return json({ ok: false, motivo: 'no_encontrado' }, 404);
      // Para que nadie active con un número de pago ajeno, hay que traer la
      // referencia de la compra (viene sola al volver de Mercado Pago) o el
      // mail con el que se pagó (para recuperar la compra a mano).
      const ref = url.searchParams.get('ref') || '';
      const mail = (url.searchParams.get('mail') || '').trim().toLowerCase();
      const esSuyo = (ref && iguales(ref, String(pago.external_reference || ''))) || (mail && mail === String(pago.payer?.email || '').toLowerCase());
      if (!esSuyo) return json({ ok: false, motivo: 'no_encontrado' }, 404);
      if (['pending', 'in_process', 'authorized'].includes(pago.status)) return json({ ok: false, motivo: 'pendiente' });
      if (!pagoValido(pago, rubro)) return json({ ok: false, motivo: 'no_aprobado' });
      return json({ ok: true, app: rubro.id, licencia: await licenciaDe(e.env, rubro.id, pagoId), abrir: `/${rubro.archivo}/app.html` });
    }

    if (url.pathname === '/api/verificar') {
      const lic = await leerLicencia(e.env, url.searchParams.get('licencia'));
      if (!lic) return json({ ok: false });
      // Si el pago se devolvió, la licencia deja de activar celulares nuevos.
      try {
        const { ok, datos: pago } = await mercadoPago(e, `/v1/payments/${lic.pago}`);
        if (ok && !pagoValido(pago, APPS[lic.app])) return json({ ok: false });
      } catch { /* sin conexión con Mercado Pago: alcanza con la firma */ }
      return json({ ok: true, app: lic.app });
    }
    return null;
  } catch (err) {
    console.error('tienda:', err?.stack || err);
    return json({ ok: false, motivo: 'error' }, 500);
  }
}
