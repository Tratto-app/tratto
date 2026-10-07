import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Card, Loading, MsgStatus, PageHeader, Score, StatusBadge } from '../components/ui';
import { fn } from '../lib/api';
import { fecha, hace, nombre } from '../lib/format';
import { useAsync, useDebounced } from '../lib/hooks';
import { CHANNELS, INTEREST } from '../lib/labels';
import { supabase } from '../lib/supabase';
import type { Message, Prospect, TrackingLink } from '../lib/types';
import { useWs } from '../lib/workspace';

type ConvRow = { id: string; channel: string; unread: number; last_message_at: string | null; prospect_id: string;
  prospect: Pick<Prospect, 'id' | 'first_name' | 'last_name' | 'status' | 'score' | 'last_reply_text' | 'do_not_contact'> | null };

const PLANTILLAS = [
  { key: 'intro', label: 'Presentación', body: 'Hola {{first_name}}! Te escribo de parte del equipo de la app. ¿Te cuento en 1 minuto cómo funciona?' },
  { key: 'seguimiento', label: 'Seguimiento', body: 'Hola {{first_name}}, ¿pudiste ver lo que te mandé? Cualquier duda te la respondo.' },
  { key: 'link', label: 'Link de descarga', body: '¡Genial {{first_name}}! Acá tenés el link para descargarla: {{link}}' },
  { key: 'ayuda_registro', label: 'Ayuda con el registro', body: 'Hola {{first_name}}! Vi que instalaste la app. ¿Pudiste registrarte? Si te trabaste en algo, avisame.' },
];

