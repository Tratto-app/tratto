// node --test tools/supabase-functions/pago-mp/handler.test.mjs
// Sin red, sin secretos y sin tocar producción: la base y Mercado Pago son
// dobles que anotan lo que se les pidió.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearHandler, crearMP, COMISION_PORC } from './handler.mjs';

const ORIGEN = 'https://www.trattoapp.com.ar';
const FUNC = 'https://x.supabase.co/functions/v1/pago-mp';

function pedido(cuerpo, { token = 'tok-cliente', query = '' } = {}) {
  const headers = { origin: ORIGEN, 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  return new Request(FUNC + query, { method: 'POST', headers, body: JSON.stringify(cuerpo) });
}

function dobles({ credito = false, presu = {}, cuenta = { access_token: 'APP_USR-prov' }, pago = { id: 777, status: 'approved',
  external_reference: 'presu-900', transaction_amount: 45000, currency_id: 'ARS' }, pref = { init_point: 'https://mp/pagar' } } = {}) {
  const log = { prefs: [], pagos: [], updates: [], tokens: [], rpc: [] };
  const fila = { id: 900, match_id: 77, tipo: 'presupuesto', monto: 45000, estado_presupuesto: 'aceptado',
    trabajo_estado: 'terminado', pago_estado: null, ...presu };
  const tablas = {
    mensajes: fila,
    matches: { id: 77, solicitudes: { user_id: 'u-cliente', zona: 'GBA Sur', servicio_necesitado: 'Pintura' },
      proveedores: { user_id: 'u-prov', zona: 'CABA' } },
    cuentas_mp: cuenta,
  };
  const libres = credito ? [{ id: 1, reservado_en: null }] : [];
  const desde = tabla => {
    const q = {
      select: () => q, eq: () => q,
      is: () => (tabla === 'creditos' ? Promise.resolve({ data: libres, error: null }) : q),
      maybeSingle: async () => ({ data: tablas[tabla], error: null }),
      update: datos => { log.updates.push([tabla, datos]); return { eq: () => ({ is: async () => ({ error: null }) }) }; },
    };
    return q;
  };
  const sb = {
    auth: { getUser: async t => t === 'tok-cliente'
      ? { data: { user: { id: 'u-cliente', email: 'c@x.com' } }, error: null }
      : t === 'tok-otro' ? { data: { user: { id: 'u-otro', email: 'o@x.com' } }, error: null }
      : { data: { user: null }, error: { message: 'no' } } },
    from: desde,
    rpc: async (nombre, args) => { log.rpc.push([nombre, args]);
      return { data: nombre === 'credito_cobro_reservar' ? credito : null, error: null }; },
  };
  const mpDe = token => {
    log.tokens.push(token);
    return {
      preferencia: async (cuerpo, idem) => { log.prefs.push([cuerpo, idem]); return pref; },
      pago: async id => { log.pagos.push(id); return pago; },
    };
  };
  return { sb, mpDe, log };
}

const handler = d => crearHandler({ sb: d.sb, mpDe: d.mpDe, urlFuncion: FUNC });

test('arma el pago en Mercado Pago con la cuenta de quien cobra y la comisión de Tratto', async () => {
  const d = dobles();
  const r = await handler(d)(pedido({ accion: 'preferencia', presupuesto_id: 900 }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { link: 'https://mp/pagar', sin_comision: false });
  assert.deepEqual(d.log.tokens, ['APP_USR-prov']);
  const [cuerpo] = d.log.prefs[0];
  assert.equal(cuerpo.items[0].unit_price, 45000);
  assert.equal(cuerpo.marketplace_fee, Math.round(45000 * COMISION_PORC / 100));
  assert.equal(cuerpo.external_reference, 'presu-900');
  assert.equal(cuerpo.back_urls.success, ORIGEN + '/?pago_mp=900');
  assert.equal(cuerpo.notification_url, FUNC + '?aviso=1&presu=900');
  assert.equal(cuerpo.binary_mode, true);
  assert.deepEqual(cuerpo.payment_methods.excluded_payment_types.map(x => x.id), ['ticket', 'atm']);
});

test('no deja pagar lo ajeno, lo no terminado, lo ya pagado ni sin cuenta conectada', async () => {
  assert.equal((await handler(dobles())(pedido({ accion: 'preferencia', presupuesto_id: 900 }, { token: 'tok-otro' }))).status, 403);
  assert.equal((await handler(dobles())(pedido({ accion: 'preferencia', presupuesto_id: 900 }, { token: null }))).status, 401);
  assert.equal((await handler(dobles({ presu: { trabajo_estado: null } }))(pedido({ accion: 'preferencia', presupuesto_id: 900 }))).status, 409);
  assert.equal((await handler(dobles({ presu: { pago_estado: 'cobrado' } }))(pedido({ accion: 'preferencia', presupuesto_id: 900 }))).status, 409);
  const sin = await handler(dobles({ cuenta: null }))(pedido({ accion: 'preferencia', presupuesto_id: 900 }));
  assert.equal(sin.status, 409);
  assert.match((await sin.json()).error, /no conectó su cuenta/);
});

test('al volver, confirma con Mercado Pago y registra el pago con las jurisdicciones', async () => {
  const d = dobles();
  const r = await handler(d)(pedido({ accion: 'verificar', presupuesto_id: 900, pago_id: '777' }));
  assert.deepEqual(await r.json(), { estado: 'cobrado' });
  assert.deepEqual(d.log.pagos, ['777']);
  const [tabla, datos] = d.log.updates[0];
  assert.equal(tabla, 'mensajes');
  assert.deepEqual(datos, { pago_id: '777', pago_estado: 'cobrado', jurisdiccion_proveedor: 'CABA',
    jurisdiccion_trabajo: 'PBA', zona_proveedor: 'CABA', zona_trabajo: 'GBA Sur' });
});

test('no registra pagos de otro presupuesto, rechazados o por menos plata', async () => {
  for (const pago of [
    { id: 777, status: 'approved', external_reference: 'presu-901', transaction_amount: 45000, currency_id: 'ARS' },
    { id: 777, status: 'rejected', external_reference: 'presu-900', transaction_amount: 45000, currency_id: 'ARS' },
    { id: 777, status: 'approved', external_reference: 'presu-900', transaction_amount: 100, currency_id: 'ARS' },
  ]) {
    const d = dobles({ pago });
    const r = await handler(d)(pedido({ accion: 'verificar', presupuesto_id: 900, pago_id: '777' }));
    assert.notEqual((await r.json()).estado, 'cobrado');
    assert.equal(d.log.updates.length, 0);
  }
});

test('la notificación de Mercado Pago confirma igual, sin sesión', async () => {
  const d = dobles();
  const r = await handler(d)(pedido({ type: 'payment', data: { id: '777' } }, { token: null, query: '?aviso=1&presu=900' }));
  assert.deepEqual(await r.json(), { estado: 'cobrado' });
  assert.equal(d.log.updates.length, 1);
  // Otro tipo de aviso: se contesta bien y no se toca nada.
  const d2 = dobles();
  await handler(d2)(pedido({ type: 'merchant_order', data: { id: '5' } }, { token: null, query: '?aviso=1&presu=900' }));
  assert.equal(d2.log.pagos.length + d2.log.updates.length, 0);
});

test('si ya estaba pagado no vuelve a preguntar ni a escribir', async () => {
  const d = dobles({ presu: { pago_estado: 'cobrado' } });
  const r = await handler(d)(pedido({ accion: 'verificar', presupuesto_id: 900, pago_id: '777' }));
  assert.deepEqual(await r.json(), { estado: 'cobrado' });
  assert.equal(d.log.pagos.length + d.log.updates.length, 0);
});

test('crearMP pide la preferencia y el pago con el token de quien cobra', async () => {
  const pedidos = [];
  const mp = crearMP('APP_USR-prov', async (url, init) => {
    pedidos.push([url, init]);
    return { json: async () => ({ ok: true }) };
  });
  await mp.preferencia({ a: 1 }, 'idem-1');
  await mp.pago('777');
  assert.equal(pedidos[0][0], 'https://api.mercadopago.com/checkout/preferences');
  assert.equal(pedidos[0][1].headers.Authorization, 'Bearer APP_USR-prov');
  assert.equal(pedidos[0][1].headers['X-Idempotency-Key'], 'idem-1');
  assert.equal(pedidos[1][0], 'https://api.mercadopago.com/v1/payments/777');
});

test('premio de referidos: si quien cobra tiene un cobro sin comisión, el pago va sin la comisión y se marca usado', async () => {
  const d = dobles({ credito: true });
  const r = await handler(d)(pedido({ accion: 'preferencia', presupuesto_id: 900 }));
  assert.deepEqual(await r.json(), { link: 'https://mp/pagar', sin_comision: true });
  assert.equal(d.log.prefs[0][0].marketplace_fee, 0);
  assert.deepEqual(d.log.rpc[0], ['credito_cobro_reservar', { p_proveedor: 'u-prov', p_presupuesto_id: 900 }]);
  const m = await handler(d)(pedido({ accion: 'medio', presupuesto_id: 900 }));
  assert.deepEqual(await m.json(), { sin_comision: true });
  await handler(d)(pedido({ accion: 'verificar', presupuesto_id: 900, pago_id: '777' }));
  assert.ok(d.log.rpc.some(([n, a]) => n === 'credito_cobro_usar' && a.p_presupuesto_id === 900));
  // Sin premio, la comisión de siempre.
  const sin = dobles();
  await handler(sin)(pedido({ accion: 'preferencia', presupuesto_id: 900 }));
  assert.equal(sin.log.prefs[0][0].marketplace_fee, Math.round(45000 * COMISION_PORC / 100));
});
