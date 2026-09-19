/**
 * Recordatorios y tareas de mantenimiento.
 *
 * Sobre la "ventana de 24 horas" de WhatsApp: Meta solo permite escribirle a un
 * cliente con texto libre dentro de las 24 h desde su ultimo mensaje. Para un
 * recordatorio del dia anterior eso casi nunca se cumple, asi que hay que usar
 * una PLANTILLA aprobada. Si se configura WHATSAPP_PLANTILLA_RECORDATORIO se usa
 * esa; si no, se manda texto y puede rebotar (queda registrado en el log).
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

    // Las tablas de control no crecen para siempre.
    await mensajesRepo.limpiarViejos(ctx.db, ahora.minus({ days: 7 }).toMillis());
    await eventosRepo.limpiarViejos(ctx.db, ahora.minus({ days: 180 }).toMillis());
  } catch (e) {
    log.error({ err: e instanceof Error ? e.message : e }, 'fallo una tarea de mantenimiento');
  }
}

export function arrancarWorkerDeRecordatorios(ctx: Contexto): { detener: () => void } {
  if (!env.RECORDATORIOS_HABILITADOS) {
    log.warn('recordatorios deshabilitados por configuración');
    return { detener: () => {} };
  }

  let corriendo = false;
  let ultimoMantenimientoMs = 0;

  const tick = async () => {
    if (corriendo) return;
    corriendo = true;
    try {
      await enviarRecordatoriosPendientes(ctx);
      const ahoraMs = Date.now();
      if (ahoraMs - ultimoMantenimientoMs > 10 * 60_000) {
        ultimoMantenimientoMs = ahoraMs;
        await mantenimiento(ctx);
      }
    } catch (e) {
      log.error({ err: e instanceof Error ? e.message : e }, 'fallo el ciclo de recordatorios');
    } finally {
      corriendo = false;
    }
  };

  const intervalo = setInterval(() => void tick(), 60_000);
  intervalo.unref?.();
  log.info('worker de recordatorios iniciado');
  return { detener: () => clearInterval(intervalo) };
}
