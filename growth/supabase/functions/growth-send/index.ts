// growth-send: mensajes desde el Inbox del panel.
//   POST /functions/v1/growth-send   (requiere sesión de un miembro del workspace)
//   send       { workspace_id, action:'send', prospect_id, channel, body, subject?, template_key? }
//   send_link  { workspace_id, action:'send_link', prospect_id, channel, link_id, body? }  ({{link}} = link personal)
//   inbound    { workspace_id, action:'inbound', prospect_id, channel, body, analyze? }
//              Carga a mano una respuesta recibida por un canal sin API de lectura
//              (por ejemplo, un DM de Instagram leído desde el teléfono).
// Las reglas de contacto (opt-out, opt-in para WhatsApp/SMS, tope diario) se
// aplican en _shared/send.ts: un mensaje bloqueado queda guardado como 'blocked'.
import { loadContext, logRun, runAi } from '../_shared/ai.ts';
import type { Channel } from '../_shared/channels.ts';
import { renderTemplate } from '../_shared/engine-core.ts';
import { admin, cors, json, requireMember } from '../_shared/http.ts';
import { personalLink, sendToProspect } from '../_shared/send.ts';

const CHANNELS: Channel[] = ['instagram', 'whatsapp', 'email', 'sms', 'tiktok', 'facebook', 'other'];
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'JSON inválido' }, 400); }

  const ws = String(b.workspace_id || '');
  const pid = String(b.prospect_id || '');
  const action = String(b.action || 'send');
  const channel = String(b.channel || '') as Channel;
  if (!UUID.test(ws) || !UUID.test(pid)) return json(req, { error: 'Faltan workspace_id o prospect_id' }, 400);
  if (!CHANNELS.includes(channel)) return json(req, { error: 'Canal inválido' }, 400);
  const who = await requireMember(req, ws);
  if (who instanceof Response) return who;

  const db = admin();
  const { data: p } = await db.from('growth_prospects').select('id,ref,first_name,last_name,company,city,status,campaign_id')
    .eq('id', pid).eq('workspace_id', ws).maybeSingle();
  if (!p) return json(req, { error: 'Prospecto inexistente' }, 404);
  const body = typeof b.body === 'string' ? b.body.slice(0, 4000) : '';

  if (action === 'inbound') {
    if (!body.trim()) return json(req, { error: 'El mensaje está vacío' }, 400);
    let { data: conv } = await db.from('growth_conversations').select('id').eq('prospect_id', pid).eq('channel', channel).maybeSingle();
    if (!conv) conv = (await db.from('growth_conversations').insert({ workspace_id: ws, prospect_id: pid, channel }).select('id').single()).data;
    const { data: msg, error } = await db.from('growth_messages').insert({
      workspace_id: ws, conversation_id: conv!.id, prospect_id: pid, direction: 'in', channel,
      body, status: 'received', provider: 'manual',
    }).select('*').single();
    if (error) return json(req, { error: error.message }, 500);

    let analysis: Record<string, unknown> | null = null;
    if (b.analyze !== false) {
      // Lee la respuesta (interés, objeción, opt-out) y la deja aplicada.
      const ctx = await loadContext(db, ws);
      const payload = { prospect: p, text: body };
      const t0 = Date.now();
      try {
        const res = await runAi('reply', ctx, payload);
        await logRun(db, ws, pid, 'reply', payload, res, null, Date.now() - t0);
        analysis = res.output;
        const intent = String(analysis.intent);
        await db.from('growth_messages').update({ intent, objection_id: analysis.objection_id ?? null }).eq('id', msg.id);
        const upd: Record<string, unknown> = { interest: intent, next_action: analysis.next_action ?? null };
        if (analysis.opt_out) Object.assign(upd, { consent: 'opt_out', do_not_contact: true, consent_source: 'Respuesta del prospecto' });
        else if (intent === 'none') upd.status = 'not_interested';
        await db.from('growth_prospects').update(upd).eq('id', pid);
        if (analysis.interested && !analysis.opt_out) await db.rpc('growth_advance', { pid, st: 'interested' });
      } catch (e) {
        await logRun(db, ws, pid, 'reply', payload, null, e instanceof Error ? e.message : String(e), Date.now() - t0);
      }
    }
    return json(req, { ok: true, message: msg, analysis });
  }

  if (action === 'send_link') {
    const lid = String(b.link_id || '');
    if (!UUID.test(lid)) return json(req, { error: 'Falta link_id' }, 400);
    const { data: link } = await db.from('growth_tracking_links').select('slug,campaign_id,archived')
      .eq('id', lid).eq('workspace_id', ws).maybeSingle();
    if (!link || link.archived) return json(req, { error: 'Link inexistente o archivado' }, 404);
    const url = personalLink(link.slug, p.ref);
    const tpl = body.trim() || 'Hola {{first_name}}! Te dejo el link para descargar la app: {{link}}';
    const text = renderTemplate(tpl.includes('{{link}}') ? tpl : `${tpl} {{link}}`, { ...p, link: url });
    const r = await sendToProspect(db, ws, pid, { channel, body: text, template_key: (b.template_key as string) || 'link', campaign_id: link.campaign_id });
    if (r.result.status !== 'blocked' && r.result.status !== 'failed') await db.rpc('growth_advance', { pid, st: 'link_sent' });
    return json(req, { ok: r.result.status !== 'failed' && r.result.status !== 'blocked', link: url, ...r });
  }

  if (action === 'send') {
    if (!body.trim()) return json(req, { error: 'El mensaje está vacío' }, 400);
    const text = renderTemplate(body, p);
    const r = await sendToProspect(db, ws, pid, {
      channel, body: text, subject: typeof b.subject === 'string' ? b.subject.slice(0, 200) : undefined,
      template_key: typeof b.template_key === 'string' ? b.template_key.slice(0, 60) : null,
      ai_generated: b.ai_generated === true, ai_run_id: UUID.test(String(b.ai_run_id || '')) ? String(b.ai_run_id) : null,
    });
    return json(req, { ok: r.result.status !== 'failed' && r.result.status !== 'blocked', ...r });
  }
  return json(req, { error: 'Acción desconocida' }, 400);
});
