import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.0';
import { handleInternal } from './internal.ts';
const KEY = 'synthetic-service-key';
const WS = '00000000-0000-4000-8000-000000000001';
function check(v: unknown) { if (!v) throw new Error('Assertion failed'); }
function request(body: unknown = {}, key = KEY) { return new Request('https://example.test/dispatch', { method: 'POST', headers: { authorization: 'Bearer ' + key }, body: JSON.stringify(body) }); }
Deno.test('internal endpoints reject foreign keys before DB access', async () => {
  const r = await handleInternal(request({}, 'wrong'), 'dispatch', () => { throw new Error('must not read'); }, { serviceKey: KEY });check(r.status === 403);
});
Deno.test('missing Meta token does not reserve or send', async () => {
  const r = await handleInternal(request(), 'dispatch', () => { throw new Error('must not read'); }, { serviceKey: KEY });
  check((await r.json()).reason === 'meta_not_configured');
});
Deno.test('disabled configuration prevents all Meta calls', async () => {
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: false }, error: null }) }) }) }) } as unknown as SupabaseClient;
  const r = await handleInternal(request({ workspace_id: WS }), 'health', () => client, { serviceKey: KEY, token: 'test' });
  check((await r.json()).reason === 'disabled_or_unapproved');
});
Deno.test('replayed dispatch cannot perform another HTTP send', async () => {
  const client = { rpc: () => Promise.resolve({ data: { ok: false }, error: null }) } as unknown as SupabaseClient;
  const r = await handleInternal(request({ id: WS, claim_token: WS }), 'dispatch', () => client, { serviceKey: KEY, token: 'test' });
  check((await r.json()).reason === 'blocked_or_already_attempted');
});
Deno.test('one accepted API call and an uncertain transport never retry', async () => {
  const original = globalThis.fetch; const calls: string[] = []; let network = 0;
  const client = { rpc: (name: string) => { calls.push(name);return Promise.resolve({ data: name === 'growth_wa_begin' ? { ok: true, workspace_id: WS, api_version: 'v26.0', phone_number_id: '123', payload: { to: 'synthetic' } } : { ok: true, state: 'accepted', delivery_confirmed: false }, error: null }); } } as unknown as SupabaseClient;
  try {
    globalThis.fetch = () => { network++; return Promise.resolve(new Response('{"messages":[{"id":"wamid.test"}]}', { status: 200 })); };
    const r = await handleInternal(request({ id: WS, claim_token: WS }), 'dispatch', () => client, { serviceKey: KEY, token: 'test' });
    check((await r.json()).delivery_confirmed === false && network === 1 && calls.join(',') === 'growth_wa_begin,growth_wa_result');
    globalThis.fetch = () => { network++; return Promise.reject(new Error('timeout')); };
    await handleInternal(request({ id: WS, claim_token: WS }), 'dispatch', () => client, { serviceKey: KEY, token: 'test' });
    check(network === 2); // Un intento por invocación; el SQL decide unknown y bloquea replays.
  } finally { globalThis.fetch = original; }
});
