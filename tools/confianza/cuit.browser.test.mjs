// CUIL o CUIT confirmado con ARCA en el registro de quien ofrece servicios
// (reemplaza a la foto del DNI, 04/11/2026). La app real con el backend
// simulado: ninguna llamada sale del navegador.
//   node --test tools/confianza/cuit.browser.test.mjs
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {iniciar, abrir, prestador} from './app-simulada.mjs';

let entorno;
before(async () => { entorno = await iniciar(); });
after(async () => { await entorno?.cerrar(); });

const CUIL = '20-12345678-6', CUIT_EMP = '30-71234567-1';

// Backend del registro: ARCA conectada o no, y qué responde la función.
function backend({activa = true, resultado = 'coincide', silencioso = false} = {}) {
  return c => {
    if (c.path.endsWith('/rpc/cuit_verificacion_activa')) return {json: activa};
    if (c.path.endsWith('/functions/v1/validar-cuit')) {
      if (c.body.accion === 'confirmar') return {json: {resultado: 'coincide'}};
      return {json: silencioso ? {resultado: 'pendiente', silencioso: true} : {resultado}};
    }
    if (c.path.endsWith('/auth/v1/signup')) return {json: {access_token: 'tok-nuevo', refresh_token: 'r',
      user: {id: prestador, email: c.body.email, user_metadata: c.body.data}}};
    return null;
  };
}

async function abrirAlta(p, rol = 'proveedor') {
  await p.page.click('#tab-crear');
  await p.page.click('#rol-' + rol);
  if (rol === 'proveedor') {
    await p.page.waitForFunction(() => document.querySelector('#a-rubro').options.length > 2);
    await p.page.selectOption('#a-rubro', {index: 1});
  }
}
async function completarResto(p) {
  await p.page.fill('#a-tel', '11 5555 4444');
  await p.page.selectOption('#a-fiscal', 'monotributo');
  await p.page.fill('#a-email', 'marcela@example.invalid');
  await p.page.fill('#a-pass', 'clave-segura-123');
  await p.page.click('#a-legales');
}
const consultas = p => p.calls.filter(c => c.path.endsWith('/functions/v1/validar-cuit') && c.body.accion === 'consultar');

test('coincide: aparece el sello de latón y la cuenta se crea con el tipo y se confirma', async () => {
  const p = await abrir(entorno, {rol: null, handler: backend()});
  try {
    await abrirAlta(p);
    assert.ok(await p.page.locator('#a-ident-elige').isVisible(), 'se ve la elección por mi cuenta / con una empresa');
    await p.page.waitForSelector('#a-ident-intro:not(.oculto)');
    assert.equal(await p.page.locator('#a-nombre-label').innerText(), 'Nombre y apellido');
    await p.page.fill('#a-nombre', 'Marcela Gómez');
    await p.page.locator('#a-cuit').pressSequentially('20123456786');
    assert.equal(await p.page.inputValue('#a-cuit'), CUIL, 'los guiones se ponen solos');
    await p.page.waitForSelector('#a-ident-estado .sello.oro');
    assert.match(await p.page.locator('#a-ident-estado').innerText(), /Coincide con ARCA/i);
    assert.ok(await p.page.locator('#a-ident-par.ok.con-hilo').count(), 'el hilo se pone de latón');
    assert.deepEqual(consultas(p).at(-1).body, {accion: 'consultar', cuit: '20123456786', tipo: 'persona', nombre: 'Marcela Gómez'});
    await p.page.locator('#a-ident').scrollIntoViewIfNeeded();
    await p.foto('cuit-coincide');
    await completarResto(p);
    await p.page.click('#a-enviar');
    await p.page.waitForFunction(() => actual !== 'auth');
    const alta = p.calls.find(c => c.path.endsWith('/auth/v1/signup'));
    assert.equal(alta.body.data.cuit, '20123456786');
    assert.equal(alta.body.data.cuit_tipo, 'persona');
    assert.equal(alta.body.data.nombre, 'Marcela Gómez');
    await p.page.waitForFunction(() => true);
    const conf = p.calls.find(c => c.path.endsWith('/functions/v1/validar-cuit') && c.body.accion === 'confirmar');
    assert.ok(conf, 'apenas se crea la cuenta pide el sello');
    assert.equal(consultas(p).length, 1, 'no repite la consulta al crear la cuenta');
  } finally { await p.cerrar(); }
});

