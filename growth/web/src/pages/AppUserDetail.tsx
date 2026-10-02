import { Link, useParams } from 'react-router-dom';
import { Badge, Card, ErrorBox, Loading, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { ars, fecha, hace, nombre, num } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import type { AppUser, TimelineItem } from '../lib/types';
import { useWs } from '../lib/workspace';

const HITOS: [keyof AppUser, string][] = [
  ['installed_at', 'Instaló'], ['first_open_at', 'Abrió por primera vez'], ['registered_at', 'Se registró'],
  ['onboarded_at', 'Completó el onboarding'], ['first_action_at', 'Primera acción'], ['activated_at', 'Activado'], ['last_seen_at', 'Último uso'],
];

export default function AppUserDetail() {
  const { id } = useParams();
  const { ws, toast } = useWs();
  const u = useAsync(async () => {
    const { data, error } = await supabase.from('growth_app_users').select('*, prospect:growth_prospects!growth_app_users_prospect_id_fkey(id,first_name,last_name,status), source:growth_sources(name), campaign:growth_campaigns(name), link:growth_tracking_links(name)').eq('id', id!).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Usuario inexistente');
    return data as AppUser & { prospect: { id: string; first_name: string | null; last_name: string | null; status: string } | null; source: { name: string } | null; campaign: { name: string } | null; link: { name: string } | null };
  }, [id]);
  const ev = useAsync(async () => {
    const [e, t] = await Promise.all([
      supabase.from('growth_app_events').select('id,event,platform,amount,properties,occurred_at').eq('app_user_id', id!).order('occurred_at', { ascending: false }).limit(100),
      supabase.from('growth_timeline').select('*').eq('app_user_id', id!).order('created_at', { ascending: false }).limit(50),
    ]);
    return { events: e.data || [], timeline: (t.data || []) as TimelineItem[] };
  }, [id]);

  if (u.error) return <ErrorBox error={u.error} />;
  if (!u.data) return <Loading />;
  const x = u.data;
  const sim = async (event: string) => {
    try { await rpc('growth_simulate_event', { ws: ws!.id, ev: { event, external_user_id: x.external_user_id, email: x.email } }); toast(`Evento ${event} registrado`); u.reload(); ev.reload(); }
    catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
  };
  return (
    <>
      <PageHeader title={x.name || x.email || x.external_user_id || 'Usuario'} desc={<>id en la app: <span className="mono">{x.external_user_id || '—'}</span> · {x.platform || 'plataforma desconocida'}</>} />
      <div className="grid g3">
        <Card title="Recorrido">
          <ul className="lista-simple">{HITOS.map(([k, l]) => <li key={k}><span style={{ flex: 1 }} className={x[k] ? '' : 'muted'}>{x[k] ? '●' : '○'} {l}</span><span className="mono muted">{fecha(x[k] as string | null, true)}</span></li>)}</ul>
        </Card>
        <Card title="Origen">
          <ul className="lista-simple pequeño">
            <li><span className="muted" style={{ width: 90 }}>Prospecto</span>{x.prospect ? <Link to={`/prospects/${x.prospect.id}`}>{nombre(x.prospect)}</Link> : 'Llegó solo (sin prospecto)'}</li>
            <li><span className="muted" style={{ width: 90 }}>Fuente</span>{x.source?.name || '—'}</li>
            <li><span className="muted" style={{ width: 90 }}>Campaña</span>{x.campaign?.name || '—'}</li>
            <li><span className="muted" style={{ width: 90 }}>Link</span>{x.link?.name || '—'}</li>
          </ul>
        </Card>
        <Card title="Uso">
          <ul className="lista-simple pequeño">
            <li><span className="muted" style={{ width: 90 }}>Sesiones</span><span className="mono">{num(x.sessions_count)}</span></li>
            <li><span className="muted" style={{ width: 90 }}>Último uso</span>{hace(x.last_seen_at)}</li>
            <li><span className="muted" style={{ width: 90 }}>Ingresos</span><span className="mono">{ars(x.revenue)}</span> {x.is_paying && <Badge tone="laton">paga</Badge>}</li>
          </ul>
          {ws!.is_demo && (
            <>
              <div className="sep" />
              <div className="muted pequeño" style={{ marginBottom: 6 }}>Simular evento (solo demo)</div>
              <div className="chips">{['register', 'onboarding_complete', 'first_action', 'session_start', 'purchase'].map((e) => <button key={e} className="btn chico" onClick={() => sim(e)}>{e}</button>)}</div>
            </>
          )}
        </Card>
      </div>
      <div className="grid g2 mt">
        <Card title="Eventos de la app">
          {!ev.data ? (ev.error ? null : <Loading />) : !ev.data.events.length ? <div className="muted">Sin eventos.</div> : (
            <div className="tabla-wrap"><table><thead><tr><th>Evento</th><th>Cuándo</th><th>Plataforma</th><th className="num">Monto</th></tr></thead>
              <tbody>{ev.data.events.map((e: { id: number; event: string; platform: string | null; amount: number | null; occurred_at: string }) => (
                <tr key={e.id}><td className="mono">{e.event}</td><td className="muted">{fecha(e.occurred_at, true)}</td><td>{e.platform || '—'}</td><td className="num">{e.amount ? ars(e.amount) : ''}</td></tr>
              ))}</tbody></table></div>
          )}
        </Card>
        <Card title="Línea de tiempo">
          {!ev.data ? (ev.error ? null : <Loading />) : <ul className="timeline">{ev.data.timeline.map((t) => <li key={t.id} className={t.actor === 'app' ? 'app' : ''}><div>{t.title}</div><div className="cuando">{fecha(t.created_at, true)}</div></li>)}</ul>}
        </Card>
      </div>
    </>
  );
}
