import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setCargando(false);
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
  };
  return (
    <div className="login">
      <form className="card grid" onSubmit={entrar}>
        <div>
          <h1>Growth OS</h1>
          <p className="texto-2" style={{ margin: '4px 0 0' }}>Conseguí, activá y retené usuarios de tu app.</p>
        </div>
        <div className="hilo" style={{ margin: 0 }} />
        <label className="campo">Email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="campo">Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn primario" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
        <p className="muted pequeño" style={{ margin: 0 }}>Acceso solo para el equipo. Las cuentas se crean desde Supabase Auth.</p>
      </form>
    </div>
  );
}
