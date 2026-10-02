// IA de adquisición: analiza prospectos, escribe mensajes, lee respuestas,
// detecta objeciones y recomienda el siguiente paso. Usa SOLO lo que hay en
// App Settings, la base de conocimiento y las objeciones del workspace.
//
// Proveedor: OpenAI (Chat Completions) si existe el secret OPENAI_API_KEY;
// si no, un respaldo por reglas (engine-core) marcado como provider 'mock'.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.0';
import { classifyReply, detectObjection, mockAnalyze, mockMessage, nextAction, type Objection, type ProspectLite } from './engine-core.ts';

export type AiAction = 'analyze' | 'message' | 'reply' | 'summary' | 'score' | 'explain' | 'objection';

export interface AiContext {
  app: Record<string, unknown>;
  knowledge: { kind: string; title: string; content: string }[];
  objections: Objection[];
  prompts: Record<string, string>;
}

export async function loadContext(db: SupabaseClient, ws: string): Promise<AiContext> {
  const [app, kb, obj, pr] = await Promise.all([
    db.from('growth_app_settings').select('*').eq('workspace_id', ws).single(),
    db.from('growth_knowledge').select('kind,title,content').eq('workspace_id', ws).order('sort').limit(80),
    db.from('growth_objections').select('id,label,patterns,response').eq('workspace_id', ws).limit(50),
    db.from('growth_ai_prompts').select('key,instructions').eq('workspace_id', ws),
  ]);
  return {
    app: app.data || {},
    knowledge: kb.data || [],
    objections: (obj.data || []) as Objection[],
    prompts: Object.fromEntries((pr.data || []).map((x: { key: string; instructions: string }) => [x.key, x.instructions])),
  };
}

function knowledgeText(ctx: AiContext): string {
  const a = ctx.app as Record<string, string | null>;
  const lines = [
    `APP: ${a.app_name || ''}`, a.description && `Qué es: ${a.description}`, a.audience && `Para quién: ${a.audience}`,
    a.value_prop && `Propuesta de valor: ${a.value_prop}`, a.features && `Funcionalidades: ${a.features}`,
    a.benefits && `Beneficios: ${a.benefits}`, a.price && `Precio: ${a.price}`, a.monetization && `Modelo: ${a.monetization}`,
    a.website && `Web: ${a.website}`,
    ...ctx.knowledge.map((k) => `[${k.kind}] ${k.title}: ${k.content}`),
    ...ctx.objections.map((o) => `[objeción] ${o.label} → respuesta recomendada: ${o.response}`),
  ].filter(Boolean);
  return lines.join('\n').slice(0, 12000);
}

const SYSTEM = `Sos el agente de adquisición de usuarios de una app. Tu único objetivo es conseguir que personas reales
descarguen la app, se registren y la usen, de forma honesta. Reglas:
- Usá solo información que esté en el CONOCIMIENTO. Si algo no está, no lo inventes: decí que lo averiguás.
- Nada de presión, promesas falsas ni datos que la app no tenga.
- Si la persona pide no ser contactada, respetalo (opt_out = true) y no sigas.
- Español rioplatense, claro y corto.
- Respondé SIEMPRE con un objeto JSON con exactamente las claves pedidas.`;

const SCHEMAS: Record<AiAction, string> = {
  analyze: '{"segment": string, "score": entero 0-100, "summary": string (1-2 oraciones), "next_action": string, "reasoning": string}',
  message: '{"message": string}',
  reply: '{"intent": "high"|"medium"|"low"|"none", "objection_label": string|null, "suggested_reply": string, "next_action": string, "opt_out": boolean, "interested": boolean}',
  summary: '{"summary": string}',
  score: '{"score": entero 0-100, "reason": string}',
  explain: '{"text": string}',
  objection: '{"objection_label": string|null, "response": string}',
};

export interface AiResult { provider: 'openai' | 'mock'; model?: string; output: Record<string, unknown>; tokens_in?: number; tokens_out?: number }

