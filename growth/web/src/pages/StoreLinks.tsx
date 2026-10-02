import { useEffect, useState } from 'react';
import { Badge, Card, ErrorBox, Field, Loading, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { num, pct, rate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

interface StoreStat { platform: string; clicks: number; installs: number; registrations: number; activations: number }
const PLAT: Record<string, string> = { android: 'Android · Google Play', ios: 'iPhone · App Store', web: 'Web', desktop: 'Computadora', other: 'Otros' };

export default function StoreLinks() {
  const { ws, app, period, reloadApp, toast } = useWs();
  const [f, setF] = useState({ play_store_url: '', app_store_url: '', deep_link_base: '' });
  useEffect(() => { if (app) setF({ play_store_url: app.play_store_url || '', app_store_url: app.app_store_url || '', deep_link_base: app.deep_link_base || '' }); }, [app]);
  const s = useAsync(() => rpc<StoreStat[]>('growth_store_stats', { ws: ws!.id, p_from: period.from, p_to: period.to }), [ws!.id, period.from, period.to]);
  const integ = useAsync(async () => (await supabase.from('growth_integrations').select('provider,mode').eq('workspace_id', ws!.id).in('provider', ['google_play', 'app_store'])).data || [], [ws!.id]);

  const guardar = async () => {
    for (const [k, v] of Object.entries(f)) if (v && !/^https:\/\//.test(v) && k !== 'deep_link_base') return toast('Las URLs de las tiendas tienen que empezar con https://', true);
    const { error } = await supabase.from('growth_app_settings').update({ play_store_url: f.play_store_url || null, app_store_url: f.app_store_url || null, deep_link_base: f.deep_link_base || null }).eq('workspace_id', ws!.id);
    if (error) toast(error.message, true); else { toast('Guardado'); reloadApp(); }
  };
  return (
    <>
      <PageHeader title="Store Links" desc="A dónde mandan los links trackeados y cómo rinde cada tienda. Los números salen de tus clicks y de los eventos que manda la app, no de las consolas de las tiendas."
        actions={<button className="btn primario" onClick={guardar}>Guardar</button>} />
      <div className="grid g2">
        <Card title="URLs">
          <div className="grid">
            <Field label="Google Play" hint="https://play.google.com/store/apps/details?id=…"><input value={f.play_store_url} onChange={(e) => setF({ ...f, play_store_url: e.target.value })} /></Field>
            <Field label="App Store" hint="https://apps.apple.com/…/id…"><input value={f.app_store_url} onChange={(e) => setF({ ...f, app_store_url: e.target.value })} /></Field>
            <Field label="Deep link (opcional)" hint="Esquema o dominio para abrir la app directo (ej.: https://app.tudominio.com)"><input value={f.deep_link_base} onChange={(e) => setF({ ...f, deep_link_base: e.target.value })} /></Field>
          </div>
        </Card>
        <Card title="Consolas de las tiendas">
          <ul className="lista-simple">
            {(integ.data || []).map((i: { provider: string; mode: string }) => (
              <li key={i.provider}><span style={{ flex: 1 }}>{i.provider === 'google_play' ? 'Google Play Console' : 'App Store Connect'}</span><Badge tone="mock">{i.mode === 'live' ? 'conectado' : 'no conectado'}</Badge></li>
            ))}
          </ul>
          <p className="muted pequeño">Las instalaciones, reseñas y conversiones de ficha que muestran las consolas (Play Console Reporting API, App Store Connect Analytics) todavía no están conectadas: requieren una cuenta de servicio de Google y una API key de App Store Connect. Hasta entonces este panel no inventa esos números: usa los clicks propios y los eventos <code>install</code> que manda la app.</p>
        </Card>
      </div>
      <Card title="Rendimiento por plataforma (período)" className="mt">
        <ErrorBox error={s.error} />
        {!s.data ? (s.error ? null : <Loading />) : !s.data.length ? <div className="muted">Sin clicks ni instalaciones en el período.</div> : (
          <div className="tabla-wrap"><table>
            <thead><tr><th>Plataforma</th><th className="num">Clicks</th><th className="num">Instalaciones</th><th className="num">Click → instalación</th><th className="num">Registros</th><th className="num">Activaciones</th></tr></thead>
            <tbody>{s.data.map((r) => <tr key={r.platform}><td>{PLAT[r.platform] || r.platform}</td><td className="num">{num(r.clicks)}</td><td className="num">{num(r.installs)}</td><td className="num">{pct(rate(r.installs, r.clicks))}</td><td className="num">{num(r.registrations)}</td><td className="num">{num(r.activations)}</td></tr>)}</tbody>
          </table></div>
        )}
        <p className="muted pequeño">La conversión click → instalación es aproximada: incluye instalaciones de personas que no pasaron por un link trackeado.</p>
      </Card>
    </>
  );
}
