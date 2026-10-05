import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { RuleBuilder, describeRule, type Cond } from '../components/RuleBuilder';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader } from '../components/ui';
import { fn, rpc } from '../lib/api';
import { hace, nombre, num, pct, rate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { CHANNELS, STATUS, STATUS_ORDER, STEP_TYPES, TRIGGERS } from '../lib/labels';
import { supabase } from '../lib/supabase';
import type { Step, TrackingLink, Workflow } from '../lib/types';
import { useWs } from '../lib/workspace';

interface WStat { workflow_id: string; runs: number; running: number; done: number; failed: number; replied: number; installed: number; registered: number }

export default function Automations() {
  const { ws, toast } = useWs();
  const [edit, setEdit] = useState<Workflow | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useAsync(async () => {
    const [w, s, r] = await Promise.all([
      supabase.from('growth_workflows').select('*').eq('workspace_id', ws!.id).order('created_at'),
      rpc<WStat[]>('growth_workflow_stats', { ws: ws!.id }),
      supabase.from('growth_workflow_runs').select('id,status,current_step,started_at,updated_at,error,workflow_id,prospect:growth_prospects(id,first_name,last_name)')
        .eq('workspace_id', ws!.id).order('updated_at', { ascending: false }).limit(25),
    ]);
    if (w.error) throw new Error(w.error.message);
    return { workflows: (w.data || []) as Workflow[], stats: Object.fromEntries(s.map((x) => [x.workflow_id, x])) as Record<string, WStat>, runs: r.data || [] };
  }, [ws!.id]);

  const procesar = async () => {
    setBusy(true);
    try { const r = await fn<{ processed: number }>('growth-automations', { workspace_id: ws!.id }); toast(`Procesadas ${r.processed} ejecuciones pendientes`); data.reload(); }
    catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Automations" desc="Secuencias que trabajan solas: mandan mensajes, esperan respuesta, deciden por reglas y avisan. Corren cada 5 minutos (y cuando apretás “Procesar ahora”)."
        actions={<><button className="btn" disabled={busy} onClick={procesar}>{busy ? 'Procesando…' : 'Procesar ahora'}</button><button className="btn primario" onClick={() => setEdit('new')}>+ Automatización</button></>} />
      <ErrorBox error={data.error} onRetry={data.reload} />
      {!data.data ? (data.error ? null : <Loading />) : !data.data.workflows.length ? (
        <Card><Empty title="Sin automatizaciones" action={<button className="btn primario" onClick={() => setEdit('new')}>Crear la primera</button>}>Por ejemplo: "cuando entra un prospecto, mandale un mensaje, esperá 2 días y si no responde, insistí una vez".</Empty></Card>
      ) : (
        <div className="grid g3">
          {data.data.workflows.map((w) => {
            const s = data.data!.stats[w.id];
            return (
              <Card key={w.id} title={w.name} actions={<Badge tone={w.active ? 'verde' : ''}>{w.active ? 'Activa' : 'Pausada'}</Badge>}>
                <p className="texto-2 pequeño" style={{ marginTop: 0 }}>{w.description}</p>
                <div className="muted pequeño">{TRIGGERS[w.trigger]}{w.trigger === 'status_changed' && Object.keys(w.trigger_filter || {}).length ? `: ${describeRule(w.trigger_filter)}` : ''}</div>
                <div className="grid g4 pequeño" style={{ margin: '12px 0' }}>
                  <div><div className="muted">Ejecuciones</div><div className="mono">{num(s?.runs ?? 0)}</div></div>
                  <div><div className="muted">En curso</div><div className="mono">{num(s?.running ?? 0)}</div></div>
                  <div><div className="muted">Respondieron</div><div className="mono">{pct(rate(s?.replied, s?.runs), 0)}</div></div>
                  <div><div className="muted">Instalaron</div><div className="mono">{pct(rate(s?.installed, s?.runs), 0)}</div></div>
                </div>
                {!!s?.failed && <div className="error pequeño" style={{ marginBottom: 8 }}>{s.failed} con error</div>}
                <div className="fila">
                  <button className="btn chico" onClick={() => setEdit(w)}>Editar pasos</button>
                  <button className="btn chico" onClick={async () => { await supabase.from('growth_workflows').update({ active: !w.active }).eq('id', w.id); data.reload(); }}>{w.active ? 'Pausar' : 'Activar'}</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {data.data && !!data.data.runs.length && (
        <Card title="Últimas ejecuciones" className="mt">
          <div className="tabla-wrap"><table>
            <thead><tr><th>Prospecto</th><th>Automatización</th><th>Estado</th><th className="num">Paso</th><th>Actualizada</th><th>Error</th></tr></thead>
            <tbody>{data.data.runs.map((r: { id: string; status: string; current_step: number; updated_at: string; error: string | null; workflow_id: string; prospect: { id: string; first_name: string | null; last_name: string | null } | { id: string; first_name: string | null; last_name: string | null }[] | null }) => {
              const pr = Array.isArray(r.prospect) ? r.prospect[0] : r.prospect;
              return (
                <tr key={r.id}>
                  <td>{pr ? <Link to={`/prospects/${pr.id}`}>{nombre(pr)}</Link> : '—'}</td>
                  <td className="texto-2">{data.data!.workflows.find((w) => w.id === r.workflow_id)?.name}</td>
                  <td><Badge tone={r.status === 'failed' ? 'rojo' : r.status === 'done' ? 'verde' : r.status === 'cancelled' ? '' : 'azul'}>{{ running: 'Corriendo', waiting: 'Esperando', done: 'Terminada', failed: 'Error', cancelled: 'Cancelada' }[r.status] || r.status}</Badge></td>
                  <td className="num">{r.current_step}</td><td className="muted">{hace(r.updated_at)}</td><td className="pequeño" style={{ color: 'var(--rojo)' }}>{r.error || ''}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </Card>
      )}
      {edit && <Builder w={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); data.reload(); }} />}
    </>
  );
}

function Builder({ w, onClose, onDone }: { w: Workflow | null; onClose: () => void; onDone: () => void }) {
  const { ws, toast } = useWs();
  const [f, setF] = useState({ name: w?.name || '', description: w?.description || '', trigger: w?.trigger || 'manual', active: w?.active ?? false });
  const [filtro, setFiltro] = useState<Cond | Record<string, never>>((w?.trigger_filter as Cond) || {});
  const [steps, setSteps] = useState<Step[] | null>(w ? null : []);
  const [error, setError] = useState<string | null>(null);
  const links = useAsync(async () => (await supabase.from('growth_tracking_links').select('id,name,slug').eq('workspace_id', ws!.id).eq('archived', false)).data as TrackingLink[] || [], [ws!.id]);
  useAsync(async () => {
    if (!w) return null;
    const { data } = await supabase.from('growth_workflow_steps').select('position,type,config,on_true,on_false').eq('workflow_id', w.id).order('position');
    setSteps((data || []) as Step[]);
    return null;
  }, [w?.id]);

  // Las posiciones se renumeran 0..n; las ramas apuntan a posiciones.
  // Al mover o quitar pasos, las ramas siguen apuntando al mismo paso.
  const renum = (arr: Step[]) => {
    const map = new Map(arr.map((s, i) => [s.position, i]));
    const t = (v: number | null) => (v === null || v === -1 ? v : map.get(v) ?? null);
    return arr.map((s, i) => ({ ...s, position: i, on_true: t(s.on_true), on_false: t(s.on_false) }));
  };
  const add = (type: string) => setSteps(renum([...(steps || []), { position: 100000, type, config: defaults(type), on_true: null, on_false: null }]));
  const upd = (i: number, patch: Partial<Step>) => setSteps((steps || []).map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => { const a = [...(steps || [])]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); setSteps(renum(a)); };

  const guardar = async () => {
    if (!f.name.trim()) return setError('Poné un nombre.');
    for (const s of steps || []) {
      if ((s.type === 'send_link') && !s.config.link_id) return setError(`Paso ${s.position + 1}: elegí el link.`);
      if (s.type === 'webhook' && !/^https:\/\//.test(String(s.config.url || ''))) return setError(`Paso ${s.position + 1}: el webhook tiene que ser https.`);
      if (s.type === 'send_message' && !s.config.ai && !String(s.config.body || '').trim()) return setError(`Paso ${s.position + 1}: escribí el mensaje o activá "lo escribe la IA".`);
    }
    const row = { workspace_id: ws!.id, name: f.name.trim(), description: f.description || null, trigger: f.trigger, active: f.active, trigger_filter: f.trigger === 'status_changed' ? filtro : {} };
    const r = w ? await supabase.from('growth_workflows').update(row).eq('id', w.id).select('id').single() : await supabase.from('growth_workflows').insert(row).select('id').single();
    if (r.error) return setError(r.error.message);
    const id = r.data.id as string;
    if (w) { const d = await supabase.from('growth_workflow_steps').delete().eq('workflow_id', id); if (d.error) return setError(d.error.message); }
    if (steps?.length) {
      const ins = await supabase.from('growth_workflow_steps').insert(steps.map((s) => ({ workspace_id: ws!.id, workflow_id: id, position: s.position, type: s.type, config: s.config, on_true: s.on_true, on_false: s.on_false })));
      if (ins.error) return setError(ins.error.message);
    }
    toast('Automatización guardada');
    onDone();
  };

  const destinos = (steps || []).map((s) => ({ v: s.position, l: `Paso ${s.position + 1}: ${STEP_TYPES[s.type]?.label}` }));
  return (
    <Modal title={w ? `Editar: ${w.name}` : 'Nueva automatización'} onClose={onClose} wide footer={<>
      {w && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => { if (!confirm('¿Eliminar la automatización y su historial?')) return; const { error } = await supabase.from('growth_workflows').delete().eq('id', w.id); if (error) setError(error.message); else onDone(); }}>Eliminar</button>}
      <button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g2">
        <Field label="Nombre"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Se dispara"><select value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })}>{Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Descripción"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Activa</label>
      </div>
      {f.trigger === 'status_changed' && <div style={{ marginTop: 12 }}><h3 style={{ marginBottom: 8 }}>Solo si el prospecto cumple</h3><RuleBuilder value={filtro} onChange={setFiltro} /></div>}
      <div className="sep" />
      {!steps ? <Loading /> : (
        <div className="pasos">
          {steps.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && <div className="paso-union" />}
              <div className="paso">
                <div className="num">{i + 1}</div>
                <div className="grid" style={{ gap: 8 }}>
                  <div><b>{STEP_TYPES[s.type]?.label}</b> <span className="muted pequeño">{STEP_TYPES[s.type]?.desc}</span></div>
                  <StepConfig s={s} links={links.data || []} onChange={(config) => upd(i, { config })} />
                  {(s.type === 'condition' || s.type === 'wait_reply') && (
                    <div className="grid g2">
                      <Field label={s.type === 'condition' ? 'Si se cumple, ir a' : 'Si responde, ir a'}>
                        <select value={s.on_true ?? ''} onChange={(e) => upd(i, { on_true: e.target.value === '' ? null : Number(e.target.value) })}>
                          <option value="">Paso siguiente</option><option value={-1}>Terminar</option>{destinos.filter((d) => d.v !== i).map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                        </select>
                      </Field>
                      <Field label={s.type === 'condition' ? 'Si no, ir a' : 'Si no responde a tiempo, ir a'}>
                        <select value={s.on_false ?? ''} onChange={(e) => upd(i, { on_false: e.target.value === '' ? null : Number(e.target.value) })}>
                          <option value="">Paso siguiente</option><option value={-1}>Terminar</option>{destinos.filter((d) => d.v !== i).map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                        </select>
                      </Field>
                    </div>
                  )}
                </div>
                <div className="grid" style={{ gap: 4 }}>
                  <button className="btn fantasma chico" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                  <button className="btn fantasma chico" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
                  <button className="btn fantasma chico" onClick={() => setSteps(renum(steps.filter((_, j) => j !== i)))} aria-label="Quitar paso">✕</button>
                </div>
              </div>
            </Fragment>
          ))}
          <div className="paso-union" />
          <select value="" onChange={(e) => e.target.value && add(e.target.value)} aria-label="Agregar paso">
            <option value="">+ Agregar paso…</option>{Object.entries(STEP_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      )}
      <p className="muted pequeño" style={{ marginTop: 12 }}>La automatización se corta sola si el prospecto pide no ser contactado o queda "No interesado". Una misma persona no puede tener dos ejecuciones activas de la misma automatización.</p>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}

function defaults(type: string): Record<string, unknown> {
  switch (type) {
    case 'send_message': return { channel: 'instagram', body: '', ai: false };
    case 'send_link': return { channel: 'instagram', body: '¡Acá tenés tu link, {{first_name}}! {{link}}' };
    case 'wait': return { days: 1 };
    case 'wait_reply': return { days: 2 };
    case 'condition': return { condition: { field: 'clicked_at', op: 'is_set' } };
    case 'set_score': return { value: 50 };
    case 'add_score': return { value: 10 };
    case 'set_status': return { status: 'contacted' };
    case 'add_tag': return { tag: '' };
    case 'create_task': return { title: 'Escribirle a {{first_name}}', due_days: 1 };
    case 'notify': return { title: '{{first_name}} necesita atención' };
    case 'webhook': return { url: 'https://' };
    default: return {};
  }
}

function StepConfig({ s, links, onChange }: { s: Step; links: TrackingLink[]; onChange: (c: Record<string, unknown>) => void }) {
  const c = s.config;
  const set = (k: string, v: unknown) => onChange({ ...c, [k]: v });
  switch (s.type) {
    case 'send_message': case 'send_link':
      return (
        <div className="grid" style={{ gap: 8 }}>
          <div className="fila">
            <select style={{ width: 150 }} value={String(c.channel || 'instagram')} onChange={(e) => set('channel', e.target.value)} aria-label="Canal">{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            {s.type === 'send_link' && <select className="crece" value={String(c.link_id || '')} onChange={(e) => set('link_id', e.target.value)} aria-label="Link"><option value="">Elegí el link…</option>{links.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
            {s.type === 'send_message' && <label className="check"><input type="checkbox" checked={!!c.ai} onChange={(e) => set('ai', e.target.checked)} /> Lo escribe la IA</label>}
            <input style={{ width: 160 }} placeholder="clave de plantilla" value={String(c.template_key || '')} onChange={(e) => set('template_key', e.target.value)} aria-label="Clave de plantilla" title="Para medir qué mensaje convierte más" />
          </div>
          {!(s.type === 'send_message' && c.ai) && <textarea rows={2} value={String(c.body || '')} onChange={(e) => set('body', e.target.value)} placeholder="Hola {{first_name}}…" aria-label="Mensaje" />}
          {s.type === 'send_message' && !!c.ai && <input value={String(c.ai_instructions || '')} onChange={(e) => set('ai_instructions', e.target.value)} placeholder="Indicaciones extra para la IA (opcional)" />}
        </div>
      );
    case 'wait': case 'wait_reply':
      return (
        <div className="fila">
          {['days', 'hours', 'minutes'].map((k) => (
            <label key={k} className="check"><input type="number" min={0} style={{ width: 70 }} value={Number(c[k] || 0)} onChange={(e) => set(k, Number(e.target.value))} /> {{ days: 'días', hours: 'horas', minutes: 'minutos' }[k]}</label>
          ))}
        </div>
      );
    case 'condition': return <RuleBuilder value={c.condition as Cond} onChange={(v) => set('condition', v)} />;
    case 'set_score': case 'add_score': return <input type="number" style={{ width: 120 }} value={Number(c.value || 0)} onChange={(e) => set('value', Number(e.target.value))} aria-label="Valor" />;
    case 'set_status': return <select value={String(c.status)} onChange={(e) => set('status', e.target.value)} aria-label="Estado">{STATUS_ORDER.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}</select>;
    case 'add_tag': return <input value={String(c.tag || '')} onChange={(e) => set('tag', e.target.value)} placeholder="etiqueta" aria-label="Etiqueta" />;
    case 'create_task': return <div className="fila"><input className="crece" value={String(c.title || '')} onChange={(e) => set('title', e.target.value)} aria-label="Tarea" /><label className="check">vence en <input type="number" min={0} style={{ width: 60 }} value={Number(c.due_days ?? 1)} onChange={(e) => set('due_days', Number(e.target.value))} /> días</label></div>;
    case 'notify': return <input value={String(c.title || '')} onChange={(e) => set('title', e.target.value)} aria-label="Título" />;
    case 'webhook': return <input value={String(c.url || '')} onChange={(e) => set('url', e.target.value)} placeholder="https://…" aria-label="URL" />;
    default: return null;
  }
}
