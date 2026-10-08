import { useState } from 'react';
import { Bars } from '../components/charts';
import { Badge, Card, ErrorBox, Field, Loading, Modal, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { ars, fecha, num, pct, rate, ratio } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import type { Breakdown, Campaign, Source } from '../lib/types';
import { useWs } from '../lib/workspace';

const KINDS: Record<string, string> = { social: 'Redes', paid: 'Pago', organic: 'Orgánico', referral: 'Referidos', messaging: 'Mensajería', email: 'Email', search: 'Buscadores', influencer: 'Influencers', other: 'Otro' };

export default function Sources() {
  const { ws, period, toast, kind } = useWs();
  const [nueva, setNueva] = useState(false);
  const [gasto, setGasto] = useState(false);
  const data = useAsync(async () => {
    const [b, s, c, sp] = await Promise.all([
      rpc<Breakdown[]>('growth_breakdown_tipo', { ws: ws!.id, p_from: period.from, p_to: period.to, dim: 'source', p_kind: kind }),
      supabase.from('growth_sources').select('id,key,name,kind').eq('workspace_id', ws!.id).order('name'),
      supabase.from('growth_campaigns').select('id,name').eq('workspace_id', ws!.id),
      supabase.from('growth_spend').select('id,spent_on,amount,note,source_id,campaign_id').eq('workspace_id', ws!.id).order('spent_on', { ascending: false }).limit(30),
    ]);
    return { rows: b, sources: (s.data || []) as Source[], campaigns: (c.data || []) as Campaign[], spend: sp.data || [] };
  }, [ws!.id, period.from, period.to]);

  // Sin rankings inventados: se ordena por activaciones reales del período.
  const rows = [...(data.data?.rows || [])].filter((r) => r.prospects || r.installs || r.spend).sort((a, b) => b.activations - a.activations || b.installs - a.installs);
  return (
    <>
      <PageHeader title="Fuentes" desc="De dónde viene cada prospecto y cada usuario. El orden sale de tus datos del período, no de un ranking genérico."
        actions={<><button className="btn" onClick={() => setGasto(true)}>+ Cargar gasto</button><button className="btn primario" onClick={() => setNueva(true)}>+ Fuente</button></>} />
      <ErrorBox error={data.error} onRetry={data.reload} />
      {!data.data ? (data.error ? null : <Loading />) : (
        <>
          <Card title="Rendimiento por fuente">
            {!rows.length ? <div className="muted">Todavía no hay datos en este período.</div> : (
              <>
                <Bars data={rows.map((r) => ({ name: r.name, installs: r.installs, activations: r.activations })) as Record<string, unknown>[]} x="name" keys={['installs', 'activations']} labels={{ installs: 'Instalaciones', activations: 'Activaciones' }} />
                <div className="tabla-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead><tr><th>Fuente</th><th className="num">Prospectos</th><th className="num">Resp.</th><th className="num">Clicks</th><th className="num">Instal.</th><th className="num">Registros</th><th className="num">Activ.</th><th className="num">Conv.</th><th className="num">Gasto</th><th className="num">CAC</th><th className="num">Ingresos</th></tr></thead>
                    <tbody>{rows.map((r) => (
                      <tr key={r.key || 'none'}>
                        <td>{r.name}</td><td className="num">{num(r.prospects)}</td><td className="num">{pct(rate(r.replied, r.contacted), 0)}</td>
                        <td className="num">{num(r.clicks)}</td><td className="num">{num(r.installs)}</td><td className="num">{num(r.registrations)}</td>
                        <td className="num">{num(r.activations)}</td><td className="num">{pct(rate(r.activations, r.prospects))}</td>
                        <td className="num">{ars(r.spend)}</td><td className="num">{ars(ratio(r.spend, r.activations))}</td><td className="num">{ars(r.revenue)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
          <div className="grid g2" style={{ marginTop: 14 }}>
            <Card title="Fuentes configuradas">
              <div className="chips">{data.data.sources.map((s) => <Badge key={s.id} title={s.key}>{s.name} · {KINDS[s.kind]}</Badge>)}</div>
            </Card>
            <Card title="Últimos gastos cargados">
              {!data.data.spend.length ? <div className="muted">Sin gastos. Cargalos para calcular CAC y ROI.</div> : (
                <ul className="lista-simple pequeño">{data.data.spend.slice(0, 10).map((s: { id: string; spent_on: string; amount: number; note: string | null; source_id: string | null; campaign_id: string | null }) => (
                  <li key={s.id}><span className="mono muted">{fecha(s.spent_on)}</span><span style={{ flex: 1 }}>{data.data!.sources.find((x) => x.id === s.source_id)?.name || '—'} {s.campaign_id && `· ${data.data!.campaigns.find((x) => x.id === s.campaign_id)?.name || ''}`}</span><span className="mono">{ars(s.amount)}</span>
                    <button className="btn fantasma chico" aria-label="Borrar gasto" onClick={async () => { const { error } = await supabase.from('growth_spend').delete().eq('id', s.id); if (error) toast(error.message, true); else data.reload(); }}>✕</button></li>
                ))}</ul>
              )}
            </Card>
          </div>
        </>
      )}
      {nueva && <NuevaFuente onClose={() => setNueva(false)} onDone={() => { setNueva(false); data.reload(); }} />}
      {gasto && data.data && <Gasto sources={data.data.sources} campaigns={data.data.campaigns} onClose={() => setGasto(false)} onDone={() => { setGasto(false); data.reload(); }} />}
    </>
  );
}

function NuevaFuente({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { ws } = useWs();
  const [name, setName] = useState(''); const [kind, setKind] = useState('other'); const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    const key = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    if (key.length < 2) return setError('Nombre muy corto.');
    const { error } = await supabase.from('growth_sources').insert({ workspace_id: ws!.id, key, name: name.trim(), kind });
    if (error) setError(error.message.includes('duplicate') ? 'Ya existe una fuente con ese nombre.' : error.message); else onDone();
  };
  return (
    <Modal title="Nueva fuente" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g2">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ej.: Volantes en ferias" /></Field>
        <Field label="Tipo"><select value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}

function Gasto({ sources, campaigns, onClose, onDone }: { sources: Source[]; campaigns: Campaign[]; onClose: () => void; onDone: () => void }) {
  const { ws } = useWs();
  const [f, setF] = useState({ spent_on: new Date().toISOString().slice(0, 10), amount: '', source_id: '', campaign_id: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    if (!(Number(f.amount) >= 0) || f.amount === '') return setError('Monto inválido.');
    const { error } = await supabase.from('growth_spend').insert({ workspace_id: ws!.id, spent_on: f.spent_on, amount: Number(f.amount), source_id: f.source_id || null, campaign_id: f.campaign_id || null, note: f.note || null });
    if (error) setError(error.message); else onDone();
  };
  return (
    <Modal title="Cargar gasto" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g2">
        <Field label="Fecha"><input type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} /></Field>
        <Field label="Monto (ARS)"><input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
        <Field label="Fuente"><select value={f.source_id} onChange={(e) => setF({ ...f, source_id: e.target.value })}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Campaña"><select value={f.campaign_id} onChange={(e) => setF({ ...f, campaign_id: e.target.value })}><option value="">—</option>{campaigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Nota"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
