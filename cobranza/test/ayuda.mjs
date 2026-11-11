// Arma una instalación de prueba: datos en memoria o en SQLite (igual que la
// D1 de Cloudflare), un reloj que se puede mover y servicios de afuera
// simulados (WhatsApp, Mercado Pago y Resend) que anotan lo que les piden.
import { DatabaseSync } from 'node:sqlite';
import { repoD1, repoMemoria } from '../src/datos.js';
import { d1DeSqlite } from '../tools/d1-sqlite.mjs';
import { manejar, tareas } from '../src/nucleo.js';
import { hmac } from '../src/servicios.js';

export const BASES = ['memoria', 'd1'];

// 10/03/2026 es martes. 13:00 UTC = 10:00 en Argentina.
export const MARTES_10H = '2026-03-10T13:00:00Z';
export const enAR = (fecha, hora = '10:00') => new Date(`${fecha}T${hora}:00-03:00`).toISOString();

export function crear(tipo, { demo = true, env = {} } = {}) {
  const d1 = tipo === 'd1' ? d1DeSqlite(new DatabaseSync(':memory:')) : null;
  const repo = d1 ? repoD1(d1) : repoMemoria();
  let ahora = new Date(MARTES_10H);
  const red = { enviados: [], textos: [], mails: [], preferencias: [], pagos: new Map(), errorWa: null, caida: false };
  const responder = (datos, status = 200) => new Response(JSON.stringify(datos), { status });
  const salir = async (url, init = {}) => {
    const cuerpo = init.body ? JSON.parse(init.body) : null;
    if (url.includes('graph.facebook.com') && url.endsWith('/messages')) {
      if (red.caida) throw new Error('sin red');
      if (red.errorWa) return responder({ error: red.errorWa }, 400);
      if (cuerpo.type === 'text') { red.textos.push(cuerpo); return responder({ messages: [{ id: `wamid.t${red.textos.length}` }] }); }
      red.enviados.push(cuerpo);
      return responder({ messages: [{ id: `wamid.${red.enviados.length}` }] });
    }
    if (url.includes('/checkout/preferences')) {
      red.preferencias.push(cuerpo);
      return responder({ id: `pref${red.preferencias.length}`, init_point: `https://mp.test/pagar/pref${red.preferencias.length}` });
    }
    if (url.includes('/v1/payments/')) {
      const pago = red.pagos.get(url.split('/').pop());
      return pago ? responder(pago) : responder({ message: 'not found' }, 404);
    }
    if (url.includes('api.resend.com')) { red.mails.push(cuerpo); return responder({ id: 'mail1' }); }
    throw new Error(`URL inesperada en la prueba: ${url}`);
  };
  const e = {
    repo, demo, salir, ahora: () => ahora,
    env: { WA_TOKEN: 't', WA_PHONE_ID: '111', WA_WABA_ID: '222', WA_APP_SECRET: 'secreto-wa', WA_VERIFY_TOKEN: 'verif', MP_ACCESS_TOKEN: 'mp', ...env },
  };
  const pedir = async (metodo, ruta, cuerpo, cabeceras = {}) => {
    const r = await manejar(new Request(`https://app.test${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-Cobranza': '1', ...cabeceras },
      body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    }), e);
    const texto = await r.text();
    let datos;
    try { datos = JSON.parse(texto); } catch { datos = texto; }
    return { estado: r.status, datos, cabeceras: r.headers };
  };
  let n = 0;
  return {
    e, red, repo, d1, pedir,
    poner(fechaIso) { ahora = new Date(fechaIso); },
    correr: () => tareas(e),
    automatico: async () => { await repo.preparar(); await repo.guardarConfig({ modo: 'auto' }); },
    // Carga una deuda con un cliente nuevo que aceptó recibir recordatorios.
    async deuda({ nombre, telefono, vence = '2026-03-10', concepto = 'la cuota de marzo', monto = '15.000', repite = 'unico', acepta = true, cliente_id } = {}) {
      n += 1;
      nombre ??= `Cliente ${n}`;
      telefono ??= `11 5555-${String(1000 + n)}`;
      const r = await pedir('POST', '/api/deudas', cliente_id ? { cliente_id, concepto, monto, vence, repite } : { concepto, monto, vence, repite, cliente: { nombre, telefono, acepta } });
      if (r.estado !== 200) throw new Error(`No se pudo cargar la deuda: ${JSON.stringify(r.datos)}`);
      return r.datos;
    },
    // Simula que el cliente escribe por WhatsApp al número del negocio.
    async escribe(telefono, texto, id = `wamid.in${++n}`) {
      const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from: telefono, type: 'text', text: { body: texto } }] } }] }] });
      return pedir('POST', '/webhook/whatsapp', cuerpo, { 'x-hub-signature-256': `sha256=${await hmac('secreto-wa', cuerpo)}` });
    },
  };
}
