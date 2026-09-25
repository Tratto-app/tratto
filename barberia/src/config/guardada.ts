/**
 * La configuración del negocio que edita el barbero desde el panel se guarda
 * también en la base. En Render (y en cualquier hosting con disco efímero) el
 * archivo config/negocio.json vuelve a la versión del repositorio en cada
 * despliegue; la copia de la base es la que sobrevive.
 */
import type { Ejecutor } from '../database/tipos.js';
import { configuracionRepo } from '../database/repositories/configuracion.js';
import { log } from '../shared/log.js';
import { guardarConfigNegocio, negocio, prepararConfigNegocio, type ConfigNegocio } from './negocio.js';

const CLAVE = 'negocio';

/** Config con la que arranca el sistema: la guardada desde el panel si hay; si no, el archivo. */
export async function configDeArranque(db: Ejecutor, ruta?: string): Promise<ConfigNegocio> {
  const guardada = await configuracionRepo.leer(db, CLAVE);
  if (!guardada) return negocio(ruta);
  let cfg: ConfigNegocio;
  try {
    cfg = prepararConfigNegocio(guardada);
  } catch (e) {
    log.error({ err: e instanceof Error ? e.message : String(e) }, 'la configuración guardada desde el panel es inválida: se usa config/negocio.json');
    return negocio(ruta);
  }
  try {
    // Se copia al archivo para que el panel y los comandos de consola vean lo mismo.
    guardarConfigNegocio(cfg, ruta);
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, 'no se pudo copiar la configuración guardada al archivo (se usa igual)');
  }
  log.info('configuración del negocio: se usa la guardada desde el panel');
  return cfg;
}

/**
 * Guarda una config editada: valida, la deja en la base (la copia que dura) y
 * después en el archivo. Tira `Error` con un mensaje legible si es inválida.
 */
export async function guardarConfigEditada(db: Ejecutor, nueva: unknown, ahoraIso: string, ruta?: string): Promise<ConfigNegocio> {
  const cfg = prepararConfigNegocio(nueva);
  await configuracionRepo.guardar(db, CLAVE, cfg, ahoraIso);
  try {
    guardarConfigNegocio(cfg, ruta);
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, 'no se pudo escribir config/negocio.json (quedó guardada en la base)');
  }
  return cfg;
}
