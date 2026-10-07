import { useState } from 'react';
import { Bars, Lines } from '../components/charts';
import { Card, ErrorBox, Kpi, Loading, PageHeader, Segmented } from '../components/ui';
import { rpc } from '../lib/api';
import { ars, num, pct, rate, ratio } from '../lib/format';
import { useAsync } from '../lib/hooks';
import type { Breakdown, Daily, Kpis } from '../lib/types';
import { useWs } from '../lib/workspace';

export function BreakdownTable({ rows }: { rows: Breakdown[] }) {
  if (!rows.length) return <div className="muted">Sin datos en este período.</div>;
  return (
    <div className="tabla-wrap"><table>
      <thead><tr><th>Nombre</th><th className="num">Prospectos</th><th className="num">Instal.</th><th className="num">Registros</th><th className="num">Activ.</th><th className="num">Activos</th><th className="num">Conv.</th><th className="num">Gasto</th><th className="num">CAC</th><th className="num">Ingresos</th><th className="num">LTV obs.</th><th className="num">ROI</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.key || 'none'}>
          <td>{r.name}</td><td className="num">{num(r.prospects)}</td><td className="num">{num(r.installs)}</td><td className="num">{num(r.registrations)}</td>
          <td className="num">{num(r.activations)}</td><td className="num">{num(r.active)}</td><td className="num">{pct(rate(r.activations, r.prospects))}</td>
          <td className="num">{ars(r.spend)}</td><td className="num">{ars(ratio(r.spend, r.activations))}</td><td className="num">{ars(r.revenue)}</td>
          <td className="num">{ars(ratio(r.revenue, r.registrations))}</td><td className="num">{r.spend ? pct(rate(r.revenue - r.spend, r.spend), 0) : '—'}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

export default function AnalyticsOverview() {
  const { ws, period } = useWs();
  const [dim, setDim] = useState<'source' | 'campaign'>('source');
  const args = { ws: ws!.id, p_from: period.from, p_to: period.to };
  const k = useAsync(() => rpc<Kpis>('growth_kpis', args), [ws!.id, period.from, period.to]);
  const b = useAsync(() => rpc<Breakdown[]>('growth_breakdown', { ...args, dim }), [ws!.id, period.from, period.to, dim]);
  const d = useAsync(() => rpc<Daily[]>('growth_daily', { ...args, p_from: period.from || new Date(Date.now() - 90 * 864e5).toISOString() }), [ws!.id, period.from, period.to]);
  const m = useAsync(() => rpc<{ template: string; sent: number; prospects: number; replied: number; interested: number; installed: number; registered: number }[]>('growth_message_performance', args), [ws!.id, period.from, period.to]);
  const c = k.data?.cur; const p = k.data?.prev;
  const rows = [...(b.data || [])].filter((r) => r.prospects || r.installs || r.spend).sort((x, y) => y.activations - x.activations);

  return (
    <>
      <PageHeader title="Análisis" desc="CAC = gasto ÷ activaciones. LTV observado = ingresos reales ÷ usuarios registrados (no es una proyección). ROI = (ingresos − gasto) ÷ gasto. Si no cargás gasto ni la app manda pagos, esos valores quedan vacíos en lugar de inventarse." />
      <ErrorBox error={k.error} onRetry={k.reload} />
      {c && (
        <div className="grid g6">
          <Kpi label="Gasto" value={c.spend} prev={p?.spend} format={ars} />
          <Kpi label="CAC por instalación" value={ratio(c.spend, c.installs)} prev={ratio(p?.spend, p?.installs)} format={ars} />
          <Kpi label="CAC por activación" value={ratio(c.spend, c.activations)} prev={ratio(p?.spend, p?.activations)} format={ars} highlight />
          <Kpi label="Ingresos" value={c.revenue} prev={p?.revenue} format={ars} />
          <Kpi label="LTV observado" value={ratio(c.revenue, c.registrations)} prev={ratio(p?.revenue, p?.registrations)} format={ars} help="Ingresos del período ÷ registros del período" />
          <Kpi label="ROI" value={c.spend ? rate(c.revenue - c.spend, c.spend) : null} prev={p?.spend ? rate(p.revenue - p.spend, p.spend) : null} format={(n) => pct(n, 0)} />
        </div>
      )}
      <Card title="Evolución" className="mt">
        {d.data ? <Lines data={d.data as unknown as Record<string, unknown>[]} keys={['clicks', 'installs', 'activations', 'active_users']} labels={{ clicks: 'Clicks', installs: 'Instalaciones', activations: 'Activaciones', active_users: 'Usuarios activos' }} /> : !d.error && <Loading />}
      </Card>
      <Card title="Por canal y campaña" className="mt" actions={<Segmented value={dim} onChange={setDim} options={[{ key: 'source', label: 'Fuente' }, { key: 'campaign', label: 'Campaña' }]} />}>
        <ErrorBox error={b.error} />
        {!b.data ? (b.error ? null : <Loading />) : (
          <>
            {rows.length > 0 && <Bars data={rows.map((r) => ({ name: r.name, installs: r.installs, activations: r.activations, active: r.active })) as Record<string, unknown>[]} x="name" keys={['installs', 'activations', 'active']} labels={{ installs: 'Instalaciones', activations: 'Activaciones', active: 'Activos' }} />}
            <div className="mt"><BreakdownTable rows={rows} /></div>
          </>
        )}
      </Card>
      <Card title="¿Qué mensaje convierte más?" className="mt">
        {!m.data ? (m.error ? null : <Loading />) : !m.data.length ? <div className="muted">Sin mensajes enviados en el período.</div> : (
          <div className="tabla-wrap"><table>
            <thead><tr><th>Plantilla / mensaje</th><th className="num">Enviados</th><th className="num">Personas</th><th className="num">Respondieron</th><th className="num">Interesados</th><th className="num">Instalaron</th><th className="num">Se registraron</th></tr></thead>
            <tbody>{[...m.data].sort((a, b2) => (rate(b2.installed, b2.prospects) ?? 0) - (rate(a.installed, a.prospects) ?? 0)).map((r) => (
              <tr key={r.template}><td className="mono">{r.template}</td><td className="num">{num(r.sent)}</td><td className="num">{num(r.prospects)}</td>
                <td className="num">{pct(rate(r.replied, r.prospects), 0)}</td><td className="num">{pct(rate(r.interested, r.prospects), 0)}</td><td className="num">{pct(rate(r.installed, r.prospects), 0)}</td><td className="num">{pct(rate(r.registered, r.prospects), 0)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="muted pequeño">Se agrupa por la "clave de plantilla" de cada envío. Con pocas personas por plantilla las diferencias pueden ser azar.</p>
      </Card>
    </>
  );
}
