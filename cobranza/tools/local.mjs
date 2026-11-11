// Corre la app en esta compu, sin Cloudflare, con una base SQLite.
//   npm run armar && npm run local          → http://localhost:8788
// Variables: PUERTO, BASE (archivo .sqlite; por defecto en memoria),
// CLAVE_INSTALACION y las claves reales (MP_ACCESS_TOKEN, WA_TOKEN…).
// Con SIMULAR=1, Mercado Pago, WhatsApp y Resend se simulan (no sale nada).
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { d1DeSqlite } from './d1-sqlite.mjs';
import worker from '../dist/worker.js';

const puerto = Number(process.env.PUERTO || 8788);
const claves = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'WA_TOKEN', 'WA_PHONE_ID', 'WA_WABA_ID', 'WA_APP_SECRET', 'WA_VERIFY_TOKEN', 'WA_API_VERSION', 'RESEND_API_KEY', 'MAIL_DESDE'];
const env = {
  DB: d1DeSqlite(new DatabaseSync(process.env.BASE || ':memory:')),
  CLAVE_INSTALACION: process.env.CLAVE_INSTALACION || 'instalar-local',
  ...Object.fromEntries(claves.filter((k) => process.env[k]).map((k) => [k, process.env[k]])),
};
if (process.env.SIMULAR) {
  Object.assign(env, { MP_ACCESS_TOKEN: 'sim', WA_TOKEN: 'sim', WA_PHONE_ID: 'sim', WA_WABA_ID: 'sim', RESEND_API_KEY: 'sim' });
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async (url, opciones) => {
    const u = String(url);
    const ok = (datos) => new Response(JSON.stringify(datos), { status: 200 });
    if (u.includes('/checkout/preferences')) return ok({ id: `sim${++n}`, init_point: `http://localhost:${puerto}/?pago-simulado=${n}` });
    if (u.includes('graph.facebook.com') && u.endsWith('/messages')) return ok({ messages: [{ id: `wamid.sim${++n}` }] });
    if (u.includes('graph.facebook.com')) return ok({ data: [], display_phone_number: '+54 9 11 0000-0000', verified_name: 'Simulado', status: 'PENDING' });
    if (u.includes('api.mercadopago.com/users/me')) return ok({ nickname: 'CUENTA_SIMULADA' });
    if (u.includes('api.mercadopago.com') || u.includes('api.resend.com')) return ok({});
    return real(url, opciones);
  };
}
http.createServer(async (req, res) => {
  const trozos = [];
  for await (const t of req) trozos.push(t);
  try {
    if (req.url === '/__tareas') {
      const pendientes = [];
      await worker.scheduled({}, env, { waitUntil: (p) => pendientes.push(p) });
      res.end(JSON.stringify(await Promise.all(pendientes)));
      return;
    }
    const pedido = new Request(`http://localhost:${puerto}${req.url}`, {
      method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(trozos),
    });
    const r = await worker.fetch(pedido, env, { waitUntil() {} });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (err) { res.writeHead(500); res.end(String(err?.stack || err)); }
}).listen(puerto, () => console.log(`Cobranza sin vueltas en http://localhost:${puerto} (clave de instalación: ${env.CLAVE_INSTALACION})`));
