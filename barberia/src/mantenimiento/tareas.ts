/**
 * Tareas de mantenimiento que corren solas en segundo plano.
 *
 * Son tres, y ninguna le escribe al cliente:
 *
 *  1. Liberar reservas temporales vencidas. Es la mas importante: sin esto, un
 *     cliente que abandona la conversacion a mitad de camino dejaria el horario
 *     bloqueado para siempre.
 *  2. Cerrar turnos que ya pasaron (pasan a "completado").
 *  3. Limpieza semanal: borrar de la base los turnos viejos, para que arranque
 *     la semana liviana. Solo borra lo que YA PASO; los turnos futuros y la
 *     ficha de los clientes no se tocan nunca.
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
import { mensajesRepo } from '../database/repositories/conversaciones.js';
import { eventosRepo } from '../database/repositories/eventos.js';
import { ESTADOS_VIGENTES } from '../booking/tipos.js';
import { env } from '../config/env.js';
import { log, enmascararTelefono } from '../shared/log.js';
import { whatsapp } from '../whatsapp/cliente.js';
import { fechaHumana, hhmmAMinutos } from '../shared/tiempo.js';

const PLANTILLA = process.env.WHATSAPP_PLANTILLA_RECORDATORIO ?? '';
const IDIOMA_PLANTILLA = process.env.WHATSAPP_PLANTILLA_IDIOMA ?? 'es_AR';

/** ¿Estamos dentro del horario permitido para mandar avisos? */
function horaEducada(ctx: Contexto, ahora: DateTime): boolean {
  const minutos = ahora.hour * 60 + ahora.minute;
  const desde = hhmmAMinutos(ctx.cfg.recordatorios.no_enviar_antes_de);
  const hasta = hhmmAMinutos(ctx.cfg.recordatorios.no_enviar_despues_de);
  return minutos >= desde && minutos <= hasta;
}

export async function enviarRecordatoriosPendientes(ctx: Contexto): Promise<{ enviados: number; omitidos: number }> {
  const salida = { enviados: 0, omitidos: 0 };
  if (!ctx.cfg.recordatorios.activos) return salida;

  const ahora = ctx.ahora();
  if (!horaEducada(ctx, ahora)) return salida;

  const pendientes = await recordatoriosRepo.vencidos(ctx.db, ahora.toMillis());
  for (const r of pendientes) {
    const turno = await turnosRepo.porId(ctx.db, r.turnoId);
    if (!turno || !ESTADOS_VIGENTES.includes(turno.estado) || turno.inicioMs < ahora.toMillis()) {
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
 * Limpieza semanal: saca de la base los turnos que ya terminaron hace mas de
 * `limpieza.conservar_dias`.
 *
 * La planilla de Google NO se toca: ahi queda el historial completo. La base de
 * datos es la semana en curso; Drive es el archivo.
 */
export async function limpiarTurnosViejos(ctx: Contexto): Promise<number> {
  if (!ctx.cfg.limpieza.activa) return 0;
  const limite = ctx.ahora().minus({ days: ctx.cfg.limpieza.conservar_dias });
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

    await limpiarTurnosViejos(ctx);

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
      if (env.RECORDATORIOS_HABILITADOS && ctx.cfg.recordatorios.activos) {
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
    { recordatorios: env.RECORDATORIOS_HABILITADOS && ctx.cfg.recordatorios.activos, limpiezaCada: `${ctx.cfg.limpieza.conservar_dias} días` },
    'worker de mantenimiento iniciado',
  );
  return { detener: () => clearInterval(intervalo) };
}
