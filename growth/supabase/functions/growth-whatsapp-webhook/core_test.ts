import { handleWebhook } from './core.ts';
const SECRET = 'synthetic-test-secret';
const config = { workspace_id: 'test-workspace', waba_id: '456', phone_number_id: '123' };
const raw = { object: 'whatsapp_business_account', entry: [{ id: '456', changes: [{ field: 'messages', value: { metadata: { phone_number_id: '123' }, messages: [{ id: 'in1', from: '5491100000001', text: { body: 'BAJA' } }], statuses: [{ id: 'out1', status: 'delivered', timestamp: '1' }] } }] }] };
function check(condition: unknown) { if (!condition) throw new Error('Assertion failed'); }
async function signed(payload: unknown, secret = SECRET) {
  const body = JSON.stringify(payload);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return new Request('https://example.test/hook', { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=' + hex } });
}
Deno.test('no secrets: no database access', async () => {
  const r = await handleWebhook(new Request('https://example.test', { method: 'POST' }), {}, { configurations() { throw new Error('must not read'); }, record() { throw new Error('must not write'); } }); check(r.status === 503);
});
Deno.test('Meta verification challenge and invalid token', async () => {
  const deps = { configurations: () => Promise.resolve([]), record: () => Promise.resolve() };
  let r = await handleWebhook(new Request('https://example.test?hub.mode=subscribe&hub.verify_token=test&hub.challenge=abc'), { verifyToken: 'test' }, deps); check(await r.text() === 'abc');
  r = await handleWebhook(new Request('https://example.test?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc'), { verifyToken: 'test' }, deps); check(r.status === 403);
});
Deno.test('signed inbound and status; reject tampering', async () => {
  const events: unknown[] = [];
  const deps = { configurations: () => Promise.resolve([config]), record: (_ws: string, e: unknown) => { events.push(e); return Promise.resolve(); } };
  let r = await handleWebhook(await signed(raw), { appSecret: SECRET }, deps); check(r.status === 200 && events.length === 2);
  r = await handleWebhook(await signed(raw, 'wrong'), { appSecret: SECRET }, deps); check(r.status === 403 && events.length === 2);
});
Deno.test('ignore foreign WABA/number; never contact someone', async () => {
  const events: unknown[] = [];
  const deps = { configurations: () => Promise.resolve([{ ...config, phone_number_id: 'other' }]), record: (_ws: string, e: unknown) => { events.push(e); return Promise.resolve(); } };
  const r = await handleWebhook(await signed(raw), { appSecret: SECRET }, deps); check(r.status === 200 && events.length === 0);
});
Deno.test('database failure requests retry; reject huge request', async () => {
  const deps = { configurations: () => Promise.resolve([config]), record: () => Promise.reject(new Error('db')) };
  const r = await handleWebhook(await signed(raw), { appSecret: SECRET }, deps); check(r.status === 503);
  const huge = new Request('https://example.test', { method: 'POST', headers: { 'content-length': '2000000' }, body: 'x' });
  check((await handleWebhook(huge, { appSecret: SECRET }, deps)).status === 413);
});
Deno.test('account alerts are normalized to a pause event', async () => {
  const events: unknown[] = [];
  const alert = { object: 'whatsapp_business_account', entry: [{ id: '456', changes: [{ field: 'account_alerts', value: { alert_type: 'restriction' } }] }] };
  const deps = { configurations: () => Promise.resolve([config]), record: (_ws: string, e: unknown) => { events.push(e); return Promise.resolve(); } };
  const r = await handleWebhook(await signed(alert), { appSecret: SECRET }, deps); check(r.status === 200 && events.length === 1);
});
