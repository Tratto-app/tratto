import { env, driverBD } from '../config/env.js';
import { log } from '../shared/log.js';
import { crearSqlite } from './sqlite.js';
import { crearPostgres } from './postgres.js';
import type { BaseDeDatos } from './tipos.js';

export type { BaseDeDatos, Transaccion, Ejecutor, Driver } from './tipos.js';

let instancia: BaseDeDatos | null = null;

export function crearBaseDeDatos(opciones?: { url?: string; sqlitePath?: string }): BaseDeDatos {
  const url = opciones?.url ?? env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) return crearPostgres(url);
  return crearSqlite(opciones?.sqlitePath ?? env.SQLITE_PATH);
}

/** Instancia compartida del proceso. */
export function bd(): BaseDeDatos {
  if (!instancia) {
    instancia = crearBaseDeDatos();
    log.info({ driver: instancia.driver }, 'base de datos inicializada');
  }
  return instancia;
}

export async function cerrarBaseDeDatos(): Promise<void> {
  if (instancia) {
    await instancia.cerrar();
    instancia = null;
  }
}

export { driverBD };
