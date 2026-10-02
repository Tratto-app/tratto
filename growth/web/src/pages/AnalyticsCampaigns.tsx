import { Bars } from '../components/charts';
import { Card, ErrorBox, Loading, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { periodLabel } from '../lib/period';
import type { Breakdown } from '../lib/types';
import { useWs } from '../lib/workspace';
import { BreakdownTable } from './AnalyticsOverview';

export default function AnalyticsCampaigns() {
  const { ws, period } = useWs();
  const b = useAsync(() => rpc<Breakdown[]>('growth_breakdown', { ws: ws!.id, p_from: period.from, p_to: period.to, dim: 'campaign' }), [ws!.id, period.from, period.to]);
  const rows = [...(b.data || [])].filter((r) => r.prospects || r.installs || r.spend).sort((x, y) => y.activations - x.activations);
  return (
    <>
      <PageHeader title="Campaigns · Analytics" desc={`Resultados por campaña en ${periodLabel(period)}. Los prospectos e instalaciones sin campaña aparecen como "Sin campaña".`} />
      <ErrorBox error={b.error} onRetry={b.reload} />
      {!b.data ? (b.error ? null : <Loading />) : (
        <>
          <Card title="Embudo por campaña">
            {rows.length ? <Bars data={rows.map((r) => ({ name: r.name, prospects: r.prospects, installs: r.installs, registrations: r.registrations, activations: r.activations })) as Record<string, unknown>[]} x="name" keys={['prospects', 'installs', 'registrations', 'activations']} labels={{ prospects: 'Prospectos', installs: 'Instalaciones', registrations: 'Registros', activations: 'Activaciones' }} height={280} /> : <div className="muted">Sin datos.</div>}
          </Card>
          <Card title="Detalle" className="mt"><BreakdownTable rows={rows} /></Card>
        </>
      )}
    </>
  );
}
