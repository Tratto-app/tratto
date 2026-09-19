/**
 * Motor de disponibilidad.
 *
 * Funciones puras: reciben la configuracion, los turnos que ocupan horario y
 * los bloqueos, y calculan que horarios se pueden ofrecer. No tocan la base de
 * datos, lo que las hace faciles de testear y de reutilizar (bot, panel, API).
 */
import { DateTime } from 'luxon';
import type { ConfigNegocio, Servicio } from '../config/negocio.js';
import {
  desdeFechaHora,
  fechaDe,
  hhmmAMinutos,
  horaDe,
  minutosAHhmm,
  rangoDeFechas,
  ventanaDeRango,
  type Fecha,
  type Hora,
  type RangoDelDia,
} from '../shared/tiempo.js';
import type { Bloqueo, HorarioDisponible, Turno } from './tipos.js';

export interface EstadoDelDia {
  fecha: Fecha;
  abierto: boolean;
  motivo: string;
  /** Tramos de atencion en hora local, ya resueltos (especiales incluidos). */
  tramos: Array<[Hora, Hora]>;
}

/** Resuelve si un dia esta abierto y con que tramos, aplicando toda la jerarquia. */
export function estadoDelDia(cfg: ConfigNegocio, fecha: Fecha): EstadoDelDia {
  const zona = cfg.negocio.timezone;
  const dt = DateTime.fromISO(fecha, { zone: zona });
  if (!dt.isValid) return { fecha, abierto: false, motivo: 'fecha inválida', tramos: [] };

  // 1. Vacaciones: mandan sobre todo lo demas.
  for (const v of cfg.horarios.vacaciones) {
    if (fecha >= v.desde && fecha <= v.hasta) {
      return { fecha, abierto: false, motivo: v.motivo || 'vacaciones', tramos: [] };
    }
  }

  // 2. Feriados.
  const feriado = cfg.horarios.feriados.find((f) => f.fecha === fecha);
  if (feriado) return { fecha, abierto: false, motivo: feriado.motivo || 'feriado', tramos: [] };

  // 3. Horario especial para ese dia puntual.
  const especial = cfg.horarios.horarios_especiales.find((h) => h.fecha === fecha);
  if (especial) {
    return {
      fecha,
      abierto: especial.tramos.length > 0,
      motivo: especial.motivo || 'horario especial',
      tramos: especial.tramos.map((t) => [t[0], t[1]] as [Hora, Hora]),
    };
  }

  // 4. Horario habitual del dia de la semana (1 = lunes ... 7 = domingo).
  const cfgDia = cfg.horarios.dias[String(dt.weekday) as '1'];
  if (!cfgDia || !cfgDia.abierto || cfgDia.tramos.length === 0) {
    return { fecha, abierto: false, motivo: 'día no laborable', tramos: [] };
  }
  return {
    fecha,
    abierto: true,
    motivo: '',
    tramos: cfgDia.tramos.map((t) => [t[0], t[1]] as [Hora, Hora]),
  };
}

export interface OpcionesDisponibilidad {
  ahora: DateTime;
  turnosOcupados: Turno[];
  bloqueos: Bloqueo[];
  /** Turno que se esta reprogramando: su horario actual no cuenta como ocupado. */
  excluirTurnoId?: string;
  /** Franja pedida por el cliente ("a la tarde"). */
  rango?: RangoDelDia;
  /** "después de las 17" */
  desdeHora?: Hora | null;
  hastaHora?: Hora | null;
  /** Ignora la anticipacion minima (lo usa el panel, para cargar a mano). */
  ignorarAnticipacion?: boolean;
}

/** Ventana de reserva permitida por las reglas de negocio, en epoch ms. */
export function ventanaDeReserva(cfg: ConfigNegocio, ahora: DateTime): { desdeMs: number; hastaMs: number } {
  const desdeMs = ahora.plus({ minutes: cfg.reglas.anticipacion_minima_min }).toMillis();
  const hastaMs = ahora.plus({ days: cfg.reglas.anticipacion_maxima_dias }).endOf('day').toMillis();
  return { desdeMs, hastaMs };
}

/**
 * Horarios disponibles para un servicio en un dia.
 *
 * Un horario se ofrece solo si:
 *  - el dia esta abierto y el turno entra completo dentro de un tramo;
 *  - no se superpone con ningun turno vivo (mas el margen configurado);
 *  - no se superpone con ningun bloqueo manual;
 *  - respeta la anticipacion minima y maxima;
 *  - respeta la franja pedida por el cliente, si pidio alguna.
 */
