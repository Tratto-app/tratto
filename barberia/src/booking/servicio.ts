/**
 * Servicio de turnos: la UNICA puerta de entrada para modificar la agenda.
 *
 * Ni la IA, ni el webhook de WhatsApp, ni el panel escriben en la base por su
 * cuenta: todos pasan por estas funciones, que son las que validan reglas de
 * negocio y garantizan que no existan dos turnos superpuestos.
 *
 * Patron de toda escritura:
 *   1. abrir transaccion y serializar la agenda (advisory lock / BEGIN IMMEDIATE);
 *   2. expirar reservas temporales vencidas;
 *   3. releer turnos y bloqueos DENTRO de la transaccion;
 *   4. validar disponibilidad con datos frescos;
 *   5. escribir el turno + el evento para Google Sheets en el mismo commit.
 *
 * El paso 3 es el que evita la doble reserva: nunca se valida con datos leidos
 * antes de abrir la transaccion.
 */
import { DateTime } from 'luxon';
import type { BaseDeDatos, Ejecutor, Transaccion } from '../database/index.js';
import { turnosRepo } from '../database/repositories/turnos.js';
import { clientesRepo } from '../database/repositories/clientes.js';
import { bloqueosRepo } from '../database/repositories/bloqueos.js';
import { outboxRepo, type TipoEventoSheets } from '../database/repositories/outbox.js';
import { eventosRepo } from '../database/repositories/eventos.js';
import { recordatoriosRepo } from '../database/repositories/recordatorios.js';
import {
  negocio as cargarNegocio,
  servicioPorId,
  serviciosActivos,
  type ConfigNegocio,
  type Servicio,
} from '../config/negocio.js';
import {
  ahora as ahoraEn,
  desdeFechaHora,
  fechaDe,
  horaDe,
  lunesDeLaSemana,
  rangoDeFechas,
  type Fecha,
  type Hora,
  type RangoDelDia,
} from '../shared/tiempo.js';
import { errores } from '../shared/errores.js';
import { idTurno } from '../shared/ids.js';
import { sanearNombre } from '../shared/texto.js';
import { log } from '../shared/log.js';
import { sheetsConfigurado } from '../config/env.js';
import {
  estadoDelDia,
  horarioEsValido,
  horariosDisponibles,
  proximosDiasAbiertos,
  repartirOpciones,
} from './disponibilidad.js';
import { ESTADOS_VIGENTES, type Bloqueo, type HorarioDisponible, type OrigenTurno, type Turno } from './tipos.js';

/**
 * Encola un evento para Google Sheets solo si Sheets esta configurado.
 * Sin esto la cola crecería para siempre en instalaciones que no usan planilla.
 * Si se conecta Sheets mas tarde, `resincronizarTodo()` reconstruye todo desde
 * la base de datos, asi que no se pierde nada.
 */
async function encolarParaSheets(tx: Transaccion, tipo: TipoEventoSheets, turnoId: string | null, ahoraMs: number): Promise<void> {
  if (!sheetsConfigurado) return;
  await outboxRepo.encolar(tx, tipo, turnoId, ahoraMs);
}

export interface Contexto {
  db: BaseDeDatos;
  cfg: ConfigNegocio;
  /** Inyectable para tests; en produccion es la hora real. */
  ahora: () => DateTime;
}

export function crearContexto(db: BaseDeDatos, cfg?: ConfigNegocio): Contexto {
  const config = cfg ?? cargarNegocio();
  return { db, cfg: config, ahora: () => ahoraEn(config.negocio.timezone) };
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export function obtenerServicios(ctx: Contexto) {
  return serviciosActivos(ctx.cfg).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    precio: s.precio,
    precio_a_confirmar: s.precio <= 0,
    duracion_min: s.duracion_min,
  }));
}

export function obtenerInfoNegocio(ctx: Contexto) {
  const n = ctx.cfg.negocio;
  return {
    nombre: n.nombre,
    direccion: n.direccion,
    como_llegar: n.como_llegar,
    telefono: n.telefono,
    instagram: n.instagram,
    maps: n.maps,
    medios_de_pago: n.medios_de_pago,
    politica_cancelacion: ctx.cfg.reglas.politica_cancelacion,
    anticipacion_maxima_dias: ctx.cfg.reglas.anticipacion_maxima_dias,
  };
}

