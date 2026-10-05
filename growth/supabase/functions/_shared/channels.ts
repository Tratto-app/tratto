// Adapters de canales. Cada uno manda un mensaje por una API oficial; si el
// canal no está en modo "live" o faltan sus credenciales, se simula (mock) y
// queda registrado como 'mock_sent'. Ninguna credencial vive en el código:
// todas son secrets de las Edge Functions.
//
// Estado de cada adapter (honesto):
//   email     Brevo API transaccional. Implementado; no probado en vivo desde acá.
//   whatsapp  WhatsApp Cloud API (Meta). Implementado; fuera de la ventana de
//             24 h solo se pueden mandar PLANTILLAS aprobadas por Meta.
//   sms       Twilio. Implementado; no probado en vivo.
//   instagram Instagram Messaging API: solo permite responder a quien escribió
//             primero, usando su IGSID. Sin IGSID no se puede mandar.
//   tiktok    No hay API pública para mensajes directos: siempre simulado.
//   facebook  Messenger: misma regla que Instagram. Simulado.

export type Channel = 'instagram' | 'whatsapp' | 'email' | 'sms' | 'tiktok' | 'facebook' | 'other';

export interface SendInput {
  channel: Channel;
  to: { email?: string | null; phone?: string | null; igsid?: string | null; name?: string | null };
  body: string;
  subject?: string;
  whatsappTemplate?: { name: string; language: string } | null;
}

export interface SendResult {
  status: 'sent' | 'mock_sent' | 'failed' | 'blocked';
  provider: string;
  external_id?: string;
  error?: string;
}

const env = (k: string) => Deno.env.get(k) || '';

function mock(_channel: string, reason: string): SendResult {
  return { status: 'mock_sent', provider: 'mock', error: reason ? `Simulado: ${reason}` : undefined };
}

export function liveAvailable(channel: Channel): boolean {
  switch (channel) {
    case 'email': return !!(env('BREVO_API_KEY') && env('GROWTH_EMAIL_FROM'));
    case 'whatsapp': return !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
    case 'sms': return !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_FROM'));
    case 'instagram': return !!(env('INSTAGRAM_TOKEN') && env('INSTAGRAM_ACCOUNT_ID'));
    default: return false;
  }
}

export async function sendVia(input: SendInput, mode: 'mock' | 'live' | 'off'): Promise<SendResult> {
  if (mode === 'off') return { status: 'blocked', provider: 'none', error: 'Canal desactivado' };
  if (mode !== 'live') return mock(input.channel, '');
  if (!liveAvailable(input.channel)) return mock(input.channel, 'faltan credenciales del canal');
  try {
    switch (input.channel) {
      case 'email': return await brevo(input);
      case 'whatsapp': return await whatsapp(input);
      case 'sms': return await twilio(input);
      case 'instagram': return await instagram(input);
      default: return mock(input.channel, 'canal sin API de envío');
    }
  } catch (e) {
    return { status: 'failed', provider: input.channel, error: String(e).slice(0, 300) };
  }
}

async function brevo(i: SendInput): Promise<SendResult> {
  if (!i.to.email) return { status: 'failed', provider: 'brevo', error: 'El prospecto no tiene email' };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env('BREVO_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env('GROWTH_EMAIL_FROM'), name: env('GROWTH_EMAIL_FROM_NAME') || undefined },
      to: [{ email: i.to.email, name: i.to.name || undefined }],
      subject: i.subject || 'Te cuento de nuestra app',
      textContent: i.body,
    }),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok ? { status: 'sent', provider: 'brevo', external_id: d.messageId }
              : { status: 'failed', provider: 'brevo', error: `${r.status} ${JSON.stringify(d).slice(0, 200)}` };
}

async function whatsapp(i: SendInput): Promise<SendResult> {
  const to = (i.to.phone || '').replace(/[^\d]/g, '');
  if (!to) return { status: 'failed', provider: 'whatsapp_cloud', error: 'El prospecto no tiene teléfono' };
  const v = env('WHATSAPP_API_VERSION') || 'v21.0';
  const body = i.whatsappTemplate
    ? { messaging_product: 'whatsapp', to, type: 'template',
        template: { name: i.whatsappTemplate.name, language: { code: i.whatsappTemplate.language } } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: i.body } };
  const r = await fetch(`https://graph.facebook.com/${v}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok ? { status: 'sent', provider: 'whatsapp_cloud', external_id: d.messages?.[0]?.id }
              : { status: 'failed', provider: 'whatsapp_cloud', error: `${r.status} ${JSON.stringify(d).slice(0, 200)}` };
}

async function twilio(i: SendInput): Promise<SendResult> {
  const to = i.to.phone;
  if (!to) return { status: 'failed', provider: 'twilio', error: 'El prospecto no tiene teléfono' };
  const sid = env('TWILIO_ACCOUNT_SID');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${env('TWILIO_AUTH_TOKEN')}`),
               'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: env('TWILIO_FROM'), Body: i.body }),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok ? { status: 'sent', provider: 'twilio', external_id: d.sid }
              : { status: 'failed', provider: 'twilio', error: `${r.status} ${d.message || ''}`.slice(0, 200) };
}

async function instagram(i: SendInput): Promise<SendResult> {
  if (!i.to.igsid) {
    return { status: 'blocked', provider: 'instagram',
             error: 'Instagram solo permite responder a quien te escribió primero (hace falta su IGSID).' };
  }
  const v = env('INSTAGRAM_API_VERSION') || 'v21.0';
  const r = await fetch(`https://graph.facebook.com/${v}/${env('INSTAGRAM_ACCOUNT_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('INSTAGRAM_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ recipient: { id: i.to.igsid }, message: { text: i.body } }),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok ? { status: 'sent', provider: 'instagram', external_id: d.message_id }
              : { status: 'failed', provider: 'instagram', error: `${r.status} ${JSON.stringify(d).slice(0, 200)}` };
}