export default function Inbox() {
  const { ws } = useWs();
  const [sp] = useSearchParams();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [canal, setCanal] = useState('');
  const [soloSinLeer, setSoloSinLeer] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [pidNuevo, setPidNuevo] = useState<string | null>(sp.get('p'));

  const convs = useAsync(async () => {
    let qy = supabase.from('growth_conversations')
      .select('id,channel,unread,last_message_at,prospect_id,prospect:growth_prospects!inner(id,first_name,last_name,status,score,last_reply_text,do_not_contact)')
      .eq('workspace_id', ws!.id).order('last_message_at', { ascending: false, nullsFirst: false }).limit(150);
    if (canal) qy = qy.eq('channel', canal);
    if (soloSinLeer) qy = qy.gt('unread', 0);
    if (dq.trim()) { const t = dq.trim().replace(/[%,()]/g, ' '); qy = qy.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,instagram.ilike.%${t}%`, { referencedTable: 'growth_prospects' }); }
    const { data, error } = await qy;
    if (error) throw new Error(error.message);
    return (data || []) as unknown as ConvRow[];
  }, [ws!.id, canal, soloSinLeer, dq]);

  // Si viene ?p=<prospecto>, abre su conversación (o una nueva)
  useEffect(() => {
    if (!pidNuevo || !convs.data) return;
    const c = convs.data.find((x) => x.prospect_id === pidNuevo);
    if (c) { setSel(c.id); setPidNuevo(null); }
  }, [pidNuevo, convs.data]);

  const actual = convs.data?.find((c) => c.id === sel) || null;
  const prospectId = actual?.prospect_id || pidNuevo;

  return (
    <>
      <PageHeader title="Mensajes" desc="Todas las conversaciones en un lugar. Los canales sin credenciales se simulan (quedan marcados como 'Simulado'); las respuestas de canales sin API de lectura (como DMs de Instagram) se cargan a mano." />
      <div className="inbox">
        <div className="inbox-lista">
          <div style={{ padding: 10, borderBottom: '1px solid var(--borde)' }} className="grid">
            <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar conversación" />
            <div className="fila">
              <select className="crece" value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal"><option value="">Todos los canales</option>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <label className="check"><input type="checkbox" checked={soloSinLeer} onChange={(e) => setSoloSinLeer(e.target.checked)} /> Sin leer</label>
            </div>
          </div>
          {convs.loading && !convs.data ? <Loading /> : (convs.data || []).map((c) => (
            <div key={c.id} className={`inbox-item ${sel === c.id ? 'activo' : ''}`} onClick={() => { setSel(c.id); setPidNuevo(null); }}>
              <div className="nombre">{nombre(c.prospect)}{c.unread > 0 && <Badge tone="laton">{c.unread}</Badge>}<span className="muted pequeño" style={{ marginLeft: 'auto' }}>{hace(c.last_message_at)}</span></div>
              <div className="fila" style={{ gap: 6, margin: '3px 0' }}><Badge>{CHANNELS[c.channel]}</Badge>{c.prospect && <StatusBadge status={c.prospect.status} />}</div>
              <div className="previa">{c.prospect?.last_reply_text || 'Sin respuesta todavía'}</div>
            </div>
          ))}
          {convs.data && !convs.data.length && <div className="muted" style={{ padding: 16 }}>Sin conversaciones con estos filtros.</div>}
        </div>
        {prospectId ? <Conversacion key={prospectId + (actual?.channel || '')} prospectId={prospectId} canalInicial={actual?.channel || null} convId={actual?.id || null}
          draft={sp.get('draft') || ''} onChange={() => convs.reload()} /> : (
          <div style={{ display: 'grid', placeItems: 'center' }} className="muted">Elegí una conversación</div>
        )}
        {prospectId ? <Lado prospectId={prospectId} /> : <div className="inbox-lado" />}
      </div>
      <p className="muted pequeño" style={{ marginTop: 10 }}>Atajo: desde el perfil de un prospecto, "Abrir en Inbox" empieza una conversación nueva.</p>
    </>
  );
}

function Conversacion({ prospectId, canalInicial, convId, draft, onChange }: { prospectId: string; canalInicial: string | null; convId: string | null; draft: string; onChange: () => void }) {
  const { ws, toast } = useWs();
  const [canal, setCanal] = useState(canalInicial || 'instagram');
  const [texto, setTexto] = useState(draft);
  const [modo, setModo] = useState<'out' | 'in'>('out');
  const [linkId, setLinkId] = useState('');
  const [busy, setBusy] = useState(false);
  const data = useAsync(async () => {
    const [m, l] = await Promise.all([
      supabase.from('growth_messages').select('*').eq('prospect_id', prospectId).order('created_at'),
      supabase.from('growth_tracking_links').select('id,name,slug').eq('workspace_id', ws!.id).eq('archived', false),
    ]);
    if (convId) await supabase.from('growth_conversations').update({ unread: 0 }).eq('id', convId);
    return { messages: (m.data || []) as Message[], links: (l.data || []) as TrackingLink[] };
  }, [prospectId]);
  const msgs = useMemo(() => (data.data?.messages || []).filter((m) => m.channel === canal), [data.data, canal]);
  const canales = useMemo(() => [...new Set((data.data?.messages || []).map((m) => m.channel))], [data.data]);

  const enviar = async () => {
    if (!texto.trim() && !linkId) return;
    setBusy(true);
    try {
      if (modo === 'in') {
        const r = await fn<{ analysis: { intent: string; objection_label: string | null; suggested_reply: string } | null }>('growth-send', { workspace_id: ws!.id, action: 'inbound', prospect_id: prospectId, channel: canal, body: texto });
        toast(r.analysis ? `Respuesta cargada · interés ${INTEREST[r.analysis.intent] || r.analysis.intent}${r.analysis.objection_label ? ` · objeción: ${r.analysis.objection_label}` : ''}` : 'Respuesta cargada');
        if (r.analysis?.suggested_reply) { setModo('out'); setTexto(r.analysis.suggested_reply); } else setTexto('');
      } else {
        const r = await fn<{ ok: boolean; result: { status: string; error?: string } }>('growth-send', linkId
          ? { workspace_id: ws!.id, action: 'send_link', prospect_id: prospectId, channel: canal, link_id: linkId, body: texto }
          : { workspace_id: ws!.id, action: 'send', prospect_id: prospectId, channel: canal, body: texto });
        if (r.result.status === 'blocked') toast(`No se envió: ${r.result.error}`, true);
        else if (r.result.status === 'failed') toast(`Falló el envío: ${r.result.error}`, true);
        else toast(r.result.status === 'mock_sent' ? 'Guardado como enviado (simulado: el canal no está conectado)' : 'Mensaje enviado');
        setTexto(''); setLinkId('');
      }
      data.reload(); onChange();
    } catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
    setBusy(false);
  };
  const sugerir = async () => {
    setBusy(true);
    try {
      const last = [...msgs].reverse().find((m) => m.direction === 'in');
      const r = await fn<{ output: Record<string, unknown>; provider: string }>('growth-ai', last
        ? { workspace_id: ws!.id, action: 'reply', prospect_id: prospectId, text: last.body }
        : { workspace_id: ws!.id, action: 'message', prospect_id: prospectId, channel: canal });
      setTexto(String(r.output.suggested_reply || r.output.message || ''));
      if (r.provider === 'mock') toast('Sugerencia por reglas (no hay OPENAI_API_KEY configurada)');
    } catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
    setBusy(false);
  };

  return (
    <div>
      <div className="fila" style={{ padding: '10px 14px', borderBottom: '1px solid var(--borde)' }}>
        <select style={{ width: 150 }} value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal de la conversación">
          {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}{canales.includes(k) ? ' •' : ''}</option>)}
        </select>
        <span className="muted pequeño">{msgs.length} mensajes en este canal</span>
      </div>
      <div className="chat">
        {data.loading && !data.data ? <Loading /> : msgs.length === 0 ? <div className="muted">Todavía no hay mensajes por {CHANNELS[canal]}.</div> : msgs.map((m) => (
          <div key={m.id} className={`burbuja ${m.direction} ${m.status === 'blocked' ? 'blocked' : ''}`}>
            {m.body}
            <div className="meta"><span>{fecha(m.created_at, true)}</span>{m.direction === 'out' ? <MsgStatus status={m.status} /> : m.intent && <span>interés {INTEREST[m.intent] || m.intent}</span>}{m.ai_generated && <span>IA</span>}{m.template_key && <span>{m.template_key}</span>}</div>
            {m.status === 'blocked' && <div className="meta">{m.error}</div>}
          </div>
        ))}
      </div>
      <div className="composer">
        <div className="fila">
          <div className="segmentado">
            <button className={modo === 'out' ? 'activo' : ''} onClick={() => setModo('out')}>Enviar</button>
            <button className={modo === 'in' ? 'activo' : ''} onClick={() => setModo('in')}>Cargar respuesta recibida</button>
          </div>
          {modo === 'out' && (
            <>
              <select style={{ width: 170 }} value="" onChange={(e) => { const p = PLANTILLAS.find((x) => x.key === e.target.value); if (p) setTexto(p.body); }} aria-label="Plantilla">
                <option value="">Plantilla…</option>{PLANTILLAS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <select style={{ width: 190 }} value={linkId} onChange={(e) => setLinkId(e.target.value)} aria-label="Adjuntar link">
                <option value="">Sin link</option>{data.data?.links.map((l) => <option key={l.id} value={l.id}>Link: {l.name}</option>)}
              </select>
              <button className="btn chico" disabled={busy} onClick={sugerir}>✦ Sugerir con IA</button>
            </>
          )}
        </div>
        <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensaje"
          placeholder={modo === 'in' ? 'Pegá lo que te respondió (la IA detecta interés, objeciones y si pidió la baja)' : 'Escribí el mensaje. {{first_name}} se reemplaza; con un link elegido, {{link}} es su link personal.'} />
        <div className="fila"><span className="muted pequeño crece">{modo === 'out' ? 'Se respetan opt-out, opt-in para WhatsApp/SMS y el tope diario.' : 'Queda guardada como mensaje recibido (provider: manual).'}</span>
          <button className="btn primario" disabled={busy || (!texto.trim() && !linkId)} onClick={enviar}>{modo === 'in' ? 'Guardar respuesta' : linkId ? 'Enviar con link' : 'Enviar'}</button></div>
      </div>
    </div>
  );
}

function Lado({ prospectId }: { prospectId: string }) {
  const p = useAsync(async () => {
    const { data } = await supabase.from('growth_prospects').select('id,first_name,last_name,company,city,status,score,interest,consent,do_not_contact,next_action,ai_summary,tags,email,phone,instagram').eq('id', prospectId).maybeSingle();
    return data as Prospect | null;
  }, [prospectId]);
  if (!p.data) return <div className="inbox-lado"><Loading /></div>;
  const x = p.data;
  return (
    <div className="inbox-lado">
      <Card className="plana">
        <Link to={`/prospects/${x.id}`}><b>{nombre(x)}</b></Link>
        <div className="muted pequeño">{[x.company, x.city].filter(Boolean).join(' · ')}</div>
        <div className="fila" style={{ marginTop: 8 }}><StatusBadge status={x.status} /><Score value={x.score} /></div>
        {x.do_not_contact && <div className="error" style={{ marginTop: 8 }}>Pidió no ser contactado: no se le envía nada.</div>}
      </Card>
      <Card className="plana" title="Próxima acción"><div className="texto-2">{x.next_action || '—'}</div>{x.ai_summary && <p className="muted pequeño">{x.ai_summary}</p>}</Card>
      <Card className="plana" title="Datos">
        <div className="pequeño texto-2">{x.email || '—'}<br />{x.phone || '—'}<br />{x.instagram || '—'}</div>
        <div className="chips" style={{ marginTop: 8 }}>{x.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
      </Card>
    </div>
  );
}