export function obtenerHorariosAtencion(ctx: Contexto) {
  const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  return {
    zona_horaria: ctx.cfg.negocio.timezone,
    semana: dias.map((nombre, i) => {
      const d = ctx.cfg.horarios.dias[String(i + 1) as '1'];
      return { dia: nombre, abierto: Boolean(d?.abierto), tramos: d?.abierto ? d.tramos : [] };
    }),
    feriados: ctx.cfg.horarios.feriados,
    vacaciones: ctx.cfg.horarios.vacaciones,
    horarios_especiales: ctx.cfg.horarios.horarios_especiales,
  };
}

async function cargarAgendaDelDia(ex: Ejecutor, ctx: Contexto, fecha: Fecha) {
  const zona = ctx.cfg.negocio.timezone;
  const desdeMs = desdeFechaHora(fecha, '00:00', zona).toMillis();
  const hastaMs = DateTime.fromISO(fecha, { zone: zona }).endOf('day').toMillis();
  const [turnos, bloqueos] = await Promise.all([
    turnosRepo.ocupadosEnRango(ex, desdeMs, hastaMs),
    bloqueosRepo.enRango(ex, desdeMs, hastaMs),
  ]);
  return { turnos, bloqueos };
}

export interface ConsultaDisponibilidad {
  fecha: Fecha;
  servicioId: string;
  rango?: RangoDelDia;
  desdeHora?: Hora | null;
  hastaHora?: Hora | null;
  excluirTurnoId?: string;
  ignorarAnticipacion?: boolean;
}

export interface ResultadoDisponibilidad {
  fecha: Fecha;
  abierto: boolean;
  motivo_cerrado: string;
  servicio: { id: string; nombre: string; duracion_min: number; precio: number };
  horarios: string[];
  horarios_sugeridos: string[];
  total_disponibles: number;
  proximos_dias_con_lugar: Fecha[];
}

/** Consulta de disponibilidad. Lectura pura: no reserva nada. */
export async function consultarDisponibilidad(
  ctx: Contexto,
  consulta: ConsultaDisponibilidad,
): Promise<ResultadoDisponibilidad> {
  const servicio = servicioActivoOError(ctx, consulta.servicioId);
  const ahora = ctx.ahora();
  const dia = estadoDelDia(ctx.cfg, consulta.fecha);
  const base = {
    fecha: consulta.fecha,
    servicio: { id: servicio.id, nombre: servicio.nombre, duracion_min: servicio.duracion_min, precio: servicio.precio },
  };

  if (!dia.abierto) {
    return {
      ...base,
      abierto: false,
      motivo_cerrado: dia.motivo,
      horarios: [],
      horarios_sugeridos: [],
      total_disponibles: 0,
      proximos_dias_con_lugar: await diasConLugar(ctx, consulta.fecha, servicio),
    };
  }

  const { turnos, bloqueos } = await cargarAgendaDelDia(ctx.db, ctx, consulta.fecha);
  const libres = horariosDisponibles(ctx.cfg, consulta.fecha, servicio, {
    ahora,
    turnosOcupados: turnos,
    bloqueos,
    excluirTurnoId: consulta.excluirTurnoId,
    rango: consulta.rango ?? null,
    desdeHora: consulta.desdeHora ?? null,
    hastaHora: consulta.hastaHora ?? null,
    ignorarAnticipacion: consulta.ignorarAnticipacion ?? false,
  });

  return {
    ...base,
    abierto: true,
    motivo_cerrado: '',
    horarios: libres.map((h) => h.hora),
    horarios_sugeridos: repartirOpciones(libres, ctx.cfg.reglas.max_opciones_horarios).map((h) => h.hora),
    total_disponibles: libres.length,
    proximos_dias_con_lugar: libres.length ? [] : await diasConLugar(ctx, consulta.fecha, servicio),
  };
}

