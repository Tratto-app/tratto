import type { Ejecutor } from '../tipos.js';
import type { Bloqueo } from '../../booking/tipos.js';

interface FilaBloqueo {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  inicio_ms: number;
  fin_ms: number;
  dia_completo: number;
  motivo: string;
  creado_en: string;
}

const mapear = (f: FilaBloqueo): Bloqueo => ({
  id: f.id,
  fecha: f.fecha,
  horaInicio: f.hora_inicio,
  horaFin: f.hora_fin,
  inicioMs: Number(f.inicio_ms),
  finMs: Number(f.fin_ms),
  diaCompleto: Number(f.dia_completo) === 1,
  motivo: f.motivo ?? '',
  creadoEn: f.creado_en,
});

export const bloqueosRepo = {
  async enRango(ex: Ejecutor, desdeMs: number, hastaMs: number): Promise<Bloqueo[]> {
    const filas = await ex.query<FilaBloqueo>(
      'SELECT * FROM bloqueos WHERE inicio_ms < ? AND fin_ms > ? ORDER BY inicio_ms ASC',
      [hastaMs, desdeMs],
    );
    return filas.map(mapear);
  },

  async porFecha(ex: Ejecutor, fecha: string): Promise<Bloqueo[]> {
    const filas = await ex.query<FilaBloqueo>('SELECT * FROM bloqueos WHERE fecha = ? ORDER BY inicio_ms ASC', [fecha]);
    return filas.map(mapear);
  },

  async porRangoDeFechas(ex: Ejecutor, desde: string, hasta: string): Promise<Bloqueo[]> {
    const filas = await ex.query<FilaBloqueo>(
      'SELECT * FROM bloqueos WHERE fecha >= ? AND fecha <= ? ORDER BY inicio_ms ASC',
      [desde, hasta],
    );
    return filas.map(mapear);
  },

  async insertar(ex: Ejecutor, b: Bloqueo): Promise<void> {
    await ex.exec(
      `INSERT INTO bloqueos (id, fecha, hora_inicio, hora_fin, inicio_ms, fin_ms, dia_completo, motivo, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.id, b.fecha, b.horaInicio, b.horaFin, b.inicioMs, b.finMs, b.diaCompleto ? 1 : 0, b.motivo, b.creadoEn],
    );
  },

  async borrar(ex: Ejecutor, id: string): Promise<number> {
    const r = await ex.exec('DELETE FROM bloqueos WHERE id = ?', [id]);
    return r.filas;
  },

  async porId(ex: Ejecutor, id: string): Promise<Bloqueo | null> {
    const filas = await ex.query<FilaBloqueo>('SELECT * FROM bloqueos WHERE id = ?', [id]);
    return filas[0] ? mapear(filas[0]) : null;
  },
};
