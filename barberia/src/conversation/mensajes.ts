/**
 * Mensajes al cliente que llevan los datos de un turno.
 *
 * Se arman acá, con los datos exactos que quedaron en la base, y no los
 * redacta la IA: el día, la hora, el servicio y el precio que lee el cliente
 * son siempre los mismos que ve el barbero. Los usan tanto la IA (el
 * orquestador reemplaza su texto por estos) como el menú sin IA.
 */
import { DateTime } from 'luxon';
import type { Contexto } from '../booking/servicio.js';
import type { Turno } from '../booking/tipos.js';
import { fechaHumana, fechaRelativaHumana } from '../shared/tiempo.js';
import { formatearPrecio } from '../shared/texto.js';

const mayuscula = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function lineaDia(ctx: Contexto, t: Turno): string {
  const zona = ctx.cfg.negocio.timezone;
  const dia = DateTime.fromISO(t.fecha, { zone: zona });
  const relativo = fechaRelativaHumana(dia, ctx.ahora().setZone(zona));
  const humano = mayuscula(fechaHumana(dia));
  return relativo === 'hoy' || relativo === 'mañana' ? `${humano} (${relativo})` : humano;
}

function lineaPrecio(ctx: Contexto, t: Turno): string {
  const moneda = ctx.cfg.negocio.moneda;
  if (t.precio <= 0) return '💵 Precio a confirmar';
  const precio = formatearPrecio(t.precio, moneda);
  return t.descuentoPorcentaje > 0 ? `💵 ${precio} (con tu ${t.descuentoPorcentaje}% de descuento 🎁)` : `💵 ${precio}`;
}

/** Ficha del turno: servicio, día, hora y precio, una cosa por línea. */
export function fichaDelTurno(ctx: Contexto, t: Turno, opciones: { conNombre?: boolean } = {}): string {
  const lineas = [`✂️ ${t.servicioNombre}`, `📅 ${lineaDia(ctx, t)}`, `🕐 ${t.horaInicio} hs`, lineaPrecio(ctx, t)];
  if (opciones.conNombre && t.nombreCliente) lineas.push(`👤 ${t.nombreCliente}`);
  return lineas.join('\n');
}

function lineaDireccion(ctx: Contexto): string {
  const n = ctx.cfg.negocio;
  if (!n.direccion) return '';
  return `📍 ${n.direccion}${n.como_llegar ? ` (${n.como_llegar})` : ''}`;
}

/** Horario apartado, esperando que el cliente confirme. */
export function mensajeApartado(ctx: Contexto, t: Turno): string {
  const minutos = ctx.cfg.reglas.hold_minutos;
  const pregunta = t.nombreCliente
    ? `¿Lo confirmo? Te lo guardo ${minutos} minutos.`
    : `Para confirmarlo, ¿me decís tu nombre? Te lo guardo ${minutos} minutos.`;
  return `Antes de confirmar, fijate que esté todo bien 👇\n\n${fichaDelTurno(ctx, t, { conNombre: true })}\n\n${pregunta}`;
}

/** Turno confirmado: queda en la agenda del barbero. */
export function mensajeConfirmado(ctx: Contexto, t: Turno): string {
  const saludo = t.nombreCliente ? `¡Listo, ${t.nombreCliente.split(' ')[0]}! ✅` : '¡Listo! ✅';
  const direccion = lineaDireccion(ctx);
  const cierre = politicaCorta(ctx);
  return [
    `${saludo} Tu turno quedó confirmado:`,
    '',
    fichaDelTurno(ctx, t),
    ...(direccion ? [direccion] : []),
    '',
    ...(cierre ? [cierre] : []),
    '¡Te esperamos! 💈',
  ].join('\n');
}

/** Turno cambiado de día u horario. */
export function mensajeModificado(ctx: Contexto, t: Turno): string {
  return ['Listo ✅ Tu turno quedó así:', '', fichaDelTurno(ctx, t), '', '¡Te esperamos! 💈'].join('\n');
}

/** Turno cancelado por el cliente. */
export function mensajeCancelado(ctx: Contexto, t: Turno): string {
  const zona = ctx.cfg.negocio.timezone;
  const dia = fechaHumana(DateTime.fromISO(t.fecha, { zone: zona }));
  return `Listo, cancelé tu turno del ${dia} a las ${t.horaInicio} ✅\n\nCuando quieras sacás otro por acá.`;
}

function politicaCorta(ctx: Contexto): string {
  const horas = ctx.cfg.reglas.cancelacion_minima_horas;
  if (horas <= 0) return 'Si necesitás cambiarlo o cancelarlo, escribime por acá.';
  return `Si necesitás cambiarlo o cancelarlo, escribime por acá hasta ${horas} ${horas === 1 ? 'hora' : 'horas'} antes.`;
}