/** Proximos dias (a partir del siguiente) que tengan al menos un horario libre. */
async function diasConLugar(ctx: Contexto, desde: Fecha, servicio: Servicio, cantidad = 3): Promise<Fecha[]> {
  const zona = ctx.cfg.negocio.timezone;
  const ahora = ctx.ahora();
  const candidatos = proximosDiasAbiertos(ctx.cfg, fechaDe(DateTime.fromISO(desde, { zone: zona }).plus({ days: 1 })), 10);
  const salida: Fecha[] = [];
  for (const f of candidatos) {
    const { turnos, bloqueos } = await cargarAgendaDelDia(ctx.db, ctx, f);
    const libres = horariosDisponibles(ctx.cfg, f, servicio, { ahora, turnosOcupados: turnos, bloqueos });
    if (libres.length > 0) salida.push(f);
    if (salida.length >= cantidad) break;
  }
  return salida;
}

export async function turnosDeCliente(ctx: Contexto, telefono: string): Promise<Turno[]> {
  return turnosRepo.vigentesDeCliente(ctx.db, telefono, ctx.ahora().toMillis());
}

export async function turnoPorId(ctx: Contexto, id: string): Promise<Turno | null> {
  return turnosRepo.porId(ctx.db, id);
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

function servicioActivoOError(ctx: Contexto, id: string): Servicio {
  const s = servicioPorId(ctx.cfg, id);
  if (!s || !s.activo) throw errores.servicioInexistente(id);
  return s;
}

interface DatosTurnoNuevo {
  telefono: string;
  nombre: string;
  servicioId: string;
  fecha: Fecha;
  hora: Hora;
  origen: OrigenTurno;
  observaciones?: string;
  /** El panel del barbero puede saltear la anticipacion minima y el tope por cliente. */
  forzar?: boolean;
}

/**
 * Valida y construye un turno DENTRO de una transaccion ya serializada.
 * Todas las altas (hold, alta directa, reprogramacion) pasan por aca.
 */
async function validarYConstruir(
  tx: Transaccion,
  ctx: Contexto,
  datos: DatosTurnoNuevo,
  opciones: { estado: 'pendiente' | 'reservado'; excluirTurnoId?: string; holdVenceMs?: number | null },
): Promise<Turno> {
  const zona = ctx.cfg.negocio.timezone;
  const ahora = ctx.ahora();
  const ahoraMs = ahora.toMillis();
  const ahoraIso = ahora.toUTC().toISO()!;
  const servicio = servicioActivoOError(ctx, datos.servicioId);

  // Reservas temporales vencidas: se liberan antes de mirar la agenda.
  await turnosRepo.expirarHolds(tx, ahoraMs, ahoraIso);

  const { turnos, bloqueos } = await cargarAgendaDelDia(tx, ctx, datos.fecha);

  const check = horarioEsValido(ctx.cfg, datos.fecha, datos.hora, servicio, {
    ahora,
    turnosOcupados: turnos,
    bloqueos,
    excluirTurnoId: opciones.excluirTurnoId,
    ignorarAnticipacion: datos.forzar ?? false,
  });
  if (!check.ok) {
    switch (check.motivo) {
      case 'dia_cerrado':
        throw errores.diaCerrado(check.detalle);
      case 'fuera_de_horario':
        throw errores.fueraDeHorario(check.detalle);
      case 'ocupado':
        throw errores.horarioOcupado(check.detalle);
      case 'anticipacion':
        throw errores.anticipacionMinima(ctx.cfg.reglas.anticipacion_minima_min);
      case 'lejano':
        throw errores.demasiadoLejos(ctx.cfg.reglas.anticipacion_maxima_dias);
    }
  }

  if (!datos.forzar) {
    // Al reprogramar, el turno viejo ya fue cancelado en esta misma transaccion,
    // asi que no entra en la cuenta: no hace falta descontarlo.
    const vigentes = await turnosRepo.contarVigentesFuturos(tx, datos.telefono, ahoraMs);
    if (vigentes >= ctx.cfg.reglas.max_turnos_futuros_por_cliente) {
      throw errores.limiteTurnos(ctx.cfg.reglas.max_turnos_futuros_por_cliente);
    }
  }

  const inicio = desdeFechaHora(datos.fecha, datos.hora, zona);
  const fin = inicio.plus({ minutes: servicio.duracion_min });

  return {
    id: idTurno(),
    telefono: datos.telefono,
    nombreCliente: sanearNombre(datos.nombre ?? ''),
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    precio: servicio.precio,
    duracionMin: servicio.duracion_min,
    fecha: datos.fecha,
    horaInicio: horaDe(inicio),
    horaFin: horaDe(fin),
    inicioMs: inicio.toMillis(),
    finMs: fin.toMillis(),
    estado: opciones.estado,
    origen: datos.origen,
    holdVenceMs: opciones.holdVenceMs ?? null,
    observaciones: (datos.observaciones ?? '').slice(0, 500),
    creadoEn: ahoraIso,
    actualizadoEn: ahoraIso,
    canceladoEn: null,
    canceladoPor: null,
  };
}

/**
 * Traduce un choque de indice/restriccion del motor a un error de negocio.
 * Si dos procesos pasan la validacion a la vez, gana el que commitea primero y
 * el otro recibe esto: el cliente ve "se ocupó el horario", nunca un 500.
 */
function traducirErrorDeConcurrencia(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /UNIQUE constraint failed: turnos\.inicio_ms/i.test(msg) ||
    /turnos_sin_superposicion/i.test(msg) ||
    /idx_turnos_inicio_unico/i.test(msg) ||
    /duplicate key value/i.test(msg)
  ) {
    throw errores.horarioOcupado('colision detectada por la base de datos');
  }
  throw e;
}

