/**
 * Webhook de WhatsApp.
 *
 * Meta espera un 200 rapido: si tardamos, reintenta y duplica mensajes. Por eso
 * se confirma la recepcion enseguida y el mensaje se procesa despues, en
 * segundo plano. La idempotencia por id de mensaje cubre los reintentos que
 * igual lleguen.
 */
import express, { type Request, type Response, type Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Contexto } from '../../booking/servicio.js';
import { log, enmascararTelefono } from '../../shared/log.js';
import { HORAS_MODO_HUMANO, procesarMensaje } from '../../conversation/orquestador.js';
import { responderPorWhatsApp, whatsapp } from '../../whatsapp/cliente.js';
import { extraerFallosDeEntrega, extraerMensajes, firmaValida, verificarSuscripcion } from '../../whatsapp/webhook.js';
import type { PayloadWebhook } from '../../whatsapp/tipos.js';
import { env } from '../../config/env.js';
import { avisarAlBarbero } from '../../whatsapp/avisos.js';
import { enFila } from '../../shared/fila.js';

export function rutasWebhook(ctx: Contexto): Router {
  const router = express.Router();

  // Meta puede mandar rafagas; este limite es alto a proposito: corta abusos
  // sin cortar el trafico normal de una barberia.
  const limite = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'demasiados_pedidos' },
  });

  // Verificacion inicial de la suscripcion (Meta hace un GET una sola vez).
  router.get('/whatsapp', limite, (req: Request, res: Response) => {
    const r = verificarSuscripcion(req.query as Record<string, unknown>);
    if (!r.ok) {
      log.warn({ motivo: r.motivo }, 'verificacion de webhook rechazada');
      res.sendStatus(403);
      return;
    }
    log.info('webhook de WhatsApp verificado');
    res.status(200).send(r.challenge ?? '');
  });

  // El cuerpo se recibe crudo para poder validar la firma byte a byte.
  router.post('/whatsapp', limite, express.raw({ type: '*/*', limit: '1mb' }), (req: Request, res: Response) => {
    const crudo = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

    if (!firmaValida(crudo, req.header('x-hub-signature-256'))) {
      log.warn({ ip: req.ip }, 'webhook con firma invalida: descartado');
      res.sendStatus(401);
      return;
    }

    let payload: PayloadWebhook;
    try {
      payload = JSON.parse(crudo.toString('utf8')) as PayloadWebhook;
    } catch {
      log.warn('webhook con JSON invalido');
      res.sendStatus(400);
      return;
    }

    // Confirmar primero, procesar despues.
    res.sendStatus(200);
    void procesarPayload(ctx, payload);
  });

  return router;
}

async function procesarPayload(ctx: Contexto, payload: PayloadWebhook): Promise<void> {
  for (const fallo of extraerFallosDeEntrega(payload)) {
    log.error({ mensaje: fallo.id, cliente: enmascararTelefono(fallo.destinatario), err: fallo.error }, 'WhatsApp no pudo entregar un mensaje');
  }

  for (const mensaje of extraerMensajes(payload)) {
    // Procesar y responder, de a un mensaje por cliente: si manda dos seguidos,
    // las respuestas le llegan en el mismo orden.
    await enFila(`whatsapp:${mensaje.telefono}`, () => atenderMensaje(ctx, mensaje));
  }
}

async function atenderMensaje(ctx: Contexto, mensaje: ReturnType<typeof extraerMensajes>[number]): Promise<void> {
  const registro = log.child({ cliente: enmascararTelefono(mensaje.telefono), mensaje: mensaje.id });
  try {
    void whatsapp.marcarLeido(mensaje.id);

    if (mensaje.noEsTexto) {
      // Audios, fotos y ubicaciones: el bot no los interpreta, pero avisa.
      await whatsapp.enviarTexto(
        mensaje.telefono,
        'Por ahora solo puedo leer mensajes de texto 🙈 Escribime qué necesitás y te ayudo con el turno.',
      );
      return;
    }

    const respuesta = await procesarMensaje(ctx, {
      telefono: mensaje.telefono,
      texto: mensaje.texto,
      ...(mensaje.titulo ? { titulo: mensaje.titulo } : {}),
      idExterno: mensaje.id,
      origen: 'whatsapp',
    });

    if (respuesta.duplicado) return;

    if (respuesta.texto) {
      await responderPorWhatsApp(mensaje.telefono, respuesta);
    }

    if (respuesta.avisarAlBarbero && env.BARBERO_WHATSAPP) {
      await avisarAlBarbero(avisoDeDerivacion(mensaje, respuesta.motivoDerivacion ?? ''));
    }
  } catch (e) {
    registro.error({ err: e instanceof Error ? e.message : e }, 'error procesando un mensaje entrante');
    try {
      await whatsapp.enviarTexto(mensaje.telefono, ctx.cfg.mensajes.error_generico);
    } catch {
      /* si tampoco se puede responder, ya quedo el log */
    }
  }
}

/**
 * Aviso al barbero cuando un cliente pide hablar con él (o sigue escribiendo
 * en una charla que ya le pasamos). Lleva el link para escribirle directo.
 */
function avisoDeDerivacion(mensaje: { telefono: string; nombrePerfil: string; texto: string; titulo?: string }, motivo: string): string {
  const quien = `${mensaje.nombrePerfil || 'Un cliente'} (+${mensaje.telefono})`;
  const dijo = (mensaje.titulo || mensaje.texto).slice(0, 160);
  const link = `https://wa.me/${mensaje.telefono}`;
  if (motivo === 'mensaje nuevo en una charla derivada') {
    return `💬 ${quien} te escribió de nuevo:\n"${dijo}"\n\nEscribile: ${link}`;
  }
  return (
    `🙋 ${quien} quiere hablar con vos.` +
    `${motivo ? `\nMotivo: ${motivo}` : ''}` +
    `\nSu mensaje: "${dijo}"` +
    `\n\nEscribile: ${link}` +
    `\nEl bot no le contesta a esta persona por ${HORAS_MODO_HUMANO} horas (o hasta que lo reactives desde el panel).`
  );
}
