/**
 * Balance de la semana.
 *
 * Responde lo que el barbero quiere saber el domingo a la noche: cuánta gente
 * atendió, cuánto facturó, cuántos clientes nuevos entraron y cómo le fue
 * comparado con la semana anterior.
 *
 * Solo lee: no borra ni modifica nada. Se calcula SIEMPRE antes de la limpieza,
 * porque después los turnos de esa semana ya no están en la base.
 */
import { DateTime } from 'luxon';
import type { Contexto } from '../booking/servicio.js';
import { turnosRepo } from '../database/repositories/turnos.js';
import { bloqueosRepo } from '../database/repositories/bloqueos.js';
import { clientesRepo } from '../database/repositories/clientes.js';
import { estadoDelDia } from '../booking/disponibilidad.js';
import { desdeFechaHora, fechaDe, hhmmAMinutos, lunesDeLaSemana, nombreDia, rangoDeFechas } from '../shared/tiempo.js';
import { formatearPrecio } from '../shared/texto.js';
import type { Turno } from '../booking/tipos.js';

export interface ResumenPorServicio {
  servicio: string;
  cantidad: number;
  facturado: number;
}

export interface ResumenSemanal {
  desde: string;
  hasta: string;
  atendidos: number;
  facturado: number;
  /** true cuando hay servicios con precio en 0: la facturación está incompleta. */
  preciosIncompletos: boolean;
  clientes: number;
  clientesNuevos: number;
  clientesQueVolvieron: number;
  cancelados: number;
  noShow: number;
  ocupacion: number;
  minutosTrabajados: number;
  minutosDisponibles: number;
  porServicio: ResumenPorServicio[];
  diaMasFuerte: { dia: string; cantidad: number } | null;
  /**
   * Telefonos atendidos en la semana. Es interno: no se muestra ni se escribe
   * en la planilla. Sirve para que el balance mensual cuente personas
   * distintas aunque los turnos de esa semana ya se hayan borrado.
   */
  telefonos: string[];
  /** Diferencias contra la semana anterior, si hay resumen guardado. */
  comparacion: { atendidos: number; facturado: number; clientes: number } | null;
}

/** Estados que cuentan como "el cliente vino y se atendió". */
const ATENDIDOS = ['reservado', 'confirmado', 'completado'];

/**
 * Precio a considerar para un turno.
 *
 * Cada turno guarda el precio que tenia el servicio cuando se reservo, que es
 * lo correcto historicamente. Pero un precio en 0 no significa "gratis", sino
 * "todavia no lo cargaron": en ese caso se usa el precio actual del servicio,
 * asi el balance sirve desde la primera semana en que el barbero carga precios.
 */
function precioDelTurno(ctx: Contexto, turno: Turno): number {
  if (turno.precio > 0) return turno.precio;
  return ctx.cfg.servicios.find((s) => s.id === turno.servicioId)?.precio ?? 0;
}

/**
 * Capacidad de un día en minutos: los tramos de atención menos los bloqueos.
 * Si el barbero se bloqueó la tarde del martes, esa tarde no cuenta en contra
 * de la ocupación.
 */
function minutosDisponiblesDelDia(ctx: Contexto, fecha: string, bloqueos: Array<{ inicioMs: number; finMs: number }>): number {
  const dia = estadoDelDia(ctx.cfg, fecha);
  if (!dia.abierto) return 0;
  const zona = ctx.cfg.negocio.timezone;
  let total = 0;
  for (const [desde, hasta] of dia.tramos) {
    const inicioTramo = desdeFechaHora(fecha, desde, zona).toMillis();
    const finTramo = desdeFechaHora(fecha, hasta, zona).toMillis();
    let minutos = hhmmAMinutos(hasta) - hhmmAMinutos(desde);
    for (const b of bloqueos) {
      const solape = Math.min(finTramo, b.finMs) - Math.max(inicioTramo, b.inicioMs);
      if (solape > 0) minutos -= solape / 60_000;
    }
    total += Math.max(0, minutos);
  }
  return Math.round(total);
}

export interface OpcionesResumen {
  /** Lunes de la semana a resumir. Por defecto, la semana en curso. */
  desde?: string;
  /** Incluir turnos que todavía no sucedieron (para ver la semana en curso). */
  incluirFuturos?: boolean;
}

