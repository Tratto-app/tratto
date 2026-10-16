export type MetaSession = { waba_id: string; phone_number_id: string; event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' };
export type WhatsAppSetup = { app_id: string; config_id: string; callback: string; webhook_fields: string[]; run_id: string; state: string; verify_token: string; expires_at: string };
type SetupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const SETUP_KEY = 'tratto.wa.setup';
export function forgetSetup(storage: SetupStorage | null) { try { storage?.removeItem(SETUP_KEY); } catch { /* Almacenamiento no disponible. */ } }
export function rememberSetup(storage: SetupStorage | null, workspace: string, owner: string, setup: WhatsAppSetup) {
  // Sólo la preparación del webhook. Nunca guardar códigos ni tokens de acceso de Meta.
  const { app_id, config_id, callback, webhook_fields, run_id, state, verify_token, expires_at } = setup;
  try { storage?.setItem(SETUP_KEY, JSON.stringify({ workspace, owner, setup: { app_id, config_id, callback, webhook_fields, run_id, state, verify_token, expires_at } })); } catch { /* La conexión sigue disponible sin caché. */ }
}
export function recallSetup(storage: SetupStorage | null, workspace: string, owner: string, now = Date.now()): WhatsAppSetup | null {
  try {
    const saved = JSON.parse(storage?.getItem(SETUP_KEY) || 'null'), s = saved?.setup;
    if (saved?.workspace !== workspace || saved?.owner !== owner || !s
      || !/^\d{5,30}$/.test(s.app_id) || !/^\d{5,30}$/.test(s.config_id)
      || !/^[0-9a-f-]{36}$/i.test(s.run_id) || !/^[a-f0-9]{64}$/.test(s.state) || !/^[a-f0-9]{64}$/.test(s.verify_token)
      || typeof s.callback !== 'string' || !Array.isArray(s.webhook_fields) || !s.webhook_fields.every((v: unknown) => typeof v === 'string')
      || !Number.isFinite(Date.parse(s.expires_at)) || Date.parse(s.expires_at) <= now) {
      forgetSetup(storage); return null;
    }
    return s as WhatsAppSetup;
  } catch { forgetSetup(storage); return null; }
}

export async function copySetupText(value: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; } } catch { /* Compatibilidad con navegadores móviles. */ }
  const input = document.createElement('textarea');
  input.value = value; input.readOnly = true; input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  const previous = document.activeElement;
  document.body.appendChild(input);
  try { input.focus(); input.select(); input.setSelectionRange(0, value.length); return document.execCommand('copy'); }
  catch { return false; }
  finally { input.remove(); if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); }
}
export function readMetaSession(origin: string, value: unknown): MetaSession | null {
  if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(origin)) return null;
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    if (!v || v.type !== 'WA_EMBEDDED_SIGNUP' || v.event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') return null;
    if (!/^\d{5,30}$/.test(v.data?.waba_id) || !/^\d{5,30}$/.test(v.data?.phone_number_id)) return null;
    return { waba_id: v.data.waba_id, phone_number_id: v.data.phone_number_id, event: v.event };
  } catch { return null; }
}

export type FacebookSdk = {
  init(options: Record<string, unknown>): void;
  login(callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>): void;
};
declare global { interface Window { FB?: FacebookSdk; fbAsyncInit?: () => void } }
let sdkPromise: Promise<FacebookSdk> | null = null;
export function loadMetaSdk(appId: string): Promise<FacebookSdk> {
  if (window.FB) { window.FB.init({ appId, version: 'v26.0', autoLogAppEvents: false, xfbml: false }); return Promise.resolve(window.FB); }
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    const fail = () => { sdkPromise = null; reject(new Error('No se pudo cargar la conexión de Meta. Abrí el CRM en Safari o Chrome y volvé a preparar la conexión.')); };
    const timer = window.setTimeout(fail, 15000);
    window.fbAsyncInit = () => {
      window.clearTimeout(timer);
      if (!window.FB) { fail(); return; }
      window.FB.init({ appId, version: 'v26.0', autoLogAppEvents: false, xfbml: false }); resolve(window.FB);
    };
    document.getElementById('tratto-meta-sdk')?.remove();
    const script = document.createElement('script'); script.id = 'tratto-meta-sdk';
    script.src = 'https://connect.facebook.net/es_LA/sdk.js'; script.async = true;
    script.onerror = () => { window.clearTimeout(timer); fail(); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
