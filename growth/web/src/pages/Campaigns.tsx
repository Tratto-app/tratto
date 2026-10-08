import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { ars, fecha, num, pct, rate, ratio } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { GOALS } from '../lib/labels';
import { supabase } from '../lib/supabase';
import type { Breakdown, Campaign, Source, Workflow } from '../lib/types';
import { useWs } from '../lib/workspace';

const ESTADOS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Borrador', tone: '' }, active: { label: 'Activa', tone: 'verde' }, paused: { label: 'Pausada', tone: 'laton' }, finished: { label: 'Terminada', tone: 'azul' },
};
const GOAL_KEY: Record<string, keyof Breakdown> = {
  prospects: 'prospects', contacted: 'contacted', replies: 'replied', clicks: 'clicks', installs: 'installs', registrations: 'registrations', activations: 'activations',
};

export default function Campaigns() {
  const { ws, kind } = useWs();
  const [edit, setEdit] = useState<Campaign | 'new' | null>(null);
  const data = useAsync(async () => {
    const [c, b, s, w, g, cs] = await Promise.all([
      supabase.from('growth_campaigns').select('*').eq('workspace_id', ws!.id).order('created_at', { ascending: false }),
      rpc<Breakdown[]>('growth_breakdown_tipo', { ws: ws!.id, p_from: null, p_to: null, dim: 'campaign', p_kind: kind }),
      supabase.from('growth_sources').select('id,key,name,kind').eq('workspace_id', ws!.id).order('name'),
      supabase.from('growth_workflows').select('id,name,trigger,active').eq('workspace_id', ws!.id).order('name'),
      supabase.from('growth_segments').select('id,name').eq('workspace_id', ws!.id).eq('entity', 'prospect').order('name'),
      supabase.from('growth_campaign_sources').select('campaign_id,source_id').eq('workspace_id', ws!.id),
    ]);
    if (c.error) throw new Error(c.error.message);
    return {
      campaigns: (c.data || []) as Campaign[], stats: Object.fromEntries(b.map((x) => [x.key || 'none', x])) as Record<string, Breakdown>,
      sources: (s.data || []) as Source[], workflows: (w.data || []) as Workflow[], segments: (g.data || []) as { id: string; name: string }[],
      links: (cs.data || []) as { campaign_id: string; source_id: string }[],
    };
  }, [ws!.id, kind]);

  return (
    <>
      <PageHeader title="Campañas" desc="Cada campaña junta fuentes, un segmento, una automatización y una meta. Las métricas son desde que empezó."
        actions={<button className="btn primario" onClick={() => setEdit('new')}>+ Campaña</button>} />
      <ErrorBox error={data.error} onRetry={data.reload} />
      {!data.data ? (data.error ? null : <Loading />) : !data.data.campaigns.length ? (
        <Card><Empty title="Sin campañas" action={<button className="btn primario" onClick={() => setEdit('new')}>Crear la primera</button>}>Una campaña es un esfuerzo con objetivo: "Instagram CABA", "Influencers", "Google Ads"…</Empty></Card>
      ) : (
        <div className="grid g2">
          {data.data.campaigns.map((c) => {
            const s = data.data!.stats[c.id];
            const logrado = s ? Number(s[GOAL_KEY[c.goal_metric]] || 0) : 0;
            const avance = c.goal_target ? Math.min(100, (100 * logrado) / c.goal_target) : null;
            const fuentes = data.data!.links.filter((l) => l.campaign_id === c.id).map((l) => data.data!.sources.find((x) => x.id === l.source_id)?.name).filter(Boolean);
            return (
              <Card key={c.id} title={c.name} actions={<><Badge tone={ESTADOS[c.status].tone}>{ESTADOS[c.status].label}</Badge><button className="btn chico" onClick={() => setEdit(c)}>Editar</button></>}>
                {c.description && <p className="texto-2" style={{ marginTop: 0 }}>{c.description}</p>}
                <div className="muted pequeño" style={{ marginBottom: 10 }}>{fecha(c.start_date)} → {c.end_date ? fecha(c.end_date) : 'sin fin'} · {fuentes.join(', ') || 'sin fuentes'}</div>
                {c.goal_target && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="fila pequeño"><span>Meta: {num(c.goal_target)} {GOALS[c.goal_metric].toLowerCase()}</span><span className="mono" style={{ marginLeft: 'auto' }}>{num(logrado)} · {pct(avance, 0)}</span></div>
                    <div className="funnel-barra" style={{ height: 8, marginTop: 4 }}><i style={{ width: `${avance}%`, background: avance! >= 100 ? 'var(--laton)' : undefined }} /></div>
                  </div>
                )}
                <div className="grid g4 pequeño">
                  <div><div className="muted">Prospectos</div><div className="mono">{num(s?.prospects ?? 0)}</div></div>
                  <div><div className="muted">Instalaciones</div><div className="mono">{num(s?.installs ?? 0)}</div></div>
                  <div><div className="muted">Activaciones</div><div className="mono">{num(s?.activations ?? 0)}</div></div>
                  <div><div className="muted">Conversión</div><div className="mono">{pct(rate(s?.activations, s?.prospects))}</div></div>
                  <div><div className="muted">Gasto</div><div className="mono">{ars(s?.spend ?? 0)}</div></div>
                  <div><div className="muted">CAC (activación)</div><div className="mono">{ars(ratio(s?.spend, s?.activations))}</div></div>
                  <div><div className="muted">Ingresos</div><div className="mono">{ars(s?.revenue ?? 0)}</div></div>
                  <div><div className="muted">ROI</div><div className="mono">{s?.spend ? pct(rate((s.revenue || 0) - s.spend, s.spend), 0) : '—'}</div></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {edit && data.data && <Editor c={edit === 'new' ? null : edit} meta={data.data} onClose={() => setEdit(null)} onDone={() => { setEdit(null); data.reload(); }} />}
    </>
  );
}

function Editor({ c, meta, onClose, onDone }: {
  c: Campaign | null; onClose: () => void; onDone: () => void;
  meta: { sources: Source[]; workflows: Workflow[]; segments: { id: string; name: string }[]; links: { campaign_id: string; source_id: string }[] };
}) {
  const { ws, toast } = useWs();
  const [f, setF] = useState<Record<string, string>>({
    name: c?.name || '', description: c?.description || '', segment_id: c?.segment_id || '', workflow_id: c?.workflow_id || '',
    goal_metric: c?.goal_metric || 'installs', goal_target: c?.goal_target ? String(c.goal_target) : '', status: c?.status || 'draft',
    budget: c?.budget ? String(c.budget) : '', start_date: c?.start_date || new Date().toISOString().slice(0, 10), end_date: c?.end_date || '',
  });
  const [srcs, setSrcs] = useState<Set<string>>(new Set(c ? meta.links.filter((l) => l.campaign_id === c.id).map((l) => l.source_id) : []));
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => {
    if (!f.name.trim()) return setError('Poné un nombre.');
    const row = {
      workspace_id: ws!.id, name: f.name.trim(), description: f.description || null, segment_id: f.segment_id || null, workflow_id: f.workflow_id || null,
      goal_metric: f.goal_metric, goal_target: f.goal_target ? Number(f.goal_target) : null, status: f.status,
      budget: f.budget ? Number(f.budget) : null, start_date: f.start_date || null, end_date: f.end_date || null,
    };
    const r = c ? await supabase.from('growth_campaigns').update(row).eq('id', c.id).select('id').single()
      : await supabase.from('growth_campaigns').insert(row).select('id').single();
    if (r.error) return setError(r.error.message);
    const id = r.data.id as string;
    // Fuentes: se agregan las nuevas y se quitan las destildadas
    const antes = new Set(meta.links.filter((l) => l.campaign_id === id).map((l) => l.source_id));
    const add = [...srcs].filter((s) => !antes.has(s)).map((s) => ({ campaign_id: id, source_id: s, workspace_id: ws!.id }));
    const del = [...antes].filter((s) => !srcs.has(s));
    if (add.length) await supabase.from('growth_campaign_sources').insert(add);
    if (del.length) await supabase.from('growth_campaign_sources').delete().eq('campaign_id', id).in('source_id', del);
    toast('Campaña guardada');
    onDone();
  };
  return (
    <Modal title={c ? 'Editar campaña' : 'Nueva campaña'} onClose={onClose} wide footer={<>
      {c && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => {
        if (!confirm('¿Eliminar la campaña? Los prospectos quedan, sin campaña.')) return;
        const { error } = await supabase.from('growth_campaigns').delete().eq('id', c.id);
        if (error) setError(error.message); else onDone();
      }}>Eliminar</button>}
      <button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g2">
        <Field label="Nombre"><input value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Estado"><select value={f.status} onChange={set('status')}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Descripción"><textarea rows={2} value={f.description} onChange={set('description')} /></Field>
        <Field label="Segmento objetivo"><select value={f.segment_id} onChange={set('segment_id')}><option value="">—</option>{meta.segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Automatización" hint="Se inicia desde Prospects (acción masiva) o por su disparador"><select value={f.workflow_id} onChange={set('workflow_id')}><option value="">—</option>{meta.workflows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="grid g2">
          <Field label="Meta"><select value={f.goal_metric} onChange={set('goal_metric')}>{Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Cantidad"><input type="number" min={1} value={f.goal_target} onChange={set('goal_target')} /></Field>
        </div>
        <Field label="Presupuesto (ARS)" hint="El gasto real se carga en Fuentes"><input type="number" min={0} value={f.budget} onChange={set('budget')} /></Field>
        <div className="grid g2">
          <Field label="Inicio"><input type="date" value={f.start_date} onChange={set('start_date')} /></Field>
          <Field label="Fin"><input type="date" value={f.end_date} onChange={set('end_date')} /></Field>
        </div>
      </div>
      <h3 style={{ margin: '16px 0 8px' }}>Fuentes</h3>
      <div className="chips">
        {meta.sources.map((s) => (
          <label key={s.id} className="check badge" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={srcs.has(s.id)} onChange={() => { const n = new Set(srcs); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); setSrcs(n); }} />{s.name}
          </label>
        ))}
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
