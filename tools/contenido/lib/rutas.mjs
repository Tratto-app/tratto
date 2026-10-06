// Dónde viven los archivos del sistema. La memoria y la configuración se
// pueden mover con variables de entorno (los tests las apuntan a carpetas
// temporales para no tocar los datos reales).
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const rutas = {
  get conocimiento() { return path.join(RAIZ, 'conocimiento'); },
  get config() { return process.env.CONTENIDO_CONFIG_DIR || path.join(RAIZ, 'config'); },
  get memoria() { return process.env.CONTENIDO_MEMORIA_DIR || path.join(RAIZ, 'memoria'); },
};
