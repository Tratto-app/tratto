import type { Ejecutor } from '../tipos.js';
import { uuid } from '../../shared/ids.js';

export type TipoEvento =
  | 'turno_creado'
  | 'turno_confirmado'
  | 'turno_cancelado'
  | 'turno_modificado'
  | 'turno_completado'
  | 'hold_creado'
  | 'hold_expirado'
  | 'bloqueo_creado'
  | 'bloqueo_borrado'
  | 'derivacion_humana'
  | 'bot_reactivado'
  | 'limpieza'
  | 'error';

/** Bitacora de auditoria. Nunca guarda el texto completo del cliente, solo el hecho. */
export const eventosRepo = {
  async registrar(
    ex: Ejecutor,
    tipo: TipoEvento,
    datos: { turnoId?: string | null; telefono?: string; detalle?: string; ahoraMs?: number },
  ): Promise<void> {
    await ex.exec('INSERT INTO eventos (id, ts_ms, tipo, turno_id, telefono, detalle) VALUES (?,?,?,?,?,?)', [
      uuid(),
      datos.ahoraMs ?? Date.now(),
      tipo,
      datos.turnoId ?? null,
      datos.telefono ?? '',
      (datos.detalle ?? '').slice(0, 500),
    ]);
  },

  async ultimos(ex: Ejecutor, limite = 50) {
    return ex.query<{ id: string; ts_ms: number; tipo: string; turno_id: string | null; telefono: string; detalle: string }>(
      'SELECT * FROM eventos ORDER BY ts_ms DESC LIMIT ?',
      [limite],
    );
  },

  async limpiarViejos(ex: Ejecutor, anteriorAMs: number): Promise<number> {
    const r = await ex.exec('DELETE FROM eventos WHERE ts_ms < ?', [anteriorAMs]);
    return r.filas;
  },
};
