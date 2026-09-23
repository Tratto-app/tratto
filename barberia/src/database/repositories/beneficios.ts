import type { Ejecutor } from '../tipos.js';
import { uuid } from '../../shared/ids.js';

export type EstadoBeneficio = 'disponible' | 'usado' | 'vencido' | 'anulado';

export interface Beneficio {
  id: string;
  telefono: string;
  tipo: string;
  descuentoPorcentaje: number;
  estado: EstadoBeneficio;
  turnoOrigen: string | null;
  turnoUsado: string | null;
  venceMs: number | null;
  creadoEn: string;
}

interface Fila {
  id: string;
  telefono: string;
  tipo: string;
  descuento_porcentaje: number;
  estado: EstadoBeneficio;
  turno_origen: string | null;
  turno_usado: string | null;
  vence_ms: number | null;
  creado_en: string;
}

const mapear = (f: Fila): Beneficio => ({
  id: f.id,
  telefono: f.telefono,
  tipo: f.tipo,
  descuentoPorcentaje: Number(f.descuento_porcentaje),
  estado: f.estado,
  turnoOrigen: f.turno_origen,
  turnoUsado: f.turno_usado,
  venceMs: f.vence_ms === null ? null : Number(f.vence_ms),
  creadoEn: f.creado_en,
});

export const beneficiosRepo = {
  /** Crea el beneficio si el cliente no tiene ya uno disponible del mismo tipo. */
  async otorgar(
    ex: Ejecutor,
    datos: { telefono: string; tipo: string; descuentoPorcentaje: number; turnoOrigen?: string | null; venceMs: number | null },
    ahoraIso: string,
  ): Promise<Beneficio | null> {
    const yaTiene = await beneficiosRepo.disponibleDe(ex, datos.telefono, Date.now());
    if (yaTiene) return null;
    const beneficio: Beneficio = {
      id: `BEN-${uuid().slice(0, 8).toUpperCase()}`,
      telefono: datos.telefono,
      tipo: datos.tipo,
      descuentoPorcentaje: datos.descuentoPorcentaje,
      estado: 'disponible',
      turnoOrigen: datos.turnoOrigen ?? null,
      turnoUsado: null,
      venceMs: datos.venceMs,
      creadoEn: ahoraIso,
    };
    await ex.exec(
      `INSERT INTO beneficios (id, telefono, tipo, descuento_porcentaje, estado, turno_origen, turno_usado, vence_ms, creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        beneficio.id, beneficio.telefono, beneficio.tipo, beneficio.descuentoPorcentaje, beneficio.estado,
        beneficio.turnoOrigen, beneficio.turnoUsado, beneficio.venceMs, ahoraIso, ahoraIso,
      ],
    );
    return beneficio;
  },

  /** El beneficio vigente de un cliente, si tiene alguno sin vencer. */
  async disponibleDe(ex: Ejecutor, telefono: string, ahoraMs: number): Promise<Beneficio | null> {
    const filas = await ex.query<Fila>(
      `SELECT * FROM beneficios
       WHERE telefono = ? AND estado = 'disponible' AND (vence_ms IS NULL OR vence_ms > ?)
       ORDER BY creado_en ASC LIMIT 1`,
      [telefono, ahoraMs],
    );
    return filas[0] ? mapear(filas[0]) : null;
  },

  async porId(ex: Ejecutor, id: string): Promise<Beneficio | null> {
    const filas = await ex.query<Fila>('SELECT * FROM beneficios WHERE id = ?', [id]);
    return filas[0] ? mapear(filas[0]) : null;
  },

  /** Marca el beneficio como usado en un turno. Devuelve false si ya no estaba disponible. */
  async usar(ex: Ejecutor, id: string, turnoId: string, ahoraIso: string): Promise<boolean> {
    const r = await ex.exec(
      "UPDATE beneficios SET estado = 'usado', turno_usado = ?, actualizado_en = ? WHERE id = ? AND estado = 'disponible'",
      [turnoId, ahoraIso, id],
    );
    return r.filas > 0;
  },

  /** Si se cancela el turno donde se usó, el descuento vuelve a estar disponible. */
  async liberarDeTurno(ex: Ejecutor, turnoId: string, ahoraIso: string): Promise<number> {
    const r = await ex.exec(
      "UPDATE beneficios SET estado = 'disponible', turno_usado = NULL, actualizado_en = ? WHERE turno_usado = ? AND estado = 'usado'",
      [ahoraIso, turnoId],
    );
    return r.filas;
  },

  async anular(ex: Ejecutor, id: string, ahoraIso: string): Promise<boolean> {
    const r = await ex.exec("UPDATE beneficios SET estado = 'anulado', actualizado_en = ? WHERE id = ?", [ahoraIso, id]);
    return r.filas > 0;
  },

  async vencerViejos(ex: Ejecutor, ahoraMs: number, ahoraIso: string): Promise<number> {
    const r = await ex.exec(
      "UPDATE beneficios SET estado = 'vencido', actualizado_en = ? WHERE estado = 'disponible' AND vence_ms IS NOT NULL AND vence_ms <= ?",
      [ahoraIso, ahoraMs],
    );
    return r.filas;
  },

  /** Teléfonos con descuento vigente. Lo usan la agenda y la planilla para marcarlos. */
  async telefonosConBeneficio(ex: Ejecutor, ahoraMs: number): Promise<Set<string>> {
    const filas = await ex.query<{ telefono: string }>(
      "SELECT DISTINCT telefono FROM beneficios WHERE estado = 'disponible' AND (vence_ms IS NULL OR vence_ms > ?)",
      [ahoraMs],
    );
    return new Set(filas.map((f) => f.telefono));
  },

  async listar(ex: Ejecutor, limite = 200): Promise<Beneficio[]> {
    const filas = await ex.query<Fila>('SELECT * FROM beneficios ORDER BY creado_en DESC LIMIT ?', [limite]);
    return filas.map(mapear);
  },
};
