import { Link } from 'react-router-dom';
import { Funnel, Lines } from '../components/charts';
import { Badge, Card, ErrorBox, Kpi, Loading, PageHeader, Score, StatusBadge } from '../components/ui';
import { rpc } from '../lib/api';
import { ars, num, pct, rate, ratio, hace, nombre } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import type { Daily, FunnelRow, Kpis, Prospect } from '../lib/types';
import { useWs } from '../lib/workspace';

export default function Dashboard() {
  const { ws, period, app, kind } = useWs();
  const args = { ws: ws!.id, p_from: period.from, p_to: period.to, p_kind: kind };
  const k = useAsync(() => rpc<Kpis>('growth_kpis_tipo', args), [ws!.id, period.from, period.to, kind]);
  const f = useAsync(() => rpc<FunnelRow[]>('growth_funnel_tipo', args), [ws!.id, period.from, period.to, kind]);
  const d = useAsync(() => rpc<Daily[]>('growth_daily_tipo', { ...args, p_from: period.from || new Date(Date.now() - 90 * 864e5).toISOString() }), [ws!.id, period.from, period.to, kind]);
  // Siempre las dos columnas, aunque arriba esté elegido un solo tipo
  const comp = useAsync(async () => {
    const base = { ws: ws!.id, p_from: period.from, p_to: period.to };
    const [cli, prov] = await Promise.all([
      rpc<Kpis>('growth_kpis_tipo', { ...base, p_kind: 'customer' }),
      rpc<Kpis>('growth_kpis_tipo', { ...base, p_kind: 'provider' }),
    ]);
    return { cli: cli.cur, prov: prov.cur };
  }, [ws!.id, period.from, period.to]);
  const hot = useAsync(async () => {
    const q = supabase.from('growth_prospects')
      .select('id,first_name,last_name,status,score,next_action,last_reply_at')
      .eq('workspace_id', ws!.id).gte('score', 70).is('installed_at', null).eq('do_not_contact', false);
    if (kind) q.eq('kind', kind);
    const { data, error } = await q.order('score', { ascending: false }).limit(8);
    if (error) throw new Error(error.message);
    return data as Pick<Prospect, 'id' | 'first_name' | 'last_name' | 'status' | 'score' | 'next_action' | 'last_reply_at'>[];
  }, [ws!.id, kind]);
  const tasks = useAsync(async () => {
    const { data } = await supabase.from('growth_tasks').select('id,title,due_at,prospect_id').eq('workspace_id', ws!.id).eq('done', false).order('due_at').limit(6);
    return data || [];
  }, [ws!.id]);

  const c = k.data?.cur; const p = k.data?.prev;
  const clicks = (x?: typeof c) => (x ? x.clicks_play + x.clicks_appstore + x.clicks_web : undefined);

  return (
    <>
      <PageHeader title={`Hola 👋 así viene ${app?.app_name || 'tu app'}`}
        desc="Todo se calcula en vivo desde la base para el período elegido arriba, y se compara con el período anterior de igual duración."
        actions={<><Link className="btn" to="/prospects?new=1">+ Prospecto</Link><Link className="btn primario" to="/campaigns">Campañas</Link></>} />
      {app?.sending_paused !== false && (
        <div className="aviso" style={{ marginBottom: 14 }}>
          <b>Envíos en pausa.</b> El sistema recibe registros y prepara las automatizaciones, pero no envía ningún mensaje todavía. Activalos en Ajustes → Espacio de trabajo cuando la app esté publicada en las tiendas.
        </div>
      )}
      {comp.data && (
        <Card title="Clientes y proveedores (período)" className="comparar-tipos">
          <div className="tabla-wrap"><table>
            <thead><tr><th></th><th className="num">Contactos nuevos</th><th className="num">Registros</th><th className="num">Primer pedido o servicio</th><th className="num">Usuarios activos</th></tr></thead>
            <tbody>
              {([['customer', 'Clientes', comp.data.cli], ['provider', 'Proveedores', comp.data.prov]] as const).map(([k2, nombre, x]) => (
                <tr key={k2} className={kind === k2 ? 'elegido' : ''}>
                  <td><Badge tone={k2 === 'provider' ? 'laton' : 'verde'}>{nombre}</Badge></td>
                  <td className="num">{num(x.prospects)}</td><td className="num">{num(x.registrations)}</td>
                  <td className="num">{num(x.activations)}</td><td className="num">{num(x.active_users)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
      <ErrorBox error={k.error} onRetry={k.reload} />
      {k.loading && !k.data ? <Loading /> : c && (
        <div className="grid g6 mt">
          <Kpi label="Prospectos nuevos" value={c.prospects} prev={p?.prospects} />
          <Kpi label="Contactados" value={c.contacted} prev={p?.contacted} />
          <Kpi label="Tasa de respuesta" value={rate(c.replied, c.contacted)} prev={rate(p?.replied, p?.contacted)} format={pct}
            help="Prospectos que respondieron / contactados en el período." />
          <Kpi label="Interesados" value={c.interested} prev={p?.interested} />
          <Kpi label="Clicks a tiendas" value={clicks(c)} prev={clicks(p)} help="Clicks en links trackeados (Play + App Store + web)." />
          <Kpi label="Instalaciones" value={c.installs} prev={p?.installs} highlight />
          <Kpi label="Registros" value={c.registrations} prev={p?.registrations} />
          <Kpi label="Activaciones" value={c.activations} prev={p?.activations} highlight
            help={`Usuarios que hicieron el evento de activación (${app?.activation_event || 'first_action'}).`} />
          <Kpi label="Usuarios activos" value={c.active_users} prev={p?.active_users}
            help={`Usaron la app en los últimos ${k.data?.active_window_days} días del período.`} />
          <Kpi label="Prospecto → activación" value={rate(c.cohort_activated, c.prospects)} prev={rate(p?.cohort_activated, p?.prospects)} format={pct}
            help="De los prospectos que entraron en el período, qué % ya se activó." />
          <Kpi label="CAC por activación" value={ratio(c.spend, c.activations)} prev={ratio(p?.spend, p?.activations)} format={ars}
            help="Gasto cargado en Fuentes / activaciones del período. Si no cargaste gasto, es $0." />
          <Kpi label="Ingresos" value={c.revenue} prev={p?.revenue} format={ars} help="Eventos 'purchase' enviados por la app." />
        </div>
      )}

      <div className="grid g3" style={{ marginTop: 14 }}>
        <Card title="Funnel de adquisición" className="span2" actions={<Link className="btn chico" to="/analytics/funnel">Ver detalle</Link>}>
          <ErrorBox error={f.error} />
          {f.data ? <Funnel rows={f.data} /> : !f.error && <Loading />}
        </Card>
        <Card title="Alta intención sin instalar" actions={<Link className="btn chico" to="/prospects?min=70">Ver todos</Link>}>
          {hot.loading ? <Loading /> : !hot.data?.length ? <div className="muted">Nadie con score ≥ 70 pendiente.</div> : (
            <ul className="lista-simple">
              {hot.data.map((x) => (
                <li key={x.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/prospects/${x.id}`}>{nombre(x)}</Link>
                    <div className="muted pequeño">{x.next_action || '—'}</div>
                  </div>
                  <div className="derecha"><Score value={x.score} /><div><StatusBadge status={x.status} /></div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid g3" style={{ marginTop: 14 }}>
        <Card title="Evolución diaria" className="span2">
          <ErrorBox error={d.error} />
          {d.data ? (
            <Lines data={d.data as unknown as Record<string, unknown>[]} keys={['prospects', 'installs', 'registrations', 'activations']}
              labels={{ prospects: 'Prospectos', installs: 'Instalaciones', registrations: 'Registros', activations: 'Activaciones' }} />
          ) : !d.error && <Loading />}
        </Card>
        <Card title="Tareas pendientes">
          {tasks.loading ? <Loading /> : !tasks.data?.length ? <div className="muted">Sin tareas. Las automatizaciones pueden crearlas.</div> : (
            <ul className="lista-simple">
              {tasks.data.map((t: { id: string; title: string; due_at: string | null; prospect_id: string | null }) => (
                <li key={t.id}>
                  <div style={{ flex: 1 }}>{t.prospect_id ? <Link to={`/prospects/${t.prospect_id}`}>{t.title}</Link> : t.title}</div>
                  <span className="muted pequeño nowrap">{t.due_at ? `vence ${hace(t.due_at)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {c && <div className="sep" />}
          {c && <div className="muted pequeño">Retenidos en el período: <b className="mono">{num(c.retained)}</b> · Pagan: <b className="mono">{num(c.paying_users)}</b> · Gasto: <b className="mono">{ars(c.spend)}</b></div>}
        </Card>
      </div>
    </>
  );
}
