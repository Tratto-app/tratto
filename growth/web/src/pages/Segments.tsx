import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RuleBuilder, describeRule, type Cond } from '../components/RuleBuilder';
import { Badge, ErrorBox, Field, Loading, Modal, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { num } from '../lib/format';
import { useAsync, useDebounced } from '../lib/hooks';
import { FIELDS_APP_USER, FIELDS_PROSPECT } from '../lib/labels';
import { supabase } from '../lib/supabase';
import type { Segment } from '../lib/types';
import { useWs } from '../lib/workspace';

export default function Segments() {
  const { ws } = useWs();
  const [edit, setEdit] = useState<Segment | 'new' | null>(null);
  const data = useAsync(async () => {
    const { data, error } = await supabase.from('growth_segments').select('*').eq('workspace_id', ws!.id).order('is_system', { ascending: false }).order('name');
    if (error) throw new Error(error.message);
    const segs = (data || []) as Segment[];
    const counts = await Promise.all(segs.map((s) => rpc<number>('growth_segment_count', { seg: s.id }).catch(() => null)));
    return segs.map((s, i) => ({ ...s, count: counts[i] }));
  }, [ws!.id]);

  return (
    <>
      <PageHeader title="Segments" desc="Grupos que se recalculan solos con reglas. Sirven para filtrar prospectos, apuntar campañas y ver usuarios en riesgo."
        actions={<button className="btn primario" onClick={() => setEdit('new')}>+ Segmento</button>} />
      <ErrorBox error={data.error} onRetry={data.reload} />
      {!data.data ? (data.error ? null : <Loading />) : (
        <div className="tabla-wrap"><table>
          <thead><tr><th>Segmento</th><th>Aplica a</th><th>Regla</th><th className="num">Personas ahora</th><th /></tr></thead>
          <tbody>{data.data.map((s) => (
            <tr key={s.id}>
              <td>{s.name} {s.is_system && <Badge>sistema</Badge>}<div className="muted pequeño">{s.description}</div></td>
              <td>{s.entity === 'prospect' ? 'Prospectos' : 'Usuarios de la app'}</td>
              <td className="texto-2 pequeño">{describeRule(s.rules, s.entity === 'prospect' ? FIELDS_PROSPECT : FIELDS_APP_USER)}</td>
              <td className="num">{num(s.count)}</td>
              <td className="nowrap">{s.entity === 'prospect' && <Link className="btn chico" to={`/prospects?seg=${s.id}`}>Ver</Link>} <button className="btn chico" onClick={() => setEdit(s)}>Editar</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {edit && <Editor s={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); data.reload(); }} />}
    </>
  );
}

function Editor({ s, onClose, onDone }: { s: Segment | null; onClose: () => void; onDone: () => void }) {
  const { ws } = useWs();
  const [name, setName] = useState(s?.name || '');
  const [desc, setDesc] = useState(s?.description || '');
  const [entity, setEntity] = useState<'prospect' | 'app_user'>(s?.entity || 'prospect');
  const [rules, setRules] = useState<Cond | Record<string, never>>((s?.rules as Cond) || {});
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dr = useDebounced(JSON.stringify(rules) + entity, 400);
  useEffect(() => {
    rpc<number>('growth_rules_preview', { ws: ws!.id, p_entity: entity, p_rules: rules }).then(setPreview, () => setPreview(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dr]);
  const guardar = async () => {
    if (!name.trim()) return setError('Poné un nombre.');
    const row = { workspace_id: ws!.id, name: name.trim(), description: desc || null, entity, rules };
    const { error } = s ? await supabase.from('growth_segments').update(row).eq('id', s.id) : await supabase.from('growth_segments').insert(row);
    if (error) setError(error.message); else onDone();
  };
  return (
    <Modal title={s ? 'Editar segmento' : 'Nuevo segmento'} onClose={onClose} wide footer={<>
      {s && !s.is_system && <button className="btn peligro" style={{ marginRight: 'auto' }} onClick={async () => { const { error } = await supabase.from('growth_segments').delete().eq('id', s.id); if (error) setError(error.message); else onDone(); }}>Eliminar</button>}
      <button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Guardar</button></>}>
      <div className="grid g3">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Descripción"><input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label="Aplica a"><select value={entity} onChange={(e) => { setEntity(e.target.value as 'prospect' | 'app_user'); setRules({}); }} disabled={!!s}><option value="prospect">Prospectos</option><option value="app_user">Usuarios de la app</option></select></Field>
      </div>
      <h3 style={{ margin: '16px 0 8px' }}>Reglas</h3>
      <RuleBuilder key={entity} value={rules} onChange={setRules} fields={entity === 'prospect' ? FIELDS_PROSPECT : FIELDS_APP_USER} />
      <div className="info" style={{ marginTop: 12 }}>Hoy entran <b className="mono">{preview === null ? '…' : num(preview)}</b> {entity === 'prospect' ? 'prospectos' : 'usuarios'}.</div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}
