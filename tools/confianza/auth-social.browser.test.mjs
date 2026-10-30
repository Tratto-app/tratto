// La app real y el puente nativo simulado. No abre cuentas ni proveedores OAuth.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {iniciar, abrir, cliente} from './app-simulada.mjs';

let entorno;
before(async () => { entorno = await iniciar(); });
after(async () => { await entorno?.cerrar(); });
const token = provider => ({access_token: 'token-simulado', refresh_token: 'refresh-simulado',
  user: {id: cliente, email: 'persona@example.invalid', app_metadata: {provider}, user_metadata: {}}});
const settings = c => c.path.endsWith('/auth/v1/settings')
  ? {json: {external: {google: true, apple: true}}} : null;
const tokens = p => p.calls.filter(c => c.path.endsWith('/auth/v1/token'));

async function nativa(p, {callback = 'ar.com.trattoapp.auth://callback?code=codigo-simulado',
  cancel = false, plugin = true} = {}) {
  await p.page.evaluate(({callback, cancel, plugin}) => {
    window.__nativeCalls = [];
    Object.defineProperty(navigator, 'userAgent', {configurable: true, value: 'iPhone TrattoApp/' + (plugin ? '3' : '2')});
    window.Capacitor = {isNativePlatform: () => true, isPluginAvailable: name => plugin && name === 'TrattoAuth',
      Plugins: {TrattoAuth: {
        openOAuth: async args => {
          window.__nativeCalls.push({method: 'openOAuth', args});
          if (cancel) throw {code: 'AUTH_CANCELED'};
          return {callbackUrl: callback};
        },
        signInWithApple: async args => {
          window.__nativeCalls.push({method: 'signInWithApple', args});
          if (cancel) throw {code: 'AUTH_CANCELED'};
          return {identityToken: 'identidad-apple-simulada', fullName: 'Ana Pérez'};
        }
      }}};
    return pintarSociales();
  }, {callback, cancel, plugin});
}

for (const width of [390, 1280]) {
  test(`Crear cuenta mantiene Google y Apple visibles antes y después de elegir rol (${width}px)`, async () => {
    const p = await abrir(entorno, {rol: null, width, handler: settings});
    try {
      await p.page.evaluate(() => { ir('auth'); cambiarAuth('crear'); });
      for (const rol of [null, 'cliente', 'proveedor']) {
        if (rol) await p.page.evaluate(rol => elegirRol(rol), rol);
        assert.ok(await p.page.locator('#a-google').isVisible());
        assert.ok(await p.page.locator('#a-apple').isVisible());
      }
      await p.foto(`alta-social-${width}`);
    } finally { await p.cerrar(); }
  });
}

test('iPhone ofrece Google sólo con puente seguro; conserva compatibilidad de la build anterior', async () => {
  const p = await abrir(entorno, {rol: null, handler: settings});
  try {
    await p.page.evaluate(() => ir('auth'));
    await nativa(p, {plugin: false});
    assert.ok(await p.page.locator('#a-google').isHidden());
    assert.ok(await p.page.locator('#a-apple').isVisible());
    await nativa(p);
    assert.ok(await p.page.locator('#a-google').isVisible());
    assert.ok(await p.page.locator('#a-apple').isVisible());
  } finally { await p.cerrar(); }
});

for (const path of ['', '/']) {
  test(`Google nativo intercambia PKCE y conserva rol y alta pendiente (callback ${path || 'sin barra'})`, async () => {
    const p = await abrir(entorno, {rol: null, handler: c => settings(c) ||
      (c.path.endsWith('/auth/v1/token') ? {json: token('google')} : null)});
    try {
      await nativa(p, {callback: `ar.com.trattoapp.auth://callback${path}?code=codigo-simulado`});
      await p.page.evaluate(() => { ir('auth'); cambiarAuth('crear'); elegirRol('proveedor'); });
      await p.page.evaluate(() => Promise.all([entrarCon('google'), entrarCon('google')]));
      const native = await p.page.evaluate(() => window.__nativeCalls);
      assert.equal(native.length, 1, 'doble toque no duplica la autorización');
      const url = new URL(native[0].args.url);
      assert.equal(url.origin, 'https://qglsonbcsncgekzbfafk.supabase.co');
      assert.equal(url.searchParams.get('redirect_to'), 'ar.com.trattoapp.auth://callback');
      assert.equal(url.searchParams.get('code_challenge_method'), 's256');
      assert.equal(tokens(p).length, 1);
      const exchange = tokens(p)[0];
      assert.equal(exchange.body.auth_code, 'codigo-simulado');
      assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(exchange.body.code_verifier).digest('base64url'));
      assert.ok(await p.page.locator('#p-auth.completando').isVisible());
      assert.equal(await p.page.evaluate(() => rolElegido), 'proveedor');
      assert.equal(await p.page.evaluate(() => localStorage.getItem('tratto_oauth')), null);
      assert.ok(await p.page.locator('#a-google').isEnabled());
      assert.equal(new URL(p.page.url()).origin, entorno.origin);
    } finally { await p.cerrar(); }
  });
}

