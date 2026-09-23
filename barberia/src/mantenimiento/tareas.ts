/**
 * Tareas de mantenimiento que corren solas en segundo plano.
 *
 * Son tres, y ninguna le escribe al cliente:
 *
 *  1. Liberar reservas temporales vencidas. Es la mas importante: sin esto, un
 *     cliente que abandona la conversacion a mitad de camino dejaria el horario
 *     bloqueado para siempre.
 *  2. Cerrar turnos que ya pasaron (pasan a "completado").
 *  3. Cierre semanal (los domingos): arma el balance de la semana y recien
 *     despues borra los turnos viejos. Ese orden no es casual: si se limpiara
 *     primero, no habria datos para contar. Solo borra lo que YA PASO; los
 *     turnos futuros y la ficha de los clientes no se tocan nunca.
 *
 * Los recordatorios por WhatsApp estan APAGADOS por decision del negocio
 * (`recordatorios.activos: false`). El codigo quedo por si algun dia se quieren
 * volver a prender, pero tal como esta la configuracion no se envia nada.
 */
import { DateTime } from 'luxon';
import type { Contexto } from '../booking/servicio.js';
import { cerrarTurnosPasados } from '../booking/servicio.js';
import { recordatoriosRepo } from '../database/repositories/recordatorios.js';
import { turnosRepo } from '../database/repositories/turnos.js';
import { conversacionesRepo, mensajesRepo } from '../database/repositories/conversaciones.js';
import { eventosRepo } from '../database/repositories/eventos.js';
import { ESTADOS_VIGENTES, type Turno } from '../booking/tipos.js';
import { beneficiosRepo } from '../database/repositories/beneficios.js';
import { env } from '../config/env.js';
import { log, enmascararTelefono } from '../shared/log.js';
import { whatsapp } from '../whatsapp/cliente.js';
import { fechaDe, fechaHumana, hhmmAMinutos, lunesDeLaSemana } from '../shared/tiempo.js';
import { calcularResumenSemanal, resumenComoTexto, type ResumenSemanal } from '../reportes/semanal.js';
import { resumenesRepo } from '../database/repositories/resumenes.js';
import { guardarResumenEnPlanilla, guardarResumenMensualEnPlanilla } from '../google/planilla.js';
import { calcularResumenMensual, mesPendienteDeCerrar, resumenMensualComoTexto, type ResumenMensual } from '../reportes/mensual.js';
import { resumenesMensualesRepo } from '../database/repositories/resumenes.js';
import { avisarAlBarbero } from '../whatsapp/avisos.js';

const PLANTILLA = process.env.WHATSAPP_PLANTILLA_RECORDATORIO ?? '';
const PLANTILLA_RESENA = process.env.WHATSAPP_PLANTILLA_RESENA ?? '';
const IDIOMA_PLANTILLA = process.env.WHATSAPP_PLANTILLA_IDIOMA ?? 'es_AR';

/** Meta rechaza el texto libre fuera de la ventana de 24 h con estos códigos. */
const FUERA_DE_VENTANA = /131047|131026|re-?engagement/i;

/** ¿Estamos dentro del horario permitido para mandar avisos? */
function horaEducada(ctx: Contexto, ahora: DateTime): boolean {
  const minutos = ahora.hour * 60 + ahora.minute;
  const desde = hhmmAMinutos(ctx.cfg.recordatorios.no_enviar_antes_de);
  const hasta = hhmmAMinutos(ctx.cfg.recordatorios.no_enviar_despues_de);
  return minutos >= desde && minutos <= hasta;
}

/**
 * Texto del pedido de resena, con el link a Google Maps y el descuento.
 *
 * Google no ofrece forma de verificar por API si alguien dejo una resena, asi
 * que el descuento se carga cuando el cliente avisa. Desde el panel el barbero
 * puede sacarlo si ve que no es cierto.
 */
export function mensajeDeResena(ctx: Contexto, nombre: string): string {
  const cfg = ctx.cfg.resenas;
  return cfg.mensaje
    .replace(/\{nombre\}/g, nombre || 'Hola')
    .replace(/\{link\}/g, cfg.link_google_maps)
    .replace(/\{descuento\}/g, String(cfg.descuento_porcentaje));
}

