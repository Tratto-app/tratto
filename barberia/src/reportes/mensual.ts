/**
 * Balance del mes.
 *
 * No se calcula desde los turnos, porque a fin de mes ya fueron borrados por
 * el cierre semanal: se arma sumando los resúmenes semanales guardados.
 *
 * Criterio para decidir a qué mes pertenece una semana: **el mes en que la
 * semana termina**. Una semana que va del 28/09 al 04/10 cuenta en octubre.
 * Así cada semana cae en un solo mes: no se cuenta dos veces ni se pierde.
 */
import { DateTime } from 'luxon';
import type { Contexto } from '../booking/servicio.js';
import { resumenesRepo } from '../database/repositories/resumenes.js';
import { nombreMes } from '../shared/tiempo.js';
import { formatearPrecio } from '../shared/texto.js';
import type { ResumenSemanal } from './semanal.js';

export interface ResumenMensual {
  /** YYYY-MM */
  mes: string;
  nombre: string;
  semanas: number;
  atendidos: number;
  facturado: number;
  preciosIncompletos: boolean;
  personas: number;
  clientesNuevos: number;
  cancelados: number;
  noShow: number;
  ocupacion: number;
  servicioMasPedido: string;
  mejorSemana: { desde: string; hasta: string; atendidos: number } | null;
  comparacion: { atendidos: number; facturado: number } | null;
}

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

function mesAnterior(mes: string): string {
  return DateTime.fromISO(`${mes}-01`).minus({ months: 1 }).toFormat('yyyy-LL');
}

