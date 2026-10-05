// growth-event: la app (o su backend) informa lo que hace cada usuario.
//   POST /functions/v1/growth-event
//   Header: x-growth-key: <clave de ingesta del workspace>  (Settings → Integrations)
//   Body:   { "event": "register", "external_user_id": "...", "click_token": "...", ... }
//        o  { "events": [ {...}, {...} ] }   (hasta 50)
// Eventos con efecto: install, open, register, onboarding_complete,
// first_action, session_start, purchase. Cualquier otro queda registrado.
import { admin, cors, json, sha256Hex } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405);
  const key = req.headers.get('x-growth-key') || '';
  if (!/^gk_[a-f0-9]{48}$/.test(key)) return json(req, { error: 'Falta la clave de ingesta' }, 401);

  const db = admin();
  const { data: ws } = await db.from('growth_workspaces').select('id').eq('ingest_key_hash', await sha256Hex(key)).maybeSingle();
  if (!ws) return json(req, { error: 'Clave inválida' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { error: 'JSON inválido' }, 400); }
  const events = (Array.isArray(body.events) ? body.events : [body]).slice(0, 50) as Record<string, unknown>[];

  const results = [];
  for (const ev of events) {
    if (typeof ev?.event !== 'string') { results.push({ ok: false, error: 'Falta "event"' }); continue; }
    const { data, error } = await db.rpc('growth_ingest_event', { ws: ws.id, ev });
    results.push(error ? { ok: false, error: error.message } : data);
  }
  return json(req, { ok: results.every((r) => (r as { ok?: boolean }).ok), results });
});