async function programarRecordatorios(tx: Transaccion, ctx: Contexto, turno: Turno): Promise<void> {
  if (!ctx.cfg.recordatorios.activos) return;
  for (const aviso of ctx.cfg.recordatorios.avisos) {
    if (!aviso.activo) continue;
    const cuando = turno.inicioMs - aviso.horas_antes * 3_600_000;
    if (cuando <= ctx.ahora().toMillis()) continue; // el turno es demasiado pronto para ese aviso
    await recordatoriosRepo.programar(tx, turno.id, aviso.id, cuando);
  }
}

export interface ResultadoReserva {
  turno: Turno;
}

/**
 * Reserva temporal ("hold"): ocupa el horario mientras el cliente confirma.
 * Vence sola a los `reglas.hold_minutos`, asi un cliente que deja la
 * conversacion por la mitad no se queda el horario para siempre.
 */
export async function crearHold(ctx: Contexto, datos: Omit<DatosTurnoNuevo, 'origen'> & { origen?: OrigenTurno }): Promise<Turno> {
  const ahora = ctx.ahora();
  const venceMs = ahora.plus({ minutes: ctx.cfg.reglas.hold_minutos }).toMillis();
  try {
    return await ctx.db.transaccion(async (tx) => {
      await tx.bloquearAgenda();
      // Un cliente solo puede tener una reserva temporal a la vez.
      await turnosRepo.expirarHoldsDeCliente(tx, datos.telefono, ahora.toUTC().toISO()!);
      const turno = await validarYConstruir(tx, ctx, { ...datos, origen: datos.origen ?? 'whatsapp' }, {
        estado: 'pendiente',
        holdVenceMs: venceMs,
      });
      await turnosRepo.insertar(tx, turno);
      await eventosRepo.registrar(tx, 'hold_creado', {
        turnoId: turno.id,
        telefono: turno.telefono,
        detalle: `${turno.fecha} ${turno.horaInicio} ${turno.servicioId}`,
        ahoraMs: ahora.toMillis(),
      });
      return turno;
    });
  } catch (e) {
    traducirErrorDeConcurrencia(e);
  }
}

