import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, ErrorBox, Field, Loading, PageHeader } from '../components/ui';
import { fn } from '../lib/api';
import { hace, nombre } from '../lib/format';
import { useAsync, useDebounced } from '../lib/hooks';
import { CHANNELS } from '../lib/labels';
import { supabase } from '../lib/supabase';
import type { Prospect } from '../lib/types';
import { useWs } from '../lib/workspace';

const ACCIONES: Record<string, { label: string; needsProspect: boolean; needsText: boolean }> = {
  analyze: { label: 'Analizar prospecto (segmento, score, próxima acción)', needsProspect: true, needsText: false },
  message: { label: 'Escribir primer mensaje', needsProspect: true, needsText: false },
  reply: { label: 'Leer una respuesta y sugerir qué contestar', needsProspect: false, needsText: true },
  objection: { label: 'Detectar objeción y responderla', needsProspect: false, needsText: true },
  summary: { label: 'Resumir la conversación', needsProspect: true, needsText: false },
  score: { label: 'Recomendar score', needsProspect: true, needsText: false },
  explain: { label: 'Explicar la app en simple', needsProspect: false, needsText: false },
};

export default function Agent() {
  const { ws, toast } = useWs();
  const [accion, setAccion] = useState('analyze');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [pid, setPid] = useState<string>('');
  const [texto, setTexto] = useState('');
  const [canal, setCanal] = useState('instagram');
  const [aplicar, setAplicar] = useState(false);
  const [res, setRes] = useState<{ provider: string; model: string | null; output: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lote, setLote] = useState<{ n: number; total: number } | null>(null);

  const buscar = useAsync(async () => {
    if (!dq.trim()) return [] as Prospect[];
    const t = dq.trim().replace(/[%,()]/g, ' ');
    const { data } = await supabase.from('growth_prospects').select('id,first_name,last_name,company,status,score').eq('workspace_id', ws!.id)
      .or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,instagram.ilike.%${t}%`).limit(8);
    return (data || []) as Prospect[];
  }, [dq, ws!.id]);
  const runs = useAsync(async () => {
    const { data } = await supabase.from('growth_ai_runs').select('id,kind,provider,model,ok,error,duration_ms,tokens_in,tokens_out,created_at,prospect_id').eq('workspace_id', ws!.id).order('created_at', { ascending: false }).limit(20);
    return data || [];
  }, [ws!.id, res]);

  const correr = async () => {
    const a = ACCIONES[accion];
    if (a.needsProspect && !pid) return toast('Elegí un prospecto', true);
    if (a.needsText && !texto.trim()) return toast('Pegá el texto a analizar', true);
    setBusy(true);
    try {
      const r = await fn<{ provider: string; model: string | null; output: Record<string, unknown> }>('growth-ai',
        { workspace_id: ws!.id, action: accion, prospect_id: pid || undefined, text: texto || undefined, channel: canal, apply: aplicar });
      setRes(r);
    } catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
    setBusy(false);
  };

  // Analiza en lote a los prospectos nuevos que todavía no tienen análisis
  const analizarLote = async () => {
    const { data } = await supabase.from('growth_prospects').select('id').eq('workspace_id', ws!.id).is('ai_summary', null).in('status', ['new', 'uncontacted']).order('created_at', { ascending: false }).limit(20);
    const ids = (data || []).map((x) => x.id);
    if (!ids.length) return toast('No hay prospectos nuevos sin analizar');
    setLote({ n: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try { await fn('growth-ai', { workspace_id: ws!.id, action: 'analyze', prospect_id: ids[i], apply: true }); } catch { /* sigue con el próximo */ }
      setLote({ n: i + 1, total: ids.length });
    }
    toast(`Analizados ${ids.length} prospectos`);
    setLote(null); runs.reload();
  };

  return (
    <>
      <PageHeader title="AI Agent" desc="El agente usa solo lo que cargaste en App Settings, la base de conocimiento y las objeciones. Si algo no está, no lo inventa."
        actions={<button className="btn" disabled={!!lote} onClick={analizarLote}>{lote ? `Analizando ${lote.n}/${lote.total}…` : 'Analizar 20 prospectos nuevos'}</button>} />
      <div className="grid g2">
        <Card title="Pedile algo al agente">
          <div className="grid">
            <Field label="Qué querés"><select value={accion} onChange={(e) => setAccion(e.target.value)}>{Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label="Prospecto" hint={ACCIONES[accion].needsProspect ? 'Obligatorio para esta acción' : 'Opcional: le da contexto'}>
              <input placeholder="Buscar por nombre, email o @…" value={q} onChange={(e) => { setQ(e.target.value); setPid(''); }} />
            </Field>
            {!pid && !!buscar.data?.length && (
              <ul className="lista-simple">{buscar.data.map((p) => <li key={p.id} style={{ cursor: 'pointer' }} onClick={() => { setPid(p.id); setQ(nombre(p)); }}>{nombre(p)} <span className="muted pequeño">{p.company}</span></li>)}</ul>
            )}
            {(accion === 'message') && <Field label="Canal"><select value={canal} onChange={(e) => setCanal(e.target.value)}>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
            {ACCIONES[accion].needsText && <Field label="Texto recibido"><textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: ¿cuánto sale? no quiero dar mis datos" /></Field>}
            {pid && ['analyze', 'score', 'summary', 'reply'].includes(accion) && <label className="check"><input type="checkbox" checked={aplicar} onChange={(e) => setAplicar(e.target.checked)} /> Guardar el resultado en el prospecto</label>}
            <button className="btn primario" disabled={busy} onClick={correr}>{busy ? 'Pensando…' : 'Ejecutar'}</button>
          </div>
        </Card>
        <Card title="Resultado" actions={res && <Badge tone={res.provider === 'mock' ? 'mock' : 'violeta'}>{res.provider === 'mock' ? 'IA simulada (reglas)' : res.model || 'OpenAI'}</Badge>}>
          {!res ? <div className="muted">Todavía nada.</div> : (
            <div className="grid" style={{ gap: 8 }}>
              {Object.entries(res.output).filter(([k]) => k !== 'objection_id').map(([k, v]) => (
                <div key={k}><div className="muted pequeño mono">{k}</div><div style={{ whiteSpace: 'pre-wrap' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div></div>
              ))}
              {pid && <Link className="btn chico" to={`/inbox?p=${pid}${res.output.message || res.output.suggested_reply ? `&draft=${encodeURIComponent(String(res.output.message || res.output.suggested_reply))}` : ''}`}>Abrir en Inbox</Link>}
            </div>
          )}
          {res?.provider === 'mock' && <div className="aviso pequeño" style={{ marginTop: 12 }}>No hay <code>OPENAI_API_KEY</code> en las Edge Functions: las respuestas salen de reglas fijas. Configurala en Settings → AI para usar el modelo.</div>}
        </Card>
      </div>
      <Card title="Últimas ejecuciones de la IA" className="mt">
        <ErrorBox error={runs.error} />
        {!runs.data ? (runs.error ? null : <Loading />) : (
          <div className="tabla-wrap"><table>
            <thead><tr><th>Cuándo</th><th>Acción</th><th>Proveedor</th><th className="num">ms</th><th className="num">Tokens</th><th>Estado</th></tr></thead>
            <tbody>{runs.data.map((r: { id: string; kind: string; provider: string; model: string | null; ok: boolean; error: string | null; duration_ms: number | null; tokens_in: number | null; tokens_out: number | null; created_at: string; prospect_id: string | null }) => (
              <tr key={r.id}><td className="muted">{hace(r.created_at)}</td><td>{r.prospect_id ? <Link to={`/prospects/${r.prospect_id}`}>{r.kind}</Link> : r.kind}</td>
                <td><Badge tone={r.provider === 'mock' ? 'mock' : 'violeta'}>{r.provider}{r.model ? ` · ${r.model}` : ''}</Badge></td>
                <td className="num">{r.duration_ms ?? '—'}</td><td className="num">{r.tokens_in ? `${r.tokens_in}/${r.tokens_out}` : '—'}</td>
                <td>{r.ok ? <Badge tone="verde">ok</Badge> : <Badge tone="rojo" title={r.error || ''}>error</Badge>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