export async function calcularResumenSemanal(ctx: Contexto, opciones: OpcionesResumen = {}): Promise<ResumenSemanal> {
  const zona = ctx.cfg.negocio.timezone;
  const ahora = ctx.ahora();
  const desde = opciones.desde ?? lunesDeLaSemana(fechaDe(ahora), zona);
  const hasta = fechaDe(DateTime.fromISO(desde, { zone: zona }).plus({ days: 6 }));

  const turnos = await turnosRepo.porRangoDeFechas(ctx.db, desde, hasta);
  const bloqueos = await bloqueosRepo.porRangoDeFechas(ctx.db, desde, hasta);

  const yaPaso = (t: Turno) => opciones.incluirFuturos || t.finMs <= ahora.toMillis();
  const atendidos = turnos.filter((t) => ATENDIDOS.includes(t.estado) && yaPaso(t));
  const cancelados = turnos.filter((t) => t.estado === 'cancelado');
  const noShow = turnos.filter((t) => t.estado === 'no_show');

  const facturado = atendidos.reduce((suma, t) => suma + precioDelTurno(ctx, t), 0);
  const preciosIncompletos = atendidos.some((t) => precioDelTurno(ctx, t) <= 0);

  // Clientes: únicos por teléfono, y cuáles vinieron por primera vez esta semana.
  const telefonos = [...new Set(atendidos.map((t) => t.telefono))];
  let clientesNuevos = 0;
  for (const tel of telefonos) {
    const cliente = await clientesRepo.porTelefono(ctx.db, tel);
    const primera = cliente?.primeraVisita ? fechaDe(DateTime.fromISO(cliente.primeraVisita, { zone: 'utc' }).setZone(zona)) : null;
    if (primera && primera >= desde && primera <= hasta) clientesNuevos++;
  }

  // Ocupación: minutos vendidos sobre minutos disponibles.
  let minutosDisponibles = 0;
  for (const fecha of rangoDeFechas(desde, hasta, zona)) {
    minutosDisponibles += minutosDisponiblesDelDia(ctx, fecha, bloqueos.filter((b) => b.fecha === fecha));
  }
  const minutosTrabajados = atendidos.reduce((suma, t) => suma + t.duracionMin, 0);

  // Ranking de servicios.
  const porServicioMapa = new Map<string, ResumenPorServicio>();
  for (const t of atendidos) {
    const actual = porServicioMapa.get(t.servicioId) ?? { servicio: t.servicioNombre, cantidad: 0, facturado: 0 };
    actual.cantidad++;
    actual.facturado += precioDelTurno(ctx, t);
    porServicioMapa.set(t.servicioId, actual);
  }
  const porServicio = [...porServicioMapa.values()].sort((a, b) => b.cantidad - a.cantidad);

  // Día más fuerte.
  const porDia = new Map<string, number>();
  for (const t of atendidos) porDia.set(t.fecha, (porDia.get(t.fecha) ?? 0) + 1);
  let diaMasFuerte: ResumenSemanal['diaMasFuerte'] = null;
  for (const [fecha, cantidad] of porDia) {
    if (!diaMasFuerte || cantidad > diaMasFuerte.cantidad) {
      diaMasFuerte = { dia: nombreDia(DateTime.fromISO(fecha, { zone: zona })), cantidad };
    }
  }

  // Comparación con la semana anterior, si quedó guardada.
  const { resumenesRepo } = await import('../database/repositories/resumenes.js');
  const semanaAnterior = await resumenesRepo.porSemana(
    ctx.db,
    fechaDe(DateTime.fromISO(desde, { zone: zona }).minus({ days: 7 })),
  );

  return {
    desde,
    hasta,
    atendidos: atendidos.length,
    facturado,
    preciosIncompletos,
    clientes: telefonos.length,
    clientesNuevos,
    clientesQueVolvieron: telefonos.length - clientesNuevos,
    cancelados: cancelados.length,
    noShow: noShow.length,
    minutosTrabajados,
    minutosDisponibles,
    ocupacion: minutosDisponibles > 0 ? Math.round((minutosTrabajados / minutosDisponibles) * 100) : 0,
    porServicio,
    diaMasFuerte,
    telefonos,
    comparacion: semanaAnterior
      ? {
          atendidos: atendidos.length - semanaAnterior.atendidos,
          facturado: facturado - semanaAnterior.facturado,
          clientes: telefonos.length - semanaAnterior.clientes,
        }
      : null,
  };
}

