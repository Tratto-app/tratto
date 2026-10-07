import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Card, ErrorBox, Field, Loading, Modal, MsgStatus, PageHeader, Score, StatusBadge } from '../components/ui';
import { fn, rpc } from '../lib/api';
import { fecha, hace, nombre } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { CHANNELS, CONSENT, ENTRADA, INTEREST, STATUS, STATUS_ORDER } from '../lib/labels';
import { LINK_BASE, supabase } from '../lib/supabase';
import type { AppUser, Message, Prospect, TimelineItem, TrackingLink } from '../lib/types';
import { useWs } from '../lib/workspace';

const ETAPAS: [keyof Prospect, string][] = [
  ['created_at', 'Alta'], ['contacted_at', 'Contactado'], ['replied_at', 'Respondió'], ['interested_at', 'Interesado'],
  ['link_sent_at', 'Link enviado'], ['clicked_at', 'Click'], ['installed_at', 'Instaló'], ['registered_at', 'Registro'], ['activated_at', 'Activación'],
];

export default function ProspectDetail() {
  const { id } = useParams();
  const { ws, toast } = useWs();
  const nav = useNavigate();
  const [editar, setEditar] = useState(false);
  const p = useAsync(async () => {
    const { data, error } = await supabase.from('growth_prospects').select('*, source:growth_sources(name), campaign:growth_campaigns(name)').eq('id', id!).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('El prospecto no existe o no pertenece a este workspace.');
    return data as Prospect & { source: { name: string } | null; campaign: { name: string } | null };
  }, [id]);
  const tl = useAsync(async () => {
    const { data } = await supabase.from('growth_timeline').select('*').eq('prospect_id', id!).order('created_at', { ascending: false }).limit(200);
    return (data || []) as TimelineItem[];
  }, [id]);
  const extra = useAsync(async () => {
    const [m, l, u, r, t] = await Promise.all([
      supabase.from('growth_messages').select('*').eq('prospect_id', id!).order('created_at'),
      supabase.from('growth_tracking_links').select('*').eq('workspace_id', ws!.id).eq('archived', false).order('created_at'),
      supabase.from('growth_app_users').select('*').eq('prospect_id', id!).maybeSingle(),
      supabase.from('growth_workflow_runs').select('id,status,current_step,started_at,finished_at,error,workflow:growth_workflows(name)').eq('prospect_id', id!).order('started_at', { ascending: false }),
      supabase.from('growth_tasks').select('*').eq('prospect_id', id!).order('due_at'),
    ]);
    return { messages: (m.data || []) as Message[], links: (l.data || []) as TrackingLink[], user: u.data as AppUser | null, runs: r.data || [], tasks: t.data || [] };
  }, [id, ws!.id]);

  const recargar = () => { p.reload(); tl.reload(); extra.reload(); };
  const upd = async (patch: Partial<Prospect>) => {
    const { error } = await supabase.from('growth_prospects').update(patch).eq('id', id!);
    if (error) toast(error.message, true); else recargar();
  };

  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  if (!p.data) return <Loading />;
  const x = p.data;

  return (
    <>
      <PageHeader title={nombre(x)}
        desc={<>{[x.company, x.city, x.source?.name, x.campaign?.name].filter(Boolean).join(' · ') || 'Sin datos de origen'} · código <span className="mono">{x.ref}</span></>}
        actions={<>
          <Link className="btn" to={`/inbox?p=${x.id}`}>Abrir en Inbox</Link>
          <button className="btn" onClick={() => setEditar(true)}>Editar</button>
          <button className="btn peligro" onClick={async () => {
            if (!confirm('¿Eliminar este prospecto y toda su historia? (derecho de supresión, Ley 25.326)')) return;
            const { error } = await supabase.from('growth_prospects').delete().eq('id', x.id);
            if (error) toast(error.message, true); else { toast('Prospecto eliminado'); nav('/prospects'); }
          }}>Eliminar</button>
        </>} />

      <div className="grid g3">
        <Card title="Estado">
          <div className="fila" style={{ marginBottom: 10 }}><StatusBadge status={x.status} /><Score value={x.score} />{x.score_manual && <Badge title="Las reglas no lo recalculan">manual</Badge>}</div>
          <div className="grid g2">
            <Field label="Mover a etapa">
              <select value={x.status} onChange={(e) => upd({ status: e.target.value })}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select>
            </Field>
            <Field label="Interés"><select value={x.interest} onChange={(e) => upd({ interest: e.target.value })}>{Object.entries(INTEREST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Score manual" hint="Vacío = lo calculan las reglas">
              <input type="number" min={0} max={100} defaultValue={x.score_manual ? x.score : ''} onBlur={(e) => {
                const v = e.target.value;
                upd(v === '' ? { score_manual: false } : { score: Math.max(0, Math.min(100, Number(v))), score_manual: true });
              }} />
            </Field>
            <Field label="Consentimiento"><select value={x.consent} onChange={(e) => upd({ consent: e.target.value })}>{Object.entries(CONSENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={x.do_not_contact} onChange={(e) => upd({ do_not_contact: e.target.checked })} /> No contactar (bloquea todo envío)</label>
          <div className="sep" />
          <div className="pequeño texto-2"><b>Próxima acción:</b> {x.next_action || '—'}</div>
          {x.ai_summary && <div className="pequeño texto-2" style={{ marginTop: 6 }}><b>IA:</b> {x.ai_summary} {x.ai_score !== null && <>· score IA <span className="mono">{x.ai_score}</span></>}</div>}
        </Card>

        <Card title="Cómo llegó">
          <ul className="lista-simple pequeño">
            <li><span className="muted" style={{ width: 110 }}>Medio</span>{x.source?.name || '—'}</li>
            <li><span className="muted" style={{ width: 110 }}>Entró por</span>{x.entrada ? (ENTRADA[x.entrada] || x.entrada) : '—'}
              {x.tags.filter((t) => ENTRADA[t] && t !== x.entrada).map((t) => <span key={t} className="muted"> · después {ENTRADA[t].toLowerCase()}</span>)}</li>
            <li><span className="muted" style={{ width: 110 }}>Campaña</span>{[x.utm_campaign, x.utm_content].filter(Boolean).join(' · ') || x.campaign?.name || '—'}</li>
            <li><span className="muted" style={{ width: 110 }}>Vino desde</span>{x.referrer || x.utm_source || '—'}</li>
            <li><span className="muted" style={{ width: 110 }}>Permiso</span>{x.consent === 'opt_in' ? (x.consent_source || 'Sí') : CONSENT[x.consent]}</li>
            {typeof x.datos?.calc_servicio === 'string' && (
              <li><span className="muted" style={{ width: 110 }}>Calculadora</span>
                {String(x.datos.calc_servicio)} · {String(x.datos.calc_precio_txt || '')} ({String(x.datos.calc_veredicto || '').replace('_', ' ')})</li>
            )}
          </ul>
        </Card>

        <Card title="Recorrido">
          <ul className="lista-simple">
            {ETAPAS.map(([k, label]) => (
              <li key={k}><span style={{ flex: 1 }} className={x[k] ? '' : 'muted'}>{x[k] ? '●' : '○'} {label}</span><span className="mono muted">{fecha(x[k] as string | null, true)}</span></li>
            ))}
          </ul>
        </Card>

        <Card title="Contacto">
          <ul className="lista-simple pequeño">
            <li><span className="muted" style={{ width: 80 }}>Email</span>{x.email || '—'}</li>
            <li><span className="muted" style={{ width: 80 }}>Teléfono</span>{x.phone || '—'}</li>
            <li><span className="muted" style={{ width: 80 }}>Instagram</span>{x.instagram || '—'}</li>
            <li><span className="muted" style={{ width: 80 }}>TikTok</span>{x.tiktok || '—'}</li>
            <li><span className="muted" style={{ width: 80 }}>Etiquetas</span><span className="chips">{x.tags.length ? x.tags.map((t) => <Badge key={t}>{t}</Badge>) : '—'}</span></li>
            <li><span className="muted" style={{ width: 80 }}>Contactos</span><span className="mono">{x.contact_count}</span> · último {hace(x.last_contact_at)}</li>
          </ul>
          {x.notes && <p className="texto-2 pequeño">{x.notes}</p>}
        </Card>
      </div>

      <div className="grid g3" style={{ marginTop: 14 }}>
        <div className="grid span2" style={{ alignContent: 'start' }}>
          <IA prospect={x} onApplied={recargar} />
          <Card title="Mensajes" actions={<Link className="btn chico" to={`/inbox?p=${x.id}`}>Responder</Link>}>
            {!extra.data ? (extra.error ? null : <Loading />) : !extra.data.messages.length ? <div className="muted">Todavía no hay mensajes.</div> : (
              <div className="chat" style={{ padding: 0, maxHeight: 360 }}>
                {extra.data.messages.map((m) => (
                  <div key={m.id} className={`burbuja ${m.direction} ${m.status === 'blocked' ? 'blocked' : ''}`}>
                    {m.body}
                    <div className="meta"><span>{CHANNELS[m.channel] || m.channel}</span><span>{fecha(m.created_at, true)}</span>{m.direction === 'out' && <MsgStatus status={m.status} />}{m.ai_generated && <span>IA</span>}</div>
                    {m.error && m.status !== 'mock_sent' && <div className="meta">{m.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <LinksPersonales prospect={x} links={extra.data?.links || []} onDone={recargar} />
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          {extra.data?.user && (
            <Card title="Usuario de la app">
              <Link to={`/users/${extra.data.user.id}`}>{extra.data.user.name || extra.data.user.email || extra.data.user.external_user_id}</Link>
              <div className="muted pequeño">{extra.data.user.platform} · {extra.data.user.sessions_count} sesiones · último uso {hace(extra.data.user.last_seen_at)}</div>
            </Card>
          )}
          {ws!.is_demo && <SimularApp prospect={x} onDone={recargar} />}
          <Card title="Línea de tiempo">
            {!tl.data ? (tl.error ? null : <Loading />) : (
              <ul className="timeline">
                {tl.data.map((t) => (
                  <li key={t.id} className={t.actor === 'app' ? 'app' : t.actor === 'ai' ? 'ai' : ''}>
                    <div>{t.title}</div>
                    <div className="cuando">{fecha(t.created_at, true)} · {t.actor === 'automation' ? 'automatización' : t.actor === 'user' ? 'equipo' : t.actor === 'app' ? 'app' : t.actor === 'ai' ? 'IA' : 'sistema'}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {!!extra.data?.runs.length && (
            <Card title="Automatizaciones">
              <ul className="lista-simple pequeño">
                {extra.data.runs.map((r: { id: string; status: string; started_at: string; error: string | null; workflow: { name: string } | { name: string }[] | null }) => (
                  <li key={r.id}><span style={{ flex: 1 }}>{Array.isArray(r.workflow) ? r.workflow[0]?.name : r.workflow?.name}</span><Badge tone={r.status === 'failed' ? 'rojo' : r.status === 'done' ? 'verde' : 'azul'}>{r.status}</Badge><span className="muted">{hace(r.started_at)}</span></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {editar && <Editar p={x} onClose={() => setEditar(false)} onDone={() => { setEditar(false); recargar(); }} />}
    </>
  );
}

function IA({ prospect, onApplied }: { prospect: Prospect; onApplied: () => void }) {
  const { ws, toast } = useWs();
  const [out, setOut] = useState<{ action: string; provider: string; output: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState('');
  const run = async (action: string, apply = false) => {
    setBusy(action);
    try {
      const r = await fn<{ provider: string; output: Record<string, unknown> }>('growth-ai', { workspace_id: ws!.id, action, prospect_id: prospect.id, apply });
      setOut({ action, provider: r.provider, output: r.output });
      if (apply) { toast('Guardado en el prospecto'); onApplied(); }
    } catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
    setBusy('');
  };
  return (
    <Card title="Agente de IA" actions={out && <Badge tone={out.provider === 'mock' ? 'mock' : 'violeta'} title={out.provider === 'mock' ? 'Sin OPENAI_API_KEY: respuesta por reglas, no un modelo de IA' : undefined}>{out.provider === 'mock' ? 'IA simulada (reglas)' : 'OpenAI'}</Badge>}>
      <div className="fila">
        <button className="btn" disabled={!!busy} onClick={() => run('analyze', true)}>{busy === 'analyze' ? '…' : 'Analizar y guardar'}</button>
        <button className="btn" disabled={!!busy} onClick={() => run('message')}>Escribir primer mensaje</button>
        <button className="btn" disabled={!!busy} onClick={() => run('summary', true)}>Resumir conversación</button>
        <button className="btn" disabled={!!busy} onClick={() => run('explain')}>Explicar la app</button>
        {prospect.last_reply_text && <button className="btn" disabled={!!busy} onClick={() => run('reply')}>Leer última respuesta</button>}
      </div>
      {out && (
        <div className="info" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
          {Object.entries(out.output).filter(([k]) => !['objection_id'].includes(k)).map(([k, v]) => (
            <div key={k}><b>{k}:</b> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
          ))}
          {out.action === 'message' && <Link className="btn chico" style={{ marginTop: 8 }} to={`/inbox?p=${prospect.id}&draft=${encodeURIComponent(String(out.output.message || ''))}`}>Usar en el Inbox</Link>}
        </div>
      )}
    </Card>
  );
}

function LinksPersonales({ prospect, links, onDone }: { prospect: Prospect; links: TrackingLink[]; onDone: () => void }) {
  const { ws, toast } = useWs();
  return (
    <Card title="Links personales">
      {!links.length ? <div className="muted">Creá un link en Links con nombre para poder mandarlo.</div> : (
        <ul className="lista-simple">
          {links.map((l) => {
            const url = `${LINK_BASE}/${l.slug}?r=${prospect.ref}`;
            return (
              <li key={l.id}>
                <div style={{ flex: 1, minWidth: 0 }}><div>{l.name}</div><div className="mono muted pequeño" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</div></div>
                <button className="btn chico" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copiado'); }}>Copiar</button>
                {ws!.is_demo && ['android', 'ios'].map((d) => (
                  <button key={d} className="btn chico laton" title="Solo en la demo: registra un click como si viniera de ese teléfono" onClick={async () => {
                    try { await rpc('growth_simulate_click', { ws: ws!.id, p_link: l.id, p_prospect: prospect.id, p_device: d }); toast(`Click simulado desde ${d}`); onDone(); }
                    catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
                  }}>Simular click {d === 'android' ? 'Android' : 'iPhone'}</button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// Solo en workspaces demo: simula lo que la app real mandaría a growth-event.
function SimularApp({ prospect, onDone }: { prospect: Prospect; onDone: () => void }) {
  const { ws, toast } = useWs();
  const ext = `sim-${prospect.ref}`;
  const ev = async (event: string) => {
    try {
      const { data: click } = await supabase.from('growth_link_clicks').select('click_token').eq('prospect_id', prospect.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      await rpc('growth_simulate_event', { ws: ws!.id, ev: { event, external_user_id: ext, prospect_id: prospect.id, click_token: click?.click_token, platform: 'android' } });
      toast(`Evento "${event}" registrado`); onDone();
    } catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
  };
  return (
    <Card title="Simular la app (demo)">
      <p className="muted pequeño" style={{ marginTop: 0 }}>Manda los mismos eventos que mandaría la app real a <code>growth-event</code>. Solo funciona en workspaces demo.</p>
      <div className="chips">
        {['install', 'open', 'register', 'onboarding_complete', 'first_action', 'session_start'].map((e) => <button key={e} className="btn chico" onClick={() => ev(e)}>{e}</button>)}
      </div>
    </Card>
  );
}

function Editar({ p, onClose, onDone }: { p: Prospect; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({
    first_name: p.first_name || '', last_name: p.last_name || '', company: p.company || '', email: p.email || '', phone: p.phone || '',
    instagram: p.instagram || '', tiktok: p.tiktok || '', city: p.city || '', notes: p.notes || '', tags: p.tags.join(', '), consent_source: p.consent_source || '',
  });
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) patch[k] = k === 'tags' ? v.split(',').map((t) => t.trim()).filter(Boolean) : v.trim() || null;
    const { error } = await supabase.from('growth_prospects').update(patch).eq('id', p.id);
    if (error) setError(error.message); else onDone();
  };
  return (
    <Modal title="Editar prospecto" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g2">
        {Object.keys(f).map((k) => (
          <Field key={k} label={{ first_name: 'Nombre', last_name: 'Apellido', company: 'Empresa', email: 'Email', phone: 'Teléfono', instagram: 'Instagram', tiktok: 'TikTok', city: 'Ciudad', notes: 'Notas', tags: 'Etiquetas (coma)', consent_source: 'Origen del consentimiento' }[k] || k}>
            {k === 'notes' ? <textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
          </Field>
        ))}
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
