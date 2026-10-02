const nf = new Intl.NumberFormat('es-AR');
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export const num = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '—' : nf.format(n));
export const ars = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '—' : money.format(n));
export const pct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(digits).replace('.', ',')}%`;
// a / b como porcentaje (null si no se puede calcular: nunca "Infinity" ni "NaN")
export const rate = (a: number | null | undefined, b: number | null | undefined) =>
  !b || a === null || a === undefined ? null : (100 * a) / b;
export const ratio = (a: number | null | undefined, b: number | null | undefined) =>
  !b || a === null || a === undefined ? null : a / b;

export function delta(cur: number | null | undefined, prev: number | null | undefined): { text: string; dir: 'sube' | 'baja' | '' } {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return { text: '', dir: '' };
  if (prev === 0) return cur === 0 ? { text: 'igual que el período anterior', dir: '' } : { text: 'nuevo vs. período anterior (0)', dir: 'sube' };
  const d = ((cur - prev) / prev) * 100;
  return { text: `${d >= 0 ? '+' : ''}${d.toFixed(0)}% vs. período anterior`, dir: d > 0 ? 'sube' : d < 0 ? 'baja' : '' };
}

export function fecha(s: string | null | undefined, conHora = false): string {
  if (!s) return '—';
  const d = new Date(s);
  return conHora
    ? d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function hace(s: string | null | undefined): string {
  if (!s) return '—';
  const ms = Date.now() - new Date(s).getTime();
  if (ms < -60000) {
    // Fecha futura (vencimientos)
    const fm = Math.round(-ms / 60000);
    if (fm < 60) return `en ${fm} min`;
    const fh = Math.round(fm / 60);
    return fh < 24 ? `en ${fh} h` : `en ${Math.round(fh / 24)} d`;
  }
  const m = Math.round(ms / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 60) return `hace ${d} d`;
  return fecha(s);
}

export const nombre = (p: { first_name?: string | null; last_name?: string | null; name?: string | null; email?: string | null } | null | undefined) =>
  p ? ([p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || p.email || 'Sin nombre') : '—';
