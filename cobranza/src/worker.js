// Entrada en Cloudflare. Un solo Worker sirve las pantallas, la API, el link
// de pago y los avisos de Mercado Pago y WhatsApp, y corre la tarea programada.
// Necesita: la base D1 conectada con el nombre DB y las claves del manual.
import { manejar, tareas } from './nucleo.js';
import { repoD1 } from './datos.js';
import { HTML, CSS, JS, VERSION } from './_web.js';

const SEGURIDAD = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex',
};
const archivo = (cuerpo, tipo, cache) => new Response(cuerpo, { headers: { 'Content-Type': tipo, 'Cache-Control': cache, ...SEGURIDAD } });

let repo = null;
function entorno(env) {
  repo ||= repoD1(env.DB);
  return { repo, env, ahora: () => new Date(), salir: (url, opciones) => fetch(url, opciones) };
}

export default {
  async fetch(request, env) {
    const ruta = new URL(request.url).pathname;
    if (ruta === '/app.css') return archivo(CSS, 'text/css; charset=utf-8', 'public, max-age=31536000, immutable');
    if (ruta === '/app.js') return archivo(JS, 'text/javascript; charset=utf-8', 'public, max-age=31536000, immutable');
    if (ruta === '/favicon.ico') return new Response(null, { status: 204 });
    if (ruta === '/version') return new Response(VERSION);
    if (!env.DB) {
      return new Response('Falta conectar la base de datos: en Cloudflare, Worker → Bindings → D1, con el nombre DB (paso 3 del manual).', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const r = await manejar(request, entorno(env));
    if (r) return r;
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('No existe', { status: 404 });
    return archivo(HTML, 'text/html; charset=utf-8', 'no-cache');
  },
  async scheduled(evento, env, ctx) {
    if (env.DB) ctx.waitUntil(tareas(entorno(env)));
  },
};
