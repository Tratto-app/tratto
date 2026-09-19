import type { Ejecutor } from '../tipos.js';

export interface RecordatorioPendiente {
  turnoId: string;
  avisoId: string;
  programadoMs: number;
}

export const recordatoriosRepo = {
  /** Programa un aviso. Idempotente: si ya existe, no lo duplica. */
  async programar(ex: Ejecutor, turnoId: string, avisoId: string, programadoMs: number): Promise<void> {
    await ex.exec(
      `INSERT INTO recordatorios (turno_id, aviso_id, programado_ms, estado)
       VALUES (?,?,?,'pendiente')
       ON CONFLICT (turno_id, aviso_id) DO UPDATE SET
         programado_ms = excluded.programado_ms,
         estado = CASE WHEN recordatorios.estado = 'enviado' THEN 'enviado' ELSE 'pendiente' END`,
      [turnoId, avisoId, programadoMs],
    );
  },

  async cancelarDeTurno(ex: Ejecutor, turnoId: string): Promise<void> {
    await ex.exec("UPDATE recordatorios SET estado = 'cancelado' WHERE turno_id = ? AND estado = 'pendiente'", [turnoId]);
  },

  async vencidos(ex: Ejecutor, ahoraMs: number, limite = 25): Promise<RecordatorioPendiente[]> {
    const filas = await ex.query<{ turno_id: string; aviso_id: string; programado_ms: number }>(
      `SELECT turno_id, aviso_id, programado_ms FROM recordatorios
       WHERE estado = 'pendiente' AND programado_ms <= ?
       ORDER BY programado_ms ASC LIMIT ?`,
      [ahoraMs, limite],
    );
    return filas.map((f) => ({ turnoId: f.turno_id, avisoId: f.aviso_id, programadoMs: Number(f.programado_ms) }));
  },

  /**
   * Toma el recordatorio de forma atomica: solo un worker puede pasarlo de
   * 'pendiente' a 'enviado'. Devuelve true si este proceso se lo quedo.
   */
  async tomar(ex: Ejecutor, turnoId: string, avisoId: string, ahoraIso: string): Promise<boolean> {
    const r = await ex.exec(
      `UPDATE recordatorios SET estado = 'enviado', enviado_en = ?
       WHERE turno_id = ? AND aviso_id = ? AND estado = 'pendiente'`,
      [ahoraIso, turnoId, avisoId],
    );
    return r.filas > 0;
  },

  async marcarError(ex: Ejecutor, turnoId: string, avisoId: string, error: string): Promise<void> {
    await ex.exec("UPDATE recordatorios SET estado = 'error', error = ? WHERE turno_id = ? AND aviso_id = ?", [
      error.slice(0, 300),
      turnoId,
      avisoId,
    ]);
  },
};
