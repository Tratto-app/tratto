import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';
import { PERIODS, periodLabel, type PeriodKey } from '../lib/period';
import { hace } from '../lib/format';
import { NOTIF } from '../lib/labels';
import type { Notification } from '../lib/types';
import { Badge } from './ui';
import { NAV } from '../lib/nav';

// Íconos de trazo simple (sin librerías)
const I = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICON = {
  dash: I('M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z'),
  users: I('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'),
  flag: I('M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7'),
  source: I('M12 2v20M2 12h20M5 5l14 14M19 5L5 19'),
  link: I('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'),
  inbox: I('M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11'),
  flow: I('M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9'),
  ai: I('M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4zM9 10h.01M15 10h.01'),
  app: I('M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2'),
  seg: I('M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z'),
  ret: I('M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15'),
  chart: I('M18 20V10M12 20V4M6 20v-6'),
  funnel: I('M22 3H2l8 9.46V19l4 2v-8.54z'),
  cohort: I('M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18'),
  store: I('M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0'),
  book: I('M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM20 17v5H6.5a2.5 2.5 0 0 1 0-5'),
  plug: I('M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z'),
  gear: I('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'),
  bell: I('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0'),
  menu: I('M3 12h18M3 6h18M3 18h18'),
  team: I('M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 9v4M5 13h14M5 13v3M12 13v3M19 13v3M5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
};


function Notificaciones() {
  const { ws } = useWs();
  const nav = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const cargar = async () => {
    if (!ws) return;
    const [l, c] = await Promise.all([
      supabase.from('growth_notifications').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('growth_notifications').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('read', false),
    ]);
    setItems((l.data || []) as Notification[]);
    setSinLeer(c.count || 0);
  };
  useEffect(() => {
    cargar();
    const t = window.setInterval(cargar, 60_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.id]);
  const marcarTodas = async () => {
    if (!ws) return;
    await supabase.from('growth_notifications').update({ read: true }).eq('workspace_id', ws.id).eq('read', false);
    cargar();
  };
  return (
    <div className="campana">
      <button className="btn fantasma" aria-label={`Notificaciones (${sinLeer} sin leer)`} onClick={() => setAbierto(!abierto)}>
        {ICON.bell}{sinLeer > 0 && <span className="n">{sinLeer > 99 ? '99+' : sinLeer}</span>}
      </button>
      {abierto && (
        <div className="card panel-notifs">
          <div className="card-cab"><h3>Notificaciones</h3><div className="acciones"><button className="btn chico" onClick={marcarTodas}>Marcar leídas</button></div></div>
          {items.length === 0 && <div className="muted">No hay notificaciones.</div>}
          <ul className="lista-simple">
            {items.map((n) => (
              <li key={n.id} style={{ cursor: n.prospect_id || n.app_user_id ? 'pointer' : 'default', opacity: n.read ? 0.65 : 1 }}
                onClick={() => {
                  setAbierto(false);
                  if (n.prospect_id) nav(`/prospects/${n.prospect_id}`); else if (n.app_user_id) nav(`/users/${n.app_user_id}`);
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fila" style={{ gap: 6 }}><Badge tone={NOTIF[n.type]?.tone}>{NOTIF[n.type]?.label || n.type}</Badge><span className="muted pequeño">{hace(n.created_at)}</span></div>
                  <div style={{ marginTop: 3 }}>{n.title}</div>
                  {n.body && <div className="muted pequeño">{n.body}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { ws, workspaces, setWs, period, setPeriod, custom, session } = useWs();
  const [menu, setMenu] = useState(false);
  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? 'abierta' : ''}`} onClick={() => setMenu(false)}>
        <div className="marca">
          <span className="marca-sello">
            <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 23l7-8 6 4 9-12" stroke="#C9A227" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>CRM de Tratto<small>{ws?.is_demo ? 'DEMO · DATOS FICTICIOS' : 'CLIENTES Y MARKETING'}</small></div>
        </div>
        {NAV.map((g) => (
          <nav className="nav-grupo" key={g.group || 'inicio'} aria-label={g.group || 'Inicio'}>
            {g.group && <span>{g.group}</span>}
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/' || it.to === '/analytics' || it.to === '/app'} className={({ isActive }) => `nav-item ${isActive ? 'activo' : ''}`}>
                {ICON[it.icon]}{it.label}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="nav-pie">{session?.user.email}<br /><button className="btn fantasma chico" style={{ paddingLeft: 0 }} onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>
      </aside>
      <div className="principal">
        <header className="topbar">
          <button className="btn fantasma solo-movil" aria-label="Menú" onClick={() => setMenu(!menu)}>{ICON.menu}</button>
          <select aria-label="Workspace" style={{ width: 'auto', maxWidth: 260 }} value={ws?.id || ''} onChange={(e) => setWs(e.target.value)}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}{w.is_demo ? ' (demo)' : ''}</option>)}
          </select>
          {ws?.is_demo && <Badge tone="laton" title="Todos los datos de este workspace son ficticios">Demo</Badge>}
          <span className="espacio" />
          <select aria-label="Período" style={{ width: 'auto' }} value={period.key} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {period.key === 'custom' && (
            <>
              <input type="date" aria-label="Desde" style={{ width: 'auto' }} value={custom.from || ''} onChange={(e) => setPeriod('custom', { ...custom, from: e.target.value })} />
              <input type="date" aria-label="Hasta" style={{ width: 'auto' }} value={custom.to || ''} onChange={(e) => setPeriod('custom', { ...custom, to: e.target.value })} />
            </>
          )}
          <span className="muted pequeño nowrap rango" title="Período aplicado a todas las métricas">{periodLabel(period)}</span>
          <Notificaciones />
        </header>
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