test('no coincide: explica, ofrece ayuda y no deja crear la cuenta', async () => {
  const p = await abrir(entorno, {rol: null, handler: backend({resultado: 'no_coincide'})});
  try {
    await abrirAlta(p);
    await p.page.fill('#a-nombre', 'Marce Gomes');
    await p.page.fill('#a-cuit', CUIL);
    await p.page.waitForSelector('#a-ident-estado.mal');
    const txt = await p.page.locator('#a-ident-estado').innerText();
    assert.match(txt, /no coincide con el de ese CUIL/);
    assert.match(txt, /Escribinos/);
    assert.ok(!txt.toUpperCase().includes('GOMEZ'), 'nunca muestra el nombre de ARCA');
    await p.page.locator('#a-ident').scrollIntoViewIfNeeded();
    await p.foto('cuit-no-coincide');
    await completarResto(p);
    await p.page.click('#a-enviar');
    await p.page.waitForTimeout(300);
    assert.equal(p.calls.filter(c => c.path.endsWith('/auth/v1/signup')).length, 0);
    assert.equal(await p.page.evaluate(() => document.activeElement.id), 'a-cuit');
  } finally { await p.cerrar(); }
});

test('un CUIT de empresa pasa solo a "Con una empresa" y cambia las etiquetas', async () => {
  const p = await abrir(entorno, {rol: null, handler: backend()});
  try {
    await abrirAlta(p);
    await p.page.fill('#a-nombre', 'Climatizar del Sur SRL');
    await p.page.locator('#a-cuit').pressSequentially('30712345671');
    await p.page.waitForSelector('[data-ident="empresa"][aria-checked="true"]');
    assert.equal(await p.page.locator('#a-nombre-label').innerText(), 'Nombre de la empresa');
    assert.equal(await p.page.locator('#a-cuit-label').innerText(), 'CUIT de la empresa');
    await p.page.waitForSelector('#a-ident-estado .sello.oro');
    assert.equal(consultas(p).at(-1).body.tipo, 'empresa');
    await p.page.locator('#a-ident').scrollIntoViewIfNeeded();
    await p.foto('cuit-empresa');
  } finally { await p.cerrar(); }
});

test('"Con una empresa" con un CUIL de persona: avisa sin consultar y frena', async () => {
  const p = await abrir(entorno, {rol: null, handler: backend()});
  try {
    await abrirAlta(p);
    await p.page.click('[data-ident="empresa"]');
    await p.page.fill('#a-nombre', 'Pinturería Gómez');
    await p.page.fill('#a-cuit', CUIL);
    await p.page.waitForSelector('#a-ident-estado.mal');
    assert.match(await p.page.locator('#a-ident-estado').innerText(), /es de una persona/);
    await p.page.waitForTimeout(1000);
    assert.equal(consultas(p).length, 0);
    await completarResto(p);
    await p.page.click('#a-enviar');
    await p.page.waitForTimeout(300);
    assert.equal(p.calls.filter(c => c.path.endsWith('/auth/v1/signup')).length, 0);
  } finally { await p.cerrar(); }
});

test('ARCA caída: avisa que se revisa después y deja seguir', async () => {
  const p = await abrir(entorno, {rol: null, handler: backend({resultado: 'pendiente'})});
  try {
    await abrirAlta(p);
    await p.page.fill('#a-nombre', 'Marcela Gómez');
    await p.page.fill('#a-cuit', CUIL);
    await p.page.waitForSelector('#a-ident-estado.nota');
    assert.match(await p.page.locator('#a-ident-estado').innerText(), /lo revisamos en un rato/);
    await completarResto(p);
    await p.page.click('#a-enviar');
    await p.page.waitForFunction(() => actual !== 'auth');
  } finally { await p.cerrar(); }
});

