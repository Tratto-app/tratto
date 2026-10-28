// node --test tools/supabase-functions/trabajo-protegido/handler.test.mjs
// Sin red, sin secretos y sin tocar producción: la base, Storage y Mercado
// Pago son dobles que anotan lo que se les pidió.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearHandler, crearMP } from './handler.mjs';

const ORIGEN = 'https://www.trattoapp.com.ar';

function pedido(cuerpo, { token = 'tok-cliente', firma, metodo = 'POST' } = {}) {
  const headers = { origin: ORIGEN, 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  if (firma) headers['x-tratto-firma'] = firma;
  return new Request('https://x/functions/v1/trabajo-protegido', {
    method: metodo, headers, body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined,
  });
}

function dobles({ preparar, activar = 'activa', pago = { id: 991, status: 'approved' }, pendientes = [], porBorrar = [] } = {}) {
  const log = { rpc: [], cobros: [], devoluciones: [], borrados: [] };
  const sb = {
    auth: {
      getUser: async t => t === 'tok-cliente'
        ? { data: { user: { id: 'u-cliente', email: 'c@x.com' } }, error: null }
        : { data: { user: null }, error: { message: 'no' } },
    },
    rpc: async (nombre, args) => {
      log.rpc.push([nombre, args]);
      if (nombre === 'proteccion_preparar') return { data: preparar ?? { puede: true, cuota: 2400, monto: 48000 }, error: null };
      if (nombre === 'proteccion_activar') return activar instanceof Error ? { data: null, error: activar } : { data: activar, error: null };
      if (nombre === 'proteccion_devoluciones_pendientes') return { data: pendientes, error: null };
      if (nombre === 'proteccion_devuelta') return { data: null, error: null };
      if (nombre === 'identidad_archivos_por_borrar') return { data: porBorrar, error: null };
      return { data: null, error: { message: 'rpc desconocida' } };
    },
    storage: { from: b => ({ remove: async n => { log.borrados.push([b, n]); return { error: null }; } }) },
  };
  const mp = {
    cobrar: async (cuerpo, idem) => { log.cobros.push([cuerpo, idem]); return pago; },
    devolver: async (id, idem) => { log.devoluciones.push([id, idem]); return { id: 'dev-' + id }; },
  };
  return { sb, mp, log };
}

test('responde el preflight con el origen de Tratto', async () => {
  const { sb, mp } = dobles();
  const r = await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(pedido(null, { metodo: 'OPTIONS' }));
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGEN);
});

test('devolver y limpiar exigen la firma de la base', async () => {
  const { sb, mp, log } = dobles();
  const h = crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' });
  assert.equal((await h(pedido({ accion: 'devolver' }, { firma: 'otra' }))).status, 401);
  assert.equal((await h(pedido({ accion: 'limpiar' }))).status, 401);
  assert.equal(log.rpc.length, 0);
});

test('cobrar sin sesión válida no llega a Mercado Pago', async () => {
  const { sb, mp, log } = dobles();
  const h = crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' });
  assert.equal((await h(pedido({ accion: 'cobrar' }, { token: '' }))).status, 401);
  assert.equal((await h(pedido({ accion: 'cobrar' }, { token: 'vencido' }))).status, 401);
  assert.equal(log.cobros.length, 0);
});

test('sin la cuenta de Tratto configurada dice que no está disponible', async () => {
  const { sb } = dobles();
  const r = await crearHandler({ sb, mp: null, firma: 'f', publicKey: null })(pedido({ accion: 'clave' }));
  assert.equal(r.status, 503);
});

test('si la base dice que no se puede proteger, no cobra', async () => {
  const { sb, mp, log } = dobles({ preparar: { puede: false, motivo: 'Quien hace el trabajo todavía no comprobó su identidad.' } });
  const r = await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(
    pedido({ accion: 'cobrar', presupuesto_id: 7, card_token: 'ct', payment_method_id: 'visa' }));
  assert.equal(r.status, 409);
  assert.match((await r.json()).detalle, /identidad/);
  assert.equal(log.cobros.length, 0);
});

