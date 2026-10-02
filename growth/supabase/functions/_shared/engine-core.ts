// Lógica pura del Growth OS: sin red ni base de datos, para poder probarla
// con tests (vitest) y usarla igual en las Edge Functions (Deno).

export type Json = Record<string, unknown>;

// ── Plantillas ──
// Reemplaza {{campo}} con datos del prospecto y de la app. Lo que no existe
// queda vacío (nunca "undefined").
export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl
    .replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_, k: string) => {
      const v = vars[k];
      return v === null || v === undefined ? '' : String(v);
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .trim();
}

// ── Dispositivo a partir del User-Agent ──
export function detectDevice(ua: string | null | undefined): 'android' | 'ios' | 'desktop' | 'other' {
  const s = (ua || '').toLowerCase();
  if (!s) return 'other';
  if (s.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  if (/windows|macintosh|x11|linux|cros/.test(s)) return 'desktop';
  return 'other';
}

// ── Redirección de links trackeados ──
export interface ClickData {
  target: 'play' | 'appstore' | 'web' | 'custom';
  token: string;
  slug: string;
  play_store_url?: string | null;
  app_store_url?: string | null;
  website?: string | null;
  custom_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
}

function withParams(url: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

// Google Play pasa el parámetro "referrer" a la app instalada (Install
// Referrer API); App Store Connect acepta "ct" (campaign token) para sus
// métricas de campañas. En la web se agregan UTM y gid (id del click).
export function buildRedirectUrl(d: ClickData): string | null {
  const utm = {
    utm_source: d.utm_source || 'growth',
    utm_medium: d.utm_medium || 'link',
    utm_campaign: d.utm_campaign || d.slug,
    utm_content: d.utm_content || undefined,
  };
  const safe = (u?: string | null) => (u && /^https:\/\//i.test(u) ? u : null);
  if (d.target === 'play' && safe(d.play_store_url)) {
    const ref = new URLSearchParams({ ...Object.fromEntries(Object.entries(utm).filter(([, v]) => v)) as Record<string, string>, gid: d.token });
    return withParams(d.play_store_url!, { referrer: ref.toString() });
  }
  if (d.target === 'appstore' && safe(d.app_store_url)) {
    return withParams(d.app_store_url!, { ct: (d.utm_campaign || d.slug).slice(0, 40) });
  }
  const web = safe(d.target === 'custom' ? d.custom_url : d.website) || safe(d.website) || safe(d.play_store_url) || safe(d.app_store_url);
  if (!web) return null;
  return withParams(web, { ...utm, gid: d.token });
}

// ── Condiciones (mismo lenguaje que growth_match en SQL) ──
export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { field: string; op: string; value?: unknown };

const DAY = 86_400_000;
const txt = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || Number.isNaN(n) ? null : n;
};

export function matchCond(obj: Record<string, unknown>, cond: Cond | Record<string, never> | null | undefined, now = Date.now()): boolean {
  if (!cond || Object.keys(cond).length === 0) return true;
  if ('all' in cond) return cond.all.every((c) => matchCond(obj, c, now));
  if ('any' in cond) return cond.any.some((c) => matchCond(obj, c, now));
  const c = cond as { field: string; op: string; value?: unknown };
  const v = obj[c.field];
  const vt = Array.isArray(v) ? (v.length ? JSON.stringify(v) : '') : txt(v);
  const valt = txt(c.value)?.toLowerCase() ?? null;
  switch (c.op) {
    case 'is_set': return vt !== null && vt !== '';
    case 'is_null': return vt === null || vt === '';
    case 'eq': return vt !== null && vt.toLowerCase() === valt;
    case 'neq': return vt === null || vt.toLowerCase() !== valt;
    case 'in': return vt !== null && Array.isArray(c.value) && c.value.some((x) => String(x).toLowerCase() === vt.toLowerCase());
    case 'nin': return vt === null || (Array.isArray(c.value) && !c.value.some((x) => String(x).toLowerCase() === vt.toLowerCase()));
    case 'gt': { const a = num(v), b = num(c.value); return a !== null && b !== null && a > b; }
    case 'gte': { const a = num(v), b = num(c.value); return a !== null && b !== null && a >= b; }
    case 'lt': { const a = num(v), b = num(c.value); return a !== null && b !== null && a < b; }
    case 'lte': { const a = num(v), b = num(c.value); return a !== null && b !== null && a <= b; }
    case 'contains': return vt !== null && valt !== null && vt.toLowerCase().includes(valt);
    case 'has_tag': return Array.isArray(v) && v.some((x) => String(x).toLowerCase() === valt);
    case 'older_than_days': { const t = Date.parse(String(v)); const d = num(c.value); return !Number.isNaN(t) && d !== null && t < now - d * DAY; }
    case 'within_days': { const t = Date.parse(String(v)); const d = num(c.value); return !Number.isNaN(t) && d !== null && t >= now - d * DAY; }
    default: return false;
  }
}

// ── Navegación entre pasos de una automatización ──
export interface Step {
  position: number;
  type: string;
  config: Record<string, unknown>;
  on_true: number | null;
  on_false: number | null;
}

// Devuelve la posición del próximo paso, o -1 para terminar.
export function nextPosition(steps: Step[], current: Step, branch?: boolean): number {
  const target = branch === undefined ? null : branch ? current.on_true : current.on_false;
  if (target === -1) return -1;
  if (target !== null && target !== undefined) return steps.some((s) => s.position === target) ? target : -1;
  const later = steps.filter((s) => s.position > current.position).sort((a, b) => a.position - b.position);
  return later.length ? later[0].position : -1;
}

export function waitMs(config: Record<string, unknown>): number {
  const d = num(config.days) ?? 0, h = num(config.hours) ?? 0, m = num(config.minutes) ?? 0;
  const ms = (d * 24 * 60 + h * 60 + m) * 60_000;
  return Math.max(60_000, Math.min(ms || 24 * 3_600_000, 90 * DAY));
}

// ── Objeciones y respuestas (heurística sin IA, también usada como respaldo) ──
export interface Objection { id: string; label: string; patterns: string[]; response: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function detectObjection(text: string, objections: Objection[]): Objection | null {
  const t = norm(text);
  let best: { o: Objection; len: number } | null = null;
  for (const o of objections) {
    for (const p of o.patterns) {
      const pp = norm(p).trim();
      if (pp && t.includes(pp) && (!best || pp.length > best.len)) best = { o, len: pp.length };
    }
  }
  return best?.o ?? null;
}

const POSITIVOS = ['me interesa', 'interesante', 'dale', 'si,', 'si!', 'si.', 'genial', 'pasame', 'mandame', 'como la descargo',
  'como funciona', 'quiero probar', 'la voy a probar', 'link', 'perfecto', 'buenisimo', 'de una', 'claro', 'ok'];
const NEGATIVOS = ['no me interesa', 'no gracias', 'no, gracias', 'no quiero', 'basta', 'stop', 'dejen de', 'no me escribas',
  'no me manden', 'baja', 'spam', 'denuncio'];

export type Intent = 'high' | 'medium' | 'low' | 'none';

export function classifyReply(text: string, objections: Objection[] = []) {
  const t = norm(text);
  const neg = NEGATIVOS.some((w) => t.includes(norm(w)));
  const optOut = /\b(baja|stop|no me escrib|no me mand|dejen de)\b/.test(t);
  const pos = POSITIVOS.filter((w) => t.includes(norm(w))).length;
  const objection = detectObjection(text, objections);
  let intent: Intent = 'low';
  if (neg) intent = 'none';
  else if (pos >= 2 || /\b(descarg|instal|link|como (la )?(bajo|descargo))\b/.test(t)) intent = 'high';
  else if (pos === 1 || /\?/.test(text)) intent = 'medium';
  if (objection && intent === 'high') intent = 'medium';
  return { intent, objection, optOut };
}

// ── IA de respaldo (sin proveedor configurado) ──
// Resultados deterministas y explicables; quedan marcados como provider 'mock'.
export interface AppInfo { app_name?: string | null; value_prop?: string | null; features?: string | null; price?: string | null }
export interface ProspectLite {
  first_name?: string | null; last_name?: string | null; company?: string | null; city?: string | null;
  status?: string; interest?: string; score?: number; source_key?: string | null; tags?: string[];
  contact_count?: number; replied_at?: string | null; installed_at?: string | null; registered_at?: string | null;
  email?: string | null; phone?: string | null; instagram?: string | null;
}

export function mockAnalyze(p: ProspectLite) {
  const parts: string[] = [];
  let score = 10;
  if (p.email || p.phone || p.instagram) { score += 10; parts.push('tiene un dato de contacto'); }
  if (p.company) { score += 5; parts.push('es una empresa o profesional'); }
  if (p.replied_at) { score += 20; parts.push('ya respondió'); }
  if (p.interest === 'high') score += 30; else if (p.interest === 'medium') score += 15;
  if (p.installed_at) score += 15;
  if (p.registered_at) score += 10;
  if (p.status === 'not_interested') score = Math.min(score, 10);
  if ((p.contact_count || 0) >= 3 && !p.replied_at) { score -= 15; parts.push('no responde después de varios contactos'); }
  score = Math.max(0, Math.min(100, score));
  const segment = p.company ? 'Profesionales y negocios' : p.source_key === 'referral' ? 'Referidos'
    : p.city && /buenos aires|caba/i.test(p.city) ? 'Buenos Aires' : 'Usuarios potenciales';
  const next = nextAction(p);
  return {
    segment, score,
    summary: parts.length ? `Prospecto que ${parts.join(', ')}.` : 'Prospecto sin interacción todavía.',
    next_action: next,
    reasoning: 'Cálculo por reglas (sin proveedor de IA configurado).',
  };
}

export function nextAction(p: ProspectLite): string {
  switch (p.status) {
    case 'new': case 'uncontacted': return 'Enviar primer mensaje';
    case 'contacted': return (p.contact_count || 0) >= 3 ? 'Pausar: no responde' : 'Hacer seguimiento en 2 días';
    case 'replied': return 'Responder y explicar cómo funciona la app';
    case 'interested': return 'Enviar el link de descarga';
    case 'link_sent': return 'Recordar el link en 1 día';
    case 'clicked': return 'Preguntar si pudo instalar';
    case 'installed': return 'Ayudar a completar el registro';
    case 'registered': return 'Guiar hacia la primera acción';
    case 'activated': case 'active': return 'Pedir una recomendación o reseña';
    case 'not_interested': return 'No volver a contactar';
    default: return 'Revisar manualmente';
  }
}

export function mockMessage(p: ProspectLite, app: AppInfo, channel: string, link?: string | null): string {
  const nombre = p.first_name ? p.first_name.trim() : '';
  const saludo = nombre ? `Hola ${nombre}!` : 'Hola!';
  const app_name = app.app_name || 'nuestra app';
  const vp = (app.value_prop || '').trim();
  const cuerpo = vp ? `${vp.replace(/\.$/, '')}.` : `Te cuento de ${app_name}.`;
  const cierre = link ? `Si querés probarla: ${link}` : '¿Te paso el link para probarla?';
  const baja = channel === 'email' ? '\n\nSi no querés recibir más mensajes, respondé "baja".'
    : channel === 'whatsapp' || channel === 'sms' ? ' Si no querés más mensajes, respondé BAJA.' : '';
  return `${saludo} Soy del equipo de ${app_name}. ${cuerpo} ${cierre}${baja}`.trim();
}
