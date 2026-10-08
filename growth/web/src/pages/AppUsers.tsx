import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Funnel } from '../components/charts';
import { Badge, Card, Empty, ErrorBox, Kpi, Loading, PageHeader, Pager } from '../components/ui';
import { rpc } from '../lib/api';
import { ars, fecha, hace, num } from '../lib/format';
import { useAsync, useDebounced } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import type { AppUser, FunnelRow } from '../lib/types';
import { useWs } from '../lib/workspace';

const PAGE = 50;

export default function AppUsers() {
  const { ws, period, app, kind } = useWs();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [plat, setPlat] = useState('');
  const [etapa, setEtapa] = useState('');
  const [origen, setOrigen] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [dq, plat, etapa, origen]);

  const funnel = useAsync(() => rpc<FunnelRow[]>('growth_app_funnel_tipo', { ws: ws!.id, p_from: period.from, p_to: period.to, p_kind: kind }), [ws!.id, period.from, period.to, kind]);
  const counts = useAsync(async () => {
    const base = () => { const q = supabase.from('growth_app_users').select('id', { count: 'exact', head: true }).eq('workspace_id', ws!.id); return kind ? q.eq('kind', kind) : q; };
    const desde = new Date(Date.now() - (app?.active_window_days || 7) * 864e5).toISOString();
    const todos = () => supabase.from('growth_app_users').select('id', { count: 'exact', head: true }).eq('workspace_id', ws!.id);
    const [t, a, act, pay, pr, cli, prov] = await Promise.all([
      base(), base().not('activated_at', 'is', null), base().gte('last_seen_at', desde), base().eq('is_paying', true), base().not('prospect_id', 'is', null),
      todos().eq('kind', 'customer'), todos().eq('kind', 'provider'),
    ]);
    return { total: t.count || 0, activated: a.count || 0, active: act.count || 0, paying: pay.count || 0, fromProspects: pr.count || 0, clientes: cli.count || 0, proveedores: prov.count || 0 };
  }, [ws!.id, app?.active_window_days, kind]);
  const list = useAsync(async () => {
    let qy = supabase.from('growth_app_users').select('*, prospect:growth_prospects!growth_app_users_prospect_id_fkey(id,first_name,last_name), source:growth_sources(name)', { count: 'exact' }).eq('workspace_id', ws!.id);
    if (dq.trim()) { const t = dq.trim().replace(/[%,()]/g, ' '); qy = qy.or(`name.ilike.%${t}%,email.ilike.%${t}%,external_user_id.ilike.%${t}%`); }
    if (kind) qy = qy.eq('kind', kind);
    if (plat) qy = qy.eq('platform', plat);
    if (etapa === 'installed') qy = qy.is('registered_at', null);
    if (etapa === 'registered') qy = qy.not('registered_at', 'is', null).is('activated_at', null);
    if (etapa === 'activated') qy = qy.not('activated_at', 'is', null);
    if (etapa === 'inactive') qy = qy.lt('last_seen_at', new Date(Date.now() - (app?.active_window_days || 7) * 864e5).toISOString());
    if (origen === 'prospect') qy = qy.not('prospect_id', 'is', null);
    if (origen === 'organic') qy = qy.is('prospect_id', null);
    const { data, error, count } = await qy.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    return { rows: (data || []) as (AppUser & { prospect: { id: string; first_name: string | null; last_name: string | null } | null; source: { name: string } | null })[], total: count || 0 };
  }, [ws!.id, dq, plat, etapa, origen, page, kind]);

  return (
    <>
      <PageHeader title="Usuarios de la app" desc={<>Personas con cuenta en Tratto: <b>{num(counts.data?.clientes)}</b> clientes y <b>{num(counts.data?.proveedores)}</b> proveedores. Con el selector de arriba ves solo unos u otros.</>} />
      {counts.data && (
        <div className="grid g6">
          <Kpi label="Usuarios" value={counts.data.total} />
          <Kpi label="Vienen de un prospecto" value={counts.data.fromProspects} />
          <Kpi label="Llegaron solos" value={counts.data.total - counts.data.fromProspects} />
          <Kpi label="Activados" value={counts.data.activated} highlight />
          <Kpi label={`Activos (${app?.active_window_days || 7} d)`} value={counts.data.active} />
          <Kpi label="Pagan" value={counts.data.paying} />
        </div>
      )}
      <Card title="Funnel dentro de la app (período)" className="mt">
        <ErrorBox error={funnel.error} />
        {funnel.data ? <Funnel rows={funnel.data.map((r) => ({ ...r, prev_n: undefined as unknown as number, last_at: null }))} compare={false} /> : !funnel.error && <Loading />}
      </Card>
      <Card className="mt">
        <div className="fila" style={{ marginBottom: 12 }}>
          <input className="crece" placeholder="Buscar por nombre, email o id de la app…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar usuario" />
          <select style={{ width: 150 }} value={plat} onChange={(e) => setPlat(e.target.value)} aria-label="Plataforma"><option value="">Plataforma</option><option value="android">Android</option><option value="ios">iPhone</option><option value="web">Web</option></select>
          <select style={{ width: 210 }} value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Etapa">
            <option value="">Todas las etapas</option><option value="installed">Instaló y no se registró</option><option value="registered">Se registró y no se activó</option>
            <option value="activated">Activados</option><option value="inactive">Inactivos</option>
          </select>
          <select style={{ width: 170 }} value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="Origen"><option value="">Cualquier origen</option><option value="prospect">Vienen de un prospecto</option><option value="organic">Llegaron solos</option></select>
        </div>
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.error ? null : list.loading && !list.data ? <Loading /> : !list.data?.rows.length ? (
          <Empty title="Todavía no hay usuarios">Aparecen cuando la app manda eventos a <code>growth-event</code> (ver Ajustes → Integraciones).</Empty>
        ) : (
          <div className="tabla-wrap"><table>
            <thead><tr><th>Usuario</th><th>Tipo</th><th>Plataforma</th><th>Origen</th><th>Instaló</th><th>Registro</th><th>Activación</th><th>Último uso</th><th className="num">Sesiones</th><th className="num">Ingresos</th></tr></thead>
            <tbody>{list.data.rows.map((u) => (
              <tr key={u.id} className="clic" onClick={() => nav(`/users/${u.id}`)}>
                <td><Link to={`/users/${u.id}`} onClick={(e) => e.stopPropagation()}>{u.name || u.email || u.external_user_id}</Link><div className="muted pequeño mono">{u.external_user_id}</div></td>
                <td>{u.kind === 'provider' ? <Badge tone="laton">Proveedor</Badge> : u.kind === 'customer' ? <Badge tone="verde">Cliente</Badge> : <span className="muted">—</span>}</td>
                <td>{u.platform ? <Badge>{u.platform}</Badge> : '—'}</td>
                <td className="pequeño">{u.prospect ? <Link to={`/prospects/${u.prospect.id}`} onClick={(e) => e.stopPropagation()}>Prospecto</Link> : <span className="muted">Solo</span>}{u.source && <span className="muted"> · {u.source.name}</span>}</td>
                <td className="muted mono">{fecha(u.installed_at)}</td><td className="muted mono">{fecha(u.registered_at)}</td>
                <td>{u.activated_at ? <Badge tone="laton">{fecha(u.activated_at)}</Badge> : <span className="muted">—</span>}</td>
                <td className="muted">{hace(u.last_seen_at)}</td><td className="num">{num(u.sessions_count)}</td><td className="num">{u.revenue ? ars(u.revenue) : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {list.data && <Pager page={page} pageSize={PAGE} total={list.data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
