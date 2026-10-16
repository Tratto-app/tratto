export type MetaSession = { waba_id: string; phone_number_id: string; event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' };
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
