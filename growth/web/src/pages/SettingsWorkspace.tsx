import { useState } from 'react';
import { Badge, Card, ErrorBox, Field, Loading, PageHeader } from '../components/ui';
import { fecha } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';
import { SUPABASE_URL } from '../lib/supabase';

export default function SettingsWorkspace() {
  const { ws, app, session, workspaces, reloadWorkspaces, reloadApp, setWs, toast } = useWs();
  const [name, setName] = useState(ws!.name);
  const [nuevo, setNuevo] = useState('');
  const [phone, setPhone] = useState(app?.contact_phone || '');
  const members = useAsync(async () => {
    const { data, error } = await supabase.from('growth_members').select('user_id,role,created_at').eq('workspace_id', ws!.id).order('created_at');
    if (error) throw new Error(error.message);
    return data as { user_id: string; role: string; created_at: string }[];
  }, [ws!.id]);
  const yo = members.data?.find((m) => m.user_id === session?.user.id);
  const admin = yo?.role === 'owner' || yo?.role === 'admin';

  const renombrar = async () => {
    const { error } = await supabase.from('growth_workspaces').update({ name: name.trim() }).eq('id', ws!.id);
    if (error) toast(error.message, true); else { toast('Guardado'); reloadWorkspaces(); }
  };
  const crear = async () => {
    const slug = nuevo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '-' + Math.random().toString(36).slice(2, 6);
    const { data, error } = await supabase.from('growth_workspaces').insert({ name: nuevo.trim(), slug, created_by: session!.user.id }).select('id').single();
    if (error) return toast(error.message, true);
    await reloadWorkspaces(); setWs(data.id); setNuevo(''); toast('Workspace creado');
  };
  const paused = app?.sending_paused !== false;
  const togglePausa = async (nuevoPausado: boolean) => {
    if (!nuevoPausado && !confirm('Vas a ACTIVAR los envíos reales de este workspace. A partir de ahora las automatizaciones empezarán a escribirles a los registrados. ¿Seguro?')) return;
    const { error } = await supabase.from('growth_app_settings').update({ sending_paused: nuevoPausado }).eq('workspace_id', ws!.id);
    if (error) toast(error.message, true); else { toast(nuevoPausado ? 'Envíos en pausa' : 'Envíos activados'); reloadApp(); }
  };
  const guardarTel = async () => {
    const { error } = await supabase.from('growth_app_settings').update({ contact_phone: phone.trim() || null }).eq('workspace_id', ws!.id);
    if (error) toast(error.message, true); else { toast('Teléfono guardado'); reloadApp(); }
  };
  const base = (import.meta.env.VITE_GROWTH_LANDING_BASE as string | undefined) || `${SUPABASE_URL}/registro`;
  const linkRegistro = `${base}?ws=${ws!.slug}`;

  return (
    <>
      <PageHeader title="Settings · Workspace" desc="Cada workspace es una app distinta, con sus propios datos. Nadie ve datos de un workspace del que no es miembro (lo garantiza la base con RLS)." />

      <Card title="Lanzamiento" className={paused ? '' : 'mt'} actions={<Badge tone={paused ? 'laton' : 'verde'}>{paused ? 'En pausa' : 'Enviando'}</Badge>}>
        <p className="texto-2" style={{ marginTop: 0 }}>
          Mientras esté <b>en pausa</b>, el sistema recibe registros y los prepara, pero <b>no envía ningún mensaje</b>: las automatizaciones quedan esperando. Activá los envíos recién cuando la app esté publicada en Play Store y App Store.
        </p>
        <div className="fila">
          {paused
            ? <button className="btn laton" disabled={!admin} onClick={() => togglePausa(false)}>Activar envíos (lanzar)</button>
            : <button className="btn peligro" disabled={!admin} onClick={() => togglePausa(true)}>Volver a pausar</button>}
          <span className="muted pequeño">Afecta a todo el workspace. Los registros y el resto del panel funcionan igual en los dos modos.</span>
        </div>
        <div className="sep" />
        <div className="grid g2">
          <Field label="Teléfono de contacto" hint="Puede aparecer en los mensajes ({{contact_phone}}). No se guarda en el código.">
            <div className="fila"><input className="crece" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 …" disabled={!admin} /><button className="btn" disabled={!admin} onClick={guardarTel}>Guardar</button></div>
          </Field>
          <Field label="Link de registro (para redes, bio y QR)" hint="Lleva a la página donde proveedores y clientes se anotan con su permiso.">
            <div className="fila"><input className="crece mono" readOnly value={linkRegistro} onFocus={(e) => e.target.select()} /><button className="btn" onClick={() => { navigator.clipboard?.writeText(linkRegistro); toast('Link copiado'); }}>Copiar</button></div>
          </Field>
        </div>
      </Card>

      <div className="grid g2 mt">
        <Card title="Este workspace">
          <div className="grid">
            <Field label="Nombre"><div className="fila"><input className="crece" value={name} onChange={(e) => setName(e.target.value)} disabled={!admin} /><button className="btn" disabled={!admin || !name.trim()} onClick={renombrar}>Guardar</button></div></Field>
            <div className="pequeño texto-2">Identificador: <span className="mono">{ws!.slug}</span> · creado {fecha(ws!.created_at)} {ws!.is_demo && <Badge tone="laton">demo: datos ficticios, permite simular eventos</Badge>}</div>
          </div>
        </Card>
        <Card title="Crear otro workspace">
          <div className="fila"><input className="crece" placeholder="Nombre de la app" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="Nombre del nuevo workspace" /><button className="btn primario" disabled={!nuevo.trim()} onClick={crear}>Crear</button></div>
          <p className="muted pequeño">Vas a ser el dueño. Se crea con fuentes, reglas de score, segmentos e instrucciones de IA por defecto. Tenés {workspaces.length} workspace(s).</p>
        </Card>
      </div>
      <Card title="Miembros" className="mt">
        <ErrorBox error={members.error} />
        {!members.data ? (members.error ? null : <Loading />) : (
          <div className="tabla-wrap"><table>
            <thead><tr><th>Usuario</th><th>Rol</th><th>Desde</th><th /></tr></thead>
            <tbody>{members.data.map((m) => (
              <tr key={m.user_id}>
                <td className="mono pequeño">{m.user_id === session?.user.id ? `${session.user.email} (vos)` : m.user_id}</td>
                <td>{admin && m.role !== 'owner' && m.user_id !== session?.user.id ? (
                  <select style={{ width: 130 }} value={m.role} aria-label="Rol" onChange={async (e) => { const { error } = await supabase.from('growth_members').update({ role: e.target.value }).eq('workspace_id', ws!.id).eq('user_id', m.user_id); if (error) toast(error.message, true); else members.reload(); }}>
                    <option value="admin">Admin</option><option value="member">Miembro</option></select>
                ) : <Badge tone={m.role === 'owner' ? 'laton' : ''}>{{ owner: 'Dueño', admin: 'Admin', member: 'Miembro' }[m.role]}</Badge>}</td>
                <td className="muted">{fecha(m.created_at)}</td>
                <td>{admin && m.role !== 'owner' && m.user_id !== session?.user.id && <button className="btn peligro chico" onClick={async () => { if (!confirm('¿Quitar a este miembro?')) return; const { error } = await supabase.from('growth_members').delete().eq('workspace_id', ws!.id).eq('user_id', m.user_id); if (error) toast(error.message, true); else members.reload(); }}>Quitar</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="muted pequeño">Para sumar a alguien: la persona crea su cuenta (Supabase Auth del proyecto) y un dueño o admin la agrega con su id de usuario. Invitar por email desde acá todavía no está implementado.</p>
        {admin && <AgregarMiembro onDone={members.reload} />}
      </Card>
    </>
  );
}

function AgregarMiembro({ onDone }: { onDone: () => void }) {
  const { ws, toast } = useWs();
  const [uid, setUid] = useState('');
  const [role, setRole] = useState('member');
  const agregar = async () => {
    if (!/^[0-9a-f-]{36}$/i.test(uid.trim())) return toast('Pegá el id de usuario (uuid)', true);
    const { error } = await supabase.from('growth_members').insert({ workspace_id: ws!.id, user_id: uid.trim(), role });
    if (error) toast(error.message.includes('foreign key') ? 'Ese usuario no existe' : error.message, true); else { setUid(''); onDone(); }
  };
  return (
    <div className="fila mt">
      <input className="crece" placeholder="id de usuario (uuid)" value={uid} onChange={(e) => setUid(e.target.value)} aria-label="Id de usuario" />
      <select style={{ width: 130 }} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol del nuevo miembro"><option value="member">Miembro</option><option value="admin">Admin</option></select>
      <button className="btn" onClick={agregar}>Agregar</button>
    </div>
  );
}
