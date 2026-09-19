import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { BaseDeDatos, Transaccion } from './tipos.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * Driver SQLite: pensado para desarrollo, tests y barberias de un solo local
 * corriendo en una sola instancia.
 *
 * La prevencion de doble reserva se apoya en `BEGIN IMMEDIATE`: SQLite admite
 * un unico escritor por vez, asi que el "chequeo + insert" de un turno es
 * atomico frente a cualquier otra conexion o proceso sobre el mismo archivo.
 */
export function crearSqlite(rutaArchivo: string): BaseDeDatos {
  if (rutaArchivo !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(rutaArchivo)), { recursive: true });
  }
  const db = new Database(rutaArchivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Si otro proceso tiene el lock de escritura, esperar en vez de fallar.
  db.pragma('busy_timeout = 5000');

  const correr = <T>(sql: string, params: readonly unknown[]): T[] => {
    const stmt = db.prepare(sql);
    return (stmt.reader ? stmt.all(...(params as unknown[])) : (stmt.run(...(params as unknown[])), [])) as T[];
  };

  const ejecutor = {
    async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
      return correr<T>(sql, params);
    },
    async exec(sql: string, params: readonly unknown[] = []) {
      const stmt = db.prepare(sql);
      const info = stmt.run(...(params as unknown[]));
      return { filas: info.changes };
    },
  };

  // SQLite admite un unico escritor. Las transacciones de este proceso se
  // encolan para no intentar abrir dos BEGIN IMMEDIATE a la vez: cada una
  // espera a la anterior, igual que haria el motor con procesos distintos.
  let cola: Promise<unknown> = Promise.resolve();

  return {
    driver: 'sqlite',
    ...ejecutor,
    async transaccion<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T> {
      const corrida = cola.then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const out = await fn({ ...ejecutor, bloquearAgenda: async () => {} });
          db.exec('COMMIT');
          return out;
        } catch (e) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* la transaccion ya estaba cerrada */
          }
          throw e;
        }
      });
      // La cola avanza pase lo que pase, para que un error no la deje trabada.
      cola = corrida.catch(() => {});
      return corrida;
    },
    async migrar() {
      db.exec(fs.readFileSync(path.join(AQUI, 'schema.sql'), 'utf8'));
    },
    async cerrar() {
      db.close();
    },
  };
}
