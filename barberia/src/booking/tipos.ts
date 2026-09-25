export const ESTADOS_TURNO = [
  'pendiente', // reserva temporal mientras el cliente confirma (bloquea el horario)
  'reservado', // turno confirmado por el cliente
  'confirmado', // el cliente ademas respondio que si al recordatorio
  'cancelado',
  'completado',
  'no_show',
  'expirado', // la reserva temporal vencio sin confirmarse
] as const;

export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

/** Estados que ocupan el horario: ningun otro turno puede superponerse con estos. */
export const ESTADOS_OCUPAN: EstadoTurno[] = ['pendiente', 'reservado', 'confirmado'];

/** Estados que el cliente considera "mi turno". */
export const ESTADOS_VIGENTES: EstadoTurno[] = ['reservado', 'confirmado'];

export type OrigenTurno = 'whatsapp' | 'panel' | 'simulador' | 'sistema';

/**
 * Un horario que se apartó mientras el cliente confirmaba y nunca llegó a ser
 * turno (sigue apartado, venció o se soltó). Al confirmarse, `holdVenceMs`
 * pasa a null; un turno cargado directo nace con null.
 */
export function nuncaFueTurno(t: Pick<Turno, 'estado' | 'holdVenceMs'>): boolean {
  return t.holdVenceMs !== null || t.estado === 'pendiente' || t.estado === 'expirado';
}

/** El turno viejo que quedó cancelado al mover un turno a otro horario. */
export function fueReprogramado(t: Pick<Turno, 'estado' | 'canceladoPor'>): boolean {
  return t.estado === 'cancelado' && (t.canceladoPor ?? '').startsWith('reprogramado');
}

/** Cancelación de verdad: no cuentan los horarios apartados ni los turnos que solo se movieron. */
export function esCancelacionReal(t: Pick<Turno, 'estado' | 'holdVenceMs' | 'canceladoPor'>): boolean {
  return t.estado === 'cancelado' && !nuncaFueTurno(t) && !fueReprogramado(t);
}

export interface Turno {
  id: string;
  telefono: string;
  nombreCliente: string;
  servicioId: string;
  servicioNombre: string;
  precio: number;
  duracionMin: number;
  /** YYYY-MM-DD en hora local del negocio */
  fecha: string;
  /** HH:mm en hora local del negocio */
  horaInicio: string;
  horaFin: string;
  /** epoch ms UTC */
  inicioMs: number;
  finMs: number;
  estado: EstadoTurno;
  origen: OrigenTurno;
  holdVenceMs: number | null;
  observaciones: string;
  /** Descuento aplicado a este turno (por ejemplo, el 10% por dejar reseña). */
  descuentoPorcentaje: number;
  /** Beneficio que se consumió en este turno, si hubo alguno. */
  beneficioId: string | null;
  creadoEn: string;
  actualizadoEn: string;
  canceladoEn: string | null;
  canceladoPor: string | null;
}

export interface Bloqueo {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  inicioMs: number;
  finMs: number;
  diaCompleto: boolean;
  motivo: string;
  creadoEn: string;
}

export interface Cliente {
  telefono: string;
  nombre: string;
  totalTurnos: number;
  primeraVisita: string | null;
  ultimaVisita: string | null;
  notas: string;
  bloqueado: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface HorarioDisponible {
  hora: string; // HH:mm local
  inicioMs: number;
  finMs: number;
  horaFin: string;
}
