/**
 * API del panel del barbero.
 *
 * Todo lo que modifica la agenda pasa por las mismas funciones que usa el bot
 * (src/booking/servicio.ts), asi que las reglas y la proteccion contra doble
 * reserva valen igual desde el panel.
 */
import express, { type Request, type Response, type Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Contexto } from '../../booking/servicio.js';
import {
  agendaDelDia,
  agendaSemanal,
  bloquearHorario,
  cancelarTurno,
  consultarDisponibilidad,
  crearTurno,
  marcarEstadoTurno,
  modificarTurno,
  obtenerServicios,
  quitarBloqueo,
  turnoPorId,
} from '../../booking/servicio.js';
import { clientesRepo } from '../../database/repositories/clientes.js';
import { conversacionesRepo } from '../../database/repositories/conversaciones.js';
import { eventosRepo } from '../../database/repositories/eventos.js';
import { outboxRepo } from '../../database/repositories/outbox.js';
import { turnosRepo } from '../../database/repositories/turnos.js';
import { guardarConfigNegocio, negocio as cargarNegocio } from '../../config/negocio.js';
import { env, iaConfigurada, sheetsConfigurado, whatsappConfigurado, driverBD } from '../../config/env.js';
import { esErrorDeNegocio } from '../../shared/errores.js';
import { fechaDe, esFechaValida, esHoraValida } from '../../shared/tiempo.js';
import { normalizarTelefono, sanearNombre, telefonoParecePlausible } from '../../shared/texto.js';
import { log } from '../../shared/log.js';
import { reactivarBot, pausarBot } from '../../conversation/orquestador.js';
import { resincronizarTodo } from '../../google/sync.js';
import { calcularResumenSemanal, resumenComoTexto } from '../../reportes/semanal.js';
import { resumenesRepo } from '../../database/repositories/resumenes.js';
import {
  borrarCookieDeSesion,
  claveCorrecta,
  firmarSesion,
  ponerCookieDeSesion,
  registrarIntentoFallido,
  requiereAuth,
} from '../middleware/auth.js';

const fechaSchema = z.string().refine(esFechaValida, 'fecha invalida (YYYY-MM-DD)');
const horaSchema = z.string().refine(esHoraValida, 'hora invalida (HH:mm)');

const turnoNuevoSchema = z.object({
  telefono: z.string().min(6).max(20),
  nombre: z.string().min(1).max(60),
  servicio_id: z.string().min(1),
  fecha: fechaSchema,
  hora: horaSchema,
  observaciones: z.string().max(500).optional(),
});

const turnoCambioSchema = z.object({
  fecha: fechaSchema.optional(),
  hora: horaSchema.optional(),
  servicio_id: z.string().min(1).optional(),
  observaciones: z.string().max(500).optional(),
  nombre: z.string().max(60).optional(),
});

const bloqueoSchema = z
  .object({
    fecha: fechaSchema,
    desde: horaSchema.optional(),
    hasta: horaSchema.optional(),
    motivo: z.string().max(200).optional(),
    dia_completo: z.boolean().optional(),
  })
  .refine((b) => b.dia_completo || (b.desde && b.hasta), 'hay que indicar desde y hasta, o marcar día completo');

/** Envuelve un handler async para que los errores lleguen al middleware de errores. */
function asinc(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (e?: unknown) => void): void => {
    fn(req, res).catch(next);
  };
}

function responderError(res: Response, e: unknown): void {
  if (esErrorDeNegocio(e)) {
    res.status(e.httpStatus).json({ error: e.codigo, mensaje: e.mensajeCliente });
    return;
  }
  throw e;
}

