/**
 * Carga del descuento por dejar reseña en Google.
 *
 * Google no ofrece forma de verificar por API si alguien dejó una reseña, así
 * que esto se apoya en lo que dice el cliente. Lo que sí se verifica es que de
 * verdad le hayamos pedido una hace poco: nadie puede reclamar un descuento
 * que nunca se le ofreció, ni el cliente ni el modelo de IA.
 *
 * Si el barbero ve que alguien mintió, lo saca desde el panel.
 */
import type { Contexto } from '../booking/servicio.js';
import { beneficiosRepo } from '../database/repositories/beneficios.js';
import { clientesRepo } from '../database/repositories/clientes.js';
import { conversacionesRepo } from '../database/repositories/conversaciones.js';
import { eventosRepo } from '../database/repositories/eventos.js';
import { enmascararTelefono, log } from '../shared/log.js';

/** Cuánto tiempo vale el "ya la dejé" después de que pedimos la reseña. */
export const VENTANA_RESENA_MS = 7 * 24 * 3_600_000;

export interface ResultadoResena {
  otorgado: boolean;
  motivo?: string;
  descuento?: number;
  mensaje?: string;
}

export async function registrarResenaDeCliente(ctx: Contexto, telefono: string, ahoraMs: number): Promise<ResultadoResena> {
  const cfg = ctx.cfg.resenas;
  if (!cfg.activo) return { otorgado: false, motivo: 'el programa de reseñas está apagado' };

  const ahoraIso = ctx.ahora().toUTC().toISO()!;
  const conv = await conversacionesRepo.obtener(ctx.db, telefono);
  const estado = conv.estado as Record<string, unknown>;
  const pendiente = estado.esperandoResena as { turnoId?: string; ts?: number } | undefined;

  if (!pendiente?.ts) return { otorgado: false, motivo: 'a este cliente no se le pidió ninguna reseña' };
  if (ahoraMs - pendiente.ts > VENTANA_RESENA_MS) {
    return { otorgado: false, motivo: 'pasó demasiado tiempo desde que se le pidió la reseña' };
  }

  const beneficio = await beneficiosRepo.otorgar(
    ctx.db,
    {
      telefono,
      tipo: 'resena',
      descuentoPorcentaje: cfg.descuento_porcentaje,
      turnoOrigen: pendiente.turnoId ?? null,
      venceMs: ahoraMs + cfg.vence_dias * 24 * 3_600_000,
    },
    ahoraIso,
  );

  delete estado.esperandoResena;
  await conversacionesRepo.guardar(ctx.db, conv, ahoraIso);

  if (beneficio) {
    await eventosRepo.registrar(ctx.db, 'resena_registrada', {
      telefono,
      turnoId: pendiente.turnoId ?? null,
      detalle: `${cfg.descuento_porcentaje}% de descuento`,
      ahoraMs,
    });
    log.info({ cliente: enmascararTelefono(telefono) }, 'reseña registrada: descuento cargado');
  }

  const nombre = (await clientesRepo.porTelefono(ctx.db, telefono))?.nombre ?? '';
  const mensaje = (
    beneficio ? cfg.mensaje_confirmacion : '¡Gracias! 🙌 Ya tenías un descuento cargado, lo usás en el próximo corte.'
  )
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{descuento\}/g, String(cfg.descuento_porcentaje))
    .trim();

  return { otorgado: true, descuento: cfg.descuento_porcentaje, mensaje };
}
