import { useState } from 'react';
import { Badge, Card, ErrorBox, Field, Loading, Modal, PageHeader } from '../components/ui';
import { fn } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

const KINDS: Record<string, string> = { problem: 'Problema que resuelve', feature: 'Funcionalidad', benefit: 'Beneficio', pricing: 'Precio', faq: 'Pregunta frecuente', terms: 'Condiciones', audience: 'Público', other: 'Otro' };
interface K { id: string; kind: string; title: string; content: string; sort: number }
interface O { id: string; label: string; patterns: string[]; response: string }

export default function Knowledge() {
  const { ws, toast } = useWs();
  const [ek, setEk] = useState<K | 'new' | null>(null);
  const [eo, setEo] = useState<O | 'new' | null>(null);
  const [prueba, setPrueba] = useState('');
  const [resp, setResp] = useState<string | null>(null);
  const data = useAsync(async () => {
    const [k, o] = await Promise.all([
      supabase.from('growth_knowledge').select('*').eq('workspace_id', ws!.id).order('kind').order('sort'),
      supabase.from('growth_objections').select('*').eq('workspace_id', ws!.id).order('label'),
    ]);
    if (k.error) throw new Error(k.error.message);
    return { k: (k.data || []) as K[], o: (o.data || []) as O[] };
  }, [ws!.id]);
  const probar = async () => {
    try {
      const r = await fn<{ output: { objection_label: string | null; response: string }; provider: string }>('growth-ai', { workspace_id: ws!.id, action: 'objection', text: prueba });
      setResp(`${r.output.objection_label ? `Objeción: ${r.output.objection_label}. ` : ''}${r.output.response}${r.provider === 'mock' ? ' (por reglas)' : ''}`);
    } catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
  };
  return (
    <>
      <PageHeader title="Knowledge Base" desc="Lo que la IA puede decir sobre la app. Si una respuesta no está acá (ni en App Overview), la IA tiene que decir que lo averigua, no inventarla." />
      <ErrorBox error={data.error} onRetry={data.reload} />
      {!data.data ? (data.error ? null : <Loading />) : (
        <div className="grid g2">
          <Card title="Base de conocimiento" actions={<button className="btn chico primario" onClick={() => setEk('new')}>+ Entrada</button>}>
            {!data.data.k.length && <div className="muted">Vacía. Agregá qué problema resuelve la app, sus funciones, precios y preguntas frecuentes.</div>}
            <ul className="lista-simple">{data.data.k.map((k) => (
              <li key={k.id} style={{ alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setEk(k)}>
                <div style={{ flex: 1 }}><div className="fila" style={{ gap: 6 }}><Badge>{KINDS[k.kind]}</Badge><b>{k.title}</b></div><div className="texto-2 pequeño" style={{ marginTop: 4 }}>{k.content}</div></div>
              </li>
            ))}</ul>
          </Card>
          <div className="grid" style={{ alignContent: 'start' }}>
            <Card title="Objeciones" actions={<button className="btn chico primario" onClick={() => setEo('new')}>+ Objeción</button>}>
              <ul className="lista-simple">{data.data.o.map((o) => (
                <li key={o.id} style={{ alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setEo(o)}>
                  <div style={{ flex: 1 }}><b>{o.label}</b><div className="muted pequeño">Se detecta con: {o.patterns.join(', ')}</div><div className="texto-2 pequeño">→ {o.response}</div></div>
                </li>
              ))}</ul>
            </Card>
            <Card title="Probar">
              <div className="fila"><input className="crece" value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="Ej.: ¿cuánto me cobran?" aria-label="Texto de prueba" /><button className="btn" disabled={!prueba.trim()} onClick={probar}>Probar</button></div>
              {resp && <div className="info mt">{resp}</div>}
            </Card>
          </div>
        </div>
      )}
      {ek && <EditK k={ek === 'new' ? null : ek} onClose={() => setEk(null)} onDone={() => { setEk(null); data.reload(); }} />}
      {eo && <EditO o={eo === 'new' ? null : eo} onClose={() => setEo(null)} onDone={() => { setEo(null); data.reload(); }} />}
    </>
  );
}

function EditK({ k, onClose, onDone }: { k: K | null; onClose: () => void; onDone: () => void }) {
  const { ws } = useWs();
  const [f, setF] = useState({ kind: k?.kind || 'faq', title: k?.title || '', content: k?.content || '', sort: k?.sort || 0 });
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    if (!f.title.trim() || !f.content.trim()) return setError('Completá título y contenido.');
    const row = { ...f, workspace_id: ws!.id, updated_at: new Date().toISOString() };
    const { error } = k ? await supabase.from('growth_knowledge').update(row).eq('id', k.id) : await supabase.from('growth_knowledge').insert(row);
    if (error) setError(error.message); else onDone();
  };
  return (
    <Modal title={k ? 'Editar entrada' : 'Nueva entrada'} onClose={onClose} footer={<>
      {k && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => { await supabase.from('growth_knowledge').delete().eq('id', k.id); onDone(); }}>Eliminar</button>}
      <button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid">
        <div className="grid g2">
          <Field label="Tipo"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KINDS).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Field>
          <Field label="Orden"><input type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Título"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Contenido" hint="Datos reales y verificables"><textarea rows={5} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
      </div>
      {error && <div className="error mt">{error}</div>}
    </Modal>
  );
}

function EditO({ o, onClose, onDone }: { o: O | null; onClose: () => void; onDone: () => void }) {
  const { ws } = useWs();
  const [f, setF] = useState({ label: o?.label || '', patterns: (o?.patterns || []).join(', '), response: o?.response || '' });
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    if (!f.label.trim() || !f.response.trim()) return setError('Completá nombre y respuesta.');
    const row = { workspace_id: ws!.id, label: f.label.trim(), patterns: f.patterns.split(',').map((x) => x.trim()).filter(Boolean), response: f.response.trim() };
    const { error } = o ? await supabase.from('growth_objections').update(row).eq('id', o.id) : await supabase.from('growth_objections').insert(row);
    if (error) setError(error.message); else onDone();
  };
  return (
    <Modal title={o ? 'Editar objeción' : 'Nueva objeción'} onClose={onClose} footer={<>
      {o && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => { await supabase.from('growth_objections').delete().eq('id', o.id); onDone(); }}>Eliminar</button>}
      <button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid">
        <Field label="Objeción"><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ej.: Precio" /></Field>
        <Field label="Palabras que la delatan" hint="Separadas por coma. Sin tildes también funciona."><input value={f.patterns} onChange={(e) => setF({ ...f, patterns: e.target.value })} /></Field>
        <Field label="Respuesta recomendada" hint="Con información real de la app"><textarea rows={4} value={f.response} onChange={(e) => setF({ ...f, response: e.target.value })} /></Field>
      </div>
      {error && <div className="error mt">{error}</div>}
    </Modal>
  );
}
