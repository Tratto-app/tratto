import { finishCoexistence, subscriptionStatus, WEBHOOK_FIELDS, type Graph, type Json } from './core.ts';
const assert = (v: unknown) => { if (!v) throw new Error('assertion failed'); };
const settings = { appId: '111111', appSecret: 'test-only-secret', expectedPhone: '+5491100000001', callback: 'https://example.invalid/observer' };
const input = { code: 'one-use-test-code', waba: '222222', phoneId: '333333', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' };
function fixture(options: { badApp?: boolean; missingPermission?: boolean; notCoex?: boolean; otherPhone?: boolean; missingHook?: boolean } = {}) {
  const calls: { path: string; method: string }[] = [];
  const graph: Graph = (path, _token, _params, method = 'GET') => Promise.resolve((() => {
    calls.push({ path, method });
    if (path === 'oauth/access_token') return { access_token: 'test-only-business-token' };
    if (path === 'debug_token') return { data: { is_valid: true, app_id: options.badApp ? 'other' : settings.appId, scopes: options.missingPermission ? [] : ['whatsapp_business_management', 'whatsapp_business_messaging'] } };
    if (path.endsWith('/phone_numbers')) return { data: [{ id: input.phoneId, display_phone_number: options.otherPhone ? '+541100000002' : '+541100000001', platform_type: 'CLOUD_API', is_on_biz_app: !options.notCoex }] };
    if (path.endsWith('/subscriptions')) return { data: [{ object: 'whatsapp_business_account', active: true, callback_url: settings.callback, fields: (options.missingHook ? ['messages'] : WEBHOOK_FIELDS).map(name => ({ name })) }] };
    if (path.endsWith('/subscribed_apps')) return { success: true };
    throw new Error('unexpected path');
  })());
  return { graph, calls };
}
Deno.test('sólo vincula número correcto en Coexistencia y no devuelve tokens', async () => {
  const f = fixture(); const result = await finishCoexistence(input, settings, f.graph);
  assert(result.receiving && result.missing.length === 0);
  assert(!JSON.stringify(result).includes('test-only'));
  assert(f.calls.filter(c => c.method === 'POST').map(c => c.path).join(',') === 'oauth/access_token,222222/subscribed_apps');
});
for (const option of ['badApp', 'missingPermission', 'notCoex', 'otherPhone'] as const) {
  Deno.test(`rechaza ${option} antes de suscribir/habilitar`, async () => {
    const f = fixture({ [option]: true }); let rejected = false;
    try { await finishCoexistence(input, settings, f.graph); } catch { rejected = true; }
    assert(rejected && !f.calls.some(c => c.path.endsWith('/subscribed_apps')));
  });
}
Deno.test('webhook incompleto conserva recepción apagada, sin registro exclusivo', async () => {
  const f = fixture({ missingHook: true }); const result = await finishCoexistence(input, settings, f.graph);
  assert(!result.receiving && result.missing.includes('smb_message_echoes'));
  assert(!f.calls.some(c => c.path.endsWith('/subscribed_apps') || c.path.includes('/register') || c.path.includes('/messages')));
});
Deno.test('un alta general nunca sustituye Coexistencia', async () => {
  const f = fixture(); let rejected = false;
  try { await finishCoexistence({ ...input, event: 'FINISH' }, settings, f.graph); } catch { rejected = true; }
  assert(rejected && f.calls.length === 0);
});
Deno.test('callback ajeno y suscripción inactiva no acreditan receptor', () => {
  const response: Json = { data: [{ object: 'whatsapp_business_account', callback_url: 'https://other.invalid', active: false, fields: WEBHOOK_FIELDS.map(name => ({ name })) }] };
  const r = subscriptionStatus(response, settings.callback); assert(!r.callbackOk && r.missing.length === WEBHOOK_FIELDS.length);
});
