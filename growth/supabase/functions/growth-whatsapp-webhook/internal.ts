import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.0';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
async function secureEqual(actual: string, expected: string): Promise<boolean> {
  if (!actual || !expected) return false;
  const [a, b] = await Promise.all([actual, expected].map(t => crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))));
  const x = new Uint8Array(a), y = new Uint8Array(b); let diff = 0;
  for (let i = 0; i < 32; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
export async function handleInternal(req: Request, route: string, db: () => SupabaseClient, env: { serviceKey?: string; token?: string }): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);
  if (!await secureEqual(req.headers.get('authorization') || '', 'Bearer ' + (env.serviceKey || '')) || !env.serviceKey) return json({ ok: false, reason: 'forbidden' }, 403);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ ok: false, reason: 'invalid_json' }, 400); }
  if (route === 'health') {
    const workspace = String(input.workspace_id || '');
    if (!/^[a-f0-9-]{36}$/i.test(workspace)) return json({ ok: false, reason: 'invalid_workspace' }, 400);
    const { data: c, error } = await db().from('growth_wa_config').select('*').eq('workspace_id', workspace).maybeSingle();
    if (error) return json({ ok: false, reason: 'storage_unavailable' }, 503);
    if (!c?.enabled || !c.template_approved || c.daily_limit <= 0 || c.monthly_budget_usd <= 0 || c.price_ceiling_usd <= 0) return json({ ok: false, reason: 'disabled_or_unapproved', workspace_id: workspace });
    if (!env.token || !/^\d+$/.test(c.phone_number_id) || !/^\d+$/.test(c.waba_id) || !/^v\d+\.0$/.test(c.api_version)) return json({ ok: false, reason: 'meta_not_configured', workspace_id: workspace });
    try {
      const base = 'https://graph.facebook.com/' + c.api_version;
      const headers = { authorization: 'Bearer ' + env.token };
      const phone = await fetch(`${base}/${c.phone_number_id}?fields=id,quality_rating,code_verification_status,whatsapp_business_manager_messaging_limit`, { headers, signal: AbortSignal.timeout(15000) });
      const template = await fetch(`${base}/${c.waba_id}/message_templates?name=${encodeURIComponent(c.template_name)}`, { headers, signal: AbortSignal.timeout(15000) });
      const pd = phone.ok ? await phone.json() : {}, td = template.ok ? await template.json() : {};
      const { data, error: saveError } = await db().rpc('growth_wa_health', { p_workspace: workspace, p_phone: pd, p_template: td });
      if (saveError) return json({ ok: false, reason: 'storage_unavailable' }, 503);
      return json({ ...data, workspace_id: workspace });
    } catch {
      const { error: resetError } = await db().rpc('growth_wa_health', { p_workspace: workspace, p_phone: {}, p_template: {} });
      return json({ ok: false, reason: resetError ? 'storage_unavailable' : 'meta_health_unavailable', workspace_id: workspace });
    }
  }
  if (route === 'dispatch') {
    if (!env.token) return json({ ok: false, reason: 'meta_not_configured' });
    const id = String(input.id || ''), token = String(input.claim_token || '');
    if (![id, token].every(x => /^[a-f0-9-]{36}$/i.test(x))) return json({ ok: false, reason: 'invalid_claim' }, 400);
    // Dentro del endpoint: reintentar el nodo n8n no puede repetir un envío.
    const { data: job, error } = await db().rpc('growth_wa_begin', { p_id: id, p_token: token });
    if (error) return json({ ok: false, reason: 'storage_unavailable' }, 503);
    if (!job?.ok) return json({ ok: false, reason: 'blocked_or_already_attempted' });
    let status = 0, result: Record<string, unknown> = { error: 'Resultado incierto; no reenviar' };
    try {
      const r = await fetch(`https://graph.facebook.com/${job.api_version}/${job.phone_number_id}/messages`, {
        method: 'POST', headers: { authorization: 'Bearer ' + env.token, 'content-type': 'application/json' },
        body: JSON.stringify(job.payload), signal: AbortSignal.timeout(20000),
      });
      status = r.status; const body = await r.json();
      result = { messages: body.messages?.map((m: { id?: string }) => ({ id: m.id })), error: body.error ? JSON.stringify({ code: body.error.code, message: String(body.error.message || '').replaceAll(env.token, '[redacted]').slice(0, 400) }) : undefined };
    } catch { /* timeout/resultado incierto: conservar intento y frenar, nunca reintentar */ }
    const { data, error: saveError } = await db().rpc('growth_wa_result', { p_id: id, p_token: token, p_status: status, p_response: result });
    if (saveError) await db().rpc('growth_wa_health', { p_workspace: job.workspace_id, p_phone: {}, p_template: {} });
    return saveError ? json({ ok: false, reason: 'result_storage_unavailable_no_retry' }, 503) : json(data);
  }
  return json({ ok: false, reason: 'route_not_found' }, 404);
}
