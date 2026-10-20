// Sólo Web APIs: pruebas sin llamadas a Meta ni a Supabase.
type Config = { workspace_id: string; waba_id: string; phone_number_id: string };
type ObjectMap = Record<string, unknown>;
export type Event = ObjectMap & { key: string; kind: string };
export type Dependencies = {
  configurations(waba: string, phone?: string): Promise<Config[]>;
  record(workspace: string, event: Event): Promise<void>;
};
const object = (v: unknown): ObjectMap => v && typeof v === 'object' && !Array.isArray(v) ? v as ObjectMap : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown): string => typeof v === 'string' ? v : '';
const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers: { 'content-type': 'application/json' } });

export async function validSignature(bytes: Uint8Array, signature: string, secret: string): Promise<boolean> {
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const digest = Uint8Array.from(signature.slice(7).match(/../g)!, (hex) => parseInt(hex, 16));
  return crypto.subtle.verify('HMAC', key, digest, new Uint8Array(bytes).buffer);
}
async function limitedBody(req: Request): Promise<Uint8Array> {
  if (Number(req.headers.get('content-length') || 0) > 1_048_576) throw new Error('too_large');
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 1_048_576) { await reader.cancel(); throw new Error('too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function handleWebhook(req: Request, env: { appSecret?: string; verifyToken?: string }, deps: Dependencies): Promise<Response> {
  if (req.method === 'GET') {
    if (!env.verifyToken) return reply(503, 'not_configured');
    const q = new URL(req.url).searchParams;
    if (q.get('hub.mode') !== 'subscribe' || q.get('hub.verify_token') !== env.verifyToken || !q.has('hub.challenge')) return reply(403, 'verification_failed');
    return new Response(q.get('hub.challenge')!, { headers: { 'content-type': 'text/plain' } });
  }
  if (req.method !== 'POST') return reply(405, 'method_not_allowed');
  if (!env.appSecret) return reply(503, 'not_configured');
  let bytes: Uint8Array;
  try { bytes = await limitedBody(req); } catch { return reply(413, 'too_large'); }
  if (!await validSignature(bytes, req.headers.get('x-hub-signature-256') || '', env.appSecret)) return reply(403, 'invalid_signature');
  let payload: ObjectMap;
  try { payload = object(JSON.parse(new TextDecoder().decode(bytes))); } catch { return reply(400, 'invalid_json'); }
  if (payload.object !== 'whatsapp_business_account') return reply(400, 'invalid_object');
  try {
    for (const rawEntry of array(payload.entry)) {
      const entry = object(rawEntry); const waba = text(entry.id);
      for (const rawChange of array(entry.changes)) {
        const change = object(rawChange); const value = object(change.value);
        const field = text(change.field); const phone = text(object(value.metadata).phone_number_id);
        const configs = await deps.configurations(waba, field === 'messages' ? phone : undefined);
        for (const cfg of configs) {
          if (!waba || cfg.waba_id !== waba || (field === 'messages' && (!phone || cfg.phone_number_id !== phone))) continue;
          if (field === 'messages') {
            for (const raw of array(value.messages)) {
              const m = object(raw); const id = text(m.id); if (!id) continue;
              const body = text(object(m.text).body) || text(object(m.button).payload) || text(object(object(m.interactive).button_reply).id);
              await deps.record(cfg.workspace_id, { key: 'in:' + id, kind: 'message', phone: text(m.from), external_id: id, body: body.slice(0, 4000), timestamp: text(m.timestamp) });
            }
            for (const raw of array(value.statuses)) {
              const s = object(raw); const id = text(s.id); const status = text(s.status); if (!id || !['sent', 'delivered', 'read', 'failed'].includes(status)) continue;
              const firstError = object(array(s.errors)[0]);
              await deps.record(cfg.workspace_id, { key: `status:${id}:${status}:${text(s.timestamp)}`, kind: 'status', external_id: id, phone: text(s.recipient_id), status, error: JSON.stringify(firstError).slice(0, 500), timestamp: text(s.timestamp) });
            }
          } else if (['account_alerts', 'phone_number_quality_update', 'message_template_status_update', 'business_capability_update'].includes(field)) {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(change)));
            const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
            await deps.record(cfg.workspace_id, { key: 'alert:' + key, kind: 'account_alert', field, body: JSON.stringify(value).slice(0, 4000) });
          }
        }
      }
    }
  } catch { return reply(503, 'storage_unavailable'); } // Meta reintenta; los event_key son idempotentes.
  return reply(200, 'received');
}
