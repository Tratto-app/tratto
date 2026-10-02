// Utilidades HTTP y de acceso compartidas por las Edge Functions (Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.0';

// El panel se sirve desde otro origen. Las funciones usan tokens Bearer (no
// cookies), así que permitir cualquier origen no expone sesiones; se puede
// restringir con la variable GROWTH_ALLOWED_ORIGINS (lista separada por comas).
export function cors(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('GROWTH_ALLOWED_ORIGINS') || '*').split(',').map((s) => s.trim());
  const origin = req.headers.get('origin') || '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-growth-key',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Cliente con service role: solo dentro de las funciones, nunca en el panel.
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

// Verifica que quien llama haya iniciado sesión y sea miembro del workspace.
export async function requireMember(req: Request, workspaceId: string): Promise<{ userId: string } | Response> {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || !workspaceId) return json(req, { error: 'Sin sesión' }, 401);
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: u, error } = await user.auth.getUser();
  if (error || !u.user) return json(req, { error: 'Sesión inválida' }, 401);
  const { data: ok } = await user.rpc('growth_is_member', { ws: workspaceId });
  if (!ok) return json(req, { error: 'Sin acceso a este workspace' }, 403);
  return { userId: u.user.id };
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparación en tiempo constante para secretos
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
