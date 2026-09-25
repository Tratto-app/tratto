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
import { extraerNombre, sanearMensaje } from '../shared/texto.js';
import { enFila } from '../shared/fila.js';
import { ErrorIA, responder as responderConIA } from '../ai/agente.js';
import type { ProveedorIA } from '../ai/proveedores/tipos.js';
import type { AccionSobreTurno, Llamador } from '../ai/herramientas.js';
import { estadoParaConfirmar, responderConMenu, type Boton, type EstadoFallback, type RespuestaFallback } from '../ai/fallback.js';
import type { Turno } from '../booking/tipos.js';
import { mensajeApartado, mensajeCancelado, mensajeConfirmado, mensajeModificado } from './mensajes.js';

/** Cuanto dura la pausa del bot despues de derivar a una persona. */
export const HORAS_MODO_HUMANO = 12;
const MAX_MENSAJES_HISTORIAL = 14;

export interface MensajeEntrante {
  telefono: string;
  texto: string;
  /**
   * Si tocó un botón o una opción de lista: lo que decía el botón. `texto`
   * trae el id (lo que entiende el menú, ej. "srv_corte"); la IA y el
   * historial ven este título ("Corte"), que es lo que el cliente leyó.
   */
  titulo?: string;
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

/**
 * Procesa un mensaje entrante. Los mensajes de un mismo teléfono se procesan
 * de a uno y en orden (ver shared/fila.ts): dos mensajes seguidos no pueden
 * pisarse el estado de la charla ni apartar dos horarios a la vez.
 */
export function procesarMensaje(
  ctx: Contexto,
  entrada: MensajeEntrante,
  opciones: OpcionesProceso = {},
): Promise<RespuestaConversacion> {
  return enFila(`charla:${entrada.telefono}`, () => procesarEnOrden(ctx, entrada, opciones));
}

/** Respuestas de botones y listas del menú: las sigue atendiendo el menú. */
const ID_DE_MENU = /^(srv|dia|hora|confirmar|cancelar|cambio|menu)_[\w:-]+$/;

async function procesarEnOrden(
  ctx: Contexto,
  entrada: MensajeEntrante,
  opciones: OpcionesProceso,
): Promise<RespuestaConversacion> {
  const registro = logConTelefono(entrada.telefono);
  const ahora = ctx.ahora();
  const ahoraMs = ahora.toMillis();
  const ahoraIso = ahora.toUTC().toISO()!;
  const texto = sanearMensaje(entrada.texto);
  // Lo que el cliente leyó en el botón que tocó; si escribió, lo que escribió.
  const textoLegible = sanearMensaje(entrada.titulo ?? '') || texto;

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

  // 3. Estado de la conversacion.
  const conv = await conversacionesRepo.obtener(ctx.db, entrada.telefono);
  const estado = conv.estado as Record<string, unknown>;
  const guardarCon = async (respuesta: RespuestaConversacion) => {
    conv.estado = estado;
    conv.ultimoMensajeMs = ahoraMs;
    conv.historial = recortarHistorial([
      ...conv.historial,
      { rol: 'cliente', texto: textoLegible, ts: ahoraMs },
      ...(respuesta.texto ? [{ rol: 'bot' as const, texto: respuesta.texto, ts: ahoraMs }] : []),
    ]);
    await conversacionesRepo.guardar(ctx.db, conv, ahoraIso);
    return respuesta;
  };

  // 4. ¿Está avisando que dejó la reseña? Se le carga el descuento.
  const respuestaResena = await quizasRegistrarResena(ctx, entrada.telefono, texto, ahoraMs);
  if (respuestaResena) {
    // registrarResenaDeCliente ya limpió el pedido de reseña en la base: se
    // relee para no pisarlo con el estado viejo.
    const fresca = await conversacionesRepo.obtener(ctx.db, entrada.telefono);
    for (const k of Object.keys(estado)) delete estado[k];
    Object.assign(estado, fresca.estado);
    return guardarCon(respuestaResena);
  }

  if (conv.modo === 'humano') {
    const desde = Number(estado.derivadoEnMs ?? 0);
    const venció = desde > 0 && ahoraMs - desde > HORAS_MODO_HUMANO * 3_600_000;
    if (!venció) {
      conv.historial = recortarHistorial([...conv.historial, { rol: 'cliente', texto: textoLegible, ts: ahoraMs }]);
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

  // Un nombre guardado que no es un nombre ("Sí", "Dale") no cuenta como conocido.
  const nombreConocido = extraerNombre(cliente?.nombre ?? '');
  const llamador: Llamador = {
    ctx,
    telefono: entrada.telefono,
    nombreConocido,
    estado,
    origen: entrada.origen,
    acciones: [],
  };

  let respuesta: RespuestaConversacion;

  // 6. Primero la IA; si no esta disponible o falla, el menu. Si el cliente
  //    tocó un botón del menú, lo sigue atendiendo el menú.
  const sigueEnElMenu = ID_DE_MENU.test(texto) && !!estado.fallback;
  if ((iaConfigurada || opciones.proveedorIA) && !sigueEnElMenu) {
    try {
      const r = await responderConIA(
        {
          mensaje: textoLegible,
          historial: conv.historial.map((h) => ({ rol: h.rol, texto: h.texto })),
          datos: {
            ahora,
            cfg: ctx.cfg,
            nombreCliente: nombreConocido,
            esClienteConocido: Boolean(nombreConocido) && (cliente?.totalTurnos ?? 0) > 0,
            cantidadDeVisitas: cliente?.totalTurnos ?? 0,
            turnosVigentes,
            reservaApartada,
          },
          llamador,
        },
        opciones.proveedorIA,
      );
      respuesta = {
        // Si la IA reservó, confirmó, cambió o canceló un turno, el cliente
        // recibe la ficha armada con los datos guardados, no la redacción del
        // modelo: así el día y la hora son exactamente los de la agenda.
        texto: mensajeDeAcciones(ctx, llamador.acciones ?? []) || r.texto,
        avisarAlBarbero: r.derivar,
        usoIA: true,
        herramientas: r.herramientasUsadas,
        ...(r.derivar ? { motivoDerivacion: String((estado.pedidoDerivacion as { motivo?: string } | undefined)?.motivo ?? '') } : {}),
      };
      // La IA tomó la charla: si había un menú a medias, queda descartado.
      delete estado.fallback;
    } catch (e) {
      const motivo = e instanceof ErrorIA ? e.motivo : 'desconocido';
      const hecho = mensajeDeAcciones(ctx, llamador.acciones ?? []);
      if (hecho) {
        // La IA se cayó DESPUÉS de hacer algo (por ejemplo, confirmó el turno
        // y se cortó antes de redactar): se le avisa al cliente lo que quedó
        // hecho, en vez de mostrarle el menú como si nada.
        registro.warn({ motivo }, 'la IA se cortó después de usar herramientas; se informa lo hecho');
        respuesta = { texto: hecho, avisarAlBarbero: false, usoIA: true, herramientas: llamador.acciones!.map((a) => a.tipo) };
      } else {
        registro.warn({ motivo }, 'la IA no pudo responder; se sigue con el menú');
        respuesta = await conMenu(ctx, entrada, texto, llamador, estado, reservaApartada);
      }
    }
  } else {
    respuesta = await conMenu(ctx, entrada, texto, llamador, estado, reservaApartada);
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
  return guardarCon(respuesta);
}

/**
 * Mensaje para el cliente a partir de lo que hicieron las herramientas en este
 * mensaje. Vacío si no se tocó ningún turno.
 */
export function mensajeDeAcciones(ctx: Contexto, acciones: AccionSobreTurno[]): string {
  // Solo cuenta el último estado de cada turno: apartado y después confirmado
  // es "confirmado"; apartado y después soltado no se informa.
  const ultimo = new Map<string, AccionSobreTurno>();
  for (const a of acciones) {
    ultimo.delete(a.turno.id);
    ultimo.set(a.turno.id, a);
  }
  const partes: string[] = [];
  for (const a of ultimo.values()) {
    if (a.tipo === 'confirmado') partes.push(mensajeConfirmado(ctx, a.turno));
    else if (a.tipo === 'modificado') partes.push(mensajeModificado(ctx, a.turno));
    else if (a.tipo === 'cancelado') partes.push(mensajeCancelado(ctx, a.turno));
    else if (a.tipo === 'apartado') partes.push(mensajeApartado(ctx, a.turno));
  }
  return partes.join('\n\n');
}

async function conMenu(
  ctx: Contexto,
  entrada: MensajeEntrante,
  texto: string,
  llamador: { nombreConocido: string },
  estado: Record<string, unknown>,
  reservaApartada: Turno | null,
): Promise<RespuestaConversacion> {
  let estadoMenu = (estado.fallback as EstadoFallback | undefined) ?? { paso: 'menu' as const };
  // La IA había apartado un horario y se cayó justo cuando el cliente iba a
  // confirmar: el menú retoma desde ahí ("sí" confirma ese horario).
  if (reservaApartada && estadoMenu.reservaId !== reservaApartada.id) estadoMenu = estadoParaConfirmar(reservaApartada);
  try {
    const r = await responderConMenu(ctx, {
      texto,
      telefono: entrada.telefono,
      nombreConocido: llamador.nombreConocido,
      estado: estadoMenu,
    });
    estado.fallback = estadoMenu;
    // Mismo registro que usa la IA para el horario apartado: si en el próximo
    // mensaje vuelve la IA, sabe qué tiene que confirmar.
    if (estadoMenu.reservaId) estado.reservaPendiente = estadoMenu.reservaId;
    else delete estado.reservaPendiente;
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

/**
 * ¿El cliente está diciendo que ya dejó la reseña? Tiene que ser claro: un
 * "listo" o "ya está" suelto puede ser la respuesta a cualquier otra cosa
 * (confirmar un turno, por ejemplo) y se lo comía esto.
 */
export function confirmaResena(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t === 'resena_hecha') return true;
  const hablaDeLaResena = /\b(resena|resenia|opinion|comentario|calificacion|estrellas|google)\b/.test(t);
  const diceQueLaHizo = /\b(ya (la |lo )?(deje|subi|puse|hice|mande|escribi)|(la|lo) (deje|subi|puse|hice)|listo|hecho|hecha|ya esta)\b/.test(t);
  // "ya la dejé" / "la subí recién": corto y sin otra cosa, se entiende solo.
  const cortoYClaro = t.split(' ').length <= 5 && /^(ya )?(la |lo )?(deje|subi|puse|hice)\b/.test(t);
  return (diceQueLaHizo && hablaDeLaResena) || cortoYClaro;
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
