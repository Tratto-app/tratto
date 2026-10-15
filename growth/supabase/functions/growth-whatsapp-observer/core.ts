// Receptor exclusivamente de lectura. No contiene un cliente de envío a Meta.
type Obj = Record<string, unknown>;
export type ObserverEvent = Obj & { key: string; kind: string; phone?: string; timestamp?: string };
export type Config = { workspace_id: string; waba_id: string; phone_number_id: string; business_phone: string; history_shared: boolean };
export type Dependencies = {
  configurations(waba: string, phone?: string): Promise<Config[]>;
  record(workspace: string, event: ObserverEvent): Promise<void>;
};
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown): string => typeof v === 'string' ? v : '';
const digits = (v: unknown): string => str(v).replace(/\D/g, '');
const json = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers: { 'content-type': 'application/json' } });

export async function validSignature(bytes: Uint8Array, signature: string, secret: string): Promise<boolean> {
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const digest = Uint8Array.from(signature.slice(7).match(/../g)!, x => parseInt(x, 16));
  return crypto.subtle.verify('HMAC', key, digest, new Uint8Array(bytes).buffer);
}
async function body(req: Request): Promise<Uint8Array> {
  const max = 4_194_304; // Los lotes de history pueden contener varias conversaciones.
  if (Number(req.headers.get('content-length') || 0) > max) throw new Error('too_large');
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); throw new Error('too_large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}
async function hash(v: unknown): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(v)));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}
function message(m: Obj, direction: 'in' | 'out', phone: string, source: string): ObserverEvent | null {
  const id = str(m.id), timestamp = str(m.timestamp), type = str(m.type);
  if (!id || id.length > 512 || !/^\d{1,12}$/.test(timestamp) || !/^\d{8,15}$/.test(phone)) return null;
  const interactive = obj(m.interactive);
  const text = str(obj(m.text).body) || str(obj(m.button).text) || str(obj(interactive.button_reply).title) || str(obj(interactive.list_reply).title) || str(obj(m.image).caption) || str(obj(m.video).caption) || str(obj(m.document).caption);
  // El marcador no se interpreta como transcripción ni como respuesta textual.
  return { key: 'message:' + id, kind: 'message', phone, external_id: id, direction, source,
    timestamp, message_type: type, body: text.slice(0, 16384), text_available: !!text,
    media_pending: !text && type !== 'text' };
}

export async function handleWebhook(req: Request, env: { appSecret?: string; verifyToken?: string }, deps: Dependencies): Promise<Response> {
  if (req.method === 'GET') {
    if (!env.verifyToken) return json(503, 'not_configured');
    const q = new URL(req.url).searchParams;
    if (q.get('hub.mode') !== 'subscribe' || q.get('hub.verify_token') !== env.verifyToken || !q.has('hub.challenge')) return json(403, 'verification_failed');
    return new Response(q.get('hub.challenge')!, { headers: { 'content-type': 'text/plain' } });
  }
  if (req.method !== 'POST') return json(405, 'method_not_allowed');
  if (!env.appSecret) return json(503, 'not_configured');
  let bytes: Uint8Array;
  try { bytes = await body(req); } catch { return json(413, 'too_large'); }
  if (!await validSignature(bytes, req.headers.get('x-hub-signature-256') || '', env.appSecret)) return json(403, 'invalid_signature');
  let payload: Obj;
  try { payload = obj(JSON.parse(new TextDecoder().decode(bytes))); } catch { return json(400, 'invalid_json'); }
  if (payload.object !== 'whatsapp_business_account') return json(400, 'invalid_object');
  try {
    for (const entryRaw of arr(payload.entry)) {
      const entry = obj(entryRaw), waba = str(entry.id); if (!waba) continue;
      for (const changeRaw of arr(entry.changes)) {
        const change = obj(changeRaw), field = str(change.field), value = obj(change.value);
        if (!['messages', 'smb_message_echoes', 'history', 'account_update'].includes(field)) continue;
        const phoneId = str(obj(value.metadata).phone_number_id);
        if (field !== 'account_update' && !phoneId) continue;
        for (const cfg of await deps.configurations(waba, field === 'account_update' ? undefined : phoneId)) {
          if (cfg.waba_id !== waba || (field !== 'account_update' && cfg.phone_number_id !== phoneId)) continue;
          const record = (e: ObserverEvent) => deps.record(cfg.workspace_id, { ...e, waba_id: waba, phone_number_id: cfg.phone_number_id });
          if (field === 'messages' || (field === 'history' && cfg.history_shared)) {
            for (const raw of arr(value.messages)) {
              const m = obj(raw), e = message(m, 'in', digits(m.from), field);
              // history.messages puede completar un adjunto; nunca cambia la dirección guardada por un thread.
              if (e) await record({ ...e, media_update_only: field === 'history' });
            }
          }
          if (field === 'smb_message_echoes') {
            for (const raw of arr(value.message_echoes)) {
              const m = obj(raw); if (digits(m.from) !== digits(cfg.business_phone)) continue;
              const e = message(m, 'out', digits(m.to), field);
              if (e) await record(e);
            }
          }
          if (field === 'history' && cfg.history_shared) {
            for (const raw of arr(value.history)) {
              const h = obj(raw), meta = obj(h.metadata);
              for (const threadRaw of arr(h.threads)) {
                const thread = obj(threadRaw), counterpart = digits(thread.id);
                for (const mRaw of arr(thread.messages)) {
                  const m = obj(mRaw), from = digits(m.from);
                  if (from !== digits(cfg.business_phone) && from !== counterpart) continue;
                  const direction = from === digits(cfg.business_phone) ? 'out' : 'in';
                  if (direction === 'out' && str(m.to) && digits(m.to) !== counterpart) continue;
                  const e = message(m, direction, counterpart, 'history');
                  if (e) await record(e);
                }
              }
              await record({ key: 'history:' + await hash({ meta, errors: h.errors }), kind: 'history_progress', phase: meta.phase, progress: meta.progress, chunk_order: meta.chunk_order, has_error: arr(h.errors).length > 0 });
            }
          }
          if (field === 'account_update') {
            // Cualquier cambio de ciclo de vida invalida cobertura; requiere revisión antes de reanudar.
            await record({ key: 'account:' + await hash(change), kind: 'account_update', event: str(value.event).slice(0, 100) });
          }
        }
      }
    }
  } catch { return json(503, 'storage_unavailable'); } // Reintento de Meta: deduplicado en SQL.
  return json(200, 'received');
}
