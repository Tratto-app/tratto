import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ErrorBox, Loading, PageHeader } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';
import './whatsapp-seguimiento.css';

type Json = Record<string, unknown>;
type Prospect = { id: string; company: string | null; first_name: string | null; rubro: string | null; zona: string | null; datos: Json };
type Config = { receiving_enabled: boolean; coverage_gap: boolean; coexistence_verified_at: string | null };
type Message = { event_key: string; direction: string; body: string; occurred_at: string; source: string; message_type: string; text_available: boolean };
const object = (v: unknown): Json => v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {};
const summary = (p: Prospect): Json => object(object(p.datos.whatsapp_manual).seguimiento_meta);
const date = (v: unknown): string => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : 'Sin comprobar';
const labels: Record<string, string> = {
  escrito_confirmado: 'Mensaje enviado desde el celular', respondio: 'Respondió',
  sin_respuesta_observada_al_corte: 'Sin respuesta observada al corte',
  mensaje_recibido_sin_contacto_previo_observado: 'Mensaje recibido; falta contacto previo',
  registrado_verificado: 'Se registró', sin_registro_detectado_al_corte: 'Sin registro detectado',
  identidad_ambigua_revision_humana: 'Identidad por revisar', pendiente_de_comprobar: 'Pendiente de comprobar',
};
const label = (v: unknown): string => labels[String(v)] || 'Pendiente de comprobar';

function Conversation({ workspace, prospect }: { workspace: string; prospect: Prospect }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);
  const [cutoff] = useState(() => new Date().toISOString());
  const load = useCallback(async (offset: number) => {
    setLoading(true); setError(null);
    const { data, error: e } = await supabase.from('growth_wa_observer_events')
      .select('event_key,direction,body,occurred_at,source,message_type,text_available')
      .eq('workspace_id', workspace).eq('prospect_id', prospect.id).eq('kind', 'message')
      .lte('received_at', cutoff).order('occurred_at').order('event_key').range(offset, offset + 99);
    if (e) { setError(e.message); setLoading(false); return; }
    const page = (data || []) as Message[];
    setMessages(old => offset === 0 ? page : [...old, ...page]); setMore(page.length === 100); setLoading(false);
  }, [workspace, prospect.id, cutoff]);
  useEffect(() => { void load(0); }, [load]);
  return <section aria-label="Conversación observada" className="wa-observer-conversation">
    <h3>{prospect.company || prospect.first_name || 'Negocio'}</h3>
    <p className="texto-2">Sólo mensajes compartidos por Meta. Los períodos sin sincronización pueden faltar.</p>
    {error && <ErrorBox error={error} />}
    {!messages.length && !loading && !error && <p>Todavía no hay mensajes observados de este negocio.</p>}
    {messages.map(m => <article className={`wa-observer-message ${m.direction}`} key={m.event_key}>
      <strong>{m.direction === 'out' ? 'Vos' : 'El negocio'}</strong>
      <p>{m.text_available ? m.body : `Mensaje ${m.message_type || 'sin texto'}: contenido pendiente de revisar.`}</p>
      <small>{date(m.occurred_at)} · {m.source === 'history' ? 'Historial compartido' : 'Meta'}</small>
    </article>)}
    {loading && <Loading />}
    {more && !loading && <button className="btn" onClick={() => void load(messages.length)}>{error ? 'Reintentar carga' : 'Cargar más mensajes'}</button>}
  </section>;
}

export default function WhatsAppSeguimiento() {
  const { ws } = useWs();
  const [data, setData] = useState<{ workspace: string; prospects: Prospect[]; config: Config | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null); setError(null); setSelected(null);
    if (!ws) return;
    const workspace = ws.id;
    void (async () => {
      try {
        const c = await supabase.from('growth_wa_observer_config').select('receiving_enabled,coverage_gap,coexistence_verified_at').eq('workspace_id', workspace).maybeSingle();
        if (c.error) throw c.error;
        const prospects: Prospect[] = [];
        for (let offset = 0; ; offset += 500) {
          const result = await supabase.from('growth_prospects').select('id,company,first_name,rubro,zona,datos')
            .eq('workspace_id', workspace).not('datos->whatsapp_manual', 'is', null).order('id').range(offset, offset + 499);
          if (result.error) throw result.error;
          prospects.push(...(result.data || []) as Prospect[]);
          if (!result.data || result.data.length < 500) break;
        }
        if (alive) setData({ workspace, prospects, config: c.data as Config | null });
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : String((e as { message?: string }).message || e)); }
    })();
    return () => { alive = false; };
  }, [ws?.id, revision]);
  if (error) return <ErrorBox error={error} onRetry={() => setRevision(r => r + 1)} />;
  if (!data || !ws || data.workspace !== ws.id) return <Loading />;
  const rows = data.prospects.filter(p => `${p.company || ''} ${p.first_name || ''} ${p.rubro || ''} ${p.zona || ''}`.toLocaleLowerCase('es-AR').includes(search.toLocaleLowerCase('es-AR')));
  return <div className="wa-observer">
    <PageHeader title="Seguimiento por WhatsApp" desc="Respuestas observadas mediante Meta y registro comprobado en Tratto." actions={<button className="btn" onClick={() => setRevision(r => r + 1)}>Actualizar</button>} />
    <Card title={data.config?.receiving_enabled ? 'Recepción de Meta habilitada' : 'Pendiente de conectar WhatsApp con Meta'}>
      <p>{data.config?.receiving_enabled ? 'Los mensajes compartidos se guardan para revisión. Vos seguís usando WhatsApp Business en tu celular.' : 'Todavía no recibimos las conversaciones del número actual. La ausencia de mensajes no significa que un negocio no respondió.'}</p>
      <p className="texto-2">{data.config?.coverage_gap !== false ? 'La cobertura aún tiene períodos sin comprobar.' : 'Cada resultado indica hasta qué momento se comprobó.'} Los envíos automáticos permanecen apagados.</p>
    </Card>
    <label>Buscar negocio, rubro o zona<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre del negocio" /></label>
    <p>{rows.length} negocios · El registro se verifica aparte de la respuesta. “Sin registro detectado” puede requerir revisar otra identidad.</p>
    <div className="wa-observer-grid">
      <div>{rows.map(p => {
        const s = summary(p), reg = object(s.registro);
        return <article className="card" key={p.id}>
          <h3><Link to={`/prospects/${p.id}`}>{p.company || p.first_name || 'Negocio'}</Link></h3>
          <p className="texto-2">{p.rubro} · {p.zona}</p>
          <dl><dt>Contacto</dt><dd>{label(s.contacto)}</dd><dt>Respuesta</dt><dd>{label(s.respuesta)}</dd><dt>Registro</dt><dd>{label(reg.estado)}</dd><dt>Comprobado hasta</dt><dd>{date(s.corte_at)}</dd></dl>
          <button className="btn" onClick={() => setSelected(p)}>Ver conversación</button>
        </article>;
      })}</div>
      {selected && <Conversation key={`${ws.id}:${selected.id}`} workspace={ws.id} prospect={selected} />}
    </div>
  </div>;
}
