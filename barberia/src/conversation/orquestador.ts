/**
 * Orquestador de conversaciones.
 *
 * Es el punto unico por donde entra un mensaje, venga de WhatsApp o del
 * simulador. Se encarga de:
 *   - descartar mensajes repetidos (WhatsApp reintenta los webhooks);
 *   - respetar el modo "atiende una persona";
 *   - mantener el contexto de la charla;
 *   - intentar con la IA y, si falla, seguir con el menu deterministico;
 *   - avisarle al barbero cuando alguien pide hablar con el.
 */
import type { Contexto } from '../booking/servicio.js';
import { turnosDeCliente } from '../booking/servicio.js';
import { clientesRepo } from '../database/repositories/clientes.js';
import { conversacionesRepo, mensajesRepo, type MensajeHistorial } from '../database/repositories/conversaciones.js';
import { eventosRepo } from '../database/repositories/eventos.js';
import { iaConfigurada } from '../config/env.js';
import { log, logConTelefono } from '../shared/log.js';
import { sanearMensaje } from '../shared/texto.js';
import { ErrorIA, responder as responderConIA, type ClienteIA } from '../ai/agente.js';
import { responderConMenu, type Boton, type EstadoFallback, type RespuestaFallback } from '../ai/fallback.js';

/** Cuanto dura la pausa del bot despues de derivar a una persona. */
const HORAS_MODO_HUMANO = 12;
const MAX_MENSAJES_HISTORIAL = 14;

export interface MensajeEntrante {
  telefono: string;
  texto: string;
  /** Id del mensaje en WhatsApp, para no procesar dos veces el mismo. */
  idExterno?: string;
  origen: 'whatsapp' | 'simulador';
}

export interface RespuestaConversacion {
  /** Vacío = el bot decide no responder (por ejemplo, está atendiendo una persona). */
  texto: string;
  botones?: Boton[];
  lista?: RespuestaFallback['lista'];
  /** Hay que avisarle al barbero. */
  avisarAlBarbero: boolean;
  motivoDerivacion?: string;
  usoIA: boolean;
  herramientas: string[];
  duplicado?: boolean;
}

const VACIA: RespuestaConversacion = { texto: '', avisarAlBarbero: false, usoIA: false, herramientas: [] };

function recortarHistorial(historial: MensajeHistorial[]): MensajeHistorial[] {
  return historial.slice(-MAX_MENSAJES_HISTORIAL);
}

export interface OpcionesProceso {
  /** Doble del modelo, solo para tests: permite probar el circuito sin llamar a la API. */
  clienteIA?: ClienteIA;
}

