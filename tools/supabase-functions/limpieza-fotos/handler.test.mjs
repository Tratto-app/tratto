import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCleanupHandler } from './handler.mjs';

const logger = { error() {} };
function fixture(overrides = {}) {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      if (overrides.rpc) return overrides.rpc(name, args);
      const data = name === 'fotos_para_borrar' ? []
        : name === 'servicio_evidencias_pendientes_borrado'
        ? [{ nombre: 'user/match/photo.jpg' }] : 1;
      return { data, error: null };
    },
    storage: { from(bucket) { return { async remove(names) {
      calls.push(['remove', bucket, names]);
      return overrides.remove ? overrides.remove(bucket, names)
        : { data: names.map(name => ({ name })), error: null };
    } }; } },
  };
  return { handler: createCleanupHandler(client, 'test-signature', logger), calls };
}
const request = (signature = 'test-signature', method = 'POST') => new Request(
  'https://example.test/limpieza-fotos', { method, headers: { 'x-tratto-firma': signature } });

test('no signature/wrong signature performs no database or Storage operation', async () => {
  const f = fixture();
  assert.equal((await f.handler(request('wrong'))).status, 401);
  assert.deepEqual(f.calls, []);
  const missing = createCleanupHandler({}, undefined, logger);
  assert.equal((await missing(request())).status, 401);
});

test('authorized GET cannot mutate storage', async () => {
  const f = fixture();
  assert.equal((await f.handler(request('test-signature', 'GET'))).status, 405);
  assert.deepEqual(f.calls, []);
});

test('private cleanup runs even when publications list is empty; ack after removal', async () => {
  const f = fixture(); const response = await f.handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls.map(x => x.slice(0,2)), [
    ['rpc','fotos_para_borrar'], ['rpc','servicio_evidencias_pendientes_borrado'],
    ['remove','servicio-evidencias'], ['rpc','servicio_evidencias_borradas'],
  ]);
  assert.deepEqual(f.calls[3][2], { p_names: ['user/match/photo.jpg'] });
  assert.equal((await response.json()).evidencias_borradas, 1);
});

test('failed/uncertain private deletion is not acknowledged', async () => {
  const f = fixture({ remove: async () => ({ data: null, error: { message: 'failed' } }) });
  const response = await f.handler(request());
  assert.equal(response.status, 500);
  assert.equal(f.calls.some(x => x[1] === 'servicio_evidencias_borradas'), false);
  assert.deepEqual((await response.json()).errores, [{ bucket: 'servicio-evidencias', paso: 'borrar' }]);
});

test('already absent object is acknowledged after a successful idempotent remove', async () => {
  const f = fixture({ remove: async () => ({ data: [], error: null }) });
  assert.equal((await f.handler(request())).status, 200);
  assert.equal(f.calls.some(x => x[1] === 'servicio_evidencias_borradas'), true);
});

test('private listing failure neither deletes nor acknowledges evidence', async () => {
  const f = fixture({ rpc: async name => name === 'fotos_para_borrar'
    ? { data: [], error: null } : { data: null, error: {} } });
  assert.equal((await f.handler(request())).status, 500);
  assert.equal(f.calls.some(x => x[0] === 'remove'), false);
});

test('ack failure reports failure and leaves retry to the database queue', async () => {
  const f = fixture({ rpc: async name => name === 'fotos_para_borrar'
    ? { data: [], error: null } : name === 'servicio_evidencias_pendientes_borrado'
    ? { data: [{ nombre: 'a/1/b.jpg' }, { nombre: 'a/1/b.jpg' }], error: null }
    : { data: null, error: {} } });
  const response = await f.handler(request());
  assert.equal(response.status, 500);
  assert.deepEqual(f.calls.find(x => x[0] === 'remove')[2], ['a/1/b.jpg']);
  assert.equal((await response.json()).errores[0].paso, 'confirmar');
});

test('publications keep their own bucket and RPC while evidence cleanup also proceeds', async () => {
  const f = fixture({ rpc: async name => ({ data:
    name === 'fotos_para_borrar' ? [{ nombre: 'pub.jpg' }]
    : name === 'servicio_evidencias_pendientes_borrado' ? [{ nombre: 'private.jpg' }] : 1,
    error: null }) });
  const response = await f.handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls.filter(x => x[0] === 'remove').map(x => x[1]),
    ['publicaciones','servicio-evidencias']);
  assert.deepEqual(f.calls.find(x => x[1] === 'fotos_borradas')[2], { nombres: ['pub.jpg'] });
});