/** Pasa una reserva temporal a turno firme. Es el unico lugar donde un turno queda confirmado. */
export async function confirmarHold(
  ctx: Contexto,
  holdId: string,
  datos: { telefono: string; nombre?: string },
): Promise<Turno> {
  const ahora = ctx.ahora();
  const ahoraIso = ahora.toUTC().toISO()!;
  const turno = await ctx.db.transaccion(async (tx) => {
    await tx.bloquearAgenda();
    const actual = await turnosRepo.porId(tx, holdId);
    if (!actual) throw errores.turnoNoEncontrado();
    if (actual.telefono !== datos.telefono) throw errores.turnoNoEncontrado();
    if (actual.estado === 'reservado' || actual.estado === 'confirmado') return actual; // idempotente
    if (actual.estado !== 'pendiente') throw errores.holdVencido();
    if (actual.holdVenceMs !== null && actual.holdVenceMs <= ahora.toMillis()) {
      await turnosRepo.cambiarEstado(tx, actual.id, 'expirado', { ahoraIso, esperado: ['pendiente'] });
      throw errores.holdVencido();
    }

    const nombre = sanearNombre(datos.nombre ?? actual.nombreCliente);
    if (!nombre) throw errores.datosInvalidos('falta el nombre del cliente', '¿Me pasás tu nombre para confirmar?');

    const filas = await turnosRepo.cambiarEstado(tx, actual.id, 'reservado', {
      ahoraIso,
      esperado: ['pendiente'],
      holdVenceMs: null,
    });
    if (filas === 0) throw errores.holdVencido();
    await turnosRepo.actualizarDatos(tx, actual.id, { nombreCliente: nombre }, ahoraIso);

    await clientesRepo.registrar(tx, actual.telefono, nombre, ahoraIso);
    await clientesRepo.marcarVisita(tx, actual.telefono, ahoraIso);

    const confirmado: Turno = { ...actual, estado: 'reservado', nombreCliente: nombre, holdVenceMs: null, actualizadoEn: ahoraIso };
    await programarRecordatorios(tx, ctx, confirmado);
    await encolarParaSheets(tx, 'turno_alta', confirmado.id, ahora.toMillis());
    await eventosRepo.registrar(tx, 'turno_creado', {
      turnoId: confirmado.id,
      telefono: confirmado.telefono,
      detalle: `${confirmado.fecha} ${confirmado.horaInicio} ${confirmado.servicioId}`,
      ahoraMs: ahora.toMillis(),
    });
    return confirmado;
  });
  log.info({ turno: turno.id, fecha: turno.fecha, hora: turno.horaInicio }, 'turno confirmado');
  return turno;
}

/** Alta directa (panel del barbero, modo menu, tests): valida y confirma en un solo commit. */
export async function crearTurno(ctx: Contexto, datos: DatosTurnoNuevo): Promise<Turno> {
  const ahora = ctx.ahora();
  const ahoraIso = ahora.toUTC().toISO()!;
  try {
    const turno = await ctx.db.transaccion(async (tx) => {
      await tx.bloquearAgenda();
      const nuevo = await validarYConstruir(tx, ctx, datos, { estado: 'reservado' });
      if (!nuevo.nombreCliente) throw errores.datosInvalidos('falta el nombre del cliente', '¿Me pasás tu nombre?');
      await turnosRepo.insertar(tx, nuevo);
      await clientesRepo.registrar(tx, nuevo.telefono, nuevo.nombreCliente, ahoraIso);
      await clientesRepo.marcarVisita(tx, nuevo.telefono, ahoraIso);
      await programarRecordatorios(tx, ctx, nuevo);
      await encolarParaSheets(tx, 'turno_alta', nuevo.id, ahora.toMillis());
      await eventosRepo.registrar(tx, 'turno_creado', {
        turnoId: nuevo.id,
        telefono: nuevo.telefono,
        detalle: `${nuevo.fecha} ${nuevo.horaInicio} ${nuevo.servicioId} (${nuevo.origen})`,
        ahoraMs: ahora.toMillis(),
      });
      return nuevo;
    });
    log.info({ turno: turno.id, origen: turno.origen }, 'turno creado');
    return turno;
  } catch (e) {
    traducirErrorDeConcurrencia(e);
  }
}

export interface DatosModificacion {
  fecha?: Fecha;
  hora?: Hora;
  servicioId?: string;
  observaciones?: string;
  nombre?: string;
}

/**
 * Reprograma un turno. Internamente cancela el viejo y crea uno nuevo en la
 * misma transaccion, de modo que nunca quede el cliente sin turno si el horario
 * nuevo esta ocupado: o se mueve, o se queda como estaba.
 */