export async function enviarRecordatoriosPendientes(ctx: Contexto): Promise<{ enviados: number; omitidos: number }> {
  const salida = { enviados: 0, omitidos: 0 };
  const ahora = ctx.ahora();
  if (!horaEducada(ctx, ahora)) return salida;

  const pendientes = await recordatoriosRepo.vencidos(ctx.db, ahora.toMillis());
  for (const r of pendientes) {
    const esResena = r.avisoId === 'resena';
    if (esResena ? !ctx.cfg.resenas.activo : !ctx.cfg.recordatorios.activos) continue;

    const turno = await turnosRepo.porId(ctx.db, r.turnoId);
    // El aviso de 24 h se manda antes del turno; el de resena, despues.
    const sirve = esResena
      ? turno && ['reservado', 'confirmado', 'completado'].includes(turno.estado) && turno.finMs <= ahora.toMillis()
      : turno && ESTADOS_VIGENTES.includes(turno.estado) && turno.inicioMs >= ahora.toMillis();
    if (!turno || !sirve) {
      await recordatoriosRepo.tomar(ctx.db, r.turnoId, r.avisoId, ahora.toUTC().toISO()!);
      salida.omitidos++;
      continue;
    }

    // Se toma el recordatorio ANTES de enviar: si hay dos instancias del
    // backend, solo una se lo queda y el cliente recibe un unico aviso.
    const meLoQuedo = await recordatoriosRepo.tomar(ctx.db, r.turnoId, r.avisoId, ahora.toUTC().toISO()!);
    if (!meLoQuedo) continue;

    const dia = DateTime.fromISO(`${turno.fecha}T${turno.horaInicio}`, { zone: ctx.cfg.negocio.timezone });
    try {
      if (esResena) {
        await enviarPedidoDeResena(ctx, turno);
        salida.enviados++;
        log.info({ turno: turno.id, cliente: enmascararTelefono(turno.telefono) }, 'pedido de reseña enviado');
        continue;
      }
      if (PLANTILLA) {
        await whatsapp.enviarPlantilla(turno.telefono, PLANTILLA, IDIOMA_PLANTILLA, [
          turno.nombreCliente || 'Hola',
          fechaHumana(dia),
          turno.horaInicio,
          turno.servicioNombre,
        ]);
      } else {
        await whatsapp.enviarTexto(
          turno.telefono,
          `Hola ${turno.nombreCliente || ''} 👋 Te recordamos tu turno:\n\n✂️ ${turno.servicioNombre}\n📅 ${fechaHumana(dia)}\n🕐 ${turno.horaInicio}\n\n¿Seguís viniendo? Si no podés, avisame por acá y lo cambiamos 🙌`.replace(
            '  ',
            ' ',
          ),
        );
      }
      salida.enviados++;
      log.info({ turno: turno.id, aviso: r.avisoId, cliente: enmascararTelefono(turno.telefono) }, 'recordatorio enviado');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      await recordatoriosRepo.marcarError(ctx.db, r.turnoId, r.avisoId, mensaje);
      log.error({ turno: turno.id, err: mensaje }, 'no se pudo enviar el recordatorio');
    }
  }
  return salida;
}

/**
 * Borra de la base los turnos que ya terminaron hace mas de
 * `cierre_semanal.conservar_dias`.
 *
 * La planilla de Google NO se toca: ahi queda el historial completo. La base de
 * datos es la semana en curso; Drive es el archivo.
 */
export async function limpiarTurnosViejos(ctx: Contexto): Promise<number> {
  if (!ctx.cfg.cierre_semanal.activo) return 0;
  const limite = ctx.ahora().minus({ days: ctx.cfg.cierre_semanal.conservar_dias });
  const borrados = await ctx.db.transaccion(async (tx) => {
    await tx.bloquearAgenda();
    // Primero los avisos asociados, para no dejar filas huerfanas.
    await tx.exec('DELETE FROM recordatorios WHERE turno_id IN (SELECT id FROM turnos WHERE fin_ms < ?)', [limite.toMillis()]);
    return turnosRepo.borrarPasadosAnterioresA(tx, limite.toMillis());
  });
  if (borrados > 0) {
    log.info({ borrados, anterioresA: limite.toISODate() }, 'limpieza: turnos viejos borrados de la base');
    await eventosRepo.registrar(ctx.db, 'limpieza', {
      detalle: `${borrados} turno(s) anteriores al ${limite.toISODate()}`,
      ahoraMs: ctx.ahora().toMillis(),
    });
  }
  return borrados;
}

export interface ResultadoCierre {
  corrio: boolean;
  motivo?: string;
  resumen?: ResumenSemanal;
  /** Se arma solo en el primer cierre de cada mes, con el mes que quedo atras. */
  resumenMensual?: ResumenMensual;
  turnosBorrados?: number;
  avisado?: boolean;
}

