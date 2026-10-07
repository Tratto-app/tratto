import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

// Primer ingreso: el usuario no pertenece a ningún workspace.
export default function NuevoWorkspace() {
  const { session, reloadWorkspaces } = useWs();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '-' + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from('growth_workspaces').insert({ name: name.trim(), slug, created_by: session!.user.id });
    if (error) setError(error.message); else reloadWorkspaces();
  };
  // En producción (base compartida con la app) los workspaces no se crean desde
  // acá: solo entra quien fue agregado como miembro. VITE_SOLO_MIEMBROS=1.
  if (import.meta.env.VITE_SOLO_MIEMBROS === '1') {
    return (
      <div className="login">
        <div className="card grid">
          <h2>Esta cuenta no tiene acceso</h2>
          <p className="texto-2" style={{ margin: 0 }}>Entraste como {session?.user.email}. El panel es solo para el equipo de Tratto: pedile a quien lo administra que te agregue como miembro.</p>
          <button type="button" className="btn fantasma" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </div>
    );
  }
  return (
    <div className="login">
      <form className="card grid" onSubmit={crear}>
        <h2>Creá tu workspace</h2>
        <p className="texto-2" style={{ margin: 0 }}>Un workspace es una app que querés hacer crecer. Después completás sus datos en App Settings.</p>
        <label className="campo">Nombre<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Mi app" /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn primario">Crear</button>
        <button type="button" className="btn fantasma" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </form>
    </div>
  );
}
