/**
 * Flujo de respaldo sin IA.
 *
 * Reservar un turno es la funcion critica del sistema: no puede depender de que
 * el modelo este disponible. Si la IA falla, se corta o no esta configurada,
 * este menu deterministico mantiene vivo el circuito completo (reservar,
 * consultar, cancelar, precios, derivar a una persona) con opciones numeradas
 * y botones de WhatsApp.
 */
import { DateTime } from 'luxon';
import type { Contexto } from '../booking/servicio.js';
import {
  cancelarTurno,
  confirmarHold,
  consultarDisponibilidad,
  crearHold,
  modificarTurno,
  obtenerInfoNegocio,
  turnoPorId,
  turnosDeCliente,
} from '../booking/servicio.js';
import type { Turno } from '../booking/tipos.js';
import { describirHorarios, proximosDiasAbiertos } from '../booking/disponibilidad.js';
import { resolverServicio, serviciosActivos } from '../config/negocio.js';
import { esErrorDeNegocio } from '../shared/errores.js';
import { fechaDe, fechaHumana, interpretarFecha } from '../shared/tiempo.js';
import { extraerNombre, formatearPrecio, normalizar } from '../shared/texto.js';
import { fichaDelTurno, mensajeApartado, mensajeCancelado, mensajeConfirmado, mensajeModificado } from '../conversation/mensajes.js';

export interface Boton {
  id: string;
  titulo: string; // WhatsApp corta en 20 caracteres
}

export interface OpcionLista {
  id: string;
  titulo: string;
  descripcion?: string;
}

export interface RespuestaFallback {
  texto: string;
  botones?: Boton[];
  lista?: { encabezado: string; boton: string; opciones: OpcionLista[] };
  derivar?: boolean;
}

type Paso =
  | 'menu'
  | 'elegir_servicio'
  | 'elegir_dia'
  | 'elegir_hora'
  | 'pedir_nombre'
  | 'confirmar'
  | 'elegir_turno_a_cancelar'
  | 'confirmar_cancelacion'
  | 'elegir_turno_a_cambiar'
  | 'confirmar_cambio';

export interface EstadoFallback {
  paso: Paso;
  servicioId?: string;
  fecha?: string;
  hora?: string;
  reservaId?: string;
  nombre?: string;
  opciones?: string[];
  turnoACancelar?: string;
  /** Turno que el cliente está cambiando de día u horario (se mueve, no se cancela). */
  turnoACambiar?: string;
}

const MENU_BOTONES: Boton[] = [
  { id: 'menu_reservar', titulo: '📅 Sacar turno' },
  { id: 'menu_mis_turnos', titulo: '🔎 Mi turno' },
  { id: 'menu_mas', titulo: '➕ Más opciones' },
];

function textoMenu(conPregunta = true): string {
  return `${conPregunta ? '¿Qué necesitás? ' : ''}Respondé con el número:

1️⃣ Sacar un turno
2️⃣ Consultar mi turno
3️⃣ Cancelar mi turno
4️⃣ Precios y servicios
5️⃣ Hablar con el barbero`;
}

function menuInicial(): RespuestaFallback {
  return { texto: textoMenu(), botones: MENU_BOTONES };
}

/**
 * Interpreta la respuesta del cliente como una opcion del menu.
 *
 * El orden importa: casi todas las frases contienen la palabra "turno", asi que
 * primero se descartan las intenciones mas especificas (cancelar, cambiar,
 * consultar) y recien al final queda "reservar".
 */
