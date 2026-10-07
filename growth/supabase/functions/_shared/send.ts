// Envío de un mensaje a un prospecto, con las reglas de contacto aplicadas.
// Lo usan growth-send (panel) y growth-automations (secuencias).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.0';
import { sendVia, type Channel, type SendInput } from './channels.ts';
import { emailHtml, emailText } from './email-html.ts';

export interface SendOptions {
  channel: Channel;
  body: string;
  subject?: string;
  template_key?: string | null;
  ai_generated?: boolean;
  ai_run_id?: string | null;
  workflow_id?: string | null;
  campaign_id?: string | null;
  whatsappTemplate?: { name: string; language: string } | null;
}

// Brevo gratis da 300 mails por día y los comparte con los avisos de la app:
// el CRM usa como mucho 150 por día salvo que se configure otro tope.
const LIMITE_DIARIO = Number(Deno.env.get('GROWTH_DAILY_SEND_LIMIT') || 150);

// Credenciales de mail: la clave de Brevo que usan los avisos de la app
// (config_app, la que se mantiene al día) o, si no está, el secret de la
// función; y el remitente verificado.
async function emailCreds(db: SupabaseClient): Promise<SendInput['creds']> {
  const { data } = await db.from('config_app').select('clave,valor').in('clave', ['brevo_api_key', 'brevo_smtp_user']);
  const cfg = Object.fromEntries((data || []).map((r: { clave: string; valor: string | null }) => [r.clave, (r.valor || '').trim()]));
  const key = cfg.brevo_api_key || Deno.env.get('BREVO_API_KEY') || Deno.env.get('BREVO-API-KEY') || '';
  return {
    brevoKey: key || null,
    smtpUser: cfg.brevo_smtp_user || null,
    from: Deno.env.get('GROWTH_EMAIL_FROM') || 'info@trattoapp.com.ar',
    fromName: Deno.env.get('GROWTH_EMAIL_FROM_NAME') || 'Tratto',
  };
}

// Links de baja de un prospecto (por su código, sin exponer el mail en la URL):
// la página del sitio (pie del mail) y la función (baja de un click del cliente de correo)
export function unsubscribeLink(wsSlug: string, ref: string, oneClick = false): string {
  const q = `ws=${encodeURIComponent(wsSlug)}&r=${encodeURIComponent(ref)}`;
  return oneClick
    ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/growth-baja?${q}`
    : `${Deno.env.get('GROWTH_BAJA_URL') || 'https://www.trattoapp.com.ar/baja/'}?${q}`;
}

export async function sendToProspect(db: SupabaseClient, ws: string, prospectId: string, o: SendOptions) {
  const { data: p, error } = await db.from('growth_prospects').select('*').eq('id', prospectId).eq('workspace_id', ws).single();
  if (error || !p) throw new Error('Prospecto inexistente');
  const { data: integ } = await db.from('growth_integrations').select('mode').eq('workspace_id', ws).eq('provider', o.channel).maybeSingle();
  const mode = (integ?.mode || 'mock') as 'mock' | 'live' | 'off';

  // Reglas de contacto (Ley 25.326 y políticas de cada plataforma)
  let blocked: string | null = null;
  if (p.do_not_contact || p.consent === 'opt_out') blocked = 'Pidió no ser contactado';
  else if (mode === 'live' && (o.channel === 'whatsapp' || o.channel === 'sms') && p.consent !== 'opt_in')
    blocked = 'WhatsApp y SMS requieren consentimiento previo (opt-in)';
  // Tratto: publicidad solo con permiso propio (art. 27, Ley 25.326), también por mail
  else if (mode === 'live' && o.channel === 'email' && p.consent !== 'opt_in')
    blocked = 'Esta persona no dio permiso para recibir mails (casilla de novedades o permiso de publicidad)';
  if (!blocked && mode === 'live') {
    const desde = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from('growth_messages').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws).eq('direction', 'out').in('status', ['sent', 'delivered', 'read']).gte('created_at', desde);
    if ((count || 0) >= LIMITE_DIARIO) blocked = `Se alcanzó el tope diario de ${LIMITE_DIARIO} envíos reales`;
  }

  const body = o.body.trim();
  // Mail: HTML con el pie de baja (link personal + List-Unsubscribe de un click)
  let extra: Partial<SendInput> = {};
  if (o.channel === 'email') {
    const { data: w } = await db.from('growth_workspaces').select('slug').eq('id', ws).single();
    const baja = unsubscribeLink(w?.slug || '', p.ref);
    const reason = p.consent === 'opt_in' && p.consent_source
      ? `Te llega este mail porque nos diste permiso para escribirte (${String(p.consent_source).toLowerCase()}).`
      : undefined;
    extra = {
      html: emailHtml(body, { unsubscribeUrl: baja, reason }),
      headers: { 'List-Unsubscribe': `<${unsubscribeLink(w?.slug || '', p.ref, true)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      creds: await emailCreds(db),
    };
    extra.body = emailText(body, { unsubscribeUrl: baja, reason });
  }

  // Conversación del canal (una por prospecto y canal)
  let { data: conv } = await db.from('growth_conversations').select('id').eq('prospect_id', prospectId).eq('channel', o.channel).maybeSingle();
  if (!conv) {
    const ins = await db.from('growth_conversations').insert({ workspace_id: ws, prospect_id: prospectId, channel: o.channel }).select('id').single();
    conv = ins.data;
  }

  const res = blocked ? { status: 'blocked' as const, provider: 'none', error: blocked }
    : await sendVia({ channel: o.channel, to: { email: p.email, phone: p.phone, name: p.first_name, igsid: null },
                      body, subject: o.subject, whatsappTemplate: o.whatsappTemplate, ...extra }, mode);

  const { data: msg } = await db.from('growth_messages').insert({
    workspace_id: ws, conversation_id: conv!.id, prospect_id: prospectId, direction: 'out', channel: o.channel,
    body, status: res.status, provider: res.provider, external_id: res.external_id || null, error: res.error || null,
    ai_generated: !!o.ai_generated, ai_run_id: o.ai_run_id || null, template_key: o.template_key || null,
    workflow_id: o.workflow_id || null, campaign_id: o.campaign_id || p.campaign_id || null,
  }).select('*').single();
  return { message: msg, result: res };
}

// Link personal trackeado de un prospecto
export function personalLink(slug: string, ref: string): string {
  const base = Deno.env.get('GROWTH_LINK_BASE') || `${Deno.env.get('SUPABASE_URL')}/functions/v1/growth-go`;
  return `${base.replace(/\/$/, '')}/${slug}?r=${ref}`;
}

// ¿El workspace tiene los envíos en pausa (hasta el lanzamiento)?
export async function sendingPaused(db: SupabaseClient, ws: string): Promise<boolean> {
  const { data } = await db.from('growth_app_settings').select('sending_paused').eq('workspace_id', ws).maybeSingle();
  return data?.sending_paused !== false; // ante la duda, pausado
}
