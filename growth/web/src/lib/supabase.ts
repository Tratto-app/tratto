// Cliente de Supabase del panel. Usa SOLO la clave pública: los permisos
// los decide la base (RLS por workspace) y las Edge Functions.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configOk = !!(url && key);
export const SUPABASE_URL = url || '';
export const supabase = createClient(url || 'http://localhost:54321', key || 'falta-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Base de los links trackeados (la Edge Function growth-go o un dominio propio)
export const LINK_BASE = ((import.meta.env.VITE_GROWTH_LINK_BASE as string | undefined) || `${SUPABASE_URL}/functions/v1/growth-go`).replace(/\/$/, '');