export async function modificarTurno(
  ctx: Contexto,
  turnoId: string,
  cambios: DatosModificacion,
  quien: { telefono?: string; origen: OrigenTurno; forzar?: boolean },
): Promise<Turno> {
  const ahora = ctx.ahora();
  const ahoraIso = ahora.toUTC().toISO()!;
  try {
    const turno = await ctx.db.transaccion(async (tx) => {
      await tx.bloquearAgenda();
      const actual = await turnosRepo.porId(tx, turnoId);
      if (!actual) throw errores.turnoNoEncontrado();
      // Un cliente solo puede tocar sus propios turnos.
      if (quien.telefono && actual.telefono !== quien.telefono) throw errores.turnoNoEncontrado();
      if (!ESTADOS_VIGENTES.includes(actual.estado)) throw errores.turnoNoEncontrado();

      const nuevaFecha = cambios.fecha ?? actual.fecha;
      const nuevaHora = cambios.hora ?? actual.horaInicio;
      const nuevoServicio = cambios.servicioId ?? actual.servicioId;
      const cambiaHorario = nuevaFecha !== actual.fecha || nuevaHora !== actual.horaInicio || nuevoServicio !== actual.servicioId;

      if (!cambiaHorario) {
        if (cambios.observaciones !== undefined || cambios.nombre !== undefined) {
          await turnosRepo.actualizarDatos(
            tx,
            actual.id,
            {
              ...(cambios.observaciones !== undefined ? { observaciones: cambios.observaciones.slice(0, 500) } : {}),
              ...(cambios.nombre !== undefined ? { nombreCliente: sanearNombre(cambios.nombre) } : {}),
            },
            ahoraIso,
          );
          await encolarParaSheets(tx, 'turno_cambio', actual.id, ahora.toMillis());
        }
        const refrescado = await turnosRepo.porId(tx, actual.id);
        return refrescado!;
      }

      // Se libera el horario viejo primero para poder reubicar dentro del mismo hueco.
      await turnosRepo.cambiarEstado(tx, actual.id, 'cancelado', {
        ahoraIso,
        esperado: ESTADOS_VIGENTES,
        canceladoPor: `reprogramado:${quien.origen}`,
      });
      await recordatoriosRepo.cancelarDeTurno(tx, actual.id);

      const nuevo = await validarYConstruir(
        tx,
        ctx,
        {
          telefono: actual.telefono,
          nombre: cambios.nombre ?? actual.nombreCliente,
          servicioId: nuevoServicio,
          fecha: nuevaFecha,
          hora: nuevaHora,
          origen: quien.origen,
          observaciones: cambios.observaciones ?? actual.observaciones,
          forzar: quien.forzar ?? false,
        },
        { estado: 'reservado', excluirTurnoId: actual.id },
      );
      await turnosRepo.insertar(tx, nuevo);
      await programarRecordatorios(tx, ctx, nuevo);
      await encolarParaSheets(tx, 'turno_baja', actual.id, ahora.toMillis());
      await encolarParaSheets(tx, 'turno_alta', nuevo.id, ahora.toMillis());
      await eventosRepo.registrar(tx, 'turno_modificado', {
        turnoId: nuevo.id,
        telefono: nuevo.telefono,
        detalle: `${actual.fecha} ${actual.horaInicio} -> ${nuevo.fecha} ${nuevo.horaInicio}`,
        ahoraMs: ahora.toMillis(),
      });
      return nuevo;
    });
    log.info({ turno: turno.id }, 'turno reprogramado');
    return turno;
  } catch (e) {
    traducirErrorDeConcurrencia(e);
  }
}

export async function cancelarTurno(
  ctx: Contexto,
  turnoId: string,
  quien: { telefono?: string; origen: OrigenTurno; motivo?: string; forzar?: boolean },
): Promise<Turno> {
  const ahora = ctx.ahora();
  const ahoraIso = ahora.toUTC().toISO()!;
  const turno = await ctx.db.transaccion(async (tx) => {
    await tx.bloquearAgenda();
    const actual = await turnosRepo.porId(tx, turnoId);
    if (!actual) throw errores.turnoNoEncontrado();
    if (quien.telefono && actual.telefono !== quien.telefono) throw errores.turnoNoEncontrado();
    if (actual.estado === 'cancelado') return actual; // idempotente
    if (!ESTADOS_VIGENTES.includes(actual.estado) && actual.estado !== 'pendiente') throw errores.turnoNoEncontrado();

    if (!quien.forzar && quien.origen !== 'panel') {
      const horasParaElTurno = (actual.inicioMs - ahora.toMillis()) / 3_600_000;
      if (horasParaElTurno < ctx.cfg.reglas.cancelacion_minima_horas) {
        throw errores.cancelacionTardia(ctx.cfg.reglas.cancelacion_minima_horas);
      }
    }

    await turnosRepo.cambiarEstado(tx, actual.id, 'cancelado', {
      ahoraIso,
      canceladoPor: quien.motivo ? `${quien.origen}:${quien.motivo.slice(0, 80)}` : quien.origen,
    });
    await recordatoriosRepo.cancelarDeTurno(tx, actual.id);
    await encolarParaSheets(tx, 'turno_baja', actual.id, ahora.toMillis());
    await eventosRepo.registrar(tx, 'turno_cancelado', {
      turnoId: actual.id,
      telefono: actual.telefono,
      detalle: `${actual.fecha} ${actual.horaInicio} por ${quien.origen}`,
      ahoraMs: ahora.toMillis(),
    });
    return { ...actual, estado: 'cancelado' as const, canceladoEn: ahoraIso, actualizadoEn: ahoraIso };
  });
  log.info({ turno: turno.id, origen: quien.origen }, 'turno cancelado');
  return turno;
}

