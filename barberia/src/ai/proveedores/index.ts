/** Elección del proveedor de IA según la configuración. */
import { claveIA, env } from '../../config/env.js';
import { log } from '../../shared/log.js';
import { crearProveedorClaude } from './claude.js';
import { crearProveedorOpenAI } from './openai.js';
import { ErrorProveedor, type ProveedorIA } from './tipos.js';

export * from './tipos.js';

let cache: ProveedorIA | null = null;

export function proveedorIA(): ProveedorIA {
  if (cache) return cache;

  if (env.AI_PROVEEDOR === 'openai') {
    if (!env.OPENAI_API_KEY) throw new ErrorProveedor('sin_credencial', 'falta OPENAI_API_KEY');
    cache = crearProveedorOpenAI({ apiKey: env.OPENAI_API_KEY });
  } else {
    if (!claveIA) throw new ErrorProveedor('sin_credencial', 'falta AI_API_KEY');
    cache = crearProveedorClaude({ apiKey: claveIA });
  }

  log.info({ proveedor: cache.nombre, modelo: cache.modelo }, 'proveedor de IA elegido');
  return cache;
}

export function reiniciarProveedor(): void {
  cache = null;
}