function opcionDeMenu(texto: string): 'reservar' | 'consultar' | 'cancelar' | 'modificar' | 'precios' | 'persona' | null {
  const t = normalizar(texto);
  if (/^3\b/.test(t) || /\b(cancelar|anular|dar de baja|no voy a poder ir)\b/.test(t)) return 'cancelar';
  if (/\b(cambiar|mover|reprogramar|correr el turno|pasar el turno|pasar mi turno|otro horario|otro dia)\b/.test(t)) return 'modificar';
  const preguntaPorSuTurno =
    /\b(mi turno|mis turnos|consultar|cuando tengo|que hora tengo|a que hora|tengo turno|tengo algo|confirmar mi turno)\b/.test(t) ||
    /\bturno tengo\b/.test(t) ||
    /\btengo (un|algun|algún) turno\b/.test(t) ||
    // "¿cuándo es mi turno?", "¿qué día tengo?", "¿a qué hora era?"
    /\b(que|cual|cuando|a que)\b[^?]{0,24}\b(turno|dia|hora)\b.{0,12}\b(tengo|es|era|tenia)\b/.test(t) ||
    /\bcuando es\b/.test(t);
  if (/^2\b/.test(t) || t === 'menu_mis_turnos' || preguntaPorSuTurno) return 'consultar';
  if (/^4\b/.test(t) || /\b(precio|precios|cuanto sale|cuanto cuesta|cuanto esta|servicios|lista de precios)\b/.test(t)) return 'precios';
  if (/^1\b/.test(t) || t === 'menu_reservar' || /\b(turno|reservar|sacar|agendar|cortar|corte|pelo|barba)\b/.test(t)) return 'reservar';
  if (
    /^5\b/.test(t) ||
    /\b(hablar|comunicarme|contactarme|contactar)\b.{0,20}\b(persona|humano|barbero|alguien|dueno)\b/.test(t) ||
    /^(con )?(una persona|un humano|el barbero|persona|humano|barbero)$/.test(t)
  ) {
    return 'persona';
  }
  return null;
}

/** "sí", "dale", "perfecto", "de una"... o el botón de confirmar. */
function esAfirmacion(t: string): boolean {
  if (/\bpero\b/.test(t)) return false; // "sí, pero a las 11" no es un sí
  return /^(si+|s|sep|see|dale|ok|oka|okey|okay|obvio|claro|confirmo|confirmar|confirmado|listo|perfecto|genial|joya|de una|bueno|va|vamos|correcto|exacto|1|👍)\b/.test(t) || /^👍/.test(t);
}

/** "no", "mejor no", "cancelá"... o el botón de no. */
function esNegacion(t: string): boolean {
  return /^(no+|nop|nah|mejor no|dejalo|deja|cancela|cancelar|anula|3)\b/.test(t);
}

/**
 * El servicio que nombró el cliente, solo si no hay duda. "corte y barba" es
 * Corte + Barba; "barba y corte" puede ser dos cosas, y ante la duda se pregunta.
 */