/**
 * Cierra el mes anterior si quedo pendiente.
 *
 * Se dispara en el primer cierre semanal de cada mes: para entonces ya estan
 * guardados todos los balances de las semanas que terminaron en el mes que
 * paso, que es de donde sale el numero mensual.
 */
async function cerrarMesSiCorresponde(ctx: Contexto): Promise<ResumenMensual | undefined> {
  const ahora = ctx.ahora();
  const mes = await mesPendienteDeCerrar(ctx, ahora);
  if (!mes) return undefined;

  const resumen = await calcularResumenMensual(ctx, mes);
  await resumenesMensualesRepo.guardar(ctx.db, resumen, ahora.toUTC().toISO()!);
  try {
    await guardarResumenMensualEnPlanilla(ctx, resumen);
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : e }, 'no se pudo escribir el balance mensual en la planilla');
  }
  log.info({ mes, atendidos: resumen.atendidos, personas: resumen.personas }, 'balance mensual cerrado');
  return resumen;
}

/**
 * Cierre de semana.
 *
 * El orden importa y es el unico posible:
 *   1. calcular el balance con los turnos todavia en la base;
 *   2. guardarlo (en la base y en Google Sheets, que es lo permanente);
 *   3. avisarle al barbero;
 *   4. recien ahi borrar los turnos viejos.
 *
 * Es idempotente: si el proceso se reinicia el domingo a la noche, no vuelve a
 * mandar el resumen, porque ya quedo guardado el de esa semana.
 */
export async function cierreSemanal(ctx: Contexto, opciones: { forzar?: boolean } = {}): Promise<ResultadoCierre> {
  const cfg = ctx.cfg.cierre_semanal;
  if (!cfg.activo) return { corrio: false, motivo: 'desactivado' };

  const ahora = ctx.ahora();
  if (!opciones.forzar) {
    if (ahora.weekday !== cfg.dia) return { corrio: false, motivo: 'no es el dia del cierre' };
    const minutosAhora = ahora.hour * 60 + ahora.minute;
    if (minutosAhora < hhmmAMinutos(cfg.hora)) return { corrio: false, motivo: 'todavia es temprano' };
  }

  const semana = lunesDeLaSemana(fechaDe(ahora), ctx.cfg.negocio.timezone);
  if (!opciones.forzar && (await resumenesRepo.porSemana(ctx.db, semana))) {
    return { corrio: false, motivo: 'el cierre de esta semana ya se hizo' };
  }

  // 1 y 2: calcular y guardar, antes de borrar nada.
  const resumen = await calcularResumenSemanal(ctx, { desde: semana });
  await resumenesRepo.guardar(ctx.db, resumen, ahora.toUTC().toISO()!);
  await eventosRepo.registrar(ctx.db, 'cierre_semanal', {
    detalle: `${resumen.desde}: ${resumen.atendidos} turnos, ${resumen.clientes} clientes`,
    ahoraMs: ahora.toMillis(),
  });

  try {
    await guardarResumenEnPlanilla(ctx, resumen);
  } catch (e) {
    // Que falle Google no puede frenar el cierre: el resumen ya esta guardado.
    log.warn({ err: e instanceof Error ? e.message : e }, 'no se pudo escribir el resumen en la planilla');
  }

  // 3: cerrar el mes si el que paso quedo completo, y avisarle al barbero.
  const resumenMensual = await cerrarMesSiCorresponde(ctx);

  let avisado = false;
  if (cfg.avisar_al_barbero) {
    const texto = resumenMensual
      ? `${resumenComoTexto(resumen, ctx.cfg.negocio.moneda)}\n\n———\n\n${resumenMensualComoTexto(resumenMensual, ctx.cfg.negocio.moneda)}`
      : resumenComoTexto(resumen, ctx.cfg.negocio.moneda);
    avisado = await avisarAlBarbero(texto);
  }

  // 4: ahora si, la limpieza.
  const turnosBorrados = await limpiarTurnosViejos(ctx);

  log.info(
    { semana: resumen.desde, atendidos: resumen.atendidos, clientes: resumen.clientes, turnosBorrados, avisado },
    'cierre semanal hecho',
  );
  return { corrio: true, resumen, ...(resumenMensual ? { resumenMensual } : {}), turnosBorrados, avisado };
}

/**
 * Manda el pedido de resena y deja anotado en la conversacion que estamos
 * esperando la respuesta, para reconocer el "ya la dejé" que venga despues.
 */
