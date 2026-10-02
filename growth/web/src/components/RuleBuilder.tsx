// Constructor visual de reglas (segmentos, filtros de automatizaciones,
// condiciones y reglas de score). Escribe el mismo JSON que evalúan
// growth_match (SQL) y matchCond (Edge Functions).
import { useState } from 'react';
import { FIELDS_PROSPECT, INTEREST, CONSENT, OPS, STATUS } from '../lib/labels';

type Simple = { field: string; op: string; value?: unknown };
type Group = { all: Cond[] } | { any: Cond[] };
export type Cond = Simple | Group;

const isGroup = (c: unknown): c is Group => !!c && typeof c === 'object' && ('all' in (c as object) || 'any' in (c as object));
const flat = (g: Group) => ('all' in g ? g.all : g.any);
const simpleOnly = (c: Cond | Record<string, never>) => {
  if (!c || Object.keys(c).length === 0) return true;
  if (!isGroup(c)) return true;
  return flat(c).every((x) => !isGroup(x));
};

function toGroup(c: Cond | Record<string, never> | null | undefined): { mode: 'all' | 'any'; items: Simple[] } {
  if (!c || Object.keys(c).length === 0) return { mode: 'all', items: [] };
  if (isGroup(c)) return { mode: 'all' in c ? 'all' : 'any', items: flat(c) as Simple[] };
  return { mode: 'all', items: [c as Simple] };
}
function fromGroup(mode: 'all' | 'any', items: Simple[]): Cond | Record<string, never> {
  if (!items.length) return {};
  if (items.length === 1) return items[0];
  return mode === 'all' ? { all: items } : { any: items };
}

const ENUM_LABELS: Record<string, Record<string, string>> = {
  status: Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label])),
  interest: INTEREST, consent: CONSENT,
};

export function RuleBuilder({ value, onChange, fields = FIELDS_PROSPECT }: {
  value: Cond | Record<string, never> | null | undefined; onChange: (c: Cond | Record<string, never>) => void; fields?: typeof FIELDS_PROSPECT;
}) {
  const [json, setJson] = useState(!simpleOnly(value || {}));
  const [txt, setTxt] = useState(JSON.stringify(value || {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const g = toGroup(value);

  if (json) {
    return (
      <div className="grid">
        <textarea className="mono" rows={8} value={txt} onChange={(e) => {
          setTxt(e.target.value);
          try { onChange(JSON.parse(e.target.value || '{}')); setErr(null); } catch { setErr('JSON inválido'); }
        }} />
        {err && <div className="error">{err}</div>}
        {simpleOnly(value || {}) && <button className="btn chico" onClick={() => setJson(false)}>Volver al editor visual</button>}
      </div>
    );
  }

  const set = (items: Simple[], mode = g.mode) => onChange(fromGroup(mode, items));
  return (
    <div className="grid" style={{ gap: 8 }}>
      {g.items.length > 1 && (
        <div className="fila pequeño texto-2">
          Se tienen que cumplir
          <select style={{ width: 'auto' }} value={g.mode} onChange={(e) => set(g.items, e.target.value as 'all' | 'any')}>
            <option value="all">todas</option><option value="any">alguna</option>
          </select>
          las condiciones
        </div>
      )}
      {g.items.length === 0 && <div className="muted pequeño">Sin condiciones: aplica a todos.</div>}
      {g.items.map((c, i) => {
        const f = fields.find((x) => x.key === c.field) || fields[0];
        const ops = Object.entries(OPS).filter(([, o]) => o.for.includes(f.type));
        const needsValue = !['is_set', 'is_null'].includes(c.op);
        const multi = c.op === 'in' || c.op === 'nin';
        return (
          <div className="fila" key={i}>
            <select style={{ width: 170 }} value={c.field} onChange={(e) => {
              const nf = fields.find((x) => x.key === e.target.value)!;
              const op = Object.entries(OPS).find(([, o]) => o.for.includes(nf.type))![0];
              const items = [...g.items]; items[i] = { field: nf.key, op, value: '' }; set(items);
            }}>
              {fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
            <select style={{ width: 170 }} value={c.op} onChange={(e) => { const items = [...g.items]; items[i] = { ...c, op: e.target.value }; set(items); }}>
              {ops.map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
            </select>
            {needsValue && (f.type === 'enum' && !multi ? (
              <select className="crece" value={String(c.value ?? '')} onChange={(e) => { const items = [...g.items]; items[i] = { ...c, value: e.target.value }; set(items); }}>
                <option value="">Elegí…</option>
                {f.options!.map((o) => <option key={o} value={o}>{ENUM_LABELS[f.key]?.[o] || o}</option>)}
              </select>
            ) : (
              <input className="crece" placeholder={multi ? 'valores separados por coma' : f.type === 'date' ? 'días' : 'valor'}
                type={f.type === 'number' || f.type === 'date' ? 'number' : 'text'}
                value={multi ? (Array.isArray(c.value) ? (c.value as string[]).join(', ') : String(c.value ?? '')) : String(c.value ?? '')}
                onChange={(e) => {
                  const items = [...g.items];
                  const v = multi ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    : f.type === 'number' || f.type === 'date' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
                  items[i] = { ...c, value: v }; set(items);
                }} />
            ))}
            <button className="btn fantasma chico" aria-label="Quitar condición" onClick={() => set(g.items.filter((_, j) => j !== i))}>✕</button>
          </div>
        );
      })}
      <div className="fila">
        <button className="btn chico" onClick={() => set([...g.items, { field: fields[0].key, op: Object.entries(OPS).find(([, o]) => o.for.includes(fields[0].type))![0], value: '' }])}>+ Condición</button>
        <button className="btn fantasma chico" onClick={() => { setTxt(JSON.stringify(value || {}, null, 2)); setJson(true); }}>Editar como JSON</button>
      </div>
    </div>
  );
}

// Texto legible de una regla (para listas)
export function describeRule(c: unknown, fields = FIELDS_PROSPECT): string {
  if (!c || (typeof c === 'object' && Object.keys(c as object).length === 0)) return 'Todos';
  if (isGroup(c)) return flat(c).map((x) => describeRule(x, fields)).join('all' in c ? ' y ' : ' o ');
  const s = c as Simple;
  const f = fields.find((x) => x.key === s.field);
  const v = Array.isArray(s.value) ? s.value.join(', ') : s.value;
  const vl = (f && ENUM_LABELS[f.key]?.[String(v)]) || v;
  return `${f?.label || s.field} ${OPS[s.op]?.label || s.op}${['is_set', 'is_null'].includes(s.op) ? '' : ` ${vl}`}`;
}
