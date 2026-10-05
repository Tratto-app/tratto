import { supabase } from './supabase';

// Llama a una función SQL (RPC). Lanza el error con un mensaje legible.
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// Llama a una Edge Function con la sesión del usuario.
export async function fn<T = Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // El cuerpo del error trae el mensaje de la función
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); msg = j.error || msg; } catch { /* sin cuerpo */ }
    }
    throw new Error(msg);
  }
  return data as T;
}

export function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
