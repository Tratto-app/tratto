import { handleWebhook, type Config, type ObserverEvent } from './core.ts';
const assert = (v: unknown, message = 'assertion failed') => { if (!v) throw new Error(message); };
const cfg: Config = { workspace_id: 'workspace-test', waba_id: 'waba-test', phone_number_id: 'phone-test', business_phone: '+15550000001', history_shared: true };
const secret = 'test-only-signing-value';
const envelope = (field: string, value: Record<string, unknown>) => ({ object: 'whatsapp_business_account', entry: [{ id: cfg.waba_id, changes: [{ field, value: { metadata: { phone_number_id: cfg.phone_number_id }, ...value } }] }] });
async function invoke(payload: unknown, options: { config?: Config; fails?: boolean; unsigned?: boolean } = {}) {
  const raw = JSON.stringify(payload), bytes = new TextEncoder().encode(raw);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, bytes);
  const signature = 'sha256=' + Array.from(new Uint8Array(signed), b => b.toString(16).padStart(2, '0')).join('');
  const events: ObserverEvent[] = [];
  const response = await handleWebhook(new Request('https://test.invalid/webhook', { method: 'POST', body: raw, headers: options.unsigned ? {} : { 'x-hub-signature-256': signature } }), { appSecret: secret }, {
    configurations: () => Promise.resolve([options.config || cfg]),
    record: (_workspace, e) => { if (options.fails) throw new Error('db unavailable'); events.push(e); return Promise.resolve(); },
  });
  return { response, events };
}
Deno.test('rechaza firma inválida antes de almacenar', async () => {
  const r = await invoke(envelope('messages', { messages: [{ id: 'test1', from: '15550000002', timestamp: '1792028000', type: 'text', text: { body: 'Hola' } }] }), { unsigned: true });
  assert(r.response.status === 403 && r.events.length === 0);
});
Deno.test('recibe texto entrante y ecos del celular con direcciones reales', async () => {
  const incoming = await invoke(envelope('messages', { messages: [{ id: 'test-in', from: '15550000002', timestamp: '1792028000', type: 'text', text: { body: '¿Cómo me registro?' } }] }));
  const outgoing = await invoke(envelope('smb_message_echoes', { message_echoes: [{ id: 'test-out', from: '15550000001', to: '15550000002', timestamp: '1792027900', type: 'text', text: { body: 'Hola' } }] }));
  assert(incoming.events[0].direction === 'in' && incoming.events[0].body === '¿Cómo me registro?');
  assert(outgoing.events[0].direction === 'out' && outgoing.events[0].phone === '15550000002');
});
Deno.test('ignora otro WABA, phone ID y ecos de otro emisor', async () => {
  const payload = envelope('smb_message_echoes', { message_echoes: [{ id: 'x', from: '15550000003', to: '15550000002', timestamp: '1792028000' }] });
  assert((await invoke(payload)).events.length === 0);
  assert((await invoke(payload, { config: { ...cfg, waba_id: 'other' } })).events.length === 0);
  assert((await invoke(payload, { config: { ...cfg, phone_number_id: 'other' } })).events.length === 0);
});
Deno.test('historial usa el emisor del mensaje y no inventa dirección de mensajes ajenos', async () => {
  const payload = envelope('history', { history: [{ metadata: { phase: 0, chunk_order: 1, progress: 50 }, threads: [{ id: '15550000002', messages: [
    { id: 'out', from: '15550000001', timestamp: '1792027900', type: 'text', text: { body: 'Hola' } },
    { id: 'in', from: '15550000002', timestamp: '1792028000', type: 'text', text: { body: 'Sí' } },
    { id: 'other', from: '15550000003', timestamp: '1792028000', type: 'text', text: { body: 'Ajeno' } },
  ] }] }] });
  const r = await invoke(payload);
  assert(r.events.length === 3 && r.events[0].direction === 'out' && r.events[1].direction === 'in' && r.events[2].kind === 'history_progress');
  assert((await invoke(payload, { config: { ...cfg, history_shared: false } })).events.length === 0);
});
Deno.test('audio no se presenta como texto ni como transcripción', async () => {
  const r = await invoke(envelope('messages', { messages: [{ id: 'audio', from: '15550000002', timestamp: '1792028000', type: 'audio', audio: { id: 'asset-test' } }] }));
  assert(r.events[0].text_available === false && r.events[0].body === '' && r.events[0].media_pending === true);
});
Deno.test('contenido adicional de history sólo completa un mensaje existente', async () => {
  const r = await invoke(envelope('history', { messages: [{ id: 'asset', from: '15550000002', timestamp: '1792028000', type: 'image', image: { caption: 'Mi trabajo' } }] }));
  assert(r.events[0].media_update_only === true && r.events[0].body === 'Mi trabajo');
});
Deno.test('error de persistencia retorna503 para permitir reintento idempotente de Meta', async () => {
  const r = await invoke(envelope('messages', { messages: [{ id: 'x', from: '15550000002', timestamp: '1792028000', type: 'text', text: { body: 'Hola' } }] }), { fails: true });
  assert(r.response.status === 503);
});
Deno.test('cambio de cuenta se guarda como ciclo de vida sin copiar datos personales', async () => {
  const r = await invoke(envelope('account_update', { event: 'PARTNER_REMOVED', business_info: { private: 'do not copy' } }));
  assert(r.events[0].kind === 'account_update' && !JSON.stringify(r.events).includes('do not copy'));
});
Deno.test('challenge requiere token de verificación correcto', async () => {
  const deps = { configurations: () => Promise.resolve([]), record: () => Promise.resolve() };
  const r = await handleWebhook(new Request('https://test.invalid/?hub.mode=subscribe&hub.verify_token=test&hub.challenge=123'), { verifyToken: 'test' }, deps);
  assert(r.status === 200 && await r.text() === '123');
  const bad = await handleWebhook(new Request('https://test.invalid/?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123'), { verifyToken: 'test' }, deps);
  assert(bad.status === 403);
});
