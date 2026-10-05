// growth-ai: IA de adquisición para el panel.
//   POST /functions/v1/growth-ai   (requiere sesión de un miembro del workspace)
//   { workspace_id, action: analyze|message|reply|summary|score|explain|objection,
//     prospect_id?, text?, message_id?, channel?, link?, apply? }
// Con apply = true guarda el resultado en el prospecto (y en el mensaje, para 'reply').
// Sin OPENAI_API_KEY responde un respaldo por reglas marcado provider 'mock'.
import { loadContext, logRun, runAi, type AiAction } from '../_shared/ai.ts';
import { admin, cors, json, requireMember } from '../_shared/http.ts';

const ACTIONS: AiAction[] = ['analyze', 'message', 'reply', 'summary', 'score', 'explain', 'objection'];
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'JSON inválido' }, 400); }

  const ws = String(b.workspace_id || '');
  const action = String(b.action || '') as AiAction;
  if (!UUID.test(ws)) return json(req, { error: 'Falta workspace_id' }, 400);
  if (!ACTIONS.includes(action)) return json(req, { error: 'Acción desconocida' }, 400);
  const who = await requireMember(req, ws);
  if (who instanceof Response) return who;

  const db = admin();
  const pid = b.prospect_id && UUID.test(String(b.prospect_id)) ? String(b.prospect_id) : null;
  let prospect: Record<string, unknown> | null = null;
  if (pid) {
    const { data } = await db.from('growth_prospects')
      .select('id,first_name,last_name,company,city,status,interest,score,tags,contact_count,replied_at,installed_at,registered_at,email,phone,instagram,last_reply_text,source:growth_sources(key)')
      .eq('id', pid).eq('workspace_id', ws).maybeSingle();
    if (!data) return json(req, { error: 'Prospecto inexistente' }, 404);
    // Solo lo necesario para la IA: el payload no lleva notas internas.
    const { source, ...rest } = data as Record<string, unknown> & { source?: { key?: string } | null };
    prospect = { ...rest, source_key: source?.key ?? null };
  }
  if (['analyze', 'score', 'summary', 'message'].includes(action) && !prospect) {
    return json(req, { error: 'Esta acción necesita prospect_id' }, 400);
  }

  const payload: Record<string, unknown> = { prospect, channel: b.channel || null, link: b.link || null };
  if (action === 'summary' && pid) {
    const { data } = await db.from('growth_messages').select('direction,channel,body,created_at')
      .eq('prospect_id', pid).order('created_at', { ascending: false }).limit(30);
    payload.messages = (data || []).reverse();
  }
  if (action === 'reply' || action === 'objection') {
    let text = typeof b.text === 'string' ? b.text : '';
    if (!text && b.message_id && UUID.test(String(b.message_id))) {
      const { data } = await db.from('growth_messages').select('body').eq('id', String(b.message_id)).eq('workspace_id', ws).maybeSingle();
      text = data?.body || '';
    }
    if (!text && prospect?.last_reply_text) text = String(prospect.last_reply_text);
    if (!text.trim()) return json(req, { error: 'No hay texto para analizar' }, 400);
    payload.text = text.slice(0, 2000);
  }

  const ctx = await loadContext(db, ws);
  const t0 = Date.now();
  let res;
  try {
    res = await runAi(action, ctx, payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logRun(db, ws, pid, action, payload, null, msg, Date.now() - t0);
    return json(req, { error: `La IA no respondió: ${msg}` }, 502);
  }
  const runId = await logRun(db, ws, pid, action, payload, res, null, Date.now() - t0);
  const out = res.output;

  const applied: string[] = [];
  if (b.apply === true && pid) {
    const upd: Record<string, unknown> = {};
    if (action === 'analyze') {
      upd.ai_score = out.score; upd.ai_summary = out.summary; upd.next_action = out.next_action;
      if (out.segment) upd.segment_label = String(out.segment).slice(0, 80);
    }
    if (action === 'score') upd.ai_score = out.score;
    if (action === 'summary') upd.ai_summary = out.summary;
    if (action === 'reply') {
      const intent = String(out.intent);
      upd.interest = intent === 'none' ? 'none' : intent;
      if (out.next_action) upd.next_action = out.next_action;
      if (out.opt_out) { upd.consent = 'opt_out'; upd.do_not_contact = true; upd.consent_source = 'Respuesta del prospecto'; }
      if (intent === 'none' && !out.opt_out) upd.status = 'not_interested';
      if (b.message_id && UUID.test(String(b.message_id))) {
        await db.from('growth_messages').update({ intent, objection_id: out.objection_id ?? null })
          .eq('id', String(b.message_id)).eq('workspace_id', ws);
        applied.push('mensaje');
      }
    }
    if (Object.keys(upd).length) {
      const { error } = await db.from('growth_prospects').update(upd).eq('id', pid).eq('workspace_id', ws);
      if (error) return json(req, { error: error.message, output: out }, 500);
      applied.push('prospecto');
    }
    if (action === 'reply' && out.interested && !out.opt_out) {
      await db.rpc('growth_advance', { pid, st: 'interested' });
    }
    await db.from('growth_timeline').insert({
      workspace_id: ws, prospect_id: pid, type: 'ai', actor: 'ai',
      title: `IA: ${{ analyze: 'análisis', score: 'score', summary: 'resumen', reply: 'lectura de respuesta' }[action as string] || action}`,
      detail: { provider: res.provider, run_id: runId },
    });
  }
  return json(req, { ok: true, provider: res.provider, model: res.model || null, run_id: runId, output: out, applied });
});