export function rutasPanel(ctx: Contexto): Router {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  const limiteLogin = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'demasiados_intentos', mensaje: 'Demasiados intentos. Probá de nuevo en un rato.' },
  });

  const limiteApi = rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false });

  // --- Sesion -------------------------------------------------------------
  router.post('/login', limiteLogin, (req: Request, res: Response) => {
    const clave = String((req.body as { clave?: unknown })?.clave ?? '');
    if (!env.DASHBOARD_PASSWORD) {
      res.status(503).json({ error: 'panel_sin_configurar', mensaje: 'Falta definir DASHBOARD_PASSWORD en el servidor.' });
      return;
    }
    if (!clave || !claveCorrecta(clave)) {
      registrarIntentoFallido(req.ip ?? 'desconocida');
      res.status(401).json({ error: 'clave_incorrecta', mensaje: 'Contraseña incorrecta.' });
      return;
    }
    ponerCookieDeSesion(res, firmarSesion(Date.now()));
    res.json({ ok: true });
  });

  router.post('/logout', (_req: Request, res: Response) => {
    borrarCookieDeSesion(res);
    res.json({ ok: true });
  });

  // Todo lo que sigue exige sesion.
  router.use(limiteApi, requiereAuth);

  router.get('/sesion', (_req, res) => {
    res.json({ autenticado: true, negocio: ctx.cfg.negocio.nombre });
  });

  // --- Agenda -------------------------------------------------------------
  router.get(
    '/agenda/hoy',
    asinc(async (_req, res) => {
      const hoy = fechaDe(ctx.ahora());
      const manana = fechaDe(ctx.ahora().plus({ days: 1 }));
      res.json({ hoy: await agendaDelDia(ctx, hoy), manana: await agendaDelDia(ctx, manana), ahora: ctx.ahora().toISO() });
    }),
  );

  router.get(
    '/agenda/dia',
    asinc(async (req, res) => {
      const fecha = String(req.query.fecha ?? '');
      if (!esFechaValida(fecha)) {
        res.status(400).json({ error: 'fecha_invalida' });
        return;
      }
      res.json(await agendaDelDia(ctx, fecha));
    }),
  );

  router.get(
    '/agenda/semana',
    asinc(async (req, res) => {
      const desde = String(req.query.desde ?? '');
      res.json({ dias: await agendaSemanal(ctx, esFechaValida(desde) ? desde : undefined) });
    }),
  );

  router.get(
    '/turnos/proximos',
    asinc(async (_req, res) => {
      const desde = fechaDe(ctx.ahora());
      const hasta = fechaDe(ctx.ahora().plus({ days: 30 }));
      const turnos = await turnosRepo.porRangoDeFechas(ctx.db, desde, hasta);
      res.json({ turnos: turnos.filter((t) => ['reservado', 'confirmado'].includes(t.estado) && t.finMs > ctx.ahora().toMillis()) });
    }),
  );

  router.get(
    '/disponibilidad',
    asinc(async (req, res) => {
      const fecha = String(req.query.fecha ?? '');
      const servicio = String(req.query.servicio ?? ctx.cfg.servicios[0]?.id ?? '');
      if (!esFechaValida(fecha)) {
        res.status(400).json({ error: 'fecha_invalida' });
        return;
      }
      try {
        res.json(await consultarDisponibilidad(ctx, { fecha, servicioId: servicio, ignorarAnticipacion: true }));
      } catch (e) {
        responderError(res, e);
      }
    }),
  );

  // --- Balance de la semana ----------------------------------------------
  router.get(
    '/resumen',
    asinc(async (req, res) => {
      const desde = String(req.query.desde ?? '');
      const resumen = await calcularResumenSemanal(ctx, esFechaValida(desde) ? { desde } : {});
      res.json({
        resumen,
        texto: resumenComoTexto(resumen, ctx.cfg.negocio.moneda),
        historial: await resumenesRepo.ultimos(ctx.db, 8),
      });
    }),
  );

  // --- Turnos -------------------------------------------------------------
  router.post(
    '/turnos',
    asinc(async (req, res) => {
      const parseo = turnoNuevoSchema.safeParse(req.body);
      if (!parseo.success) {
        res.status(422).json({ error: 'datos_invalidos', detalle: parseo.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
        return;
      }
      const d = parseo.data;
      const telefono = normalizarTelefono(d.telefono, { codigoPais: ctx.cfg.negocio.codigo_pais });
      if (!telefonoParecePlausible(telefono)) {
        res.status(422).json({ error: 'telefono_invalido', mensaje: 'Revisá el número: tiene que ser el de WhatsApp, con código de país.' });
        return;
      }
      try {
        const turno = await crearTurno(ctx, {
          telefono,
          nombre: sanearNombre(d.nombre),
          servicioId: d.servicio_id,
          fecha: d.fecha,
          hora: d.hora,
          origen: 'panel',
          observaciones: d.observaciones ?? '',
          forzar: true, // el barbero manda: puede cargar un turno sobre la hora
        });
        res.status(201).json({ turno });
      } catch (e) {
        responderError(res, e);
      }
    }),
  );

  router.patch(
    '/turnos/:id',
    asinc(async (req, res) => {
      const parseo = turnoCambioSchema.safeParse(req.body);
      if (!parseo.success) {
        res.status(422).json({ error: 'datos_invalidos', detalle: parseo.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
        return;
      }
      const d = parseo.data;
      try {
        const turno = await modificarTurno(
          ctx,
          String(req.params.id),
          {
            ...(d.fecha ? { fecha: d.fecha } : {}),
            ...(d.hora ? { hora: d.hora } : {}),
            ...(d.servicio_id ? { servicioId: d.servicio_id } : {}),
            ...(d.observaciones !== undefined ? { observaciones: d.observaciones } : {}),
            ...(d.nombre !== undefined ? { nombre: d.nombre } : {}),
          },
          { origen: 'panel', forzar: true },
        );
        res.json({ turno });
      } catch (e) {
        responderError(res, e);
      }
    }),
  );

  router.post(
    '/turnos/:id/cancelar',
    asinc(async (req, res) => {
      try {
        const motivo = String((req.body as { motivo?: unknown })?.motivo ?? '').slice(0, 120);
        const turno = await cancelarTurno(ctx, String(req.params.id), { origen: 'panel', motivo, forzar: true });
        res.json({ turno });
      } catch (e) {
        responderError(res, e);
      }
    }),
  );

  router.post(
    '/turnos/:id/estado',
    asinc(async (req, res) => {
      const estado = String((req.body as { estado?: unknown })?.estado ?? '');
      if (estado !== 'completado' && estado !== 'no_show') {
        res.status(422).json({ error: 'estado_invalido', mensaje: 'Solo se puede marcar completado o no_show.' });
        return;
      }
      try {
        res.json({ turno: await marcarEstadoTurno(ctx, String(req.params.id), estado) });
      } catch (e) {
        responderError(res, e);
      }
    }),
  );

  router.get(
    '/turnos/:id',
    asinc(async (req, res) => {
      const turno = await turnoPorId(ctx, String(req.params.id));
      if (!turno) {
        res.status(404).json({ error: 'no_encontrado' });
        return;
      }
      res.json({ turno });
    }),
  );

  // --- Bloqueos -----------------------------------------------------------
  router.post(
    '/bloqueos',
    asinc(async (req, res) => {
      const parseo = bloqueoSchema.safeParse(req.body);
      if (!parseo.success) {
        res.status(422).json({ error: 'datos_invalidos', detalle: parseo.error.issues.map((i) => i.message) });
        return;
      }
      const d = parseo.data;
      try {
        const bloqueo = await bloquearHorario(ctx, {
          fecha: d.fecha,
          ...(d.desde ? { desde: d.desde } : {}),
          ...(d.hasta ? { hasta: d.hasta } : {}),
          motivo: d.motivo ?? '',
          diaCompleto: d.dia_completo ?? false,
        });
        const afectados = await turnosRepo.superpuestos(ctx.db, bloqueo.inicioMs, bloqueo.finMs);
        res.status(201).json({ bloqueo, turnos_afectados: afectados });
      } catch (e) {
        responderError(res, e);
      }
    }),
  );

  router.delete(
    '/bloqueos/:id',
    asinc(async (req, res) => {
      const ok = await quitarBloqueo(ctx, String(req.params.id));
      res.status(ok ? 200 : 404).json({ ok });
    }),
  );

  // --- Clientes y conversaciones -----------------------------------------
  router.get(
    '/clientes',
    asinc(async (_req, res) => {
      res.json({ clientes: await clientesRepo.listar(ctx.db, 500) });
    }),
  );

  router.get(
    '/conversaciones/derivadas',
    asinc(async (_req, res) => {
      res.json({ telefonos: await conversacionesRepo.enModoHumano(ctx.db) });
    }),
  );

  router.post(
    '/conversaciones/:telefono/bot',
    asinc(async (req, res) => {
      const telefono = normalizarTelefono(String(req.params.telefono), { codigoPais: ctx.cfg.negocio.codigo_pais });
      const activar = (req.body as { activar?: unknown })?.activar !== false;
      if (activar) await reactivarBot(ctx, telefono);
      else await pausarBot(ctx, telefono);
      res.json({ ok: true, modo: activar ? 'bot' : 'humano' });
    }),
  );

  // --- Configuracion ------------------------------------------------------
  router.get('/config', (_req, res) => {
    res.json({ config: cargarNegocio(), servicios: obtenerServicios(ctx) });
  });

  router.put(
    '/config',
    asinc(async (req, res) => {
      try {
        const nueva = guardarConfigNegocio((req.body as { config?: unknown })?.config ?? req.body);
        // El contexto vivo tiene que ver los cambios sin reiniciar el servidor.
        (ctx as { cfg: typeof nueva }).cfg = nueva;
        log.info('configuración del negocio actualizada desde el panel');
        res.json({ ok: true, config: nueva });
      } catch (e) {
        res.status(422).json({ error: 'config_invalida', mensaje: e instanceof Error ? e.message : 'configuración inválida' });
      }
    }),
  );

  // --- Estado del sistema -------------------------------------------------
  router.get(
    '/estado',
    asinc(async (_req, res) => {
      res.json({
        ahora: ctx.ahora().toISO(),
        base_de_datos: driverBD,
        ia: iaConfigurada ? { activa: true, modelo: env.AI_MODEL } : { activa: false },
        whatsapp: { configurado: whatsappConfigurado, version_api: env.WHATSAPP_GRAPH_VERSION },
        sheets: { configurado: sheetsConfigurado, pendientes_de_sincronizar: await outboxRepo.contar(ctx.db) },
        ultimos_eventos: await eventosRepo.ultimos(ctx.db, 20),
      });
    }),
  );

  router.post(
    '/sheets/sync',
    asinc(async (_req, res) => {
      try {
        res.json(await resincronizarTodo(ctx));
      } catch (e) {
        res.status(503).json({ error: 'sheets_no_disponible', mensaje: e instanceof Error ? e.message : 'error' });
      }
    }),
  );

  return router;
}
