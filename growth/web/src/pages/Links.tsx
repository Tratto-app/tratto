import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { hace, num, pct, rate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { LINK_BASE, supabase } from '../lib/supabase';
import type { Campaign, Source, TrackingLink } from '../lib/types';
import { useWs } from '../lib/workspace';

const DEST: Record<string, string> = {
  smart: 'Inteligente (Android → Play, iPhone → App Store, resto → web)', play: 'Siempre Google Play', appstore: 'Siempre App Store', web: 'Siempre la web', custom: 'URL propia (https)',
};
interface LinkStat { link_id: string; clicks: number; android: number; ios: number; desktop: number; installs: number; registrations: number; activations: number; last_click: string | null }

export default function Links() {
  const { ws, app, toast, kind } = useWs();
  const [edit, setEdit] = useState<TrackingLink | 'new' | null>(null);
  const [archivados, setArchivados] = useState(false);
  const data = useAsync(async () => {
    const [l, s, c, st] = await Promise.all([
      supabase.from('growth_tracking_links').select('*').eq('workspace_id', ws!.id).order('created_at', { ascending: false }),
      supabase.from('growth_sources').select('id,key,name,kind').eq('workspace_id', ws!.id).order('name'),
      supabase.from('growth_campaigns').select('id,name').eq('workspace_id', ws!.id),
      rpc<LinkStat[]>('growth_link_stats_tipo', { ws: ws!.id, p_kind: kind }),
    ]);
    if (l.error) throw new Error(l.error.message);
    return { links: (l.data || []) as TrackingLink[], sources: (s.data || []) as Source[], campaigns: (c.data || []) as Campaign[], stats: Object.fromEntries(st.map((x) => [x.link_id, x])) as Record<string, LinkStat> };
  }, [ws!.id, kind]);

  const faltan = [!app?.play_store_url && 'Google Play', !app?.app_store_url && 'App Store', !app?.website && 'web'].filter(Boolean);
  const links = (data.data?.links || []).filter((l) => l.archived === archivados);
  return (
    <>
      <PageHeader title="Links con nombre" desc="Un link por campaña o canal. Detecta el teléfono, manda a la tienda que corresponde y registra cada click. Agregando ?r=<código> queda atado a un prospecto."
        actions={<><label className="check"><input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} /> Ver archivados</label><button className="btn primario" onClick={() => setEdit('new')}>+ Link</button></>} />
      {faltan.length > 0 && <div className="aviso" style={{ marginBottom: 14 }}>Falta cargar la URL de {faltan.join(', ')} en La app → Tiendas. Mientras tanto, esos clicks van a la web (o a la otra tienda).</div>}
      <ErrorBox error={data.error} onRetry={data.reload} />
      {!data.data ? (data.error ? null : <Loading />) : !links.length ? (
        <Card><Empty title={archivados ? 'No hay links archivados' : 'Sin links'} action={!archivados && <button className="btn primario" onClick={() => setEdit('new')}>Crear link</button>} /></Card>
      ) : (
        <div className="tabla-wrap">
          <table>
            <thead><tr><th>Link</th><th>Destino</th><th>Campaña / fuente</th><th className="num">Clicks</th><th className="num">Android</th><th className="num">iPhone</th><th className="num">PC</th><th className="num">Instal.</th><th className="num">Activ.</th><th className="num">Click→activ.</th><th>Último</th><th /></tr></thead>
            <tbody>
              {links.map((l) => {
                const s = data.data!.stats[l.id];
                const url = `${LINK_BASE}/${l.slug}`;
                return (
                  <tr key={l.id}>
                    <td><div>{l.name}</div><div className="mono muted pequeño">{url}</div></td>
                    <td><Badge>{l.destination}</Badge></td>
                    <td className="texto-2 pequeño">{data.data!.campaigns.find((c) => c.id === l.campaign_id)?.name || '—'}<br />{data.data!.sources.find((c) => c.id === l.source_id)?.name || ''}</td>
                    <td className="num">{num(s?.clicks ?? 0)}</td><td className="num">{num(s?.android ?? 0)}</td><td className="num">{num(s?.ios ?? 0)}</td><td className="num">{num(s?.desktop ?? 0)}</td>
                    <td className="num">{num(s?.installs ?? 0)}</td><td className="num">{num(s?.activations ?? 0)}</td><td className="num">{pct(rate(s?.activations, s?.clicks))}</td>
                    <td className="muted nowrap">{hace(s?.last_click)}</td>
                    <td className="nowrap">
                      <button className="btn chico" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copiado'); }}>Copiar</button>{' '}
                      <button className="btn chico" onClick={() => setEdit(l)}>Editar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted pequeño" style={{ marginTop: 12 }}>
        Los previsualizadores de WhatsApp, Facebook, Telegram y similares no cuentan como click. No se guarda la IP de nadie. Google Play recibe un <code>referrer</code> con UTM y el id del click (<code>gid</code>), que la app puede leer con la Install Referrer API y mandar a <code>growth-event</code> como <code>click_token</code>.
      </p>
      {edit && data.data && <Editor l={edit === 'new' ? null : edit} sources={data.data.sources} campaigns={data.data.campaigns} onClose={() => setEdit(null)} onDone={() => { setEdit(null); data.reload(); }} />}
    </>
  );
}

function Editor({ l, sources, campaigns, onClose, onDone }: { l: TrackingLink | null; sources: Source[]; campaigns: Campaign[]; onClose: () => void; onDone: () => void }) {
  const { ws } = useWs();
  const [f, setF] = useState({
    name: l?.name || '', slug: l?.slug || '', destination: l?.destination || 'smart', custom_url: l?.custom_url || '',
    campaign_id: l?.campaign_id || '', source_id: l?.source_id || '', utm_medium: l?.utm_medium || '', utm_content: l?.utm_content || '', archived: l?.archived || false,
  });
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    const slug = (f.slug || f.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    if (!f.name.trim() || slug.length < 3) return setError('Poné un nombre (y un slug de al menos 3 letras).');
    if (f.destination === 'custom' && !/^https:\/\//.test(f.custom_url)) return setError('La URL propia tiene que empezar con https://');
    const row = { workspace_id: ws!.id, name: f.name.trim(), slug, destination: f.destination, custom_url: f.destination === 'custom' ? f.custom_url : null,
      campaign_id: f.campaign_id || null, source_id: f.source_id || null, utm_medium: f.utm_medium || null, utm_content: f.utm_content || null, archived: f.archived };
    const { error } = l ? await supabase.from('growth_tracking_links').update(row).eq('id', l.id) : await supabase.from('growth_tracking_links').insert(row);
    if (error) setError(error.message.includes('duplicate') ? 'Ese slug ya está usado (los slugs son únicos en todo el sistema).' : error.message); else onDone();
  };
  return (
    <Modal title={l ? 'Editar link' : 'Nuevo link'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g2">
        <Field label="Nombre"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="Slug" hint={`${LINK_BASE}/${f.slug || '…'}`}><input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="se arma del nombre" /></Field>
        <Field label="Destino"><select value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })}>{Object.entries(DEST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {f.destination === 'custom' && <Field label="URL propia"><input value={f.custom_url} onChange={(e) => setF({ ...f, custom_url: e.target.value })} placeholder="https://" /></Field>}
        <Field label="Campaña"><select value={f.campaign_id} onChange={(e) => setF({ ...f, campaign_id: e.target.value })}><option value="">—</option>{campaigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Fuente (utm_source)"><select value={f.source_id} onChange={(e) => setF({ ...f, source_id: e.target.value })}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="utm_medium"><input value={f.utm_medium} onChange={(e) => setF({ ...f, utm_medium: e.target.value })} placeholder="dm, bio, story…" /></Field>
        <Field label="utm_content"><input value={f.utm_content} onChange={(e) => setF({ ...f, utm_content: e.target.value })} /></Field>
      </div>
      {l && <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} /> Archivado (deja de redirigir)</label>}
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