function servicioSinDuda(ctx: Contexto, texto: string) {
  const t = normalizar(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const elegido = resolverServicio(ctx.cfg, texto);
  if (!elegido) return undefined;
  const nombresDe = (s: { nombre: string; alias: string[] }) =>
    [s.nombre, ...s.alias].map((c) => normalizar(c).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  const delElegido = nombresDe(elegido).filter((c) => c.length >= 4 && t.includes(c));
  const masLargo = delElegido.sort((a, b) => b.length - a.length)[0] ?? t;
  const otros = serviciosActivos(ctx.cfg).filter((s) => s.id !== elegido.id);
  const hayOtro = otros.some((s) => nombresDe(s).some((c) => c.length >= 4 && t.includes(c) && !masLargo.includes(c)));
  return hayOtro ? undefined : elegido;
}

const dia = (ctx: Contexto, f: string) => fechaHumana(DateTime.fromISO(f, { zone: ctx.cfg.negocio.timezone }));

function listaDeServicios(ctx: Contexto): RespuestaFallback {
  const servicios = serviciosActivos(ctx.cfg);
  const lineas = servicios
    .map((s, i) => `${i + 1}️⃣ ${s.nombre} — ${formatearPrecio(s.precio, ctx.cfg.negocio.moneda)}`)
    .join('\n');
  return {
    texto: `¿Qué te querés hacer?\n\n${lineas}`,
    lista: {
      encabezado: 'Servicios',
      boton: 'Ver servicios',
      opciones: servicios.slice(0, 10).map((s) => ({
        id: `srv_${s.id}`,
        titulo: s.nombre.slice(0, 24),
        descripcion: formatearPrecio(s.precio, ctx.cfg.negocio.moneda),
      })),
    },
  };
}

function elegirDe<T>(texto: string, opciones: T[], idDe: (o: T) => string): T | null {
  const t = normalizar(texto);
  const n = Number(t.replace(/[^\d]/g, ''));
  if (Number.isInteger(n) && n >= 1 && n <= opciones.length && /^\d+$/.test(t.replace(/[^\d]/g, ''))) {
    return opciones[n - 1] ?? null;
  }
  const porId = opciones.find((o) => normalizar(idDe(o)) === t);
  return porId ?? null;
}

async function ofrecerDias(ctx: Contexto, estado: EstadoFallback): Promise<RespuestaFallback> {
  const zona = ctx.cfg.negocio.timezone;
  const hoy = fechaDe(ctx.ahora());
  const dias = proximosDiasAbiertos(ctx.cfg, hoy, 6);
  estado.opciones = dias;
  estado.paso = 'elegir_dia';
  const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const lineas = dias
    .map((f, i) => `${i + 1}️⃣ ${capital(fechaHumana(DateTime.fromISO(f, { zone: zona })))}${f === hoy ? ' (hoy)' : ''}`)
    .join('\n');
  return {
    texto: `¿Qué día te queda bien?\n\n${lineas}\n\nO escribime el día (por ejemplo: "el sábado").`,
    lista: {
      encabezado: 'Días',
      boton: 'Elegir día',
      opciones: dias.map((f) => ({ id: `dia_${f}`, titulo: capital(fechaHumana(DateTime.fromISO(f, { zone: zona }))).slice(0, 24) })),
    },
  };
}

async function ofrecerHorarios(ctx: Contexto, estado: EstadoFallback): Promise<RespuestaFallback> {
  // Al cambiar un turno, su propio horario cuenta como libre (se puede correr media hora).
  const r = await consultarDisponibilidad(ctx, {
    fecha: estado.fecha!,
    servicioId: estado.servicioId!,
    excluirTurnoId: estado.turnoACambiar,
  });
  if (!r.abierto) {
    const otros = r.proximos_dias_con_lugar;
    estado.paso = 'elegir_dia';
    estado.opciones = otros;
    return {
      texto: `Ese día no abrimos${r.motivo_cerrado ? ` (${r.motivo_cerrado})` : ''}. ¿Te sirve alguno de estos?\n\n${otros
        .map((f, i) => `${i + 1}️⃣ ${fechaHumana(DateTime.fromISO(f, { zone: ctx.cfg.negocio.timezone }))}`)
        .join('\n')}`,
    };
  }
  const horarios = r.horarios_sugeridos.length ? r.horarios_sugeridos : r.horarios.slice(0, 8);
  if (horarios.length === 0) {
    estado.paso = 'elegir_dia';
    estado.opciones = r.proximos_dias_con_lugar;
    return {
      texto: `Uy, ese día ya no me queda lugar 😕\n\n${r.proximos_dias_con_lugar
        .map((f, i) => `${i + 1}️⃣ ${fechaHumana(DateTime.fromISO(f, { zone: ctx.cfg.negocio.timezone }))}`)
        .join('\n')}\n\n¿Alguno de estos te sirve?`,
    };
  }
  estado.opciones = horarios;
  estado.paso = 'elegir_hora';
  return {
    texto: `Para el ${r.fecha === fechaDe(ctx.ahora()) ? 'día de hoy' : fechaHumana(DateTime.fromISO(r.fecha, { zone: ctx.cfg.negocio.timezone }))} tengo estos horarios:\n\n${horarios
      .map((h, i) => `${i + 1}️⃣ ${h}`)
      .join('\n')}\n\n¿Cuál te queda mejor?`,
    lista: {
      encabezado: 'Horarios',
      boton: 'Elegir horario',
      opciones: horarios.slice(0, 10).map((h) => ({ id: `hora_${h}`, titulo: h })),
    },
  };
}

async function armarResumen(ctx: Contexto, estado: EstadoFallback, telefono: string, nombre: string): Promise<RespuestaFallback> {
  try {
    const hold = await crearHold(ctx, {
      telefono,
      nombre,
      servicioId: estado.servicioId!,
      fecha: estado.fecha!,
      hora: estado.hora!,
    });
    estado.reservaId = hold.id;
    estado.paso = 'confirmar';
    return {
      texto: mensajeApartado(ctx, hold),
      botones: [
        { id: 'confirmar_si', titulo: '✅ Sí, confirmar' },
        { id: 'confirmar_cambiar', titulo: '✏️ Cambiar' },
        { id: 'confirmar_no', titulo: '❌ Cancelar' },
      ],
    };
  } catch (e) {
    estado.paso = 'elegir_hora';
    const msg = esErrorDeNegocio(e) ? e.mensajeCliente : ctx.cfg.mensajes.error_al_confirmar;
    const otra = await ofrecerHorarios(ctx, estado);
    return { texto: `${msg}\n\n${otra.texto}`, ...(otra.lista ? { lista: otra.lista } : {}) };
  }
}

/** Pregunta por un turno, con la ficha y dos botones. */
function preguntarPorTurno(ctx: Contexto, pregunta: string, t: Turno, botones: Boton[]): RespuestaFallback {
  return { texto: `${pregunta}\n\n${fichaDelTurno(ctx, t)}`, botones };
}

const BOTONES_CANCELAR: Boton[] = [
  { id: 'cancelar_si', titulo: '✅ Sí, cancelar' },
  { id: 'cancelar_no', titulo: '❌ No' },
];

function listaDeTurnos(ctx: Contexto, turnos: Turno[]): string {
  return turnos.map((t2, i) => `${i + 1}️⃣ ${dia(ctx, t2.fecha)} ${t2.horaInicio} hs — ${t2.servicioNombre}`).join('\n');
}

/** Arranca el cambio de un turno: se elige otro día para el mismo servicio. */
async function empezarCambio(ctx: Contexto, estado: EstadoFallback, t: Turno): Promise<RespuestaFallback> {
  estado.turnoACambiar = t.id;
  estado.servicioId = t.servicioId;
  const dias = await ofrecerDias(ctx, estado);
  return {
    ...dias,
    texto: `Dale, cambiamos tu turno de ${t.servicioNombre} del ${dia(ctx, t.fecha)} a las ${t.horaInicio} hs.\n\n${dias.texto}`,
  };
}

/**
 * Procesa un mensaje en modo menu. Devuelve la respuesta y muta `estado`,
 * que el orquestador guarda en la conversacion.
 */
export async function responderConMenu(
  ctx: Contexto,
  entrada: { texto: string; telefono: string; nombreConocido: string; estado: EstadoFallback },
): Promise<RespuestaFallback> {
  const { texto, telefono, nombreConocido, estado } = entrada;
  const t = normalizar(texto);

  // Salidas rapidas disponibles en cualquier paso. Tienen que ser el mensaje
  // entero: "quiero volver a sacar turno" no es "volver al menú", y "¿el
  // barbero atiende el sábado?" no es pedir hablar con él.
  if (/^(menu|volver|volver al menu|inicio|empezar de nuevo|cancelar todo)$/.test(t) || t === 'menu_mas') {
    if (estado.reservaId) {
      await cancelarTurno(ctx, estado.reservaId, { telefono, origen: 'whatsapp', forzar: true, motivo: 'volvio al menu' }).catch(() => {});
    }
    reiniciar(estado);
    return menuInicial();
  }
  if (
    /\b(hablar|comunicarme|contactarme|contactar)\b.{0,20}\b(persona|humano|barbero|alguien|dueno)\b/.test(t) ||
    /^(con )?(una persona|un humano|el barbero|persona|humano|barbero)$/.test(t) ||
    (estado.paso === 'menu' && /^5\b/.test(t))
  ) {
    reiniciar(estado);
    return { texto: ctx.cfg.mensajes.derivacion_humana, derivar: true };
  }

  switch (estado.paso) {
    case 'elegir_servicio': {
      const servicios = serviciosActivos(ctx.cfg);
      const elegido = elegirDe(texto, servicios, (s) => `srv_${s.id}`) ?? servicioSinDuda(ctx, texto);
      if (!elegido) return { ...listaDeServicios(ctx), texto: `No te entendí 😅 Elegí con el número:\n\n${listaDeServicios(ctx).texto}` };
      estado.servicioId = elegido.id;
      const { fecha } = interpretarFecha(texto, ctx.ahora());
      if (fecha) {
        estado.fecha = fecha;
        return ofrecerHorarios(ctx, estado);
      }
      return ofrecerDias(ctx, estado);
    }

    case 'elegir_dia': {
      const opciones = estado.opciones ?? [];
      const porNumero = elegirDe(texto, opciones, (f) => `dia_${f}`);
      const interpretada = porNumero ?? interpretarFecha(texto, ctx.ahora()).fecha;
      if (!interpretada) return ofrecerDias(ctx, estado);
      estado.fecha = interpretada;
      return ofrecerHorarios(ctx, estado);
    }

    case 'elegir_hora': {
      const opciones = estado.opciones ?? [];
      const escrito = interpretarFecha(texto, ctx.ahora()).hora;
      const elegido = elegirDe(texto, opciones, (h) => `hora_${h}`) ?? escrito;
      if (!elegido) {
        const r = await ofrecerHorarios(ctx, estado);
        return { texto: `No te entendí el horario 😅\n\n${r.texto}`, ...(r.lista ? { lista: r.lista } : {}) };
      }
      // Si escribió un horario a mano, hay que verificar que siga libre antes de
      // seguir: no tiene sentido pedirle el nombre para después rechazarlo.
      if (!opciones.includes(elegido)) {
        const disponibles = await consultarDisponibilidad(ctx, {
          fecha: estado.fecha!,
          servicioId: estado.servicioId!,
          excluirTurnoId: estado.turnoACambiar,
        });
        if (!disponibles.horarios.includes(elegido)) {
          const r = await ofrecerHorarios(ctx, estado);
          return {
            texto: `Las ${elegido} no las tengo libres 😕\n\n${r.texto}`,
            ...(r.lista ? { lista: r.lista } : {}),
          };
        }
      }
      estado.hora = elegido;

      // Cambio de un turno existente: se muestra cómo queda y se pide el sí.
      if (estado.turnoACambiar) {
        const actual = await turnoPorId(ctx, estado.turnoACambiar);
        if (!actual) {
          reiniciar(estado);
          return { texto: 'No encontré el turno que querías cambiar 🤔', botones: MENU_BOTONES };
        }
        estado.paso = 'confirmar_cambio';
        return {
          texto: `Te lo cambio así:\n\nAntes: ${dia(ctx, actual.fecha)} a las ${actual.horaInicio} hs\nAhora: *${dia(ctx, estado.fecha!)} a las ${elegido} hs*\n\n¿Lo cambio?`,
          botones: [
            { id: 'cambio_si', titulo: '✅ Sí, cambiarlo' },
            { id: 'cambio_no', titulo: '❌ Dejarlo como está' },
          ],
        };
      }

      const nombre = estado.nombre || nombreConocido;
      if (!nombre) {
        estado.paso = 'pedir_nombre';
        return { texto: 'Perfecto. ¿Me decís tu nombre para anotar el turno?' };
      }
      return armarResumen(ctx, estado, telefono, nombre);
    }

    case 'pedir_nombre': {
      const nombre = extraerNombre(texto);
      if (!nombre) return { texto: 'Decime solo tu nombre así te anoto el turno 🙌 (por ejemplo: Juan)' };
      estado.nombre = nombre;
      // Si ya hay un horario apartado (por ejemplo, lo apartó la IA antes de
      // caerse), se confirma ese mismo con el nombre.
      if (estado.reservaId) return confirmarApartado(ctx, estado, telefono, nombre);
      return armarResumen(ctx, estado, telefono, nombre);
    }

    case 'confirmar': {
      const cambia =
        t === 'confirmar_cambiar' ||
        t === '2' ||
        /\b(cambiar|otro horario|otra hora|otro dia)\b/.test(t) ||
        (/\bmejor\b/.test(t) && !/^mejor no\b/.test(t));
      if (cambia) {
        if (estado.reservaId) {
          await cancelarTurno(ctx, estado.reservaId, { telefono, origen: 'whatsapp', forzar: true, motivo: 'cambio antes de confirmar' }).catch(() => {});
          delete estado.reservaId;
        }
        return ofrecerDias(ctx, estado);
      }
      if (t === 'confirmar_no' || esNegacion(t)) {
        if (estado.reservaId) {
          await cancelarTurno(ctx, estado.reservaId, { telefono, origen: 'whatsapp', forzar: true, motivo: 'no confirmo' }).catch(() => {});
        }
        reiniciar(estado);
        return { texto: 'Listo, no reservo nada entonces 👍 Cuando quieras escribime.', botones: MENU_BOTONES };
      }
      if (t === 'confirmar_si' || esAfirmacion(t)) {
        const nombre = estado.nombre || nombreConocido;
        if (!nombre) {
          estado.paso = 'pedir_nombre';
          return { texto: '¡Dale! ¿Me decís tu nombre para anotar el turno?' };
        }
        return confirmarApartado(ctx, estado, telefono, nombre);
      }
      // Respuesta que no es ni sí ni no: el horario sigue guardado, se vuelve a preguntar.
      return {
        texto: 'No te entendí 😅 ¿Confirmo el turno?',
        botones: [
          { id: 'confirmar_si', titulo: '✅ Sí, confirmar' },
          { id: 'confirmar_cambiar', titulo: '✏️ Cambiar' },
          { id: 'confirmar_no', titulo: '❌ Cancelar' },
        ],
      };
    }

    case 'elegir_turno_a_cancelar':
    case 'elegir_turno_a_cambiar': {
      const turnos = await turnosDeCliente(ctx, telefono);
      const elegido = elegirDe(texto, turnos, (x) => x.id);
      if (!elegido) {
        reiniciar(estado);
        return { texto: `No encontré ese turno. Volvemos al menú 👇\n\n${textoMenu()}`, botones: MENU_BOTONES };
      }
      if (estado.paso === 'elegir_turno_a_cambiar') return empezarCambio(ctx, estado, elegido);
      estado.turnoACancelar = elegido.id;
      estado.paso = 'confirmar_cancelacion';
      return preguntarPorTurno(ctx, '¿Querés cancelar este turno?', elegido, BOTONES_CANCELAR);
    }

    case 'confirmar_cancelacion': {
      const afirma = t === 'cancelar_si' || esAfirmacion(t) || /^(si,? )?cancela(r|lo)?\b/.test(t);
      const id = estado.turnoACancelar!;
      reiniciar(estado);
      if (!afirma) return { texto: 'Listo, tu turno sigue en pie 👍' };
      try {
        const cancelado = await cancelarTurno(ctx, id, { telefono, origen: 'whatsapp' });
        return { texto: mensajeCancelado(ctx, cancelado) };
      } catch (e) {
        return { texto: esErrorDeNegocio(e) ? e.mensajeCliente : ctx.cfg.mensajes.error_generico };
      }
    }

    case 'confirmar_cambio': {
      const afirma = t === 'cambio_si' || esAfirmacion(t);
      const id = estado.turnoACambiar!;
      const { fecha, hora } = estado;
      if (!afirma) {
        reiniciar(estado);
        return { texto: 'Listo, tu turno queda como estaba 👍' };
      }
      try {
        const movido = await modificarTurno(ctx, id, { fecha: fecha!, hora: hora! }, { telefono, origen: 'whatsapp' });
        reiniciar(estado);
        return { texto: mensajeModificado(ctx, movido) };
      } catch (e) {
        const msg = esErrorDeNegocio(e) ? e.mensajeCliente : ctx.cfg.mensajes.error_al_confirmar;
        if (esErrorDeNegocio(e) && e.codigo === 'CANCELACION_TARDIA') {
          reiniciar(estado);
          return { texto: msg };
        }
        estado.paso = 'elegir_hora';
        const r = await ofrecerHorarios(ctx, estado);
        return { texto: `${msg}\n\n${r.texto}`, ...(r.lista ? { lista: r.lista } : {}) };
      }
    }

    case 'menu':
    default: {
      const opcion = opcionDeMenu(texto);
      switch (opcion) {
        case 'reservar': {
          // Si ya dijo qué y cuándo ("corte el sábado"), no se le vuelve a preguntar.
          const servicio = /^(1|menu_reservar)$/.test(t) ? undefined : servicioSinDuda(ctx, texto);
          if (!servicio) {
            estado.paso = 'elegir_servicio';
            return listaDeServicios(ctx);
          }
          estado.servicioId = servicio.id;
          const { fecha } = interpretarFecha(texto, ctx.ahora());
          if (fecha) {
            estado.fecha = fecha;
            return ofrecerHorarios(ctx, estado);
          }
          return ofrecerDias(ctx, estado);
        }
        case 'consultar': {
          const turnos = await turnosDeCliente(ctx, telefono);
          estado.paso = 'menu';
          if (turnos.length === 0) {
            return { texto: 'No tenés ningún turno reservado 🤔 ¿Querés sacar uno?', botones: MENU_BOTONES };
          }
          const fichas = turnos.map((t2) => fichaDelTurno(ctx, t2)).join('\n\n');
          return { texto: `Tenés ${turnos.length === 1 ? 'este turno' : 'estos turnos'}:\n\n${fichas}` };
        }
        case 'cancelar': {
          const turnos = await turnosDeCliente(ctx, telefono);
          if (turnos.length === 0) {
            estado.paso = 'menu';
            return { texto: 'No tenés turnos para cancelar 🤔', botones: MENU_BOTONES };
          }
          if (turnos.length === 1) {
            estado.turnoACancelar = turnos[0]!.id;
            estado.paso = 'confirmar_cancelacion';
            return preguntarPorTurno(ctx, '¿Querés cancelar este turno?', turnos[0]!, BOTONES_CANCELAR);
          }
          estado.paso = 'elegir_turno_a_cancelar';
          return { texto: `¿Cuál querés cancelar?\n\n${listaDeTurnos(ctx, turnos)}` };
        }
        case 'modificar': {
          const turnos = await turnosDeCliente(ctx, telefono);
          if (turnos.length === 0) {
            estado.paso = 'elegir_servicio';
            return { ...listaDeServicios(ctx), texto: `No encuentro ningún turno tuyo 🤔 ¿Sacamos uno?\n\n${listaDeServicios(ctx).texto}` };
          }
          if (turnos.length === 1) return empezarCambio(ctx, estado, turnos[0]!);
          estado.paso = 'elegir_turno_a_cambiar';
          return { texto: `¿Cuál querés cambiar?\n\n${listaDeTurnos(ctx, turnos)}` };
        }
        case 'precios': {
          const servicios = serviciosActivos(ctx.cfg);
          estado.paso = 'menu';
          return {
            texto: `Estos son los servicios:\n\n${servicios
              .map((s) => `✂️ ${s.nombre} — ${formatearPrecio(s.precio, ctx.cfg.negocio.moneda)}`)
              .join('\n')}\n\n🕐 Horarios de atención:\n${describirHorarios(ctx.cfg)
              .split('\n')
              .map((l) => l[0]!.toUpperCase() + l.slice(1))
              .join('\n')}`,
            botones: MENU_BOTONES,
          };
        }
        case 'persona': {
          reiniciar(estado);
          return { texto: ctx.cfg.mensajes.derivacion_humana, derivar: true };
        }
        default: {
          if (/\b(donde|direccion|ubicados|ubicacion|queda|como llego)\b/.test(t)) {
            const info = obtenerInfoNegocio(ctx);
            if (info.direccion) {
              const mapa = info.maps ? `\n🗺️ ${info.maps}` : '';
              return { texto: `Estamos en ${info.direccion}${info.como_llegar ? ` (${info.como_llegar})` : ''} 📍${mapa}`, botones: MENU_BOTONES };
            }
            return { texto: 'La dirección te la confirma el barbero 🙌 Si la necesitás ahora, escribí *5* y le aviso para que te escriba.', botones: MENU_BOTONES };
          }
          estado.paso = 'menu';
          return { texto: `${ctx.cfg.mensajes.bienvenida}\n\n${textoMenu(false)}`, botones: MENU_BOTONES };
        }
      }
    }
  }
}

/** Confirma el horario apartado y deja el estado limpio. */
async function confirmarApartado(ctx: Contexto, estado: EstadoFallback, telefono: string, nombre: string): Promise<RespuestaFallback> {
  try {
    const turno = await confirmarHold(ctx, estado.reservaId!, { telefono, nombre });
    reiniciar(estado);
    return { texto: mensajeConfirmado(ctx, turno) };
  } catch (e) {
    delete estado.reservaId;
    const msg = esErrorDeNegocio(e) ? e.mensajeCliente : ctx.cfg.mensajes.error_al_confirmar;
    if (!estado.servicioId || !estado.fecha) {
      reiniciar(estado);
      return { texto: `${msg}\n\n${textoMenu()}`, botones: MENU_BOTONES };
    }
    estado.paso = 'elegir_hora';
    const r = await ofrecerHorarios(ctx, estado);
    return { texto: `${msg}\n\n${r.texto}`, ...(r.lista ? { lista: r.lista } : {}) };
  }
}

/** Menú a partir de un horario que apartó la IA: el cliente solo tiene que decir que sí. */
export function estadoParaConfirmar(t: Turno): EstadoFallback {
  return {
    paso: t.nombreCliente ? 'confirmar' : 'pedir_nombre',
    reservaId: t.id,
    servicioId: t.servicioId,
    fecha: t.fecha,
    hora: t.horaInicio,
    ...(t.nombreCliente ? { nombre: t.nombreCliente } : {}),
  };
}

export function estadoFallbackInicial(): EstadoFallback {
  return { paso: 'menu' };
}

/** Deja el estado limpio en el menu, sin perder la referencia del objeto. */
function reiniciar(estado: EstadoFallback): void {
  for (const k of Object.keys(estado) as Array<keyof EstadoFallback>) delete estado[k];
  estado.paso = 'menu';
}
