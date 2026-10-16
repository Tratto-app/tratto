export type Json = Record<string, unknown>;
export type Graph = (path: string, token: string, params?: Record<string, string>, method?: 'GET' | 'POST') => Promise<Json>;
export const WEBHOOK_FIELDS = ['messages', 'account_update', 'smb_message_echoes', 'smb_app_state_sync', 'history'];
export const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
export const digits = (value: unknown) => String(value || '').replace(/\D/g, '');
export const canonicalPhone = (value: unknown) => digits(value).replace(/^54911/, '5411');
export const numericId = (value: unknown) => typeof value === 'string' && /^[0-9]{5,30}$/.test(value);
export const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2, '0')).join('');

export function subscriptionStatus(response: Json, callback: string): { missing: string[]; callbackOk: boolean } {
  const subscriptions = Array.isArray(response.data) ? response.data.map(object) : [];
  const subscription = subscriptions.find(s => s.object === 'whatsapp_business_account' && s.active === true);
  const fields = new Set((Array.isArray(subscription?.fields) ? subscription.fields : []).map(f => object(f).name));
  return { missing: WEBHOOK_FIELDS.filter(f => !fields.has(f)), callbackOk: subscription?.callback_url === callback };
}

// El token obtenido sólo vive en esta petición. No se devuelve ni se guarda en CRM.
export async function finishCoexistence(
  input: { code: string; waba: string; phoneId: string; event: string },
  settings: { appId: string; appSecret: string; expectedPhone: string; callback: string },
  graph: Graph,
) {
  if (input.event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') throw new Error('Meta no confirmó la modalidad Coexistencia.');
  if (!numericId(input.waba) || !numericId(input.phoneId) || !input.code || input.code.length > 4096) throw new Error('Datos de vinculación incompletos.');
  const auth = await graph('oauth/access_token', '', { client_id: settings.appId, client_secret: settings.appSecret, code: input.code }, 'POST');
  const token = typeof auth.access_token === 'string' ? auth.access_token : '';
  if (!token) throw new Error('Meta no devolvió autorización utilizable.');
  const appToken = `${settings.appId}|${settings.appSecret}`;
  const debug = object((await graph('debug_token', appToken, { input_token: token })).data);
  const scopes = Array.isArray(debug.scopes) ? debug.scopes : [];
  if (debug.is_valid !== true || debug.app_id !== settings.appId || !scopes.includes('whatsapp_business_management') || !scopes.includes('whatsapp_business_messaging')) {
    throw new Error('La autorización no corresponde a esta app o faltan permisos de WhatsApp.');
  }
  const response = await graph(`${input.waba}/phone_numbers`, token, { fields: 'id,display_phone_number,platform_type,is_on_biz_app', limit: '100' });
  const phones = Array.isArray(response.data) ? response.data.map(object) : [];
  const phone = phones.find(p => p.id === input.phoneId);
  if (!phone || !canonicalPhone(settings.expectedPhone) || canonicalPhone(phone.display_phone_number) !== canonicalPhone(settings.expectedPhone)) {
    throw new Error('El número autorizado no coincide con el número actual confirmado para Tratto.');
  }
  if (phone.is_on_biz_app !== true || phone.platform_type !== 'CLOUD_API') throw new Error('Meta no confirmó que el número conserve WhatsApp Business en el celular.');
  const hook = subscriptionStatus(await graph(`${settings.appId}/subscriptions`, appToken), settings.callback);
  if (hook.callbackOk && hook.missing.length === 0) {
    const subscribed = await graph(`${input.waba}/subscribed_apps`, token, {}, 'POST');
    if (subscribed.success !== true) throw new Error('Meta no confirmó la suscripción del receptor.');
  }
  return {
    waba: input.waba, phoneId: input.phoneId, phone: String(phone.display_phone_number),
    receiving: hook.callbackOk && hook.missing.length === 0,
    missing: hook.callbackOk ? hook.missing : ['callback_url', ...hook.missing],
  };
}
