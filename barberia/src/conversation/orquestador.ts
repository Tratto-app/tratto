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
import { turnoPorId, turnosDeCliente } from '../booking/servicio.js';
import { clientesRepo } from '../database/repositories/clientes.js';
import { conversacionesRepo, mensajesRepo, type MensajeHistorial } from '../database/repositories/conversaciones.js';
import { eventosRepo } from '../database/repositories/eventos.js';
import { env, iaConfigurada } from '../config/env.js';
import { log, logConTelefono } from '../shared/log.js';
import { registrarResenaDeCliente } from './resenas.js';
import { sanearMensaje } from '../shared/texto.js';
import { ErrorIA, responder as responderConIA } from '../ai/agente.js';
import type { ProveedorIA } from '../ai/proveedores/tipos.js';
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
  /** Doble del proveedor, solo para tests: permite probar sin llamar a ninguna API. */
  proveedorIA?: ProveedorIA;
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

  // 2. Atajo para el barbero: si pide el balance, se lo damos al instante.
  //    Funciona siempre porque el la ventana de 24 h la abre el mismo con su
  //    mensaje, asi que no depende de plantillas aprobadas.
  if (env.BARBERO_WHATSAPP && entrada.telefono === env.BARBERO_WHATSAPP) {
    const pedido = queBalancePide(texto);
    if (pedido === 'mes') {
      const { calcularResumenMensual, mesDe, resumenMensualComoTexto } = await import('../reportes/mensual.js');
      const resumen = await calcularResumenMensual(ctx, mesDe(ahora.toISODate()!));
      registro.info('el barbero pidió el balance del mes');
      return {
        texto: resumenMensualComoTexto(resumen, ctx.cfg.negocio.moneda),
        avisarAlBarbero: false,
        usoIA: false,
        herramientas: ['resumen_mensual'],
      };
    }
    if (pedido === 'semana') {
      const { calcularResumenSemanal, resumenComoTexto } = await import('../reportes/semanal.js');
      const resumen = await calcularResumenSemanal(ctx);
      registro.info('el barbero pidió el balance de la semana');
      return {
        texto: resumenComoTexto(resumen, ctx.cfg.negocio.moneda),
        avisarAlBarbero: false,
        usoIA: false,
        herramientas: ['resumen_semanal'],
      };
    }
  }

  // 3. ¿Está avisando que dejó la reseña? Se le carga el descuento.
  const respuestaResena = await quizasRegistrarResena(ctx, entrada.telefono, texto, ahoraMs);
  if (respuestaResena) return respuestaResena;

  // 4. Estado de la conversacion.
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

  // 5. Datos del cliente para personalizar la respuesta.
  const cliente = await clientesRepo.porTelefono(ctx.db, entrada.telefono);
  if (cliente?.bloqueado) {
    registro.warn('cliente bloqueado: no se responde');
    return VACIA;
  }
  const turnosVigentes = await turnosDeCliente(ctx, entrada.telefono);

  // Horario apartado en un mensaje anterior y todavía sin confirmar. El
  // historial que ve el modelo es solo texto, así que sin esto se olvida del
  // reserva_id, no puede confirmarlo y, al volver a consultar, su propio
  // horario apartado le aparece ocupado ("ya no hay lugar"). Pasó en producción.
  let reservaApartada: Awaited<ReturnType<typeof turnoPorId>> = null;
  if (typeof estado.reservaPendiente === 'string') {
    const t = await turnoPorId(ctx, estado.reservaPendiente);
    const vigente = t && t.telefono === entrada.telefono && t.estado === 'pendiente' && (t.holdVenceMs ?? 0) > ahora.toMillis();
    if (vigente) reservaApartada = t;
    else delete estado.reservaPendiente;
  }

  const llamador = {
    ctx,
    telefono: entrada.telefono,
    nombreConocido: cliente?.nombre ?? '',
    estado,
    origen: entrada.origen,
  };

  let respuesta: RespuestaConversacion;

  // 6. Primero la IA; si no esta disponible o falla, el menu.
  if (iaConfigurada || opciones.proveedorIA) {
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
            reservaApartada,
          },
          llamador,
        },
        opciones.proveedorIA,
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

  // 7. Derivacion a persona: se pausa el bot.
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

  // 8. Persistencia del contexto.
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

/** ¿El cliente está diciendo que ya dejó la reseña? */
function confirmaResena(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return (
    t === 'resena_hecha' ||
    /\b(ya (la )?(deje|subi|puse|hice)|la deje|listo|hecho|ya esta|ya la puse|la subi)\b/.test(t)
  );
}

/** Carga el descuento si el cliente avisa que dejó la reseña que le pedimos. */
async function quizasRegistrarResena(
  ctx: Contexto,
  telefono: string,
  texto: string,
  ahoraMs: number,
): Promise<RespuestaConversacion | null> {
  if (!ctx.cfg.resenas.activo || !confirmaResena(texto)) return null;
  const r = await registrarResenaDeCliente(ctx, telefono, ahoraMs);
  if (!r.otorgado) return null;
  return { texto: r.mensaje ?? '', avisarAlBarbero: false, usoIA: false, herramientas: ['registrar_resena'] };
}

/** ¿El barbero pide un balance? ¿De la semana o del mes? */
function queBalancePide(texto: string): 'semana' | 'mes' | null {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const pideBalance =
    /^(resumen|balance|reporte|estadisticas)\b/.test(t) || /\bcomo (venimos|vengo|vamos|fue la semana|viene la semana|fue el mes)\b/.test(t);
  if (!pideBalance) return null;
  return /\b(mes|mensual|mes pasado)\b/.test(t) ? 'mes' : 'semana';
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
