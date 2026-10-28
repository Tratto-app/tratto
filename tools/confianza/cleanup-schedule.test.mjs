import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../../supabase/migrations/20261028113131_servicio_evidencias_programar_limpieza.sql', import.meta.url), 'utf8');
async function fixture({ signature = true, validUrl = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema privado; create schema cron; create schema net; create schema vault;
    create table privado.config(clave text primary key, valor text);
    create table vault.secrets(name text primary key);
    create table vault.decrypted_secrets(name text primary key, decrypted_secret text);
    create table cron.jobs(jobname text, schedule text, command text);
    create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin
      insert into cron.jobs values($1,$2,$3); return 1;
    end $$;
    create table net.calls(url text, body jsonb, params jsonb, headers jsonb, timeout_ms int);
    create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000)
    returns bigint language plpgsql as $$begin
      insert into net.calls values(url,body,params,headers,timeout_milliseconds); return 42;
    end $$;
  `);
  await db.query('insert into privado.config values($1,$2)', ['url_funciones', validUrl ? 'https://exampleproject.supabase.co/functions/v1/' : 'https://other.test/']);
  if (signature) {
    await db.query('insert into vault.secrets values($1)', ['push_firma_quick_service']);
    await db.query('insert into vault.decrypted_secrets values($1,$2)', ['push_firma_quick_service', 'local-test-signature']);
  }
  return db;
}

test('new schedule only queues private evidence endpoint at runtime and has no public execution', async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    assert.deepEqual((await db.query('select * from cron.jobs')).rows, [{
      jobname: 'servicio-evidencias-limpieza', schedule: '30 6 * * *',
      command: 'select privado.servicio_programar_limpieza_evidencias()',
    }]);
    assert.equal((await db.query('select count(*)::int n from net.calls')).rows[0].n, 0);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await db.query(`select has_function_privilege($1,'privado.servicio_programar_limpieza_evidencias()','execute') permitido`, [role])).rows[0].permitido, false);
    }
    assert.equal((await db.query('select privado.servicio_programar_limpieza_evidencias() request_id')).rows[0].request_id, 42);
    const call = (await db.query('select * from net.calls')).rows[0];
    assert.equal(call.url, 'https://exampleproject.supabase.co/functions/v1/limpieza-fotos?solo=evidencias');
    assert.deepEqual(call.body, {}); assert.deepEqual(call.params, {});
    assert.equal(call.headers['x-tratto-firma'], 'local-test-signature');
    assert.equal(call.timeout_ms, 60000);
    assert.equal((await db.query('select command from cron.jobs')).rows[0].command.includes('local-test-signature'), false);
  } finally { await db.close(); }
});

test('missing signature or invalid destination fails migration without a schedule', async () => {
  for (const options of [{ signature: false }, { validUrl: false }]) {
    const db = await fixture(options);
    try {
      await assert.rejects(db.exec(migration), /Falta/);
      assert.equal((await db.query('select count(*)::int n from cron.jobs')).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::int n from net.calls')).rows[0].n, 0);
    } finally { await db.close(); }
  }
});

test('runtime rejects removed signature or changed destination before HTTP', async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    await db.exec('delete from vault.decrypted_secrets');
    await assert.rejects(db.query('select privado.servicio_programar_limpieza_evidencias()'), /Firma/);
    await db.exec("update privado.config set valor='https://other.test/'");
    await assert.rejects(db.query('select privado.servicio_programar_limpieza_evidencias()'), /Configuración/);
    assert.equal((await db.query('select count(*)::int n from net.calls')).rows[0].n, 0);
  } finally { await db.close(); }
});
