// growth-automations: avanza las automatizaciones (secuencias) de cada prospecto.
//   POST /functions/v1/growth-automations
//   - Cron de la base (cada 5 min): header x-growth-cron con el secreto de Vault.
//     Procesa todos los workspaces.
//   - Panel: sesión de un miembro + { workspace_id } procesa solo ese workspace.
//     { workspace_id, action:'start', workflow_id, prospect_ids:[...] } inicia una
//     automatización manual para esos prospectos y la procesa enseguida.
// Cada ejecución avanza paso a paso hasta que tiene que esperar (wait, wait_reply)
// o termina. Un prospecto que pidió no ser contactado corta la ejecución.
import { loadContext, logRun, runAi } from '../_shared/ai.ts';
import type { Channel } from '../_shared/channels.ts';
import { matchCond, nextPosition, renderTemplate, waitMs, type Cond, type Step } from '../_shared/engine-core.ts';
import { admin, cors, json, requireMember, safeEqual, sha256Hex } from '../_shared/http.ts';
import { personalLink, sendingPaused, sendToProspect } from '../_shared/send.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.0';

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_RUNS = 50;
const MAX_STEPS = 20;
const STATUSES = ['new', 'uncontacted', 'contacted', 'replied', 'interested', 'link_sent', 'clicked', 'installed',
  'registered', 'activated', 'active', 'not_interested', 'no_response'];

type Run = { id: string; workspace_id: string; workflow_id: string; prospect_id: string; status: string;
  current_step: number; wait_until: string | null; waiting_reply: boolean; log: unknown[]; updated_at: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405);
  const db = admin();
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* el cron manda {} */ }

  let onlyWs: string | null = null;
  const cronKey = req.headers.get('x-growth-cron');
  if (cronKey) {
    const { data } = await db.from('growth_system').select('value').eq('key', 'cron_secret_hash').maybeSingle();
    if (!data || !safeEqual(await sha256Hex(cronKey), data.value)) return json(req, { error: 'No autorizado' }, 401);
  } else {
    onlyWs = String(b.workspace_id || '');
    if (!UUID.test(onlyWs)) return json(req, { error: 'Falta workspace_id' }, 400);
    const who = await requireMember(req, onlyWs);
    if (who instanceof Response) return who;
  }

  let started = 0;
  if (onlyWs && b.action === 'start') {
    const wf = String(b.workflow_id || '');
    const ids = (Array.isArray(b.prospect_ids) ? b.prospect_ids : []).map(String).filter((x) => UUID.test(x)).slice(0, 500);
    if (!UUID.test(wf) || !ids.length) return json(req, { error: 'Faltan workflow_id o prospect_ids' }, 400);
    const { data: w } = await db.from('growth_workflows').select('id').eq('id', wf).eq('workspace_id', onlyWs).maybeSingle();
    if (!w) return json(req, { error: 'Automatización inexistente' }, 404);
    const { data: ok } = await db.from('growth_prospects').select('id').eq('workspace_id', onlyWs).in('id', ids);
    const rows = (ok || []).map((p) => ({ workspace_id: onlyWs, workflow_id: wf, prospect_id: p.id }));
    // Una sola ejecución activa por prospecto y automatización (índice único parcial)
    for (const r of rows) {
      const { error } = await db.from('growth_workflow_runs').insert(r);
      if (!error) started++;
    }
  }

  const now = new Date().toISOString();
  let q = db.from('growth_workflow_runs').select('*')
    .or(`status.eq.running,and(status.eq.waiting,wait_until.lte.${now})`)
    .order('updated_at', { ascending: true }).limit(MAX_RUNS);
  if (onlyWs) q = q.eq('workspace_id', onlyWs);
  const { data: runs, error } = await q;
  if (error) return json(req, { error: error.message }, 500);

  const results: Record<string, unknown>[] = [];
  const stepsCache = new Map<string, Step[]>();
  const pausedCache = new Map<string, boolean>();
  const phoneCache = new Map<string, string>();
  for (const run of (runs || []) as Run[]) {
    // Reclamo optimista: si otra invocación ya la tomó, updated_at cambió.
    const { data: claimed } = await db.from('growth_workflow_runs').update({ updated_at: new Date().toISOString() })
      .eq('id', run.id).eq('updated_at', run.updated_at).select('updated_at').maybeSingle();
    if (!claimed) continue;
    run.updated_at = claimed.updated_at;
    if (!pausedCache.has(run.workspace_id)) pausedCache.set(run.workspace_id, await sendingPaused(db, run.workspace_id));
    const paused = pausedCache.get(run.workspace_id)!;
    if (!phoneCache.has(run.workspace_id)) {
      const { data: st } = await db.from('growth_app_settings').select('contact_phone').eq('workspace_id', run.workspace_id).maybeSingle();
      phoneCache.set(run.workspace_id, st?.contact_phone || '');
    }
    const contactPhone = phoneCache.get(run.workspace_id)!;
    try {
      results.push({ run: run.id, ...(await advance(db, run, stepsCache, paused, contactPhone)) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from('growth_workflow_runs').update({ status: 'failed', error: msg.slice(0, 500), finished_at: new Date().toISOString() }).eq('id', run.id);
      await db.from('growth_notifications').insert({
        workspace_id: run.workspace_id, type: 'automation_error', title: 'Falló una automatización',
        body: msg.slice(0, 300), prospect_id: run.prospect_id,
      });
      results.push({ run: run.id, status: 'failed', error: msg });
    }
  }
  return json(req, { ok: true, started, processed: results.length, results });
});