const signo = (n: number) => (n > 0 ? `+${n}` : String(n));

/** El resumen escrito como se lo mandamos al barbero por WhatsApp. */
export function resumenComoTexto(r: ResumenSemanal, moneda = 'ARS'): string {
  const fmt = (f: string) => DateTime.fromISO(f).toFormat('dd/LL');
  const lineas: string[] = [`📊 Cómo te fue esta semana (${fmt(r.desde)} al ${fmt(r.hasta)})`, ''];

  if (r.atendidos === 0) {
    lineas.push('No hubo turnos atendidos esta semana.');
    if (r.cancelados > 0) lineas.push(`Se cancelaron ${r.cancelados}.`);
    return lineas.join('\n');
  }

  lineas.push(`✂️ ${r.atendidos} turno${r.atendidos === 1 ? '' : 's'} atendido${r.atendidos === 1 ? '' : 's'}`);
  lineas.push(
    `👥 ${r.clientes} cliente${r.clientes === 1 ? '' : 's'}` +
      (r.clientesNuevos > 0 ? `, ${r.clientesNuevos} nuevo${r.clientesNuevos === 1 ? '' : 's'}` : ''),
  );

  if (r.preciosIncompletos && r.facturado === 0) {
    lineas.push('💰 Cargá los precios en el panel y la próxima te digo cuánto facturaste');
  } else {
    lineas.push(`💰 ${formatearPrecio(r.facturado, moneda)} facturado${r.preciosIncompletos ? ' (hay servicios sin precio cargado)' : ''}`);
  }

  lineas.push(`📈 ${r.ocupacion}% de la agenda ocupada`);
  lineas.push('');

  if (r.porServicio[0]) lineas.push(`Lo más pedido: ${r.porServicio[0].servicio} (${r.porServicio[0].cantidad})`);
  if (r.diaMasFuerte) lineas.push(`Tu día más fuerte: ${r.diaMasFuerte.dia} (${r.diaMasFuerte.cantidad} turnos)`);

  if (r.cancelados > 0 || r.noShow > 0) {
    const partes: string[] = [];
    if (r.cancelados > 0) partes.push(`${r.cancelados} cancelado${r.cancelados === 1 ? '' : 's'}`);
    if (r.noShow > 0) partes.push(`${r.noShow} no vino`);
    lineas.push(`❌ ${partes.join(' · ')}`);
  }

  if (r.comparacion) {
    const c = r.comparacion;
    const partes = [`${signo(c.atendidos)} turnos`];
    if (!r.preciosIncompletos || c.facturado !== 0) {
      partes.push(`${c.facturado >= 0 ? '+' : '-'}${formatearPrecio(Math.abs(c.facturado), moneda)}`);
    }
    lineas.push('', `Contra la semana pasada: ${partes.join(', ')}`);
  }

  return lineas.join('\n');
}

/** Fila para la hoja "Resumen semanal" de Google Sheets. */
export function resumenComoFila(r: ResumenSemanal): string[] {
  return [
    `${r.desde} al ${r.hasta}`,
    String(r.atendidos),
    String(r.clientes),
    String(r.clientesNuevos),
    String(r.clientesQueVolvieron),
    r.facturado > 0 ? String(r.facturado) : 'sin precios cargados',
    `${r.ocupacion}%`,
    String(r.cancelados),
    String(r.noShow),
    r.porServicio[0]?.servicio ?? '',
    r.diaMasFuerte?.dia ?? '',
  ];
}

export const ENCABEZADOS_RESUMEN = [
  'Semana', 'Turnos atendidos', 'Clientes', 'Nuevos', 'Volvieron',
  'Facturado', 'Ocupación', 'Cancelados', 'No vinieron', 'Servicio más pedido', 'Día más fuerte',
];