export function horariosDisponibles(
  cfg: ConfigNegocio,
  fecha: Fecha,
  servicio: Servicio,
  opciones: OpcionesDisponibilidad,
): HorarioDisponible[] {
  const zona = cfg.negocio.timezone;
  const dia = estadoDelDia(cfg, fecha);
  if (!dia.abierto) return [];

  const { ahora } = opciones;
  const hoy = fechaDe(ahora);
  if (fecha === hoy && !cfg.reglas.permite_reservar_mismo_dia) return [];
  if (fecha < hoy) return [];

  const ventana = ventanaDeReserva(cfg, ahora);
  const minimoMs = opciones.ignorarAnticipacion ? 0 : ventana.desdeMs;
  if (!opciones.ignorarAnticipacion && desdeFechaHora(fecha, '00:00', zona).toMillis() > ventana.hastaMs) return [];

  const duracion = servicio.duracion_min;
  const margen = cfg.reglas.margen_entre_turnos_min;
  const grilla = cfg.reglas.grilla_min;

  const ocupados = opciones.turnosOcupados.filter((t) => t.id !== opciones.excluirTurnoId);

  // Limites horarios pedidos por el cliente.
  const porRango = ventanaDeRango(opciones.rango ?? null);
  const limiteDesde = Math.max(
    porRango ? hhmmAMinutos(porRango.desde) : 0,
    opciones.desdeHora ? hhmmAMinutos(opciones.desdeHora) : 0,
  );
  const limiteHasta = Math.min(
    porRango ? hhmmAMinutos(porRango.hasta) : 24 * 60,
    opciones.hastaHora ? hhmmAMinutos(opciones.hastaHora) : 24 * 60,
  );

  const salida: HorarioDisponible[] = [];

  for (const [desde, hasta] of dia.tramos) {
    const tramoIni = hhmmAMinutos(desde);
    const tramoFin = hhmmAMinutos(hasta);

    // La grilla se ancla al inicio del tramo: 10:00, 10:15, 10:30...
    for (let m = tramoIni; m + duracion <= tramoFin; m += grilla) {
      if (m < limiteDesde || m >= limiteHasta) continue;

      const inicio = desdeFechaHora(fecha, minutosAHhmm(m), zona);
      const fin = inicio.plus({ minutes: duracion });
      const inicioMs = inicio.toMillis();
      const finMs = fin.toMillis();

      if (inicioMs < minimoMs) continue;
      if (!opciones.ignorarAnticipacion && inicioMs > ventana.hastaMs) continue;

      const chocaConTurno = ocupados.some(
        (t) => inicioMs < t.finMs + margen * 60_000 && t.inicioMs - margen * 60_000 < finMs,
      );
      if (chocaConTurno) continue;

      const chocaConBloqueo = opciones.bloqueos.some((b) => inicioMs < b.finMs && b.inicioMs < finMs);
      if (chocaConBloqueo) continue;

      salida.push({ hora: horaDe(inicio), inicioMs, finMs, horaFin: horaDe(fin) });
    }
  }

  return salida.sort((a, b) => a.inicioMs - b.inicioMs);
}

/**
 * De todos los horarios libres, elige unos pocos bien repartidos para ofrecerle
 * al cliente. Mandar 23 horarios por WhatsApp no ayuda a nadie.
 */
export function repartirOpciones(horarios: HorarioDisponible[], cantidad: number): HorarioDisponible[] {
  if (horarios.length <= cantidad) return horarios;
  const elegidos: HorarioDisponible[] = [];
  const paso = (horarios.length - 1) / (cantidad - 1);
  for (let i = 0; i < cantidad; i++) {
    const item = horarios[Math.round(i * paso)];
    if (item && !elegidos.some((e) => e.inicioMs === item.inicioMs)) elegidos.push(item);
  }
  return elegidos;
}

