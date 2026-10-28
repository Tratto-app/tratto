// Trabajo protegido e identidad comprobada en la app real, con el backend
// simulado: ninguna llamada sale del navegador (ni pagos, ni fotos, ni avisos).
//   node --test tools/confianza/trabajo-protegido.browser.test.mjs
// Con CAPTURAS=carpeta deja capturas de cada estado para mirarlas.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.TRATTO_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliente = '11111111-1111-4111-8111-111111111111';
const prestador = '22222222-2222-4222-8222-222222222222';
const capturas = process.env.CAPTURAS || '';
let browser, server, origin;

const presupuesto = (extra = {}) => ({id: 501, match_id: 17, tipo: 'presupuesto', remitente_tipo: 'proveedor',
  contenido: null, monto: 48000, incluye: 'Pintar living y comedor, dos manos, materiales aparte', plazo: '3 días',
  estado_presupuesto: 'aceptado', trabajo_estado: null, pago_estado: null, created_at: '2026-10-28T15:00:00Z', ...extra});

before(async () => {
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1)));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(file);
      const mime = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'application/javascript'
        : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
      res.writeHead(200, {'Content-Type': mime}); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: true});
});
after(async () => { await browser?.close(); await new Promise(r => server?.close(r)); });

async function app({rol = 'cliente', handler, width = 390}) {
  const context = await browser.newContext({viewport: {width, height: 844}});
  const page = await context.newPage(), calls = [], errors = [];
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === origin) return route.continue();
    if (req.resourceType() === 'script') return route.fulfill({status: 200, contentType: 'application/javascript', body: ''});
    if (req.resourceType() === 'stylesheet') return route.fulfill({status: 200, contentType: 'text/css', body: ''});
    if (req.method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH'}});
    let body = null; try { body = req.postDataJSON(); } catch {}
    const call = {path: url.pathname, query: url.search, method: req.method(), body};
    calls.push(call);
    const r = (handler && handler(call)) || {json: []};
    return route.fulfill({status: r.status || 200, contentType: 'application/json', body: JSON.stringify(r.json ?? []),
      headers: {'Access-Control-Allow-Origin': origin}});
  });
  await page.goto(origin);
  await page.waitForSelector('#arranque', {state: 'detached'});
  await page.evaluate(({cliente, prestador, rol}) => {
    const yo = rol === 'cliente' ? cliente : prestador;
    sesion = {access_token: 'token-simulado-no-real', user: {id: yo, email: 'x@example.invalid',
      user_metadata: {rol, nombre: 'Persona de prueba'}}};
    modo = rol;
    conexiones[17] = {id: 17, estado: 'aceptado',
      proveedores: {nombre: 'Prestador de prueba', zona: 'CABA', rubro: 'Pintura', descripcion: '', precio_desde: 1, precio_hasta: 2, disponibilidad: 'Lunes a viernes'},
      solicitudes: {user_id: cliente, nombre_cliente: 'Cliente de prueba', servicio_necesitado: 'Pintura', zona: 'CABA', presupuesto: 50000, urgencia: 'Esta semana', descripcion: ''}};
  }, {cliente, prestador, rol});
  return {page, calls, errors, async foto(nombre) {
    if (capturas) await page.screenshot({path: path.join(capturas, nombre + '.png'), fullPage: false});
  }, async cerrar() {
    // La pantalla entra deslizándose: se mide cuando terminó de entrar.
    await page.waitForFunction(() => !document.querySelector('.pantalla.desliza')).catch(() => {});
    const fuera = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth
      ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 5).map(e => e.tagName + '.' + e.className + '#' + e.id) : []);
    assert.deepEqual(fuera, [], 'sin scroll horizontal');
    await context.close();
    assert.deepEqual(errors, [], 'la app no debe lanzar errores');
  }};
}

async function abrirChat(p) {
  await p.page.evaluate(() => abrirChat(17));
  await p.page.waitForSelector('[data-presu="501"]');
}