test('sin ARCA conectada: no promete el chequeo, no consulta y el alta sigue como antes', async () => {
  const p = await abrir(entorno, {rol: null, handler: backend({activa: false})});
  try {
    await abrirAlta(p);
    await p.page.waitForFunction(() => arcaActiva === false);
    assert.ok(await p.page.locator('#a-ident-intro').isHidden());
    assert.equal(await p.page.locator('#a-ident-par.con-hilo').count(), 0);
    assert.match(await p.page.locator('#a-cuit-ayuda').innerText(), /facturarte la comisión/);
    await p.page.fill('#a-nombre', 'Marcela Gómez');
    await p.page.fill('#a-cuit', CUIL);
    await completarResto(p);
    await p.page.click('#a-enviar');
    await p.page.waitForFunction(() => actual !== 'auth');
    assert.equal(consultas(p).length, 0);
  } finally { await p.cerrar(); }
});

test('cliente: queda "Tu nombre" y no hay CUIL ni elección', async () => {
  const p = await abrir(entorno, {rol: null, handler: backend()});
  try {
    await abrirAlta(p, 'cliente');
    assert.equal(await p.page.locator('#a-nombre-label').innerText(), 'Tu nombre');
    assert.ok(await p.page.locator('#a-ident-elige').isHidden());
    assert.ok(await p.page.locator('#a-cuit').isHidden());
  } finally { await p.cerrar(); }
});

test('ficha pública: muestra "CUIL verificado" cuando ARCA lo confirmó', async () => {
  const p = await abrir(entorno, {handler: c => {
    if (c.path.endsWith('/rpc/sello_fiscal')) return {json: 'cuil'};
    if (c.path.endsWith('/rest/v1/perfil_proveedor')) return {json: [{user_id: prestador, nombre: 'Marcela Gómez', titular: 'Plomería', trabajos_hechos: 3}]};
    return null;
  }});
  try {
    await p.page.evaluate(id => abrirFicha(id, false), prestador);
    await p.page.waitForSelector('#pf-medallas .sello-fiscal');
    assert.match(await p.page.locator("#pf-medallas").innerText(), /CUIL verificado/i);
    assert.match(await p.page.locator('#pf-nota-datos').innerText(), /Confirmamos con ARCA que su nombre y su CUIL van juntos/);
    assert.match(await p.page.locator('#pf-nota-datos').innerText(), /no los verificamos/);
    await p.foto('cuit-ficha');
  } finally { await p.cerrar(); }
});

test('panel: a quien ARCA no confirmó le pide el CUIL y la hoja lo resuelve', async () => {
  let confirmar = null;
  const p = await abrir(entorno, {rol: 'proveedor', handler: c => {
    if (c.path.endsWith('/rpc/cuit_mi_estado')) return {json: confirmar ? {activa: true, resultado: 'coincide'} : {activa: true, resultado: 'no_coincide'}};
    if (c.path.endsWith('/functions/v1/validar-cuit')) { confirmar = c.body; return {json: {resultado: 'coincide'}}; }
    return null;
  }});
  try {
    await p.page.evaluate(() => { sesion.user.user_metadata.cuit = '20123456786'; ir('panel'); cargarPanel(); });
    await p.page.waitForSelector('#cuil-abrir');
    assert.match(await p.page.locator('#panel-cuil').innerText(), /Confirmá tu CUIL/);
    await p.page.click('#cuil-abrir');
    assert.equal(await p.page.inputValue('#cc-cuit'), CUIL);
    await p.page.fill('#cc-nombre', 'Marcela Gómez');
    await p.foto('cuit-hoja');
    await p.page.click('#cc-confirmar');
    await p.page.waitForSelector('#cc-estado .sello.oro');
    assert.deepEqual(confirmar, {accion: 'confirmar', cuit: '20123456786', tipo: 'persona', nombre: 'Marcela Gómez'});
    await p.page.waitForSelector('#telon-cuil:not(.abierto)', {state: 'attached'});
    await p.page.waitForFunction(() => !document.querySelector('#cuil-abrir'));
  } finally { await p.cerrar(); }
});

test('panel: sin ARCA conectada no pide nada', async () => {
  const p = await abrir(entorno, {rol: 'proveedor', handler: c =>
    c.path.endsWith('/rpc/cuit_mi_estado') ? {json: {activa: false, resultado: null}} : null});
  try {
    await p.page.evaluate(() => { ir('panel'); cargarPanel(); });
    await p.page.waitForTimeout(400);
    assert.equal(await p.page.locator('#panel-cuil').innerText(), '');
  } finally { await p.cerrar(); }
});