/** Verifica que un horario puntual siga libre. Es la validacion previa a reservar. */
export function horarioEsValido(
  cfg: ConfigNegocio,
  fecha: Fecha,
  hora: Hora,
  servicio: Servicio,
  opciones: OpcionesDisponibilidad,
): { ok: true } | { ok: false; motivo: 'dia_cerrado' | 'fuera_de_horario' | 'ocupado' | 'anticipacion' | 'lejano'; detalle: string } {
  const zona = cfg.negocio.timezone;
  const dia = estadoDelDia(cfg, fecha);
  if (!dia.abierto) return { ok: false, motivo: 'dia_cerrado', detalle: dia.motivo };

  const inicio = desdeFechaHora(fecha, hora, zona);
  const fin = inicio.plus({ minutes: servicio.duracion_min });
  const iniMin = hhmmAMinutos(hora);
  const finMin = iniMin + servicio.duracion_min;

  const entraEnTramo = dia.tramos.some(([d, h]) => iniMin >= hhmmAMinutos(d) && finMin <= hhmmAMinutos(h));
  if (!entraEnTramo) {
    return {
      ok: false,
      motivo: 'fuera_de_horario',
      detalle: `el turno ${hora}-${minutosAHhmm(finMin)} no entra en los tramos ${dia.tramos.map((t) => t.join('-')).join(' / ')}`,
    };
  }

  const inicioMs = inicio.toMillis();
  const finMs = fin.toMillis();
  const ventana = ventanaDeReserva(cfg, opciones.ahora);
  if (!opciones.ignorarAnticipacion) {
    if (inicioMs < ventana.desdeMs) {
      return { ok: false, motivo: 'anticipacion', detalle: `hay que reservar con ${cfg.reglas.anticipacion_minima_min} min de anticipación` };
    }
    if (inicioMs > ventana.hastaMs) {
      return { ok: false, motivo: 'lejano', detalle: `solo se reserva hasta ${cfg.reglas.anticipacion_maxima_dias} días adelante` };
    }
  }

  const margen = cfg.reglas.margen_entre_turnos_min * 60_000;
  const choque = opciones.turnosOcupados
    .filter((t) => t.id !== opciones.excluirTurnoId)
    .find((t) => inicioMs < t.finMs + margen && t.inicioMs - margen < finMs);
  if (choque) return { ok: false, motivo: 'ocupado', detalle: `se superpone con el turno ${choque.id}` };

  const bloqueo = opciones.bloqueos.find((b) => inicioMs < b.finMs && b.inicioMs < finMs);
  if (bloqueo) return { ok: false, motivo: 'ocupado', detalle: `horario bloqueado: ${bloqueo.motivo || 'sin motivo'}` };

  return { ok: true };
}

/** Proximos dias abiertos a partir de una fecha, para sugerir alternativas. */
export function proximosDiasAbiertos(cfg: ConfigNegocio, desde: Fecha, cantidad: number, maxDias = 30): Fecha[] {
  const zona = cfg.negocio.timezone;
  const fin = fechaDe(DateTime.fromISO(desde, { zone: zona }).plus({ days: maxDias }));
  const salida: Fecha[] = [];
  for (const f of rangoDeFechas(desde, fin, zona)) {
    if (estadoDelDia(cfg, f).abierto) salida.push(f);
    if (salida.length >= cantidad) break;
  }
  return salida;
}

/** Texto human-friendly con los horarios de atencion, para responder consultas. */
export function describirHorarios(cfg: ConfigNegocio): string {
  const nombres = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const lineas: string[] = [];
  const abiertos: Array<{ dia: number; clave: string }> = [];
  for (let d = 1; d <= 7; d++) {
    const cfgDia = cfg.horarios.dias[String(d) as '1'];
    const clave = cfgDia?.abierto ? cfgDia.tramos.map((t) => `${t[0]} a ${t[1]}`).join(' y ') : '';
    if (clave) abiertos.push({ dia: d, clave });
  }
  // Agrupa dias consecutivos con el mismo horario: "martes a sábado de 10 a 13 y de 15 a 20".
  let i = 0;
  while (i < abiertos.length) {
    let j = i;
    while (j + 1 < abiertos.length && abiertos[j + 1]!.clave === abiertos[i]!.clave && abiertos[j + 1]!.dia === abiertos[j]!.dia + 1) j++;
    const desde = nombres[abiertos[i]!.dia - 1];
    const hasta = nombres[abiertos[j]!.dia - 1];
    lineas.push(`${i === j ? desde : `${desde} a ${hasta}`}: ${abiertos[i]!.clave}`);
    i = j + 1;
  }
  const cerrados = nombres.filter((_, idx) => !abiertos.some((a) => a.dia === idx + 1));
  if (cerrados.length) lineas.push(`${cerrados.join(' y ')}: cerrado`);
  return lineas.join('\n');
}
