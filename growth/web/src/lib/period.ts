export type PeriodKey = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';
export interface Period { key: PeriodKey; from: string | null; to: string | null }

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoy' }, { key: '7d', label: '7 días' }, { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' }, { key: 'all', label: 'Todo' }, { key: 'custom', label: 'Personalizado' },
];

// Rango [from, to) en ISO. "Todo" = sin límite inferior (null).
export function resolvePeriod(key: PeriodKey, custom?: { from?: string; to?: string }, now = new Date()): Period {
  const end = new Date(now);
  const start = new Date(now);
  switch (key) {
    case 'today': start.setHours(0, 0, 0, 0); break;
    case '7d': start.setDate(start.getDate() - 7); break;
    case '30d': start.setDate(start.getDate() - 30); break;
    case '90d': start.setDate(start.getDate() - 90); break;
    case 'all': return { key, from: null, to: end.toISOString() };
    case 'custom': {
      const f = custom?.from ? new Date(custom.from + 'T00:00:00') : start;
      const t = custom?.to ? new Date(custom.to + 'T00:00:00') : end;
      if (custom?.to) t.setDate(t.getDate() + 1); // el día "hasta" se incluye
      return { key, from: f.toISOString(), to: t.toISOString() };
    }
  }
  return { key, from: start.toISOString(), to: end.toISOString() };
}

export function periodLabel(p: Period): string {
  if (p.key !== 'custom') return PERIODS.find((x) => x.key === p.key)!.label;
  const f = p.from ? new Date(p.from).toLocaleDateString('es-AR') : '…';
  const t = p.to ? new Date(new Date(p.to).getTime() - 1).toLocaleDateString('es-AR') : 'hoy';
  return `${f} – ${t}`;
}
