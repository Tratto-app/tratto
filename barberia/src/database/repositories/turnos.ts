import type { Ejecutor } from '../tipos.js';
import { ESTADOS_OCUPAN, ESTADOS_VIGENTES, type EstadoTurno, type Turno } from '../../booking/tipos.js';

interface FilaTurno {
  id: string;
  telefono: string;
  nombre_cliente: string;
  servicio_id: string;
  servicio_nombre: string;
  precio: number;
  duracion_min: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  inicio_ms: number;
  fin_ms: number;
  estado: EstadoTurno;
  origen: Turno['origen'];
  hold_vence_ms: number | null;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
  cancelado_en: string | null;
  cancelado_por: string | null;
}

export function mapearTurno(f: FilaTurno): Turno {
  return {
    id: f.id,
    telefono: f.telefono,
    nombreCliente: f.nombre_cliente,
    servicioId: f.servicio_id,
    servicioNombre: f.servicio_nombre,
    precio: Number(f.precio),
    duracionMin: Number(f.duracion_min),
    fecha: f.fecha,
    horaInicio: f.hora_inicio,
    horaFin: f.hora_fin,
    inicioMs: Number(f.inicio_ms),
    finMs: Number(f.fin_ms),
    estado: f.estado,
    origen: f.origen,
    holdVenceMs: f.hold_vence_ms === null ? null : Number(f.hold_vence_ms),
    observaciones: f.observaciones ?? '',
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    canceladoEn: f.cancelado_en,
    canceladoPor: f.cancelado_por,
  };
}

const COLUMNAS = `id, telefono, nombre_cliente, servicio_id, servicio_nombre, precio, duracion_min,
  fecha, hora_inicio, hora_fin, inicio_ms, fin_ms, estado, origen, hold_vence_ms, observaciones,
  creado_en, actualizado_en, cancelado_en, cancelado_por`;

const lista = (n: number) => Array.from({ length: n }, () => '?').join(',');

