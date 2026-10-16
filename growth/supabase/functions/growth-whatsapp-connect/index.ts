import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.2/cors';
import { finishCoexistence, hash, numericId, object, WEBHOOK_FIELDS, type Graph, type Json } from './core.ts';

const ORIGIN = 'https://www.trattoapp.com.ar';
// Keep the SDK's request headers (including x-client-info), with our exact origin/methods.
const headers = { ...corsHeaders, 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
const reply = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const nonce = () => [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Método no permitido' }, 405);
  const bearer = req.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ')) return reply({ error: 'Iniciá sesión en el CRM.' }, 401);
  let body: Json;
  try { const raw = await req.text(); if (raw.length > 12000) throw new Error(); body = object(JSON.parse(raw)); }
  catch { return reply({ error: 'Solicitud inválida.' }, 400); }
  const ws = body.workspace_id;
  if (!uuid(ws)) return reply({ error: 'Workspace inválido.' }, 400);
  const base = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(base, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
  const auth = await user.auth.getUser();
  if (auth.error || !auth.data.user) return reply({ error: 'Sesión inválida.' }, 401);
  const db = createClient(base, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const member = await db.from('growth_members').select('role').eq('workspace_id', ws).eq('user_id', auth.data.user.id).maybeSingle();
  if (member.error) return reply({ error: 'No se pudo comprobar el acceso.' }, 503);
  if (member.data?.role !== 'owner') return reply({ error: 'La vinculación corresponde al titular del workspace.' }, 403);
  const board = await db.from('growth_mkt_items').select('estado').eq('workspace_id', ws).eq('datos->>clave', 'coordinacion_codex_claude').maybeSingle();
  if (board.error) return reply({ error: 'No se pudo comprobar la pausa.' }, 503);
  if (board.data?.estado !== 'programado') return reply({ error: 'La coordinación está pausada.' }, 409);
  const settings = await db.from('growth_mkt_ajustes').select('valor').eq('workspace_id', ws).eq('clave', 'whatsapp_seguimiento_meta').maybeSingle();
  if (settings.error) return reply({ error: 'No se pudo leer la configuración.' }, 503);
  const cfg = object(settings.data?.valor), appId = cfg.app_id, configId = cfg.embedded_signup_config_id;
  if (!numericId(appId) || !numericId(configId)) return reply({ error: 'Falta la configuración oficial de Meta.' }, 409);
  const callback = `${base}/functions/v1/growth-whatsapp-observer`;
  if (body.action === 'status') return reply({ app_id: appId, config_id: configId, callback, webhook_fields: WEBHOOK_FIELDS, expected_phone: cfg.business_phone_objetivo });
  if (body.action === 'begin') {
    const state = nonce(), verify = nonce(), id = crypto.randomUUID(), until = new Date(Date.now() + 15 * 60000).toISOString();
    const inserted = await db.from('growth_wa_setup_sessions').insert({ id, workspace_id: ws, user_id: auth.data.user.id, app_id: appId, config_id: configId, state_hash: await hash(state), verify_hash: await hash(verify), expires_at: until });
    if (inserted.error) return reply({ error: 'No se pudo preparar la sesión.' }, 503);
    return reply({ run_id: id, state, verify_token: verify, expires_at: until, app_id: appId, config_id: configId, callback, webhook_fields: WEBHOOK_FIELDS });
  }
  if (body.action !== 'complete' || !uuid(body.run_id) || typeof body.state !== 'string' || body.state.length !== 64) return reply({ error: 'Solicitud de vinculación inválida.' }, 400);
  const selected = await db.from('growth_wa_setup_sessions').select('*').eq('id', body.run_id).eq('workspace_id', ws).eq('user_id', auth.data.user.id).maybeSingle();
  const session = selected.data;
  if (selected.error) return reply({ error: 'No se pudo comprobar la sesión de vinculación.' }, 503);
  if (!session || session.state_hash !== await hash(body.state) || session.app_id !== appId || session.config_id !== configId) return reply({ error: 'Sesión de vinculación inválida.' }, 403);
  if (session.status !== 'pending') return reply(object(session.result).estado ? object(session.result) : { error: 'Esta sesión ya se procesó. Actualizá el estado antes de iniciar otra.', estado: session.status }, 409);
  const claimed = await db.from('growth_wa_setup_sessions').update({ status: 'processing' }).eq('id', body.run_id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
  if (claimed.error || !claimed.data) return reply({ error: 'La sesión venció o ya está en proceso.' }, 409);
  const appSecret = Deno.env.get('TRATTO_WA_APP_SECRET') || '';
  const graph: Graph = async (path, token, params = {}, method = 'GET') => {
    if (!/^(oauth\/access_token|debug_token|[0-9]+\/(phone_numbers|subscriptions|subscribed_apps))$/.test(path)
      || (method === 'POST' && path !== 'oauth/access_token' && !/^[0-9]+\/subscribed_apps$/.test(path))) throw new Error('Operación de Meta no admitida.');
    const url = new URL(`https://graph.facebook.com/v26.0/${path}`);
    const options: RequestInit = { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15000) };
    if (method === 'GET') Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    else options.body = new URLSearchParams(params);
    const response = await fetch(url, options);
    const data = object(await response.json());
    if (!response.ok || data.error) {
      const error = object(data.error);
      let message = String(error.error_user_msg || error.message || 'Solicitud rechazada por Meta.');
      for (const value of [token, appSecret, ...Object.entries(params).filter(([k]) => ['code', 'client_secret', 'input_token'].includes(k)).map(([, v]) => v)]) if (value) message = message.split(value).join('[privado]');
      throw new Error(`Meta ${error.code || response.status}${error.error_subcode ? `/${error.error_subcode}` : ''}: ${message.slice(0, 500)}`);
    }
    return data;
  };
  try {
    if (!appSecret) throw new Error('Falta la configuración privada del servidor.');
    const verified = await finishCoexistence({ code: String(body.code || ''), waba: String(body.waba_id || ''), phoneId: String(body.phone_number_id || ''), event: String(body.event || '') }, { appId: String(appId), appSecret, expectedPhone: String(cfg.business_phone_objetivo || ''), callback }, graph);
    const linked = await db.rpc('growth_wa_observer_owner_link', { p_workspace: ws, p_user: auth.data.user.id, p_run: body.run_id, p_waba: verified.waba, p_phone_id: verified.phoneId, p_phone: verified.phone, p_receiving: verified.receiving, p_missing_fields: verified.missing });
    if (linked.error) throw new Error('La autorización se verificó, pero no se pudo guardar el vínculo. Actualizá el CRM antes de volver a vincular.');
    const result = object(linked.data);
    await db.from('growth_wa_setup_sessions').update({ status: 'completed', result }).eq('id', body.run_id).eq('status', 'processing');
    return reply(result);
  } catch (error) {
    const message = error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'No se pudo confirmar la operación de Meta. No se reintentó automáticamente.';
    const result = { estado: 'pendiente_revision', error: message };
    await db.from('growth_wa_setup_sessions').update({ status: 'uncertain', result }).eq('id', body.run_id).eq('status', 'processing');
    return reply(result, 422);
  }
});