for (const width of [320, 390]) test('el cliente ve la oferta y abre el pago de la cuota (' + width + 'px)', async () => {
  const p = await app({width, handler: c =>
    c.path.endsWith('/rest/v1/mensajes') ? {json: [presupuesto()]}
    : c.path.endsWith('/rpc/proteccion_cotizar') ? {json: {puede: true, cuota: 2400, monto: 48000, motivo: null}}
    : null});
  try {
    await abrirChat(p);
    await p.page.waitForSelector('[data-proteger="501"]');
    const txt = await p.page.locator('[data-prot="501"]').innerText();
    assert.match(txt, /Protegé este trabajo por \$\s?2\.400/);
    assert.match(txt, /48 horas hábiles/);
    await p.page.locator('[data-prot="501"]').scrollIntoViewIfNeeded();
    await p.foto('1-oferta-' + width);
    await p.page.locator('[data-proteger="501"]').click();
    const panel = p.page.locator('[data-pago-panel="501"][data-pago-tipo="cuota"]');
    await panel.waitFor();
    assert.match(await panel.locator('.pago-tit').innerText(), /TRABAJO PROTEGIDO/i);
    await panel.scrollIntoViewIfNeeded();
    await p.foto('2-pago-cuota-' + width);
    // "Ahora no" vuelve a la oferta.
    await panel.locator('[data-pago-cancelar]').click();
    await p.page.waitForSelector('[data-proteger="501"]');
    assert.equal(p.calls.some(c => c.path.includes('/functions/v1/trabajo-protegido')), false, 'no cobra nada sin tarjeta');
  } finally { await p.cerrar(); }
});

test('sin protección disponible (interruptor apagado) no se muestra nada', async () => {
  const p = await app({handler: c =>
    c.path.endsWith('/rest/v1/mensajes') ? {json: [presupuesto()]}
    : c.path.endsWith('/rpc/proteccion_cotizar') ? {json: {puede: false, cuota: 2400, motivo: 'Trabajo protegido todavía no está disponible.'}}
    : null});
  try {
    await abrirChat(p);
    await p.page.waitForTimeout(400);
    assert.equal(await p.page.locator('[data-prot]').count(), 0);
  } finally { await p.cerrar(); }
});

test('trabajo protegido: el cliente reclama que no se lo terminaron', async () => {
  let fila = {id: 'tp1', presupuesto_id: 501, estado: 'activa', quiere_seguir: null, plazo_reemplazo: null, cuota: 2400};
  const p = await app({handler: c => {
    if (c.path.endsWith('/rest/v1/mensajes')) return {json: [presupuesto()]};
    if (c.path.endsWith('/rest/v1/trabajos_protegidos')) return {json: [fila]};
    if (c.path.endsWith('/rpc/proteccion_reclamar')) {
      fila = {...fila, estado: 'reclamada', quiere_seguir: c.body.p_seguir, plazo_reemplazo: '2026-11-03T18:00:00Z'};
      return {json: fila};
    }
    return null;
  }});
  try {
    await abrirChat(p);
    await p.page.waitForSelector('[data-prot-reclamar="501"]');
    await p.page.locator('[data-prot="501"]').scrollIntoViewIfNeeded();
    await p.foto('3-protegido');
    await p.page.locator('[data-prot-reclamar="501"]').click();
    await p.page.waitForSelector('[data-prot-form="501"]');
    // Sin detalle no manda nada.
    await p.page.locator('[data-prot-enviar="501"]').click();
    assert.match(await p.page.locator('[data-prot-error]').innerText(), /qué pasó/);
    await p.page.locator('[data-prot-detalle]').fill('Dejó la pared a medio pintar el lunes y no contesta.');
    await p.page.locator('[data-prot-form="501"]').scrollIntoViewIfNeeded();
    await p.foto('4-reclamo');
    await p.page.locator('[data-prot-enviar="501"]').click();
    await p.page.waitForFunction(() => document.querySelector('[data-prot="501"]').innerText.includes('Reclamo en marcha'));
    const envio = p.calls.find(c => c.path.endsWith('/rpc/proteccion_reclamar'));
    assert.deepEqual(envio.body, {p_presupuesto_id: 501, p_seguir: true, p_detalle: 'Dejó la pared a medio pintar el lunes y no contesta.'});
    assert.match(await p.page.locator('[data-prot="501"]').innerText(), /martes 3\/11 a las 15:00/);
    await p.page.locator('[data-prot="501"]').scrollIntoViewIfNeeded();
    await p.foto('5-reclamado');
  } finally { await p.cerrar(); }
});