// ---------------------------------------------------------------------------
// Bloqueos manuales
// ---------------------------------------------------------------------------

export async function bloquearHorario(
  ctx: Contexto,
  datos: { fecha: Fecha; desde?: Hora; hasta?: Hora; motivo?: string; diaCompleto?: boolean },
): Promise<Bloqueo> {
  const zona = ctx.cfg.negocio.timezone;
  const ahora = ctx.ahora();
  const diaCompleto = datos.diaCompleto || (!datos.desde && !datos.hasta);
  const desde = diaCompleto ? '00:00' : datos.desde!;
  const hasta = diaCompleto ? '23:59' : datos.hasta!;
  if (hasta <= desde) throw errores.datosInvalidos('el bloqueo termina antes de empezar', 'El horario del bloqueo está al revés.');

  const inicio = desdeFechaHora(datos.fecha, desde, zona);
  const fin = desdeFechaHora(datos.fecha, hasta, zona);
  const bloqueo: Bloqueo = {
    id: `BLQ-${idTurno().slice(4)}`,
    fecha: datos.fecha,
    horaInicio: desde,
    horaFin: hasta,
    inicioMs: inicio.toMillis(),
    finMs: fin.toMillis(),
    diaCompleto,
    motivo: (datos.motivo ?? '').slice(0, 200),
    creadoEn: ahora.toUTC().toISO()!,
  };

  return ctx.db.transaccion(async (tx) => {
    await tx.bloquearAgenda();
    // Aviso: si ya hay turnos ahi, el bloqueo se crea igual pero se informa,
    // porque el barbero puede querer bloquear y despues reubicar a mano.
    const choques = await turnosRepo.superpuestos(tx, bloqueo.inicioMs, bloqueo.finMs);
    await bloqueosRepo.insertar(tx, bloqueo);
    await eventosRepo.registrar(tx, 'bloqueo_creado', {
      detalle: `${bloqueo.fecha} ${bloqueo.horaInicio}-${bloqueo.horaFin} (${choques.length} turnos afectados)`,
      ahoraMs: ahora.toMillis(),
    });
    await encolarParaSheets(tx, 'refrescar_vistas', null, ahora.toMillis());
    return bloqueo;
  });
}

export async function quitarBloqueo(ctx: Contexto, id: string): Promise<boolean> {
  const ahora = ctx.ahora();
  return ctx.db.transaccion(async (tx) => {
    const filas = await bloqueosRepo.borrar(tx, id);
    if (filas > 0) {
      await eventosRepo.registrar(tx, 'bloqueo_borrado', { detalle: id, ahoraMs: ahora.toMillis() });
      await encolarParaSheets(tx, 'refrescar_vistas', null, ahora.toMillis());
    }
    return filas > 0;
  });
}