export async function runAi(action: AiAction, ctx: AiContext, payload: Record<string, unknown>): Promise<AiResult> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return { provider: 'mock', output: mockRun(action, ctx, payload) };
  const model = Deno.env.get('GROWTH_AI_MODEL') || 'gpt-4o-mini';
  const user = [
    `TAREA (${action}): ${ctx.prompts[action] || ''}`,
    `Formato de respuesta: ${SCHEMAS[action]}`,
    `CONOCIMIENTO DE LA APP:\n${knowledgeText(ctx)}`,
    `DATOS:\n${JSON.stringify(payload).slice(0, 6000)}`,
  ].join('\n\n');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0.4, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  let out: Record<string, unknown> = {};
  try { out = JSON.parse(d.choices?.[0]?.message?.content || '{}'); } catch { out = {}; }
  return { provider: 'openai', model, output: sanitize(action, out, ctx), tokens_in: d.usage?.prompt_tokens, tokens_out: d.usage?.completion_tokens };
}

function sanitize(action: AiAction, o: Record<string, unknown>, ctx: AiContext): Record<string, unknown> {
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  if (action === 'analyze' || action === 'score') o.score = clamp(o.score);
  if (action === 'reply') {
    if (!['high', 'medium', 'low', 'none'].includes(String(o.intent))) o.intent = 'low';
    const label = o.objection_label ? String(o.objection_label) : null;
    const match = label ? ctx.objections.find((x) => x.label.toLowerCase() === label.toLowerCase()) : null;
    o.objection_id = match?.id ?? null;
    o.opt_out = !!o.opt_out;
  }
  return o;
}

function mockRun(action: AiAction, ctx: AiContext, p: Record<string, unknown>): Record<string, unknown> {
  const prospect = (p.prospect || {}) as ProspectLite;
  const app = ctx.app as Record<string, string | null>;
  switch (action) {
    case 'analyze': return mockAnalyze(prospect);
    case 'score': { const a = mockAnalyze(prospect); return { score: a.score, reason: a.summary }; }
    case 'message': return { message: mockMessage(prospect, app, String(p.channel || 'instagram'), (p.link as string) || null) };
    case 'explain': return { text: [app.description, app.value_prop].filter(Boolean).join(' ') || `${app.app_name || 'La app'}: completá App Settings para que pueda explicarla.` };
    case 'summary': {
      const msgs = (p.messages || []) as { direction: string; body: string }[];
      const last = msgs.filter((m) => m.direction === 'in').slice(-1)[0];
      return { summary: `${msgs.length} mensajes. ${last ? `Última respuesta: "${last.body.slice(0, 120)}".` : 'Todavía no respondió.'} Próximo paso: ${nextAction(prospect)}.` };
    }
    case 'objection': {
      const o = detectObjection(String(p.text || ''), ctx.objections);
      return { objection_label: o?.label ?? null, response: o?.response ?? 'No detecté una objeción conocida. Respondé la pregunta con la base de conocimiento.' };
    }
    case 'reply': {
      const c = classifyReply(String(p.text || ''), ctx.objections);
      const name = prospect.first_name ? ` ${prospect.first_name}` : '';
      const suggested = c.optOut ? `Perfecto${name}, no te escribimos más. ¡Gracias!`
        : c.objection ? c.objection.response
        : c.intent === 'high' ? `¡Genial${name}! Te paso el link para descargarla: {{link}}`
        : c.intent === 'medium' ? `${app.value_prop || 'Te cuento cómo funciona.'} ¿Querés el link para probarla?`
        : '¡Gracias por responder! Si en algún momento te sirve, avisame y te paso el link.';
      return {
        intent: c.intent, objection_label: c.objection?.label ?? null, objection_id: c.objection?.id ?? null,
        suggested_reply: suggested, opt_out: c.optOut, interested: c.intent === 'high' || c.intent === 'medium',
        next_action: c.optOut ? 'No volver a contactar' : c.intent === 'high' ? 'Enviar el link de descarga' : 'Responder la duda y ofrecer el link',
      };
    }
  }
}

export async function logRun(db: SupabaseClient, ws: string, prospectId: string | null, kind: string, input: unknown,
                             res: AiResult | null, err: string | null, ms: number): Promise<string | null> {
  const { data } = await db.from('growth_ai_runs').insert({
    workspace_id: ws, prospect_id: prospectId, kind, provider: res?.provider || 'openai', model: res?.model,
    input, output: res?.output || {}, ok: !err, error: err, tokens_in: res?.tokens_in, tokens_out: res?.tokens_out, duration_ms: ms,
  }).select('id').single();
  return data?.id ?? null;
}