async function getSteps(db: SupabaseClient, wf: string, cache: Map<string, Step[]>): Promise<Step[]> {
  if (!cache.has(wf)) {
    const { data } = await db.from('growth_workflow_steps').select('position,type,config,on_true,on_false')
      .eq('workflow_id', wf).order('position');
    cache.set(wf, (data || []) as Step[]);
  }
  return cache.get(wf)!;
}

async function advance(db: SupabaseClient, run: Run, cache: Map<string, Step[]>, paused: boolean, contactPhone: string) {
  const steps = await getSteps(db, run.workflow_id, cache);
  const log = Array.isArray(run.log) ? [...run.log] : [];
  const save = (patch: Record<string, unknown>) =>
    db.from('growth_workflow_runs').update({ ...patch, log: log.slice(-100), updated_at: new Date().toISOString() }).eq('id', run.id);
  const finish = async (status: 'done' | 'cancelled', why: string) => {
    log.push({ at: new Date().toISOString(), info: why });
    await save({ status, finished_at: new Date().toISOString(), wait_until: null, waiting_reply: false });
    return { status, info: why };
  };

  let pos = run.current_step;
  let resuming = run.status === 'waiting' || run.waiting_reply || !!run.wait_until;
  for (let i = 0; i < MAX_STEPS; i++) {
    const step = steps.find((s) => s.position === pos) ?? steps.filter((s) => s.position > pos).sort((a, b) => a.position - b.position)[0];
    if (!step) return finish('done', 'Fin de la automatización');
    pos = step.position;

    const { data: p } = await db.from('growth_prospects').select('*').eq('id', run.prospect_id).maybeSingle();
    if (!p) return finish('cancelled', 'El prospecto ya no existe');
    if (p.do_not_contact || p.consent === 'opt_out' || p.status === 'not_interested') {
      return finish('cancelled', 'El prospecto pidió no ser contactado o no le interesa');
    }

    const cfg = (step.config || {}) as Record<string, unknown>;
    const entry: Record<string, unknown> = { at: new Date().toISOString(), step: pos, type: step.type };
    let branch: boolean | undefined;

    switch (step.type) {
      case 'wait': {
        if (!resuming) {
          const until = new Date(Date.now() + waitMs(cfg)).toISOString();
          log.push({ ...entry, info: `Espera hasta ${until}` });
          await save({ status: 'waiting', current_step: pos, wait_until: until, waiting_reply: false });
          return { status: 'waiting', until };
        }
        entry.info = 'Espera cumplida';
        break;
      }
      case 'wait_reply': {
        if (!resuming) {
          const until = new Date(Date.now() + waitMs(cfg)).toISOString();
          log.push({ ...entry, info: `Espera respuesta hasta ${until}`, since: entry.at });
          await save({ status: 'waiting', current_step: pos, wait_until: until, waiting_reply: true });
          return { status: 'waiting_reply', until };
        }
        const since = [...log].reverse().find((l) => (l as Record<string, unknown>).step === pos && (l as Record<string, unknown>).since) as
          { since?: string } | undefined;
        branch = !!p.last_reply_at && (!since?.since || p.last_reply_at > since.since);
        entry.info = branch ? 'Respondió' : 'No respondió a tiempo';
        break;
      }
      case 'condition': {
        branch = matchCond(p, cfg.condition as Cond);
        entry.info = branch ? 'Se cumple' : 'No se cumple';
        break;
      }
      case 'send_message': case 'send_link': {
        if (paused) {
          // Envíos en pausa: la secuencia espera sin mandar nada ni marcar contacto.
          const until = new Date(Date.now() + 6 * 3600_000).toISOString();
          log.push({ ...entry, info: 'En pausa hasta el lanzamiento: el mensaje queda en espera' });
          await save({ status: 'waiting', current_step: pos, wait_until: until, waiting_reply: false });
          return { status: 'paused', until };
        }
        const channel = String(cfg.channel || 'email') as Channel;
        let link: string | null = null;
        let campaign: string | null = null;
        if (step.type === 'send_link') {
          const { data: l } = await db.from('growth_tracking_links').select('slug,campaign_id').eq('id', String(cfg.link_id || ''))
            .eq('workspace_id', run.workspace_id).maybeSingle();
          if (!l) throw new Error(`Paso ${pos}: el link configurado no existe`);
          link = personalLink(l.slug, p.ref);
          campaign = l.campaign_id;
        }
        let body = String(cfg.body || '');
        let aiRun: string | null = null;
        if (cfg.ai === true || !body.trim()) {
          const ctx = await loadContext(db, run.workspace_id);
          const payload = { prospect: p, channel, link, instructions: cfg.ai_instructions || null };
          const t0 = Date.now();
          const res = await runAi('message', ctx, payload);
          aiRun = await logRun(db, run.workspace_id, p.id, 'message', payload, res, null, Date.now() - t0);
          body = String(res.output.message || '');
        }
        if (link && !body.includes('{{link}}') && !body.includes(link)) body += ' {{link}}';
        // Variables: datos guardados (por ejemplo, el resultado de la calculadora) + la ficha
        const vars = { ...((p.datos as Record<string, unknown>) || {}), ...p, link, contact_phone: contactPhone };
        const text = renderTemplate(body, vars);
        const r = await sendToProspect(db, run.workspace_id, p.id, {
          channel, body: text, subject: cfg.subject ? renderTemplate(String(cfg.subject), vars) : undefined,
          template_key: cfg.template_key ? String(cfg.template_key) : `wf:${run.workflow_id.slice(0, 8)}:${pos}`,
          ai_generated: !!aiRun, ai_run_id: aiRun, workflow_id: run.workflow_id, campaign_id: campaign,
        });
        if (step.type === 'send_link' && r.result.status !== 'blocked' && r.result.status !== 'failed') {
          await db.rpc('growth_advance', { pid: p.id, st: 'link_sent' });
        }
        entry.info = `Mensaje por ${channel}: ${r.result.status}${r.result.error ? ` (${r.result.error})` : ''}`;
        if (r.result.status === 'failed') throw new Error(`Paso ${pos}: ${r.result.error || 'no se pudo enviar'}`);
        break;
      }
      case 'ai_analyze': {
        const ctx = await loadContext(db, run.workspace_id);
        const payload = { prospect: p };
        const t0 = Date.now();
        const res = await runAi('analyze', ctx, payload);
        await logRun(db, run.workspace_id, p.id, 'analyze', payload, res, null, Date.now() - t0);
        const o = res.output;
        await db.from('growth_prospects').update({
          ai_score: o.score, ai_summary: o.summary, next_action: o.next_action,
          segment_label: o.segment ? String(o.segment).slice(0, 80) : p.segment_label,
        }).eq('id', p.id);
        entry.info = `IA (${res.provider}): score ${o.score}`;
        break;
      }
      case 'set_score': case 'add_score': {
        const n = Math.round(Number(cfg.value) || 0);
        const score = Math.max(0, Math.min(100, step.type === 'set_score' ? n : (p.score || 0) + n));
        await db.from('growth_prospects').update({ score, score_manual: true }).eq('id', p.id);
        entry.info = `Score ${score}`;
        break;
      }
      case 'set_status': {
        const st = String(cfg.status || '');
        if (!STATUSES.includes(st)) throw new Error(`Paso ${pos}: estado inválido`);
        await db.from('growth_prospects').update({ status: st }).eq('id', p.id);
        entry.info = `Estado ${st}`;
        break;
      }
      case 'add_tag': {
        const tag = String(cfg.tag || '').trim().slice(0, 40);
        if (tag && !(p.tags || []).includes(tag)) await db.from('growth_prospects').update({ tags: [...(p.tags || []), tag] }).eq('id', p.id);
        entry.info = `Etiqueta ${tag}`;
        break;
      }
      case 'create_task': {
        const days = Number(cfg.due_days ?? 1);
        await db.from('growth_tasks').insert({
          workspace_id: run.workspace_id, prospect_id: p.id,
          title: renderTemplate(String(cfg.title || 'Contactar a {{first_name}}'), p).slice(0, 200),
          due_at: new Date(Date.now() + Math.max(0, days) * 86_400_000).toISOString(),
        });
        entry.info = 'Tarea creada';
        break;
      }
      case 'notify': {
        await db.from('growth_notifications').insert({
          workspace_id: run.workspace_id, type: 'info', prospect_id: p.id,
          title: renderTemplate(String(cfg.title || 'Automatización: {{first_name}}'), p).slice(0, 200),
          body: cfg.body ? renderTemplate(String(cfg.body), p).slice(0, 500) : null,
        });
        entry.info = 'Notificación';
        break;
      }
      case 'webhook': {
        const url = String(cfg.url || '');
        if (!/^https:\/\//.test(url)) throw new Error(`Paso ${pos}: el webhook tiene que ser https`);
        const r = await fetch(url, {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
          // Datos mínimos del prospecto: nada de notas internas
          body: JSON.stringify({ event: 'growth.workflow_step', workflow_id: run.workflow_id, step: pos,
            prospect: { id: p.id, ref: p.ref, first_name: p.first_name, status: p.status, score: p.score, email: p.email, phone: p.phone } }),
        });
        entry.info = `Webhook ${r.status}`;
        if (!r.ok) throw new Error(`Paso ${pos}: el webhook respondió ${r.status}`);
        break;
      }
      default:
        throw new Error(`Paso ${pos}: tipo desconocido ${step.type}`);
    }

    log.push(entry);
    resuming = false;
    const next = nextPosition(steps, step, branch);
    if (next === -1) return finish('done', 'Fin de la automatización');
    pos = next;
    await save({ status: 'running', current_step: pos, wait_until: null, waiting_reply: false });
  }
  return { status: 'running', info: `Pausa tras ${MAX_STEPS} pasos; sigue en la próxima vuelta` };
}
