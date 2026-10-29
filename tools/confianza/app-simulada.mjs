// La app real (index.html) en un navegador, con el backend simulado: ninguna
// llamada sale del navegador. La usan las pruebas de las funciones nuevas.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.TRATTO_PLAYWRIGHT_MODULE || 'playwright');

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const cliente = '11111111-1111-4111-8111-111111111111';
export const prestador = '22222222-2222-4222-8222-222222222222';
const capturas = process.env.CAPTURAS || '';

export async function iniciar() {
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(raiz, pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1)));
    if (!file.startsWith(raiz + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(file);
      const mime = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'application/javascript'
        : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
      res.writeHead(200, {'Content-Type': mime}); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless: true});
  return {origin, browser, async cerrar() { await browser.close(); await new Promise(r => server.close(r)); }};
}

// rol: 'cliente' | 'proveedor' | null (sin sesión). handler(call) devuelve {json, status} o null.
export async function abrir(entorno, {rol = 'cliente', handler, width = 390, ruta = '/'} = {}) {
  const {origin, browser} = entorno;
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
      'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE'}});
    let body = null; try { body = req.postDataJSON(); } catch {}
    const call = {path: url.pathname, query: decodeURIComponent(url.search), method: req.method(), body};
    calls.push(call);
    const r = (handler && handler(call)) || {json: []};
    return route.fulfill({status: r.status || 200, contentType: 'application/json', body: JSON.stringify(r.json ?? []),
      headers: {'Access-Control-Allow-Origin': origin}});
  });
  await page.goto(origin + ruta);
  await page.waitForSelector('#arranque', {state: 'detached'});
  if (rol) {
    await page.evaluate(({cliente, prestador, rol}) => {
      const yo = rol === 'cliente' ? cliente : prestador;
      sesion = {access_token: 'token-simulado-no-real', user: {id: yo, email: 'x@example.invalid',
        user_metadata: {rol, nombre: 'Persona de prueba'}}};
      modo = rol;
    }, {cliente, prestador, rol});
  }
  return {page, calls, errors,
    async foto(nombre) { if (capturas) await page.screenshot({path: path.join(capturas, nombre + '.png'), fullPage: false}); },
    async cerrar() {
      await page.waitForFunction(() => !document.querySelector('.pantalla.desliza')).catch(() => {});
      const fuera = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth
        ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 5).map(e => e.tagName + '.' + e.className + '#' + e.id) : []);
      await context.close();
      assert.deepEqual(fuera, [], 'sin scroll horizontal');
      assert.deepEqual(errors, [], 'la app no debe lanzar errores');
    }};
}