async function enviarPedidoDeResena(ctx: Contexto, turno: Turno): Promise<void> {
  const texto = mensajeDeResena(ctx, turno.nombreCliente);
  try {
    await whatsapp.enviarBotones(turno.telefono, texto, [{ id: 'resena_hecha', titulo: '✅ Ya la dejé' }]);
  } catch (e) {
    // El pedido sale una hora despues del corte, y para entonces la ventana de
    // 24 h de WhatsApp suele estar cerrada (el cliente reservo dias antes). En
    // ese caso hace falta una plantilla aprobada por Meta.
    const mensaje = e instanceof Error ? e.message : String(e);
    if (!FUERA_DE_VENTANA.test(mensaje) || !PLANTILLA_RESENA) throw e;
    log.info({ turno: turno.id }, 'ventana de 24 h cerrada: el pedido de reseña sale por plantilla');
    await whatsapp.enviarPlantilla(turno.telefono, PLANTILLA_RESENA, IDIOMA_PLANTILLA, [
      turno.nombreCliente || 'Hola',
      ctx.cfg.resenas.link_google_maps,
      String(ctx.cfg.resenas.descuento_porcentaje),
    ]);
  }

  const ahora = ctx.ahora();
  const conv = await conversacionesRepo.obtener(ctx.db, turno.telefono);
  (conv.estado as Record<string, unknown>).esperandoResena = { turnoId: turno.id, ts: ahora.toMillis() };
  await conversacionesRepo.guardar(ctx.db, conv, ahora.toUTC().toISO()!);
}

/** Tareas de limpieza: holds vencidos, turnos pasados, tablas de control. */
export async function mantenimiento(ctx: Contexto): Promise<void> {
  const ahora = ctx.ahora();
  const ahoraIso = ahora.toUTC().toISO()!;
  try {
    const expirados = await ctx.db.transaccion(async (tx) => {
      await tx.bloquearAgenda();
      return turnosRepo.expirarHolds(tx, ahora.toMillis(), ahoraIso);
    });
    if (expirados > 0) {
      await eventosRepo.registrar(ctx.db, 'hold_expirado', { detalle: `${expirados} reserva(s) temporal(es)`, ahoraMs: ahora.toMillis() });
    }
    const cerrados = await cerrarTurnosPasados(ctx);
    if (cerrados > 0) log.info({ cerrados }, 'turnos pasados marcados como completados');

    const vencidos = await beneficiosRepo.vencerViejos(ctx.db, ahora.toMillis(), ahoraIso);
    if (vencidos > 0) log.info({ vencidos }, 'descuentos vencidos');

    await cierreSemanal(ctx);

    // Las tablas de control no crecen para siempre.
    await mensajesRepo.limpiarViejos(ctx.db, ahora.minus({ days: 7 }).toMillis());
    await eventosRepo.limpiarViejos(ctx.db, ahora.minus({ days: 180 }).toMillis());
  } catch (e) {
    log.error({ err: e instanceof Error ? e.message : e }, 'fallo una tarea de mantenimiento');
  }
}

/**
 * Arranca el worker de mantenimiento.
 *
 * Corre SIEMPRE, incluso con los recordatorios apagados: liberar las reservas
 * temporales vencidas no es opcional, sin eso la agenda se tapa sola.
 */
export function arrancarWorkerDeMantenimiento(ctx: Contexto): { detener: () => void } {
  let corriendo = false;
  let ultimoMantenimientoMs = 0;

  const tick = async () => {
    if (corriendo) return;
    corriendo = true;
    try {
      if (env.RECORDATORIOS_HABILITADOS && (ctx.cfg.recordatorios.activos || ctx.cfg.resenas.activo)) {
        await enviarRecordatoriosPendientes(ctx);
      }
      const ahoraMs = Date.now();
      if (ahoraMs - ultimoMantenimientoMs > 10 * 60_000) {
        ultimoMantenimientoMs = ahoraMs;
        await mantenimiento(ctx);
      }
    } catch (e) {
      log.error({ err: e instanceof Error ? e.message : e }, 'fallo el ciclo de mantenimiento');
    } finally {
      corriendo = false;
    }
  };

  const intervalo = setInterval(() => void tick(), 60_000);
  intervalo.unref?.();
  void tick();
  log.info(
    {
      recordatorios: env.RECORDATORIOS_HABILITADOS && ctx.cfg.recordatorios.activos,
      cierreSemanal: ctx.cfg.cierre_semanal.activo
        ? `${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][ctx.cfg.cierre_semanal.dia - 1]} ${ctx.cfg.cierre_semanal.hora}`
        : 'desactivado',
    },
    'worker de mantenimiento iniciado',
  );
  return { detener: () => clearInterval(intervalo) };
}
