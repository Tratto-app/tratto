import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { resolvePeriod, type Period, type PeriodKey } from './period';
import type { AppSettings, Workspace } from './types';

interface Ctx {
  session: Session | null;
  ready: boolean;
  workspaces: Workspace[];
  ws: Workspace | null;
  app: AppSettings | null;
  setWs: (id: string) => void;
  reloadWorkspaces: () => Promise<void>;
  reloadApp: () => Promise<void>;
  period: Period;
  setPeriod: (k: PeriodKey, custom?: { from?: string; to?: string }) => void;
  custom: { from?: string; to?: string };
  toast: (msg: string, error?: boolean) => void;
  /** Vista del CRM: todos, solo clientes o solo proveedores */
  tipo: Tipo;
  setTipo: (t: Tipo) => void;
  /** Para las funciones *_tipo: null = todos */
  kind: 'customer' | 'provider' | null;
}

export type Tipo = 'todos' | 'customer' | 'provider';
export const TIPOS: { key: Tipo; label: string }[] = [
  { key: 'todos', label: 'Todos' }, { key: 'customer', label: 'Clientes' }, { key: 'provider', label: 'Proveedores' },
];

const C = createContext<Ctx | null>(null);
const LS_WS = 'growth.ws';
const LS_PERIOD = 'growth.period';
const LS_TIPO = 'growth.tipo';

function leer(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function guardar(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* sin storage */ } }

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsId, setWsId] = useState<string | null>(leer(LS_WS));
  const [app, setApp] = useState<AppSettings | null>(null);
  const [pkey, setPkey] = useState<PeriodKey>((leer(LS_PERIOD) as PeriodKey) || '30d');
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [tipo, setTipoState] = useState<Tipo>(() => {
    const t = leer(LS_TIPO);
    return t === 'customer' || t === 'provider' ? t : 'todos';
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const reloadWorkspaces = useCallback(async () => {
    const { data } = await supabase.from('growth_workspaces').select('id,name,slug,is_demo,created_at').order('created_at');
    setWorkspaces((data || []) as Workspace[]);
    setReady(true);
  }, []);
  useEffect(() => { if (session) reloadWorkspaces(); else { setWorkspaces([]); } }, [session, reloadWorkspaces]);

  const ws = useMemo(() => workspaces.find((w) => w.id === wsId) || workspaces[0] || null, [workspaces, wsId]);

  const reloadApp = useCallback(async () => {
    if (!ws) { setApp(null); return; }
    const { data } = await supabase.from('growth_app_settings').select('*').eq('workspace_id', ws.id).maybeSingle();
    setApp(data as AppSettings | null);
  }, [ws]);
  useEffect(() => { reloadApp(); }, [reloadApp]);

  const toast = useCallback((text: string, error = false) => {
    setMsg({ text, error });
    window.setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 4200);
  }, []);

  const period = useMemo(() => resolvePeriod(pkey, custom), [pkey, custom]);

  const value: Ctx = {
    session, ready, workspaces, ws, app,
    setWs: (id) => { setWsId(id); guardar(LS_WS, id); },
    reloadWorkspaces, reloadApp,
    period, custom,
    setPeriod: (k, c) => { setPkey(k); guardar(LS_PERIOD, k); if (c) setCustom(c); },
    toast,
    tipo,
    setTipo: (t) => { setTipoState(t); guardar(LS_TIPO, t); },
    kind: tipo === 'todos' ? null : tipo,
  };
  return (
    <C.Provider value={value}>
      {children}
      {msg && <div className={`toast ${msg.error ? 'error' : ''}`} role="status">{msg.text}</div>}
    </C.Provider>
  );
}

export function useWs(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error('useWs fuera de WorkspaceProvider');
  return c;
}

// Atajo para páginas que necesitan un workspace elegido
export function useWsId(): string {
  const { ws } = useWs();
  return ws?.id || '';
}