test('cobra la cuota que calcula la base, no la que manda el navegador', async () => {
  const { sb, mp, log } = dobles();
  const r = await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(
    pedido({ accion: 'cobrar', presupuesto_id: 7, card_token: 'ct', payment_method_id: 'visa', cuota: 1 }));
  const b = await r.json();
  assert.equal(b.estado, 'activa');
  assert.equal(log.cobros[0][0].transaction_amount, 2400);
  assert.equal(log.cobros[0][0].payer.email, 'c@x.com');
  assert.equal(log.cobros[0][1], 'tratto-protegido-7-ct');
  const act = log.rpc.find(x => x[0] === 'proteccion_activar')[1];
  assert.deepEqual(act, { p_presupuesto_id: 7, p_cliente: 'u-cliente', p_pago_id: '991', p_cuota: 2400 });
});

test('un rechazo de la tarjeta se explica y no activa nada', async () => {
  const { sb, mp, log } = dobles({ pago: { id: 5, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' } });
  const b = await (await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(
    pedido({ accion: 'cobrar', presupuesto_id: 7, card_token: 'ct', payment_method_id: 'visa' }))).json();
  assert.equal(b.estado, 'rechazado');
  assert.match(b.detalle, /saldo/);
  assert.ok(!log.rpc.some(x => x[0] === 'proteccion_activar'));
});

test('si ya estaba protegido, devuelve el cobro en el acto', async () => {
  const { sb, mp, log } = dobles({ activar: 'duplicado' });
  const r = await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(
    pedido({ accion: 'cobrar', presupuesto_id: 7, card_token: 'ct', payment_method_id: 'visa' }));
  const b = await r.json();
  assert.equal(b.devuelto, true);
  assert.deepEqual(log.devoluciones[0], ['991', 'tratto-devolucion-auto-991']);
});

test('si la base falla después de cobrar, también devuelve', async () => {
  const { sb, mp, log } = dobles({ activar: new Error('caída') });
  await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(
    pedido({ accion: 'cobrar', presupuesto_id: 7, card_token: 'ct', payment_method_id: 'visa' }));
  assert.equal(log.devoluciones.length, 1);
});

test('devolver procesa lo pendiente y lo marca devuelto', async () => {
  const { sb, mp, log } = dobles({ pendientes: [{ id: 'p1', pago_id: '111', cuota: 2400 }] });
  const b = await (await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(
    pedido({ accion: 'devolver' }, { token: '', firma: 'f' }))).json();
  assert.equal(b.hechas, 1);
  assert.deepEqual(log.devoluciones[0], ['111', 'tratto-devolucion-p1']);
  assert.deepEqual(log.rpc.at(-1), ['proteccion_devuelta', { p_id: 'p1', p_devolucion_id: 'dev-111' }]);
});

test('limpiar borra solo en el bucket de identidad lo que la base indica', async () => {
  const { sb, mp, log } = dobles({ porBorrar: ['u/a.jpg', 'u/b.jpg'] });
  const b = await (await crearHandler({ sb, mp, firma: 'f', publicKey: 'pk' })(
    pedido({ accion: 'limpiar' }, { token: '', firma: 'f' }))).json();
  assert.equal(b.borradas, 2);
  assert.deepEqual(log.borrados, [['identidad', ['u/a.jpg', 'u/b.jpg']]]);
});

test('crearMP manda la clave de idempotencia y la cuenta de Tratto', async () => {
  const llamadas = [];
  const mp = crearMP('APP_USR-x', async (url, op) => { llamadas.push([url, op]); return { json: async () => ({ id: 1 }) }; });
  await mp.devolver('42', 'k1');
  assert.equal(llamadas[0][0], 'https://api.mercadopago.com/v1/payments/42/refunds');
  assert.equal(llamadas[0][1].headers['X-Idempotency-Key'], 'k1');
  assert.equal(crearMP(''), null);
});
