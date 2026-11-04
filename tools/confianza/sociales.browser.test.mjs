// Entrar con Google (botón oficial de Google Identity Services) y Apple.
// La app real con el backend simulado; el script de Google se reemplaza por
// un doble que anota cómo se lo inicializó. Ninguna llamada sale del navegador.
//   node --test tools/confianza/sociales.browser.test.mjs
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {iniciar, abrir, cliente} from './app-simulada.mjs';

let entorno;
before(async () => { entorno = await iniciar(); });
after(async () => { await entorno?.cerrar(); });

// Doble de google.accounts.id: dibuja un botón que, al tocarlo, devuelve un
// token de prueba como lo haría Google.
const GIS_FALSO = () => {
  window.__gis = {};
  window.google = {accounts: {id: {
    initialize: o => { window.__gis.init = o; },
    renderButton: (caja, o) => {
      window.__gis.boton = o;
      const b = document.createElement('button');
      b.id = 'gis-falso'; b.textContent = 'Continuar con Google'; b.type = 'button';
      b.onclick = () => window.__gis.init.callback({credential: 'token-de-google-de-prueba'});
      caja.appendChild(b);
    },
  }}};
};
const ajustes = (externos) => c => c.path.endsWith('/auth/v1/settings') ? {json: {external: externos}} : null;

test('Google: botón oficial, nonce con huella y sesión por id_token', async () => {
  const p = await abrir(entorno, {rol: null, handler: c => {
    if (c.path.endsWith('/auth/v1/settings')) return {json: {external: {google: true, apple: true, email: true}}};
    if (c.path.endsWith('/auth/v1/token') && c.query.includes('grant_type=id_token')) return {json: {
      access_token: 'tok', refresh_token: 'r', user: {id: cliente, email: 'ana@example.invalid',
        app_metadata: {provider: 'google'}, user_metadata: {full_name: 'Ana Pérez'}}}};
    return null;
  }, antes: GIS_FALSO});
  try {
    await p.page.waitForSelector('#gis-falso');
    assert.ok(await p.page.locator('#a-google').isHidden(), 'el botón viejo queda escondido');
    assert.ok(await p.page.locator('#a-apple').isVisible());
    const gis = await p.page.evaluate(() => ({cid: window.__gis.init.client_id, nonce: window.__gis.init.nonce,
      modo: window.__gis.init.ux_mode, texto: window.__gis.boton.text, idioma: window.__gis.boton.locale}));
    assert.match(gis.cid, /\.apps\.googleusercontent\.com$/);
    assert.equal(gis.modo, 'popup');
    assert.equal(gis.texto, 'continue_with');
    assert.equal(gis.idioma, 'es-419');
    await p.page.click('#gis-falso');
    await p.page.waitForSelector('#p-auth.completando');
    const llamada = p.calls.find(c => c.path.endsWith('/auth/v1/token') && c.query.includes('grant_type=id_token'));
    assert.equal(llamada.body.provider, 'google');
    assert.equal(llamada.body.id_token, 'token-de-google-de-prueba');
    // A Google va la huella del nonce; a Supabase, el nonce tal cual.
    assert.equal(createHash('sha256').update(llamada.body.nonce).digest('hex'), gis.nonce);
    assert.equal(await p.page.inputValue('#a-nombre'), 'Ana Pérez');
    assert.ok(!p.calls.some(c => c.path.endsWith('/auth/v1/authorize')), 'no pasa por la página de Supabase');
  } finally { await p.cerrar(); }
});

test('Google: si el botón oficial no carga, queda el de siempre', async () => {
  const p = await abrir(entorno, {rol: null, handler: ajustes({google: true, apple: false, email: true})});
  try {
    await p.page.waitForFunction(() => !document.getElementById('a-google').classList.contains('oculto'));
    assert.ok(await p.page.locator('#a-google-gis').isHidden());
  } finally { await p.cerrar(); }
});

test('app de iPhone: no muestra Google ni Apple hasta tener el inicio nativo', async () => {
  const p = await abrir(entorno, {rol: null, handler: ajustes({google: true, apple: true, email: true}),
    antes: () => { window.Capacitor = {isNativePlatform: () => true}; }});
  try {
    await p.page.waitForTimeout(500);
    assert.ok(await p.page.locator('#a-sociales').isHidden());
    assert.ok(await p.page.locator('#a-apple').isHidden());
  } finally { await p.cerrar(); }
});