/** Junta varios resúmenes semanales en uno mensual. */
export function agregarSemanas(mes: string, semanas: ResumenSemanal[], anterior?: ResumenMensual | null): ResumenMensual {
  const nombre = nombreMes(DateTime.fromISO(`${mes}-01`));
  const base: ResumenMensual = {
    mes,
    nombre,
    semanas: semanas.length,
    atendidos: 0,
    facturado: 0,
    preciosIncompletos: false,
    personas: 0,
    clientesNuevos: 0,
    cancelados: 0,
    noShow: 0,
    ocupacion: 0,
    servicioMasPedido: '',
    mejorSemana: null,
    comparacion: null,
  };
  if (semanas.length === 0) return base;

  const personas = new Set<string>();
  const porServicio = new Map<string, number>();
  let minutosTrabajados = 0;
  let minutosDisponibles = 0;

  for (const s of semanas) {
    base.atendidos += s.atendidos;
    base.facturado += s.facturado;
    base.clientesNuevos += s.clientesNuevos;
    base.cancelados += s.cancelados;
    base.noShow += s.noShow;
    base.preciosIncompletos = base.preciosIncompletos || s.preciosIncompletos;
    minutosTrabajados += s.minutosTrabajados;
    minutosDisponibles += s.minutosDisponibles;
    for (const tel of s.telefonos ?? []) personas.add(tel);
    for (const serv of s.porServicio) porServicio.set(serv.servicio, (porServicio.get(serv.servicio) ?? 0) + serv.cantidad);
    if (!base.mejorSemana || s.atendidos > base.mejorSemana.atendidos) {
      base.mejorSemana = { desde: s.desde, hasta: s.hasta, atendidos: s.atendidos };
    }
  }

  base.personas = personas.size;
  base.ocupacion = minutosDisponibles > 0 ? Math.round((minutosTrabajados / minutosDisponibles) * 100) : 0;
  base.servicioMasPedido = [...porServicio.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  if (anterior) {
    base.comparacion = { atendidos: base.atendidos - anterior.atendidos, facturado: base.facturado - anterior.facturado };
  }
  return base;
}

export async function calcularResumenMensual(ctx: Contexto, mes: string): Promise<ResumenMensual> {
  const { resumenesMensualesRepo } = await import('../database/repositories/resumenes.js');
  const todas = await resumenesRepo.ultimos(ctx.db, 60);
  const delMes = todas.filter((s) => mesDe(s.hasta) === mes).sort((a, b) => a.desde.localeCompare(b.desde));
  const anterior = await resumenesMensualesRepo.porMes(ctx.db, mesAnterior(mes));
  return agregarSemanas(mes, delMes, anterior);
}

/** ¿Hay un mes cerrado que todavía no se reportó? Devuelve cuál. */
export async function mesPendienteDeCerrar(ctx: Contexto, hoy: DateTime): Promise<string | null> {
  const { resumenesMensualesRepo } = await import('../database/repositories/resumenes.js');
  const mesPasado = mesAnterior(hoy.toFormat('yyyy-LL'));
  if (await resumenesMensualesRepo.porMes(ctx.db, mesPasado)) return null;
  const semanas = await resumenesRepo.ultimos(ctx.db, 60);
  return semanas.some((s) => mesDe(s.hasta) === mesPasado) ? mesPasado : null;
}

export function resumenMensualComoTexto(r: ResumenMensual, moneda = 'ARS'): string {
  const lineas: string[] = [`📅 Balance de ${r.nombre}`, ''];
  if (r.atendidos === 0) {
    lineas.push('No hubo turnos atendidos en el mes.');
    return lineas.join('\n');
  }

  lineas.push(`✂️ ${r.atendidos} turnos en ${r.semanas} semana${r.semanas === 1 ? '' : 's'}`);
  lineas.push(`👥 ${r.personas} persona${r.personas === 1 ? '' : 's'} distinta${r.personas === 1 ? '' : 's'}` + (r.clientesNuevos ? `, ${r.clientesNuevos} nueva${r.clientesNuevos === 1 ? '' : 's'}` : ''));
  if (r.facturado > 0) {
    lineas.push(`💰 ${formatearPrecio(r.facturado, moneda)} facturado${r.preciosIncompletos ? ' (hay servicios sin precio)' : ''}`);
  }
  lineas.push(`📈 ${r.ocupacion}% de agenda ocupada`);
  lineas.push('');
  if (r.servicioMasPedido) lineas.push(`Lo más pedido: ${r.servicioMasPedido}`);
  if (r.mejorSemana) {
    const fmt = (f: string) => DateTime.fromISO(f).toFormat('dd/LL');
    lineas.push(`Tu mejor semana: ${fmt(r.mejorSemana.desde)} al ${fmt(r.mejorSemana.hasta)} (${r.mejorSemana.atendidos} turnos)`);
  }
  if (r.cancelados || r.noShow) lineas.push(`❌ ${r.cancelados} cancelados · ${r.noShow} no vinieron`);
  if (r.comparacion) {
    const c = r.comparacion;
    const partes = [`${c.atendidos >= 0 ? '+' : ''}${c.atendidos} turnos`];
    if (r.facturado > 0) partes.push(`${c.facturado >= 0 ? '+' : '-'}${formatearPrecio(Math.abs(c.facturado), moneda)}`);
    lineas.push('', `Contra el mes anterior: ${partes.join(', ')}`);
  }
  return lineas.join('\n');
}

export const ENCABEZADOS_MENSUAL = [
  'Mes', 'Turnos', 'Personas distintas', 'Nuevos', 'Facturado', 'Ocupación',
  'Cancelados', 'No vinieron', 'Servicio más pedido', 'Mejor semana',
];

export function resumenMensualComoFila(r: ResumenMensual): string[] {
  return [
    `${r.mes} (${r.nombre})`,
    String(r.atendidos),
    String(r.personas),
    String(r.clientesNuevos),
    r.facturado > 0 ? String(r.facturado) : 'sin precios cargados',
    `${r.ocupacion}%`,
    String(r.cancelados),
    String(r.noShow),
    r.servicioMasPedido,
    r.mejorSemana ? `${r.mejorSemana.desde} (${r.mejorSemana.atendidos})` : '',
  ];
}
