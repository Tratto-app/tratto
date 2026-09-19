/**
 * Simulador de WhatsApp para probar el bot sin numero real.
 *
 * Usa exactamente el mismo orquestador que el webhook: lo que ves acá es lo
 * que va a hacer el bot en WhatsApp. Lo unico que cambia es que la respuesta
 * vuelve por HTTP en vez de salir por la API de Meta.
 */
import express, { type Request, type Response, type Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Contexto } from '../../booking/servicio.js';
import { procesarMensaje } from '../../conversation/orquestador.js';
import { conversacionesRepo } from '../../database/repositories/conversaciones.js';
import { turnosDeCliente } from '../../booking/servicio.js';
import { env, esProduccion } from '../../config/env.js';
import { normalizarTelefono } from '../../shared/texto.js';
import { requiereAuth } from '../middleware/auth.js';
import { uuid } from '../../shared/ids.js';

const mensajeSchema = z.object({
  texto: z.string().min(1).max(1000),
  telefono: z.string().min(6).max(20).optional(),
});

export function rutasSimulador(ctx: Contexto): Router {
  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));
  router.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

  // En produccion el simulador queda detras del login del panel: si no, seria
  // una puerta abierta para escribir en la agenda sin autenticacion.
  if (esProduccion) router.use(requiereAuth);

  router.post('/mensaje', (req: Request, res: Response, next) => {
    void (async () => {
      const parseo = mensajeSchema.safeParse(req.body);
      if (!parseo.success) {
        res.status(422).json({ error: 'datos_invalidos' });
        return;
      }
      const telefono = normalizarTelefono(parseo.data.telefono ?? '5491100000000', { codigoPais: ctx.cfg.negocio.codigo_pais });
      const respuesta = await procesarMensaje(ctx, {
        telefono,
        texto: parseo.data.texto,
        idExterno: `sim-${uuid()}`,
        origen: 'simulador',
      });
      const turnos = await turnosDeCliente(ctx, telefono);
      res.json({
        respuesta: respuesta.texto,
        botones: respuesta.botones ?? [],
        lista: respuesta.lista ?? null,
        uso_ia: respuesta.usoIA,
        herramientas: respuesta.herramientas,
        derivado: respuesta.avisarAlBarbero,
        turnos_del_cliente: turnos.map((t) => ({
          id: t.id,
          fecha: t.fecha,
          hora: t.horaInicio,
          servicio: t.servicioNombre,
          estado: t.estado,
        })),
      });
    })().catch(next);
  });

  router.post('/reiniciar', (req: Request, res: Response, next) => {
    void (async () => {
      const telefono = normalizarTelefono(String((req.body as { telefono?: unknown })?.telefono ?? '5491100000000'), {
        codigoPais: ctx.cfg.negocio.codigo_pais,
      });
      const ahora = ctx.ahora().toUTC().toISO()!;
      await conversacionesRepo.guardar(
        ctx.db,
        { telefono, modo: 'bot', estado: {}, historial: [], ultimoMensajeMs: 0 },
        ahora,
      );
      res.json({ ok: true, telefono });
    })().catch(next);
  });

  router.get('/estado', (_req: Request, res: Response) => {
    res.json({
      ia_activa: Boolean(env.AI_HABILITADA && (env.AI_API_KEY || env.ANTHROPIC_API_KEY)),
      modelo: env.AI_MODEL,
      negocio: ctx.cfg.negocio.nombre,
      servicios: ctx.cfg.servicios.filter((s) => s.activo).map((s) => s.nombre),
    });
  });

  return router;
}