export const turnosRepo = {
  async porId(ex: Ejecutor, id: string): Promise<Turno | null> {
    const filas = await ex.query<FilaTurno>(`SELECT ${COLUMNAS} FROM turnos WHERE id = ?`, [id]);
    return filas[0] ? mapearTurno(filas[0]) : null;
  },

  /**
   * Turnos que ocupan el horario y se superponen con el rango dado.
   * Es la consulta critica del sistema: siempre se ejecuta dentro de la misma
   * transaccion que despues inserta, nunca antes.
   */
  async superpuestos(
    ex: Ejecutor,
    inicioMs: number,
    finMs: number,
    opciones: { excluirId?: string } = {},
  ): Promise<Turno[]> {
    const params: unknown[] = [...ESTADOS_OCUPAN, inicioMs, finMs];
    let sql = `SELECT ${COLUMNAS} FROM turnos
      WHERE estado IN (${lista(ESTADOS_OCUPAN.length)})
        AND inicio_ms < ? AND fin_ms > ?`;
    if (opciones.excluirId) {
      sql += ' AND id <> ?';
      params.push(opciones.excluirId);
    }
    const filas = await ex.query<FilaTurno>(sql, params);
    return filas.map(mapearTurno);
  },

  /** Turnos que ocupan horario dentro de un rango (para dibujar la agenda del dia). */
  async ocupadosEnRango(ex: Ejecutor, desdeMs: number, hastaMs: number): Promise<Turno[]> {
    const filas = await ex.query<FilaTurno>(
      `SELECT ${COLUMNAS} FROM turnos
       WHERE estado IN (${lista(ESTADOS_OCUPAN.length)})
         AND inicio_ms < ? AND fin_ms > ?
       ORDER BY inicio_ms ASC`,
      [...ESTADOS_OCUPAN, hastaMs, desdeMs],
    );
    return filas.map(mapearTurno);
  },

  /** Todos los turnos de un dia (incluye cancelados: el barbero quiere verlos). */
  async porFecha(ex: Ejecutor, fecha: string): Promise<Turno[]> {
    const filas = await ex.query<FilaTurno>(
      `SELECT ${COLUMNAS} FROM turnos WHERE fecha = ? ORDER BY inicio_ms ASC`,
      [fecha],
    );
    return filas.map(mapearTurno);
  },

  async porRangoDeFechas(ex: Ejecutor, desde: string, hasta: string): Promise<Turno[]> {
    const filas = await ex.query<FilaTurno>(
      `SELECT ${COLUMNAS} FROM turnos WHERE fecha >= ? AND fecha <= ? ORDER BY inicio_ms ASC`,
      [desde, hasta],
    );
    return filas.map(mapearTurno);
  },

  /** Turnos vigentes a futuro de un cliente. Es lo que el bot llama "tu turno". */
  async vigentesDeCliente(ex: Ejecutor, telefono: string, desdeMs: number): Promise<Turno[]> {
    const filas = await ex.query<FilaTurno>(
      `SELECT ${COLUMNAS} FROM turnos
       WHERE telefono = ? AND estado IN (${lista(ESTADOS_VIGENTES.length)}) AND fin_ms > ?
       ORDER BY inicio_ms ASC`,
      [telefono, ...ESTADOS_VIGENTES, desdeMs],
    );
    return filas.map(mapearTurno);
  },

  async historialDeCliente(ex: Ejecutor, telefono: string, limite = 20): Promise<Turno[]> {
    const filas = await ex.query<FilaTurno>(
      `SELECT ${COLUMNAS} FROM turnos WHERE telefono = ? ORDER BY inicio_ms DESC LIMIT ?`,
      [telefono, limite],
    );
    return filas.map(mapearTurno);
  },

  async insertar(ex: Ejecutor, t: Turno): Promise<void> {
    await ex.exec(
      `INSERT INTO turnos (${COLUMNAS}) VALUES (${lista(20)})`,
      [
        t.id, t.telefono, t.nombreCliente, t.servicioId, t.servicioNombre, t.precio, t.duracionMin,
        t.fecha, t.horaInicio, t.horaFin, t.inicioMs, t.finMs, t.estado, t.origen, t.holdVenceMs,
        t.observaciones, t.creadoEn, t.actualizadoEn, t.canceladoEn, t.canceladoPor,
      ],
    );
  },

  async cambiarEstado(
    ex: Ejecutor,
    id: string,
    estado: EstadoTurno,
    opciones: { ahoraIso: string; esperado?: EstadoTurno[]; canceladoPor?: string; holdVenceMs?: number | null } = {
      ahoraIso: new Date().toISOString(),
    },
  ): Promise<number> {
    const params: unknown[] = [estado, opciones.ahoraIso];
    let sql = 'UPDATE turnos SET estado = ?, actualizado_en = ?';
    if (estado === 'cancelado') {
      sql += ', cancelado_en = ?, cancelado_por = ?';
      params.push(opciones.ahoraIso, opciones.canceladoPor ?? 'sistema');
    }
    if (opciones.holdVenceMs !== undefined) {
      sql += ', hold_vence_ms = ?';
      params.push(opciones.holdVenceMs);
    }
    sql += ' WHERE id = ?';
    params.push(id);
    if (opciones.esperado?.length) {
      sql += ` AND estado IN (${lista(opciones.esperado.length)})`;
      params.push(...opciones.esperado);
    }
    const r = await ex.exec(sql, params);
    return r.filas;
  },

  async actualizarDatos(
    ex: Ejecutor,
    id: string,
    campos: Partial<Pick<Turno, 'nombreCliente' | 'observaciones' | 'telefono'>>,
    ahoraIso: string,
  ): Promise<void> {
    const sets: string[] = ['actualizado_en = ?'];
    const params: unknown[] = [ahoraIso];
    if (campos.nombreCliente !== undefined) {
      sets.push('nombre_cliente = ?');
      params.push(campos.nombreCliente);
    }
    if (campos.observaciones !== undefined) {
      sets.push('observaciones = ?');
      params.push(campos.observaciones);
    }
    if (campos.telefono !== undefined) {
      sets.push('telefono = ?');
      params.push(campos.telefono);
    }
    params.push(id);
    await ex.exec(`UPDATE turnos SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  /**
   * Marca como expiradas las reservas temporales vencidas.
   * Se llama SIEMPRE al principio de una transaccion de escritura de agenda:
   * asi un hold abandonado no bloquea el horario de otro cliente.
   */
  async expirarHolds(ex: Ejecutor, ahoraMs: number, ahoraIso: string): Promise<number> {
    const r = await ex.exec(
      `UPDATE turnos SET estado = 'expirado', actualizado_en = ?
       WHERE estado = 'pendiente' AND hold_vence_ms IS NOT NULL AND hold_vence_ms <= ?`,
      [ahoraIso, ahoraMs],
    );
    return r.filas;
  },

  /** Libera los holds vivos de un cliente: solo puede tener una reserva temporal a la vez. */
  async expirarHoldsDeCliente(ex: Ejecutor, telefono: string, ahoraIso: string): Promise<number> {
    const r = await ex.exec(
      `UPDATE turnos SET estado = 'expirado', actualizado_en = ?
       WHERE telefono = ? AND estado = 'pendiente'`,
      [ahoraIso, telefono],
    );
    return r.filas;
  },

  async contarVigentesFuturos(ex: Ejecutor, telefono: string, ahoraMs: number): Promise<number> {
    const filas = await ex.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM turnos
       WHERE telefono = ? AND estado IN (${lista(ESTADOS_OCUPAN.length)}) AND inicio_ms > ?`,
      [telefono, ...ESTADOS_OCUPAN, ahoraMs],
    );
    return Number(filas[0]?.n ?? 0);
  },

  /**
   * Borra turnos que ya terminaron hace rato. Es la limpieza semanal: deja la
   * base liviana con la semana en curso.
   *
   * Solo toca turnos PASADOS: la condicion es sobre `fin_ms`, asi que un turno
   * futuro no puede caer nunca, por vieja que sea la fecha de creacion.
   * Los clientes y su historial viven en otra tabla y no se tocan.
   */
  async borrarPasadosAnterioresA(ex: Ejecutor, limiteMs: number): Promise<number> {
    const r = await ex.exec('DELETE FROM turnos WHERE fin_ms < ?', [limiteMs]);
    return r.filas;
  },

  /** Turnos que ya pasaron y siguen como reservados: candidatos a "completado". */
  async pasadosSinCerrar(ex: Ejecutor, ahoraMs: number, limite = 200): Promise<Turno[]> {
    const filas = await ex.query<FilaTurno>(
      `SELECT ${COLUMNAS} FROM turnos
       WHERE estado IN ('reservado','confirmado') AND fin_ms < ?
       ORDER BY inicio_ms ASC LIMIT ?`,
      [ahoraMs, limite],
    );
    return filas.map(mapearTurno);
  },
};