/** Turnos con choque contra un bloqueo: el panel los muestra para reubicarlos. */
export async function turnosAfectadosPorBloqueo(ctx: Contexto, bloqueo: Bloqueo): Promise<Turno[]> {
  return turnosRepo.superpuestos(ctx.db, bloqueo.inicioMs, bloqueo.finMs);
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export interface DiaDeAgenda {
  fecha: Fecha;
  abierto: boolean;
  motivo_cerrado: string;
  tramos: Array<[Hora, Hora]>;
  turnos: Turno[];
  bloqueos: Bloqueo[];
  huecos_libres: HorarioDisponible[];
}

export async function agendaDelDia(ctx: Contexto, fecha: Fecha, servicioParaHuecos?: string): Promise<DiaDeAgenda> {
  const dia = estadoDelDia(ctx.cfg, fecha);
  const [turnos, bloqueos] = await Promise.all([
    turnosRepo.porFecha(ctx.db, fecha),
    bloqueosRepo.porFecha(ctx.db, fecha),
  ]);
  const servicio = servicioParaHuecos ? servicioPorId(ctx.cfg, servicioParaHuecos) : serviciosActivos(ctx.cfg)[0];
  const huecos = servicio
    ? horariosDisponibles(ctx.cfg, fecha, servicio, {
        ahora: ctx.ahora(),
        turnosOcupados: turnos.filter((t) => ['pendiente', 'reservado', 'confirmado'].includes(t.estado)),
        bloqueos,
        ignorarAnticipacion: true,
      })
    : [];
  return {
    fecha,
    abierto: dia.abierto,
    motivo_cerrado: dia.motivo,
    tramos: dia.tramos,
    turnos,
    bloqueos,
    huecos_libres: huecos,
  };
}

export async function agendaSemanal(ctx: Contexto, desde?: Fecha): Promise<DiaDeAgenda[]> {
  const zona = ctx.cfg.negocio.timezone;
  const inicio = lunesDeLaSemana(desde ?? fechaDe(ctx.ahora()), zona);
  const fin = fechaDe(DateTime.fromISO(inicio, { zone: zona }).plus({ days: 6 }));
  const fechas = rangoDeFechas(inicio, fin, zona);
  const dias: DiaDeAgenda[] = [];
  for (const f of fechas) dias.push(await agendaDelDia(ctx, f));
  return dias;
}

/** Marca un turno como completado o como ausente. Solo desde el panel. */
export async function marcarEstadoTurno(
  ctx: Contexto,
  turnoId: string,
  estado: 'completado' | 'no_show',
): Promise<Turno> {
  const ahora = ctx.ahora();
  const ahoraIso = ahora.toUTC().toISO()!;
  return ctx.db.transaccion(async (tx) => {
    const actual = await turnosRepo.porId(tx, turnoId);
    if (!actual) throw errores.turnoNoEncontrado();
    // Se admite corregir un turno ya cerrado: el barbero puede haberse equivocado.
    const filas = await turnosRepo.cambiarEstado(tx, turnoId, estado, {
      ahoraIso,
      esperado: [...ESTADOS_VIGENTES, 'completado', 'no_show'],
    });
    if (filas === 0) {
      throw errores.datosInvalidos(
        `no se puede pasar de ${actual.estado} a ${estado}`,
        'Ese turno ya no está activo.',
      );
    }
    await recordatoriosRepo.cancelarDeTurno(tx, turnoId);
    await encolarParaSheets(tx, 'turno_cambio', turnoId, ahora.toMillis());
    await eventosRepo.registrar(tx, estado === 'completado' ? 'turno_completado' : 'turno_modificado', {
      turnoId,
      telefono: actual.telefono,
      detalle: `marcado como ${estado}`,
      ahoraMs: ahora.toMillis(),
    });
    return { ...actual, estado, actualizadoEn: ahoraIso };
  });
}

/**
 * Horas que se espera antes de dar por completado un turno pasado.
 * Da tiempo a que el barbero marque "no vino" desde el panel.
 */
const GRACIA_CIERRE_HORAS = 12;

/** Cierra turnos viejos: los marca como completados para que no queden colgados. */
export async function cerrarTurnosPasados(ctx: Contexto): Promise<number> {
  const ahora = ctx.ahora();
  const ahoraIso = ahora.toUTC().toISO()!;
  const pasados = await turnosRepo.pasadosSinCerrar(ctx.db, ahora.minus({ hours: GRACIA_CIERRE_HORAS }).toMillis());
  let n = 0;
  for (const t of pasados) {
    await ctx.db.transaccion(async (tx) => {
      const filas = await turnosRepo.cambiarEstado(tx, t.id, 'completado', { ahoraIso, esperado: ESTADOS_VIGENTES });
      if (filas > 0) {
        await encolarParaSheets(tx, 'turno_cambio', t.id, ahora.toMillis());
        await eventosRepo.registrar(tx, 'turno_completado', { turnoId: t.id, telefono: t.telefono, ahoraMs: ahora.toMillis() });
        n++;
      }
    });
  }
  return n;
}
