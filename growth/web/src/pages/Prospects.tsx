import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Pager, Score, StatusBadge } from '../components/ui';
import { fn } from '../lib/api';
import { hace, nombre, num } from '../lib/format';
import { useAsync, useDebounced } from '../lib/hooks';
import { CHANNELS, CONSENT, INTEREST, STATUS, STATUS_ORDER } from '../lib/labels';
import { supabase } from '../lib/supabase';
import type { Campaign, Prospect, Source, Workflow } from '../lib/types';
import { useWs } from '../lib/workspace';
import { parseCsv } from '../lib/csv';

const PAGE = 50;
const COLS = 'id,ref,kind,rubro,zona,first_name,last_name,company,email,phone,instagram,city,status,score,ai_score,interest,consent,do_not_contact,tags,source_id,campaign_id,contact_count,last_contact_at,last_reply_at,next_action,created_at';

export default function Prospects() {
  const { ws, toast } = useWs();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [status, setStatus] = useState(sp.get('status') || '');
  const [kind, setKind] = useState(sp.get('kind') || '');
  const [source, setSource] = useState('');
  const [campaign, setCampaign] = useState('');
  const [minScore, setMinScore] = useState(sp.get('min') || '');
  const [segment, setSegment] = useState(sp.get('seg') || '');
  const [order, setOrder] = useState('created_at');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [nuevo, setNuevo] = useState(sp.get('new') === '1');
  const [importar, setImportar] = useState(false);
  const [masivo, setMasivo] = useState<'' | 'workflow' | 'tag' | 'status'>('');

  const meta = useAsync(async () => {
    const [s, c, w, g] = await Promise.all([
      supabase.from('growth_sources').select('id,key,name,kind').eq('workspace_id', ws!.id).order('name'),
      supabase.from('growth_campaigns').select('id,name,status').eq('workspace_id', ws!.id).order('created_at', { ascending: false }),
      supabase.from('growth_workflows').select('id,name,trigger,active').eq('workspace_id', ws!.id).order('name'),
      supabase.from('growth_segments').select('id,name,entity').eq('workspace_id', ws!.id).eq('entity', 'prospect').order('name'),
    ]);
    return { sources: (s.data || []) as Source[], campaigns: (c.data || []) as Campaign[], workflows: (w.data || []) as Workflow[], segments: g.data || [] };
  }, [ws!.id]);

  useEffect(() => { setPage(0); setSel(new Set()); }, [dq, status, kind, source, campaign, minScore, segment, order]);

  const list = useAsync(async () => {
    let ids: string[] | null = null;
    if (segment) {
      const { data, error } = await supabase.rpc('growth_segment_ids', { seg: segment, lim: 5000, off: 0 });
      if (error) throw new Error(error.message);
      ids = (data || []).map((r: { id: string }) => r.id);
      if (!ids!.length) return { rows: [] as Prospect[], total: 0 };
    }
    let qy = supabase.from('growth_prospects').select(COLS, { count: 'exact' }).eq('workspace_id', ws!.id);
    if (dq.trim()) {
      const t = dq.trim().replace(/[%,()]/g, ' ');
      qy = qy.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,instagram.ilike.%${t}%,company.ilike.%${t}%,phone.ilike.%${t}%,ref.eq.${t}`);
    }
    if (status) qy = qy.eq('status', status);
    if (kind) qy = qy.eq('kind', kind);
    if (source) qy = qy.eq('source_id', source);
    if (campaign) qy = campaign === 'none' ? qy.is('campaign_id', null) : qy.eq('campaign_id', campaign);
    if (minScore) qy = qy.gte('score', Number(minScore));
    if (ids) qy = qy.in('id', ids.slice(0, 1000));
    qy = qy.order(order, { ascending: false, nullsFirst: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    const { data, error, count } = await qy;
    if (error) throw new Error(error.message);
    return { rows: (data || []) as unknown as Prospect[], total: count || 0 };
  }, [ws!.id, dq, status, kind, source, campaign, minScore, segment, order, page]);

  const srcName = useMemo(() => Object.fromEntries((meta.data?.sources || []).map((s) => [s.id, s.name])), [meta.data]);
  const campName = useMemo(() => Object.fromEntries((meta.data?.campaigns || []).map((s) => [s.id, s.name])), [meta.data]);
  const rows = list.data?.rows || [];
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const exportar = async () => {
    const { data, error } = await supabase.from('growth_prospects').select('ref,first_name,last_name,company,email,phone,instagram,city,status,score,interest,consent,created_at')
      .eq('workspace_id', ws!.id).order('created_at', { ascending: false }).limit(10000);
    if (error) return toast(error.message, true);
    const cols = Object.keys(data?.[0] || { ref: '' });
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...(data || []).map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `prospectos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <>
      <PageHeader title="Prospects" desc="Personas que todavía no usan la app. Cada una tiene su estado en el funnel, su score y su link personal."
        actions={<>
          <button className="btn" onClick={exportar}>Exportar CSV</button>
          <button className="btn" onClick={() => setImportar(true)}>Importar CSV</button>
          <button className="btn primario" onClick={() => setNuevo(true)}>+ Prospecto</button>
        </>} />

      <Card>
        <div className="fila" style={{ marginBottom: 12 }}>
          <input className="crece" placeholder="Buscar por nombre, email, @usuario, empresa, teléfono o código…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          <select style={{ width: 150 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo">
            <option value="">Proveedores y clientes</option><option value="provider">Proveedores</option><option value="customer">Clientes</option>
          </select>
          <select style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
          <select style={{ width: 150 }} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Fuente">
            <option value="">Todas las fuentes</option>
            {meta.data?.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={{ width: 180 }} value={campaign} onChange={(e) => setCampaign(e.target.value)} aria-label="Campaña">
            <option value="">Todas las campañas</option><option value="none">Sin campaña</option>
            {meta.data?.campaigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={{ width: 170 }} value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Segmento">
            <option value="">Todos los segmentos</option>
            {meta.data?.segments.map((s: { id: string; name: string }) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input style={{ width: 110 }} type="number" min={0} max={100} placeholder="Score ≥" value={minScore} onChange={(e) => setMinScore(e.target.value)} aria-label="Score mínimo" />
          <select style={{ width: 160 }} value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Orden">
            <option value="created_at">Más nuevos</option><option value="score">Mayor score</option>
            <option value="last_reply_at">Última respuesta</option><option value="last_contact_at">Último contacto</option>
          </select>
        </div>
        {sel.size > 0 && (
          <div className="info fila" style={{ marginBottom: 12 }}>
            <b>{sel.size} seleccionados</b>
            <button className="btn chico" onClick={() => setMasivo('workflow')}>Iniciar automatización</button>
            <button className="btn chico" onClick={() => setMasivo('tag')}>Etiquetar</button>
            <button className="btn chico" onClick={() => setMasivo('status')}>Cambiar estado</button>
            <button className="btn fantasma chico" onClick={() => setSel(new Set())}>Deseleccionar</button>
          </div>
        )}
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.error ? null : list.loading && !list.data ? <Loading /> : rows.length === 0 ? (
          <Empty title="No hay prospectos con estos filtros" action={<button className="btn primario" onClick={() => setNuevo(true)}>Agregar el primero</button>}>
            Cargalos a mano, importá un CSV o recibilos desde un formulario.
          </Empty>
        ) : (
          <div className="tabla-wrap">
            <table>
              <thead><tr>
                <th><input type="checkbox" aria-label="Seleccionar todos" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
                <th>Prospecto</th><th>Estado</th><th>Score</th><th>Interés</th><th>Fuente</th><th>Campaña</th><th className="num">Contactos</th><th>Última respuesta</th><th>Próxima acción</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="clic" onClick={() => nav(`/prospects/${r.id}`)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Seleccionar ${nombre(r)}`} checked={sel.has(r.id)} onChange={() => { const s = new Set(sel); if (s.has(r.id)) s.delete(r.id); else s.add(r.id); setSel(s); }} />
                    </td>
                    <td>
                      <Link to={`/prospects/${r.id}`} onClick={(e) => e.stopPropagation()}>{nombre(r)}</Link>
                      {r.do_not_contact && <> <Badge tone="rojo" title="No contactar">No contactar</Badge></>}
                      <div className="muted pequeño">{[r.kind === 'provider' ? 'Proveedor' : 'Cliente', r.rubro, r.zona || r.city, r.company, r.email].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td><Score value={r.score} /></td>
                    <td className="texto-2">{INTEREST[r.interest]}</td>
                    <td className="texto-2">{(r.source_id && srcName[r.source_id]) || '—'}</td>
                    <td className="texto-2">{(r.campaign_id && campName[r.campaign_id]) || '—'}</td>
                    <td className="num">{r.contact_count}</td>
                    <td className="muted nowrap">{hace(r.last_reply_at)}</td>
                    <td className="texto-2 pequeño">{r.next_action || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pager page={page} pageSize={PAGE} total={list.data.total} onPage={setPage} />}
      </Card>

      {nuevo && meta.data && <NuevoProspecto sources={meta.data.sources} campaigns={meta.data.campaigns}
        onClose={() => { setNuevo(false); if (sp.get('new')) { sp.delete('new'); setSp(sp); } }}
        onDone={(id) => { setNuevo(false); nav(`/prospects/${id}`); }} />}
      {importar && meta.data && <Importar sources={meta.data.sources} campaigns={meta.data.campaigns} onClose={() => setImportar(false)} onDone={() => { setImportar(false); list.reload(); }} />}
      {masivo && meta.data && <Masivo tipo={masivo} ids={[...sel]} workflows={meta.data.workflows} onClose={() => setMasivo('')}
        onDone={() => { setMasivo(''); setSel(new Set()); list.reload(); }} />}
    </>
  );
}

function NuevoProspecto({ sources, campaigns, onClose, onDone }: { sources: Source[]; campaigns: Campaign[]; onClose: () => void; onDone: (id: string) => void }) {
  const { ws } = useWs();
  const [f, setF] = useState<Record<string, string>>({ country: 'AR', consent: 'unknown' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => {
    if (!f.first_name && !f.email && !f.instagram && !f.phone) return setError('Cargá al menos un nombre o un dato de contacto.');
    const row: Record<string, unknown> = { workspace_id: ws!.id };
    for (const k of ['first_name', 'last_name', 'company', 'email', 'phone', 'instagram', 'facebook', 'tiktok', 'city', 'country', 'notes', 'consent', 'consent_source']) if (f[k]?.trim()) row[k] = f[k].trim();
    if (f.source_id) row.source_id = f.source_id;
    if (f.campaign_id) row.campaign_id = f.campaign_id;
    if (f.tags) row.tags = f.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const { data, error } = await supabase.from('growth_prospects').insert(row).select('id').single();
    if (error) setError(error.message); else onDone(data.id);
  };
  return (
    <Modal title="Nuevo prospecto" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g2">
        <Field label="Nombre"><input value={f.first_name || ''} onChange={set('first_name')} autoFocus /></Field>
        <Field label="Apellido"><input value={f.last_name || ''} onChange={set('last_name')} /></Field>
        <Field label="Empresa o negocio"><input value={f.company || ''} onChange={set('company')} /></Field>
        <Field label="Ciudad"><input value={f.city || ''} onChange={set('city')} /></Field>
        <Field label="Email"><input type="email" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label="Teléfono"><input value={f.phone || ''} onChange={set('phone')} placeholder="+54 9 11 …" /></Field>
        <Field label="Instagram"><input value={f.instagram || ''} onChange={set('instagram')} placeholder="@usuario" /></Field>
        <Field label="TikTok"><input value={f.tiktok || ''} onChange={set('tiktok')} /></Field>
        <Field label="Fuente"><select value={f.source_id || ''} onChange={set('source_id')}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Campaña"><select value={f.campaign_id || ''} onChange={set('campaign_id')}><option value="">—</option>{campaigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Consentimiento" hint="WhatsApp y SMS en vivo solo se mandan con opt-in."><select value={f.consent} onChange={set('consent')}>{Object.entries(CONSENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Origen del consentimiento"><input value={f.consent_source || ''} onChange={set('consent_source')} placeholder="Ej.: formulario de la web" /></Field>
        <Field label="Etiquetas" hint="Separadas por coma"><input value={f.tags || ''} onChange={set('tags')} /></Field>
        <Field label="Notas"><textarea value={f.notes || ''} onChange={set('notes')} rows={2} /></Field>
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}

// CSV con encabezados. Columnas reconocidas: nombre/first_name, apellido/last_name,
// email, telefono/phone, instagram, tiktok, empresa/company, ciudad/city, etiquetas/tags, consentimiento/consent.
const MAP: Record<string, string> = {
  nombre: 'first_name', first_name: 'first_name', apellido: 'last_name', last_name: 'last_name', email: 'email', mail: 'email',
  telefono: 'phone', teléfono: 'phone', phone: 'phone', celular: 'phone', instagram: 'instagram', tiktok: 'tiktok', facebook: 'facebook',
  empresa: 'company', company: 'company', ciudad: 'city', city: 'city', etiquetas: 'tags', tags: 'tags', consentimiento: 'consent', consent: 'consent', notas: 'notes', notes: 'notes',
};

function Importar({ sources, campaigns, onClose, onDone }: { sources: Source[]; campaigns: Campaign[]; onClose: () => void; onDone: () => void }) {
  const { ws, toast } = useWs();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [src, setSrc] = useState('');
  const [camp, setCamp] = useState('');
  const [origen, setOrigen] = useState('');
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const leer = async (file: File) => {
    const m = parseCsv(await file.text());
    if (m.length < 2) return setError('El archivo no tiene filas.');
    const head = m[0].map((h) => MAP[h.trim().toLowerCase()] || '');
    if (!head.some(Boolean)) return setError('No reconocí ninguna columna. Usá encabezados como nombre, email, telefono, instagram.');
    setError(null);
    setRows(m.slice(1, 5001).map((r) => {
      const o: Record<string, unknown> = {};
      head.forEach((k, i) => { const v = (r[i] || '').trim(); if (k && v) o[k] = k === 'tags' ? v.split(/[|,]/).map((t) => t.trim()).filter(Boolean) : v; });
      if (o.consent && !['opt_in', 'opt_out', 'unknown'].includes(String(o.consent))) delete o.consent;
      return o;
    }).filter((o) => Object.keys(o).length));
  };
  const subir = async () => {
    setSubiendo(true);
    let n = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const lote = rows.slice(i, i + 200).map((r) => ({ ...r, workspace_id: ws!.id, source_id: src || null, campaign_id: camp || null, consent_source: r.consent ? origen || 'Importación CSV' : null }));
      const { error } = await supabase.from('growth_prospects').insert(lote);
      if (error) { setSubiendo(false); return setError(`Se cargaron ${n}. Error: ${error.message}`); }
      n += lote.length;
    }
    toast(`Se importaron ${num(n)} prospectos`);
    onDone();
  };
  return (
    <Modal title="Importar prospectos (CSV)" onClose={onClose} wide footer={<><button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn primario" disabled={!rows.length || !ok || subiendo} onClick={subir}>{subiendo ? 'Importando…' : `Importar ${num(rows.length)}`}</button></>}>
      <div className="grid">
        <div className="aviso">Cargá solo datos que obtuviste legítimamente (formularios propios, contactos que te dieron su dato, listas con consentimiento). No uses datos de scraping ni bases compradas: la Ley 25.326 lo prohíbe y las plataformas bloquean las cuentas.</div>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])} aria-label="Archivo CSV" />
        <div className="grid g3">
          <Field label="Fuente"><select value={src} onChange={(e) => setSrc(e.target.value)}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Campaña"><select value={camp} onChange={(e) => setCamp(e.target.value)}><option value="">—</option>{campaigns.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Origen de los datos"><input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ej.: formulario del evento" /></Field>
        </div>
        {rows.length > 0 && (
          <div className="tabla-wrap" style={{ maxHeight: 220, overflow: 'auto' }}>
            <table><thead><tr>{['first_name', 'last_name', 'email', 'phone', 'instagram', 'city'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 8).map((r, i) => <tr key={i}>{['first_name', 'last_name', 'email', 'phone', 'instagram', 'city'].map((h) => <td key={h}>{String(r[h] ?? '')}</td>)}</tr>)}</tbody></table>
          </div>
        )}
        <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Confirmo que tengo una base legal para contactar a estas personas.</label>
        {error && <div className="error">{error}</div>}
      </div>
    </Modal>
  );
}

function Masivo({ tipo, ids, workflows, onClose, onDone }: { tipo: 'workflow' | 'tag' | 'status'; ids: string[]; workflows: Workflow[]; onClose: () => void; onDone: () => void }) {
  const { ws, toast } = useWs();
  const [v, setV] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const aplicar = async () => {
    setTrabajando(true);
    try {
      if (tipo === 'workflow') {
        const r = await fn<{ started: number; processed: number }>('growth-automations', { workspace_id: ws!.id, action: 'start', workflow_id: v, prospect_ids: ids });
        toast(`Automatización iniciada para ${r.started} (las que ya estaban corriendo no se duplican)`);
      } else if (tipo === 'status') {
        const { error } = await supabase.from('growth_prospects').update({ status: v }).in('id', ids).eq('workspace_id', ws!.id);
        if (error) throw new Error(error.message);
        toast('Estado actualizado');
      } else {
        const { data } = await supabase.from('growth_prospects').select('id,tags').in('id', ids);
        for (const p of data || []) {
          if (!(p.tags || []).includes(v)) await supabase.from('growth_prospects').update({ tags: [...(p.tags || []), v] }).eq('id', p.id);
        }
        toast('Etiqueta agregada');
      }
      onDone();
    } catch (e) { toast(e instanceof Error ? e.message : String(e), true); setTrabajando(false); }
  };
  return (
    <Modal title={tipo === 'workflow' ? 'Iniciar automatización' : tipo === 'tag' ? 'Agregar etiqueta' : 'Cambiar estado'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" disabled={!v || trabajando} onClick={aplicar}>Aplicar a {ids.length}</button></>}>
      {tipo === 'workflow' && <select value={v} onChange={(e) => setV(e.target.value)} aria-label="Automatización"><option value="">Elegí…</option>{workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
      {tipo === 'tag' && <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Etiqueta" aria-label="Etiqueta" />}
      {tipo === 'status' && <select value={v} onChange={(e) => setV(e.target.value)} aria-label="Estado"><option value="">Elegí…</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select>}
      {tipo === 'workflow' && <p className="muted pequeño">Los mensajes respetan las reglas de contacto: no se escribe a quien pidió la baja y los canales sin credenciales quedan simulados. Canales: {Object.values(CHANNELS).join(', ')}.</p>}
      {tipo === 'status' && <p className="muted pequeño">Cambiar el estado a mano también actualiza la fecha de esa etapa (para el funnel) si todavía no tenía.</p>}
    </Modal>
  );
}