export async function procesarMensaje(
  ctx: Contexto,
  entrada: MensajeEntrante,
  opciones: OpcionesProceso = {},
): Promise<RespuestaConversacion> {
  const registro = logConTelefono(entrada.telefono);
  const ahora = ctx.ahora();
  const ahoraMs = ahora.toMillis();
  const ahoraIso = ahora.toUTC().toISO()!;
  const texto = sanearMensaje(entrada.texto);

  // 1. Idempotencia: WhatsApp reintenta los webhooks si tardamos en responder.
  if (entrada.idExterno) {
    const esNuevo = await mensajesRepo.registrarSiEsNuevo(ctx.db, entrada.idExterno, entrada.telefono, ahoraMs);
    if (!esNuevo) {
      registro.info({ id: entrada.idExterno }, 'mensaje repetido, se ignora');
      return { ...VACIA, duplicado: true };
    }
  }

  if (!texto) return VACIA;

  // 2. Estado de la conversacion.
  const conv = await conversacionesRepo.obtener(ctx.db, entrada.telefono);
  const estado = conv.estado as Record<string, unknown>;

  if (conv.modo === 'humano') {
    const desde = Number(estado.derivadoEnMs ?? 0);
    const venció = desde > 0 && ahoraMs - desde > HORAS_MODO_HUMANO * 3_600_000;
    if (!venció) {
      conv.historial = recortarHistorial([...conv.historial, { rol: 'cliente', texto, ts: ahoraMs }]);
      conv.ultimoMensajeMs = ahoraMs;
      await conversacionesRepo.guardar(ctx.db, conv, ahoraIso);
      registro.info('mensaje recibido mientras atiende una persona: el bot no responde');
      return { ...VACIA, avisarAlBarbero: true, motivoDerivacion: 'mensaje nuevo en una charla derivada' };
    }
    conv.modo = 'bot';
    delete estado.derivadoEnMs;
    await eventosRepo.registrar(ctx.db, 'bot_reactivado', { telefono: entrada.telefono, detalle: 'venció la pausa', ahoraMs });
  }

  // 3. Datos del cliente para personalizar la respuesta.
  const cliente = await clientesRepo.porTelefono(ctx.db, entrada.telefono);
  if (cliente?.bloqueado) {
    registro.warn('cliente bloqueado: no se responde');
    return VACIA;
  }
  const turnosVigentes = await turnosDeCliente(ctx, entrada.telefono);

  const llamador = {
    ctx,
    telefono: entrada.telefono,
    nombreConocido: cliente?.nombre ?? '',
    estado,
    origen: entrada.origen,
  };

  let respuesta: RespuestaConversacion;

  // 4. Primero la IA; si no esta disponible o falla, el menu.
  if (iaConfigurada || opciones.clienteIA) {
    try {
      const r = await responderConIA(
        {
          mensaje: texto,
          historial: conv.historial.map((h) => ({ rol: h.rol, texto: h.texto })),
          datos: {
            ahora,
            cfg: ctx.cfg,
            nombreCliente: cliente?.nombre ?? '',
            esClienteConocido: Boolean(cliente?.nombre) && (cliente?.totalTurnos ?? 0) > 0,
            cantidadDeVisitas: cliente?.totalTurnos ?? 0,
            turnosVigentes,
          },
          llamador,
        },
        opciones.clienteIA,
      );
      respuesta = {
        texto: r.texto,
        avisarAlBarbero: r.derivar,
        usoIA: true,
        herramientas: r.herramientasUsadas,
        ...(r.derivar ? { motivoDerivacion: String((estado.pedidoDerivacion as { motivo?: string } | undefined)?.motivo ?? '') } : {}),
      };
    } catch (e) {
      const motivo = e instanceof ErrorIA ? e.motivo : 'desconocido';
      registro.warn({ motivo }, 'la IA no pudo responder; se sigue con el menú');
      respuesta = await conMenu(ctx, entrada, texto, llamador, estado);
    }
  } else {
    respuesta = await conMenu(ctx, entrada, texto, llamador, estado);
  }

  // 5. Derivacion a persona: se pausa el bot.
  if (respuesta.avisarAlBarbero) {
    conv.modo = 'humano';
    estado.derivadoEnMs = ahoraMs;
    delete estado.pedidoDerivacion;
    await eventosRepo.registrar(ctx.db, 'derivacion_humana', {
      telefono: entrada.telefono,
      detalle: respuesta.motivoDerivacion ?? '',
      ahoraMs,
    });
    if (!respuesta.texto) respuesta.texto = ctx.cfg.mensajes.derivacion_humana;
  }

  // 6. Persistencia del contexto.
  conv.estado = estado;
  conv.ultimoMensajeMs = ahoraMs;
  conv.historial = recortarHistorial([
    ...conv.historial,
    { rol: 'cliente', texto, ts: ahoraMs },
    ...(respuesta.texto ? [{ rol: 'bot' as const, texto: respuesta.texto, ts: ahoraMs }] : []),
  ]);
  await conversacionesRepo.guardar(ctx.db, conv, ahoraIso);

  return respuesta;
}

async function conMenu(
  ctx: Contexto,
  entrada: MensajeEntrante,
  texto: string,
  llamador: { nombreConocido: string },
  estado: Record<string, unknown>,
): Promise<RespuestaConversacion> {
  const estadoMenu = (estado.fallback as EstadoFallback | undefined) ?? { paso: 'menu' as const };
  try {
    const r = await responderConMenu(ctx, {
      texto,
      telefono: entrada.telefono,
      nombreConocido: llamador.nombreConocido,
      estado: estadoMenu,
    });
    estado.fallback = estadoMenu;
    return {
      texto: r.texto,
      ...(r.botones ? { botones: r.botones } : {}),
      ...(r.lista ? { lista: r.lista } : {}),
      avisarAlBarbero: Boolean(r.derivar),
      usoIA: false,
      herramientas: [],
    };
  } catch (e) {
    log.error({ err: e instanceof Error ? e.message : e }, 'fallo tambien el flujo de menú');
    return { texto: ctx.cfg.mensajes.error_generico, avisarAlBarbero: false, usoIA: false, herramientas: [] };
  }
}

/** Devuelve la conversacion al bot (lo usa el panel del barbero). */
export async function reactivarBot(ctx: Contexto, telefono: string): Promise<void> {
  const ahora = ctx.ahora();
  await conversacionesRepo.cambiarModo(ctx.db, telefono, 'bot', ahora.toUTC().toISO()!);
  const conv = await conversacionesRepo.obtener(ctx.db, telefono);
  delete (conv.estado as Record<string, unknown>).derivadoEnMs;
  await conversacionesRepo.guardar(ctx.db, conv, ahora.toUTC().toISO()!);
  await eventosRepo.registrar(ctx.db, 'bot_reactivado', { telefono, detalle: 'reactivado desde el panel', ahoraMs: ahora.toMillis() });
}

export async function pausarBot(ctx: Contexto, telefono: string): Promise<void> {
  const ahora = ctx.ahora();
  const conv = await conversacionesRepo.obtener(ctx.db, telefono);
  conv.modo = 'humano';
  (conv.estado as Record<string, unknown>).derivadoEnMs = ahora.toMillis();
  await conversacionesRepo.guardar(ctx.db, conv, ahora.toUTC().toISO()!);
}
