// La tienda en esta compu, con un Mercado Pago simulado (no se cobra nada).
//   npm run armar && node tools/tienda-local.mjs     → http://localhost:8793
// PAGO=pending simula un pago que queda en proceso.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { manejarTienda } from '../tienda/nucleo.js';

const TIPOS = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json' };

export function crearTienda({ puerto = 8793, estadoPago = process.env.PAGO || 'approved' } = {}) {
  const raiz = fileURLToPath(new URL('../dist/tienda/', import.meta.url));
  const origen = `http://localhost:${puerto}`;
  const pagos = new Map();
  let numero = 7000000000;
  const responder = (datos, status = 200) => new Response(JSON.stringify(datos), { status });
  const salir = async (url, opciones = {}) => {
    if (url.endsWith('/checkout/preferences')) {
      const c = JSON.parse(opciones.body);
      const id = String(++numero);
      pagos.set(id, { id: Number(id), status: estadoPago, external_reference: c.external_reference, transaction_amount: c.items[0].unit_price, payer: { email: 'compradora@ejemplo.com' } });
      return responder({ id: `pref-${id}`, init_point: `${origen}/__mp?pago=${id}&titulo=${encodeURIComponent(c.items[0].title)}&monto=${c.items[0].unit_price}&vuelve=${encodeURIComponent(c.back_urls.success)}` });
    }
    const m = url.match(/\/v1\/payments\/(\d+)$/);
    if (m) return pagos.has(m[1]) ? responder(pagos.get(m[1])) : responder({}, 404);
    throw new Error(`URL inesperada: ${url}`);
  };
  const e = { env: { MP_ACCESS_TOKEN: 'simulado', LICENCIA_SECRETO: 'secreto-de-prueba' }, salir };
  const servidor = http.createServer(async (req, res) => {
    const url = new URL(req.url, origen);
    try {
      if (url.pathname === '/__mp') {      // la pantalla de pago, simulada
        const p = pagos.get(url.searchParams.get('pago'));
        const vuelve = `${url.searchParams.get('vuelve')}&payment_id=${p.id}&status=${p.status}&external_reference=${encodeURIComponent(p.external_reference)}`;
        res.writeHead(200, { 'Content-Type': TIPOS.html });
        res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mercado Pago (simulado)</title><body style="font-family:system-ui;max-width:420px;margin:60px auto;padding:0 20px"><p style="color:#666">Mercado Pago simulado: acá no se cobra nada.</p><h1>${url.searchParams.get('titulo')}</h1><p style="font-size:2rem;font-weight:700">$ ${Number(url.searchParams.get('monto')).toLocaleString('es-AR')}</p><a id="pagar" href="${vuelve}" style="display:block;text-align:center;background:#009ee3;color:#fff;padding:16px;border-radius:10px;text-decoration:none;font-weight:700">Pagar</a></body>`);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        const r = await manejarTienda(new Request(url, { method: req.method }), e);
        if (!r) { res.writeHead(404); res.end('No existe'); return; }
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      const archivo = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      const cuerpo = await readFile(raiz + archivo.slice(1));
      res.writeHead(200, { 'Content-Type': TIPOS[archivo.split('.').pop()] || 'application/octet-stream' });
      res.end(cuerpo);
    } catch { res.writeHead(404); res.end('No existe'); }
  }).listen(puerto);
  return { servidor, origen, pagos, devolver: (id) => { pagos.get(String(id)).status = 'refunded'; } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { origen } = crearTienda();
  console.log(`Tienda de prueba en ${origen} (Mercado Pago simulado)`);
}