test('quien hace el trabajo ve que está protegido y no tiene botones del cliente', async () => {
  const p = await app({rol: 'proveedor', handler: c =>
    c.path.endsWith('/rest/v1/mensajes') ? {json: [presupuesto()]}
    : c.path.endsWith('/rest/v1/trabajos_protegidos') ? {json: [{id: 'tp1', presupuesto_id: 501, estado: 'activa', cuota: 2400}]}
    : null});
  try {
    await abrirChat(p);
    await p.page.waitForSelector('[data-prot="501"]');
    assert.match(await p.page.locator('[data-prot="501"]').innerText(), /perdés el distintivo/);
    assert.equal(await p.page.locator('[data-prot-reclamar]').count(), 0);
    assert.equal(p.calls.some(c => c.path.endsWith('/rpc/proteccion_cotizar')), false);
  } finally { await p.cerrar(); }
});

test('identidad: formulario, fotos y envío', async () => {
  const subidas = [];
  const p = await app({rol: 'proveedor', handler: c => {
    if (c.path.endsWith('/rpc/identidad_mi_estado')) return {json: subidas.length >= 4 ? {estado: 'pendiente'} : {desde: null, estado: null}};
    if (c.path.startsWith('/storage/v1/object/identidad/')) { subidas.push(c.path); return {json: {Key: c.path}}; }
    if (c.path.endsWith('/rpc/identidad_pedir')) { subidas.push('pedido'); return {json: 'pendiente'}; }
    return null;
  }});
  try {
    await p.page.evaluate(() => {
      misPerfiles = [{id: 1, rubro: 'Pintura'}]; ir('panel');
      document.getElementById('panel-datos').classList.remove('oculto'); cargarIdentidad();
    });
    await p.page.waitForSelector('#panel-identidad [data-ident-form]');
    await p.page.locator('#panel-identidad').scrollIntoViewIfNeeded();
    await p.foto('6-identidad');
    // Sin fotos no se manda.
    await p.page.locator('#panel-identidad [data-ident-nombre]').fill('Juana Pérez');
    await p.page.locator('#panel-identidad [data-ident-enviar]').click();
    assert.match(await p.page.locator('#panel-identidad [data-ident-error]').innerText(), /Falta la foto/);
    // Una imagen chica de verdad (1x1 PNG) para cada paso.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    for (const k of ['frente', 'dorso', 'selfie']) {
      await p.page.locator('#panel-identidad [data-ident-archivo="' + k + '"]').setInputFiles({name: k + '.png', mimeType: 'image/png', buffer: png});
      await p.page.waitForFunction(k => document.querySelector('#panel-identidad [data-ident-paso="' + k + '"]').classList.contains('lista'), k);
    }
    assert.equal(subidas.length, 3);
    assert.ok(subidas.every(s => /^\/storage\/v1\/object\/identidad\/22222222-2222-4222-8222-222222222222\/[0-9a-f-]{36}\.jpg$/.test(s)), 'rutas dentro de la carpeta propia');
    await p.page.locator('#panel-identidad [data-ident-enviar]').click();
    await p.page.waitForFunction(() => document.getElementById('panel-identidad').innerText.includes('Estamos revisando'));
    const pedido = p.calls.find(c => c.path.endsWith('/rpc/identidad_pedir'));
    assert.equal(pedido.body.p_nombre, 'Juana Pérez');
    assert.ok(pedido.body.p_frente && pedido.body.p_dorso && pedido.body.p_selfie);
  } finally { await p.cerrar(); }
});
