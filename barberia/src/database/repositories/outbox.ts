import type { Ejecutor } from '../tipos.js';
import { uuid } from '../../shared/ids.js';

export type TipoEventoSheets = 'turno_alta' | 'turno_cambio' | 'turno_baja' | 'refrescar_vistas';

export interface EventoOutbox {
  id: string;
  tipo: TipoEventoSheets;
  turnoId: string | null;
  intentos: number;
  proximoIntentoMs: number;
  ultimoError: string;
}

interface Fila {
  id: string;
  tipo: TipoEventoSheets;
  turno_id: string | null;
  creado_ms: number;
  proximo_intento_ms: number;
  intentos: number;
  ultimo_error: string;
}

const mapear = (f: Fila): EventoOutbox => ({
  id: f.id,
  tipo: f.tipo,
  turnoId: f.turno_id,
  intentos: Number(f.intentos),
  proximoIntentoMs: Number(f.proximo_intento_ms),
  ultimoError: f.ultimo_error ?? '',
});

/**
 * Cola de sincronizacion hacia Google Sheets.
 *
 * Se escribe dentro de la MISMA transaccion que el turno: o se guardan los dos,
 * o no se guarda ninguno. Asi no existe un turno que nunca llegue a la planilla.
 * El envio real ocurre despues, fuera de la transaccion, con reintentos.
 */
export const outboxRepo = {
  async encolar(ex: Ejecutor, tipo: TipoEventoSheets, turnoId: string | null, ahoraMs: number): Promise<void> {
    await ex.exec(
      `INSERT INTO sheets_outbox (id, tipo, turno_id, creado_ms, proximo_intento_ms, intentos)
       VALUES (?,?,?,?,?,0)`,
      [uuid(), tipo, turnoId, ahoraMs, ahoraMs],
    );
  },

  async pendientes(ex: Ejecutor, ahoraMs: number, limite = 25): Promise<EventoOutbox[]> {
    const filas = await ex.query<Fila>(
      'SELECT * FROM sheets_outbox WHERE proximo_intento_ms <= ? ORDER BY creado_ms ASC LIMIT ?',
      [ahoraMs, limite],
    );
    return filas.map(mapear);
  },

  async borrar(ex: Ejecutor, id: string): Promise<void> {
    await ex.exec('DELETE FROM sheets_outbox WHERE id = ?', [id]);
  },

  async posponer(ex: Ejecutor, id: string, proximoIntentoMs: number, error: string): Promise<void> {
    await ex.exec(
      'UPDATE sheets_outbox SET intentos = intentos + 1, proximo_intento_ms = ?, ultimo_error = ? WHERE id = ?',
      [proximoIntentoMs, error.slice(0, 500), id],
    );
  },

  async contar(ex: Ejecutor): Promise<number> {
    const filas = await ex.query<{ n: number }>('SELECT COUNT(*) AS n FROM sheets_outbox');
    return Number(filas[0]?.n ?? 0);
  },
};