for (const callback of ['https://ajeno.invalid/?code=no', 'ar.com.trattoapp.auth://otro?code=no',
  'ar.com.trattoapp.auth://usuario@callback?code=no', 'ar.com.trattoapp.auth://callback/extra?code=no',
  'ar.com.trattoapp.auth://callback?code=no#fragmento']) {
  test(`Rechaza callback inesperado sin intercambiar credenciales: ${callback}`, async () => {
    const p = await abrir(entorno, {rol: null, handler: settings});
    try {
      await nativa(p, {callback});
      await p.page.evaluate(() => { ir('auth'); return entrarCon('google'); });
      assert.equal(tokens(p).length, 0);
      assert.equal(await p.page.evaluate(() => localStorage.getItem('tratto_oauth')), null);
      assert.match(await p.page.locator('#a-aviso').innerText(), /No se pudo completar/);
      assert.ok(await p.page.locator('#a-google').isEnabled());
    } finally { await p.cerrar(); }
  });
}

for (const provider of ['google', 'apple']) {
  test(`${provider}: cancelar no crea sesión ni deja botones bloqueados`, async () => {
    const p = await abrir(entorno, {rol: null, handler: settings});
    try {
      await nativa(p, {cancel: true});
      await p.page.evaluate(provider => { ir('auth'); return entrarCon(provider); }, provider);
      assert.equal(tokens(p).length, 0);
      assert.equal(await p.page.evaluate(() => sesion), null);
      assert.match(await p.page.locator('#a-aviso').innerText(), /Cancelaste el ingreso/);
      assert.ok(await p.page.locator('#a-google').isEnabled());
      assert.ok(await p.page.locator('#a-apple').isEnabled());
    } finally { await p.cerrar(); }
  });
}

test('Apple nativo valida nonce y mantiene alta, nombre y términos pendientes', async () => {
  const p = await abrir(entorno, {rol: null, handler: c => settings(c) ||
    (c.path.endsWith('/auth/v1/token') ? {json: token('apple')} : null)});
  try {
    await nativa(p);
    await p.page.evaluate(() => { ir('auth'); cambiarAuth('crear'); elegirRol('proveedor'); return entrarCon('apple'); });
    const calls = await p.page.evaluate(() => window.__nativeCalls);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'signInWithApple');
    const exchange = tokens(p)[0];
    assert.match(exchange.query, /grant_type=id_token/);
    assert.equal(exchange.body.provider, 'apple');
    assert.equal(exchange.body.id_token, 'identidad-apple-simulada');
    assert.equal(calls[0].args.nonceHash, createHash('sha256').update(exchange.body.nonce).digest('hex'));
    assert.match(calls[0].args.nonceHash, /^[a-f0-9]{64}$/);
    assert.equal(await p.page.inputValue('#a-nombre'), 'Ana Pérez');
    assert.equal(await p.page.evaluate(() => rolElegido), 'proveedor');
    assert.ok(await p.page.locator('#p-auth.completando').isVisible());
    assert.ok(!(await p.page.locator('#a-legales').isChecked()), 'no acepta términos por la persona');
    assert.ok(await p.page.locator('#a-email').isHidden());
    assert.ok(!p.calls.some(c => c.path.endsWith('/auth/v1/user') && c.method === 'PUT'));
  } finally { await p.cerrar(); }
});

test('Apple: credencial rechazada por backend no inicia sesión', async () => {
  const p = await abrir(entorno, {rol: null, handler: c => settings(c) ||
    (c.path.endsWith('/auth/v1/token') ? {status: 400, json: {message: 'Unacceptable audience in id_token'}} : null)});
  try {
    await nativa(p);
    await p.page.evaluate(() => { ir('auth'); return entrarCon('apple'); });
    assert.equal(await p.page.evaluate(() => sesion), null);
    assert.ok(await p.page.locator('#a-apple').isEnabled());
    assert.ok(await p.page.locator('#p-auth.completando').isHidden());
  } finally { await p.cerrar(); }
});

test('Cuenta existente entra con su rol guardado sin repetir el alta ni sobrescribir sus datos', async () => {
  const existing = token('apple');
  existing.user.user_metadata = {rol: 'cliente', nombre: 'Nombre existente', legales_aceptados: true};
  const p = await abrir(entorno, {rol: null, handler: c => settings(c) ||
    (c.path.endsWith('/auth/v1/token') ? {json: existing} : null)});
  try {
    await nativa(p);
    await p.page.evaluate(() => { ir('auth'); cambiarAuth('crear'); elegirRol('proveedor'); return entrarCon('apple'); });
    await p.page.waitForFunction(() => actual === 'inicio');
    assert.equal(await p.page.evaluate(() => modo), 'cliente');
    assert.equal(await p.page.evaluate(() => sesion.user.user_metadata.nombre), 'Nombre existente');
    assert.ok(await p.page.locator('#p-auth.completando').isHidden());
    assert.ok(!p.calls.some(c => c.path.endsWith('/auth/v1/user') && c.method === 'PUT'));
  } finally { await p.cerrar(); }
});
