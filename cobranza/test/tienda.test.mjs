// La venta automática: el cobro, la entrega de la licencia y sus candados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejarTienda, leerLicencia } from '../tienda/nucleo.js';

function tienda({ env = { MP_ACCESS_TOKEN: 'mp', LICENCIA_SECRETO: 'secreto' } } = {}) {
  const pagos = new Map(), cobros = [];
  let n = 9000;
  const responder = (datos, status = 200) => new Response(JSON.stringify(datos), { status });
  const salir = async (url, opciones = {}) => {
    if (url.endsWith('/checkout/preferences')) {
      const c = JSON.parse(opciones.body);
      cobros.push(c);
      const id = String(++n);
      pagos.set(id, { id: Number(id), status: 'approved', external_reference: c.external_reference, transaction_amount: c.items[0].unit_price, payer: { email: 'Ana@Mail.com' } });
      return responder({ id: `pref${id}`, init_point: `https://mp.test/pagar/${id}` });
    }
    const m = url.match(/\/v1\/payments\/(\d+)$/);
    return m && pagos.has(m[1]) ? responder(pagos.get(m[1])) : responder({}, 404);
  };
  const e = { env, salir };
  const pedir = async (ruta) => {
    const r = await manejarTienda(new Request(`https://tienda.test${ruta}`), e);
    const texto = await r.text();
    let datos; try { datos = JSON.parse(texto); } catch { datos = texto; }
    return { estado: r.status, datos, cabeceras: r.headers };
  };
  // Compra completa: devuelve el número de pago y la referencia, como los trae Mercado Pago al volver.
  const comprar = async (app) => { await pedir(`/api/comprar?app=${app}`); const id = String(n); return { id, ref: pagos.get(id).external_reference, pago: pagos.get(id) }; };
  return { pedir, comprar, pagos, cobros, e };
}

test('comprar arma el cobro con el precio de la app y vuelve a la página de gracias', async () => {
  const t = tienda();
  const r = await t.pedir('/api/comprar?app=cuotas');
  assert.equal(r.estado, 302);
  assert.equal(r.cabeceras.get('location'), 'https://mp.test/pagar/9001');
  const c = t.cobros[0];
  assert.deepEqual([c.items[0].unit_price, c.items[0].currency_id, c.auto_return, c.binary_mode], [29000, 'ARS', 'approved', true]);
  assert.equal(c.back_urls.success, 'https://tienda.test/gracias.html?app=cuotas');
  assert.match(c.external_reference, /^cuotas:[0-9a-f]{20}$/);
  await t.pedir('/api/comprar?app=control');
  assert.equal(t.cobros[1].items[0].unit_price, 59000);
  assert.equal((await t.pedir('/api/comprar?app=nada')).estado, 404);
  assert.equal((await tienda({ env: {} }).pedir('/api/comprar?app=cuotas')).estado, 503, 'sin las claves cargadas no vende');
});

test('al volver de pagar se entrega la licencia, y sirve para activar otro celular', async () => {
  const t = tienda();
  const { id, ref } = await t.comprar('libreta');
  const r = await t.pedir(`/api/activar?app=libreta&pago=${id}&ref=${encodeURIComponent(ref)}`);
  assert.deepEqual([r.datos.ok, r.datos.app, r.datos.abrir], [true, 'libreta', '/libreta/app.html']);
  assert.deepEqual(await leerLicencia(t.e.env, r.datos.licencia), { app: 'libreta', pago: id });
  assert.deepEqual((await t.pedir(`/api/verificar?licencia=${r.datos.licencia}`)).datos, { ok: true, app: 'libreta' });
});

test('nadie activa con un número de pago ajeno: hace falta la referencia o el mail', async () => {
  const t = tienda();
  const { id, ref } = await t.comprar('cuotas');
  assert.equal((await t.pedir(`/api/activar?app=cuotas&pago=${id}`)).estado, 404);
  assert.equal((await t.pedir(`/api/activar?app=cuotas&pago=${id}&ref=cuotas:0000`)).estado, 404);
  assert.equal((await t.pedir(`/api/activar?app=cuotas&pago=${id}&mail=otra@mail.com`)).estado, 404);
  assert.equal((await t.pedir(`/api/activar?app=cuotas&pago=${id}&mail=ana@mail.com`)).datos.ok, true, 'con el mail del pago recupera la compra');
  assert.equal((await t.pedir(`/api/activar?app=cuotas&pago=${id}&ref=${encodeURIComponent(ref)}`)).datos.ok, true);
  assert.equal((await t.pedir('/api/activar?app=cuotas&pago=abc')).estado, 400);
});

test('solo vale un pago aprobado, de esa app y por el precio completo', async () => {
  const t = tienda();
  const a = await t.comprar('control');
  const activar = (app, c) => t.pedir(`/api/activar?app=${app}&pago=${c.id}&ref=${encodeURIComponent(c.ref)}`);
  a.pago.status = 'in_process';
  assert.deepEqual((await activar('control', a)).datos, { ok: false, motivo: 'pendiente' });
  a.pago.status = 'rejected';
  assert.deepEqual((await activar('control', a)).datos, { ok: false, motivo: 'no_aprobado' });
  a.pago.status = 'approved';
  a.pago.transaction_amount = 100;
  assert.deepEqual((await activar('control', a)).datos, { ok: false, motivo: 'no_aprobado' }, 'pagó de menos');
  const barata = await t.comprar('libreta');
  assert.deepEqual((await activar('control', barata)).datos, { ok: false, motivo: 'no_aprobado' }, 'pagó otra app más barata');
});

test('una licencia inventada o retocada no sirve, y una compra devuelta deja de activar', async () => {
  const t = tienda();
  const c = await t.comprar('combi');
  const { licencia } = (await t.pedir(`/api/activar?app=combi&pago=${c.id}&ref=${encodeURIComponent(c.ref)}`)).datos;
  const [datos, sello] = licencia.split('.');
  for (const falsa of ['', 'hola', `${datos}.${'0'.repeat(40)}`, `${btoa('combi.1234')}.${sello}`, `${btoa(`control.${c.id}`)}.${sello}`]) {
    assert.deepEqual((await t.pedir(`/api/verificar?licencia=${encodeURIComponent(falsa)}`)).datos, { ok: false }, falsa);
  }
  assert.equal(await leerLicencia({ LICENCIA_SECRETO: 'otro' }, licencia), null, 'firmada con otra clave no vale');
  c.pago.status = 'refunded';
  assert.deepEqual((await t.pedir(`/api/verificar?licencia=${licencia}`)).datos, { ok: false });
});
