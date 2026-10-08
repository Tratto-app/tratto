import { Link } from 'react-router-dom';
import { Card, ErrorBox, Kpi, Loading, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { hace, num, pct } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';
import { CohortTable, type CohortRow } from './AnalyticsCohorts';

interface Ret { new_users: number; active_users: number; returning_users: number; d1: number | null; d7: number | null; d30: number | null }

export default function Retention() {
  const { ws, period, app, kind } = useWs();
  const args = { ws: ws!.id, p_from: period.from, p_to: period.to, p_kind: kind };
  const r = useAsync(() => rpc<Ret>('growth_retention_tipo', args), [ws!.id, period.from, period.to, kind]);
  const c = useAsync(() => rpc<CohortRow[]>('growth_cohorts_tipo', { ...args, grain: 'week' }), [ws!.id, period.from, period.to, kind]);
  const riesgo = useAsync(async () => {
    const dias = app?.active_window_days || 7;
    let q = supabase.from('growth_app_users').select('id,name,email,external_user_id,last_seen_at,sessions_count').eq('workspace_id', ws!.id)
      .not('activated_at', 'is', null).lt('last_seen_at', new Date(Date.now() - dias * 864e5).toISOString());
    if (kind) q = q.eq('kind', kind);
    const { data } = await q.order('last_seen_at', { ascending: false }).limit(12);
    return data || [];
  }, [ws!.id, app?.active_window_days, kind]);

  return (
    <>
      <PageHeader title="Retención" desc="¿Vuelven? D1 = usó la app el día siguiente al registro; D7 = entre el día 7 y el 13; D30 = entre el 30 y el 59. Solo cuentan las cohortes que ya tuvieron tiempo de llegar a ese día." />
      <ErrorBox error={r.error} onRetry={r.reload} />
      {!r.data ? (r.error ? null : <Loading />) : (
        <div className="grid g6">
          <Kpi label="Retención D1" value={r.data.d1} format={pct} highlight />
          <Kpi label="Retención D7" value={r.data.d7} format={pct} highlight />
          <Kpi label="Retención D30" value={r.data.d30} format={pct} highlight />
          <Kpi label="Registros nuevos" value={r.data.new_users} />
          <Kpi label="Usuarios activos" value={r.data.active_users} help="Con al menos una sesión en el período" />
          <Kpi label="Volvieron" value={r.data.returning_users} help="Registrados antes del período que lo usaron en el período" />
        </div>
      )}
      <Card title="Cohortes semanales" className="mt">
        <ErrorBox error={c.error} />
        {c.data ? <CohortTable rows={c.data} /> : !c.error && <Loading />}
      </Card>
      <Card title={`Activados que dejaron de usarla (más de ${app?.active_window_days || 7} días)`} className="mt"
        actions={<Link className="btn chico" to="/segments">Segmentos</Link>}>
        {!riesgo.data ? (riesgo.error ? null : <Loading />) : !riesgo.data.length ? <div className="muted">Nadie en riesgo ahora.</div> : (
          <ul className="lista-simple">{riesgo.data.map((u: { id: string; name: string | null; email: string | null; external_user_id: string | null; last_seen_at: string | null; sessions_count: number }) => (
            <li key={u.id}><Link to={`/users/${u.id}`} style={{ flex: 1 }}>{u.name || u.email || u.external_user_id}</Link><span className="muted pequeño">{num(u.sessions_count)} sesiones · último uso {hace(u.last_seen_at)}</span></li>
          ))}</ul>
        )}
        <p className="muted pequeño">Todos los días a las 9:40 el sistema revisa quién quedó inactivo y crea una notificación.</p>
      </Card>
    </>
  );
}
