// growth-signup: alta pública desde la página de registro.
//   POST /functions/v1/growth-signup
//   { workspace: "<slug>", kind: "provider"|"customer",
//     first_name?, last_name?, email?, phone?, company?, city?, zona?, rubro?, source?,
//     consent: true, website_hp?: "" }
// Quien se registra DA su consentimiento (consent = opt_in). Nadie entra a la
// base sin pasar por acá. No envía nada: si el workspace está en pausa, la
// persona queda encolada para cuando se active el lanzamiento.
import { admin, cors, json } from '../_shared/http.ts';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'JSON inválido' }, 400); }

  // Trampa anti-bots: un campo oculto que una persona nunca completa.
  if (typeof b.website_hp === 'string' && b.website_hp.trim() !== '') return json(req, { ok: true });
  if (b.consent !== true) return json(req, { error: 'Falta aceptar recibir mensajes' }, 400);

  const slug = String(b.workspace || '').toLowerCase();
  const kind = b.kind === 'provider' ? 'provider' : 'customer';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return json(req, { error: 'Workspace inválido' }, 400);
  if (email && !EMAIL.test(email)) return json(req, { error: 'El email no parece válido' }, 400);
  if (!email && phone.replace(/[^0-9]/g, '').length < 8) return json(req, { error: 'Dejá un email o un teléfono válido' }, 400);

  const db = admin();
  const { data: ws } = await db.from('growth_workspaces').select('id').eq('slug', slug).maybeSingle();
  if (!ws) return json(req, { error: 'Workspace inexistente' }, 404);

  const data = {
    first_name: b.first_name, last_name: b.last_name, email, phone,
    company: b.company, city: b.city, zona: b.zona, rubro: b.rubro,
    source: typeof b.source === 'string' ? b.source : undefined,
    consent_source: kind === 'provider' ? 'Registro de proveedor (web)' : 'Registro de cliente (web)',
    notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : undefined,
  };
  const { data: pid, error } = await db.rpc('growth_signup', { ws: ws.id, kind, data });
  if (error) return json(req, { error: error.message }, 400);
  return json(req, { ok: true, id: pid });
});
