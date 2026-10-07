import { useState } from 'react';
import { Card, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui';
import { rpc } from '../lib/api';
import { fecha, num, pct, rate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { useWs } from '../lib/workspace';

export interface CohortRow { cohort: string; size: number; d1: number | null; d7: number | null; d30: number | null }

// Celda con intensidad según el %. null = la cohorte todavía no llegó a ese día.
function Celda({ n, size }: { n: number | null; size: number }) {
  if (n === null) return <td className="num muted" title="Todavía no pasó el tiempo para medirlo">·</td>;
  const r = rate(n, size) ?? 0;
  return <td className="num" style={{ background: `rgba(43,126,98,${Math.min(0.75, r / 100 + 0.05)})` }} title={`${num(n)} de ${num(size)}`}>{pct(r, 0)}</td>;
}

export function CohortTable({ rows }: { rows: CohortRow[] }) {
  if (!rows.length) return <div className="muted">No hay registros en este período.</div>;
  return (
    <div className="tabla-wrap"><table>
      <thead><tr><th>Cohorte (registro)</th><th className="num">Usuarios</th><th className="num">D1</th><th className="num">D7</th><th className="num">D30</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.cohort}><td className="mono">{fecha(r.cohort)}</td><td className="num">{num(r.size)}</td><Celda n={r.d1} size={r.size} /><Celda n={r.d7} size={r.size} /><Celda n={r.d30} size={r.size} /></tr>)}</tbody>
    </table></div>
  );
}

export default function AnalyticsCohorts() {
  const { ws, period } = useWs();
  const [grain, setGrain] = useState<'week' | 'month'>('week');
  const c = useAsync(() => rpc<CohortRow[]>('growth_cohorts', { ws: ws!.id, p_from: period.from, p_to: period.to, grain }), [ws!.id, period.from, period.to, grain]);
  return (
    <>
      <PageHeader title="Cohortes" desc="Usuarios agrupados por la semana (o el mes) en que se registraron, y qué parte volvió a usar la app." actions={<Segmented value={grain} onChange={setGrain} options={[{ key: 'week', label: 'Semanas' }, { key: 'month', label: 'Meses' }]} />} />
      <ErrorBox error={c.error} onRetry={c.reload} />
      <Card>{c.data ? <CohortTable rows={c.data} /> : !c.error && <Loading />}</Card>
    </>
  );
}
