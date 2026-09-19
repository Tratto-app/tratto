import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { BaseDeDatos, Transaccion } from './tipos.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// int8/bigint llega como string por defecto; lo queremos como number
// (epoch en ms entra comodo en el entero seguro de JS).
pg.types.setTypeParser(20, (v: string) => Number(v));
// numeric -> number (precios)
pg.types.setTypeParser(1700, (v: string) => Number(v));

/** Clave del advisory lock que serializa toda escritura de agenda. */
const LOCK_AGENDA = 918273645;

/** Traduce los placeholders `?` del SQL portable a la forma `$n` de PostgreSQL. */
export function aPlaceholdersPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Driver PostgreSQL: la opcion recomendada para produccion.
 *
 * Ademas de la transaccion + advisory lock, el esquema agrega una restriccion
 * de exclusion GiST que rechaza a nivel motor cualquier turno superpuesto.
 */
export function crearPostgres(connectionString: string): BaseDeDatos {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(/localhost|127\.0\.0\.1/.test(connectionString) ? {} : { ssl: { rejectUnauthorized: false } }),
  });

  const ejecutor = (cliente: pg.Pool | pg.PoolClient) => ({
    async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
      const r = await cliente.query(aPlaceholdersPg(sql), params as unknown[]);
      return r.rows as T[];
    },
    async exec(sql: string, params: readonly unknown[] = []) {
      const r = await cliente.query(aPlaceholdersPg(sql), params as unknown[]);
      return { filas: r.rowCount ?? 0 };
    },
  });

  return {
    driver: 'postgres',
    ...ejecutor(pool),
    async transaccion<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T> {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const base = ejecutor(cliente);
        const tx: Transaccion = {
          ...base,
          async bloquearAgenda() {
            await cliente.query('SELECT pg_advisory_xact_lock($1)', [LOCK_AGENDA]);
          },
        };
        const out = await fn(tx);
        await cliente.query('COMMIT');
        return out;
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        cliente.release();
      }
    },
    async migrar() {
      const comun = fs.readFileSync(path.join(AQUI, 'schema.sql'), 'utf8');
      const especifico = fs.readFileSync(path.join(AQUI, 'schema.postgres.sql'), 'utf8');
      await pool.query(comun);
      await pool.query(especifico);
    },
    async cerrar() {
      await pool.end();
    },
  };
}
