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
  obtenerInfoNegocio,
  turnosDeCliente,
} from '../booking/servicio.js';
import { describirHorarios, proximosDiasAbiertos } from '../booking/disponibilidad.js';
import { serviciosActivos } from '../config/negocio.js';
import { esErrorDeNegocio } from '../shared/errores.js';
import { fechaDe, fechaHumana, interpretarFecha } from '../shared/tiempo.js';
import { formatearDuracion, formatearPrecio, nombreParecePlausible, normalizar, sanearNombre } from '../shared/texto.js';

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
  | 'confirmar_cancelacion';

export interface EstadoFallback {
  paso: Paso;
  servicioId?: string;
  fecha?: string;
  hora?: string;
  reservaId?: string;
  nombre?: string;
  opciones?: string[];
  turnoACancelar?: string;
  /** El cliente esta cambiando el turno: al cancelar seguimos con uno nuevo. */
  reprogramando?: boolean;
}

const MENU_BOTONES: Boton[] = [
  { id: 'menu_reservar', titulo: '📅 Sacar turno' },
  { id: 'menu_mis_turnos', titulo: '🔎 Mi turno' },
  { id: 'menu_mas', titulo: '➕ Más opciones' },
];

function textoMenu(): string {
  return `¿Qué necesitás? Respondé con el número:

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
  if (/^5\b/.test(t) || /\b(persona|humano|barbero|hablar con)\b/.test(t)) return 'persona';
  return null;
}

function listaDeServicios(ctx: Contexto): RespuestaFallback {
  const servicios = serviciosActivos(ctx.cfg);
  const lineas = servicios
    .map((s, i) => `${i + 1}️⃣ ${s.nombre} — ${formatearPrecio(s.precio, ctx.cfg.negocio.moneda)} (${formatearDuracion(s.duracion_min)})`)
    .join('\n');
  return {
    texto: `¿Qué te querés hacer?\n\n${lineas}`,
    lista: {
      encabezado: 'Servicios',
      boton: 'Ver servicios',
      opciones: servicios.slice(0, 10).map((s) => ({
        id: `srv_${s.id}`,
        titulo: s.nombre.slice(0, 24),
        descripcion: `${formatearPrecio(s.precio, ctx.cfg.negocio.moneda)} · ${formatearDuracion(s.duracion_min)}`,
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
  const lineas = dias
    .map((f, i) => `${i + 1}️⃣ ${fechaHumana(DateTime.fromISO(f, { zone: zona }))}${f === hoy ? ' (hoy)' : ''}`)
    .join('\n');
  return {
    texto: `¿Qué día te queda bien?\n\n${lineas}\n\nO escribime el día (por ejemplo: "el sábado").`,
    lista: {
      encabezado: 'Días',
      boton: 'Elegir día',
      opciones: dias.map((f) => ({ id: `dia_${f}`, titulo: fechaHumana(DateTime.fromISO(f, { zone: zona })).slice(0, 24) })),
    },
  };
}

async function ofrecerHorarios(ctx: Contexto, estado: EstadoFallback): Promise<RespuestaFallback> {
  const r = await consultarDisponibilidad(ctx, { fecha: estado.fecha!, servicioId: estado.servicioId! });
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
  const zona = ctx.cfg.negocio.timezone;
  const servicio = serviciosActivos(ctx.cfg).find((s) => s.id === estado.servicioId)!;
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
    // Si tiene descuento por reseña, se lo decimos: es el premio prometido.
    const lineaPrecio =
      hold.descuentoPorcentaje > 0
        ? `\n💰 ${formatearPrecio(hold.precio, ctx.cfg.negocio.moneda)} (con tu ${hold.descuentoPorcentaje}% de descuento 🎁)`
        : '';
    return {
      texto: `Perfecto. Antes de confirmar:\n\n✂️ ${servicio.nombre}\n📅 ${fechaHumana(DateTime.fromISO(estado.fecha!, { zone: zona }))}\n🕐 ${estado.hora}\n👤 ${nombre}${lineaPrecio}\n\n¿Confirmamos?`,
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

/**
 * Procesa un mensaje en modo menu. Devuelve la respuesta y muta `estado`,
 * que el orquestador guarda en la conversacion.
 */
export async function responderConMenu(
  ctx: Contexto,
  entrada: { texto: string; telefono: string; nombreConocido: string; estado: EstadoFallback },
): Promise<RespuestaFallback> {
  const { texto, telefono, nombreConocido, estado } = entrada;
  const zona = ctx.cfg.negocio.timezone;
  const t = normalizar(texto);

  // Salidas rapidas disponibles en cualquier paso.
  if (/\b(menu|menú|volver|empezar de nuevo|cancelar todo)\b/.test(t)) {
    reiniciar(estado);
    estado.paso = 'menu';
    return menuInicial();
  }
  if (/\b(hablar con|persona|humano|un humano|el barbero)\b/.test(t)) {
    estado.paso = 'menu';
    return { texto: ctx.cfg.mensajes.derivacion_humana, derivar: true };
  }

  switch (estado.paso) {
    case 'elegir_servicio': {
      const servicios = serviciosActivos(ctx.cfg);
      const elegido = elegirDe(texto, servicios, (s) => `srv_${s.id}`) ?? servicios.find((s) => normalizar(s.nombre) === t);
      if (!elegido) return { texto: `No te entendí 😅 Elegí con el número:\n\n${listaDeServicios(ctx).texto}` };
      estado.servicioId = elegido.id;
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
        const disponibles = await consultarDisponibilidad(ctx, { fecha: estado.fecha!, servicioId: estado.servicioId! });
        if (!disponibles.horarios.includes(elegido)) {
          const r = await ofrecerHorarios(ctx, estado);
          return {
            texto: `Las ${elegido} ya las tengo ocupadas 😕\n\n${r.texto}`,
            ...(r.lista ? { lista: r.lista } : {}),
          };
        }
      }
      estado.hora = elegido;
      const nombre = estado.nombre || nombreConocido;
      if (!nombre) {
        estado.paso = 'pedir_nombre';
        return { texto: 'Perfecto. ¿Me pasás tu nombre para confirmar el turno?' };
      }
      return armarResumen(ctx, estado, telefono, nombre);
    }

    case 'pedir_nombre': {
      if (!nombreParecePlausible(texto)) return { texto: 'Decime tu nombre así te lo dejo agendado 🙌' };
      estado.nombre = sanearNombre(texto);
      return armarResumen(ctx, estado, telefono, estado.nombre);
    }

    case 'confirmar': {
      const afirma = /^(si|sí|s|dale|ok|oka|obvio|confirmo|confirmar|listo|1|confirmar_si)\b/.test(t) || t === 'confirmar_si';
      const cambia = /\b(cambiar|otro|otra)\b/.test(t) || t === 'confirmar_cambiar';
      if (cambia) {
        if (estado.reservaId) {
          await cancelarTurno(ctx, estado.reservaId, { telefono, origen: 'whatsapp', forzar: true, motivo: 'cambio antes de confirmar' }).catch(() => {});
          delete estado.reservaId;
        }
        return ofrecerDias(ctx, estado);
      }
      if (!afirma) {
        if (estado.reservaId) {
          await cancelarTurno(ctx, estado.reservaId, { telefono, origen: 'whatsapp', forzar: true, motivo: 'no confirmo' }).catch(() => {});
          delete estado.reservaId;
        }
        estado.paso = 'menu';
        return { texto: 'Listo, no reservo nada entonces 👍 Cuando quieras escribime.', botones: MENU_BOTONES };
      }
      try {
        const turno = await confirmarHold(ctx, estado.reservaId!, { telefono, nombre: estado.nombre || nombreConocido });
        const nombre = turno.nombreCliente;
        reiniciar(estado);
        estado.paso = 'menu';
        const conDescuento =
          turno.descuentoPorcentaje > 0
            ? `\n💰 ${formatearPrecio(turno.precio, ctx.cfg.negocio.moneda)} con tu ${turno.descuentoPorcentaje}% 🎁`
            : '';
        return {
          texto: `¡Listo, ${nombre}! ✂️\n\nTu turno quedó reservado:\n📅 ${fechaHumana(DateTime.fromISO(turno.fecha, { zone: zona }))}\n🕐 ${turno.horaInicio}\n✂️ ${turno.servicioNombre}${conDescuento}\n\n¡Te esperamos!`,
        };
      } catch (e) {
        estado.paso = 'elegir_hora';
        delete estado.reservaId;
        const msg = esErrorDeNegocio(e) ? e.mensajeCliente : ctx.cfg.mensajes.error_al_confirmar;
        const r = await ofrecerHorarios(ctx, estado);
        return { texto: `${msg}\n\n${r.texto}`, ...(r.lista ? { lista: r.lista } : {}) };
      }
    }

    case 'elegir_turno_a_cancelar': {
      const turnos = await turnosDeCliente(ctx, telefono);
      const elegido = elegirDe(texto, turnos, (x) => x.id);
      if (!elegido) {
        estado.paso = 'menu';
        return { texto: 'No encontré ese turno. Volvemos al menú 👇\n\n' + textoMenu(), botones: MENU_BOTONES };
      }
      estado.turnoACancelar = elegido.id;
      estado.paso = 'confirmar_cancelacion';
      return {
        texto: `¿Querés cancelar este turno?\n\n✂️ ${elegido.servicioNombre}\n📅 ${fechaHumana(DateTime.fromISO(elegido.fecha, { zone: zona }))}\n🕐 ${elegido.horaInicio}`,
        botones: [
          { id: 'cancelar_si', titulo: '✅ Sí, cancelar' },
          { id: 'cancelar_no', titulo: '❌ No' },
        ],
      };
    }

    case 'confirmar_cancelacion': {
      const afirma = /^(si|sí|s|dale|ok|confirmo|cancelar|cancelar_si)\b/.test(t) || t === 'cancelar_si';
      const id = estado.turnoACancelar!;
      reiniciar(estado);
      estado.paso = 'menu';
      if (!afirma) return { texto: 'Listo, tu turno sigue en pie 👍' };
      try {
        await cancelarTurno(ctx, id, { telefono, origen: 'whatsapp' });
        return { texto: 'Listo, cancelé tu turno ✅ Cuando quieras sacás otro por acá.' };
      } catch (e) {
        return { texto: esErrorDeNegocio(e) ? e.mensajeCliente : ctx.cfg.mensajes.error_generico };
      }
    }

    case 'menu':
    default: {
      const opcion = opcionDeMenu(texto);
      switch (opcion) {
        case 'reservar': {
          estado.paso = 'elegir_servicio';
          return listaDeServicios(ctx);
        }
        case 'consultar': {
          const turnos = await turnosDeCliente(ctx, telefono);
          estado.paso = 'menu';
          if (turnos.length === 0) {
            return { texto: 'No tenés ningún turno reservado 🤔 ¿Querés sacar uno?', botones: MENU_BOTONES };
          }
          const lineas = turnos
            .map((t2) => `📅 ${fechaHumana(DateTime.fromISO(t2.fecha, { zone: zona }))} a las ${t2.horaInicio} — ${t2.servicioNombre}`)
            .join('\n');
          return { texto: `Tenés ${turnos.length === 1 ? 'este turno' : 'estos turnos'}:\n\n${lineas}` };
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
            const t2 = turnos[0]!;
            return {
              texto: `¿Querés cancelar este turno?\n\n✂️ ${t2.servicioNombre}\n📅 ${fechaHumana(DateTime.fromISO(t2.fecha, { zone: zona }))}\n🕐 ${t2.horaInicio}`,
              botones: [
                { id: 'cancelar_si', titulo: '✅ Sí, cancelar' },
                { id: 'cancelar_no', titulo: '❌ No' },
              ],
            };
          }
          estado.paso = 'elegir_turno_a_cancelar';
          return {
            texto: `¿Cuál querés cancelar?\n\n${turnos
              .map((t2, i) => `${i + 1}️⃣ ${fechaHumana(DateTime.fromISO(t2.fecha, { zone: zona }))} ${t2.horaInicio} — ${t2.servicioNombre}`)
              .join('\n')}`,
          };
        }
        case 'modificar': {
          const turnos = await turnosDeCliente(ctx, telefono);
          if (turnos.length === 0) {
            estado.paso = 'elegir_servicio';
            return { texto: 'No encuentro ningún turno tuyo 🤔 ¿Sacamos uno?\n\n' + listaDeServicios(ctx).texto };
          }
          const t2 = turnos[0]!;
          estado.turnoACancelar = t2.id;
          estado.reprogramando = true;
          estado.paso = 'confirmar_cancelacion';
          return {
            texto: `Tenés este turno:\n\n✂️ ${t2.servicioNombre}\n📅 ${fechaHumana(DateTime.fromISO(t2.fecha, { zone: zona }))}\n🕐 ${t2.horaInicio}\n\nPara cambiarlo lo doy de baja y sacamos uno nuevo. ¿Dale?`,
            botones: [
              { id: 'cancelar_si', titulo: '🔁 Sí, cambiarlo' },
              { id: 'cancelar_no', titulo: '❌ Dejarlo así' },
            ],
          };
        }
        case 'precios': {
          const servicios = serviciosActivos(ctx.cfg);
          estado.paso = 'menu';
          return {
            texto: `Estos son los servicios:\n\n${servicios
              .map((s) => `✂️ ${s.nombre} — ${formatearPrecio(s.precio, ctx.cfg.negocio.moneda)} (${formatearDuracion(s.duracion_min)})`)
              .join('\n')}\n\n${describirHorarios(ctx.cfg)}`,
            botones: MENU_BOTONES,
          };
        }
        case 'persona': {
          estado.paso = 'menu';
          return { texto: ctx.cfg.mensajes.derivacion_humana, derivar: true };
        }
        default: {
          const info = obtenerInfoNegocio(ctx);
          if (/\b(donde|direccion|ubicados|queda)\b/.test(t) && info.direccion) {
            return { texto: `Estamos en ${info.direccion}${info.como_llegar ? ` (${info.como_llegar})` : ''} 📍`, botones: MENU_BOTONES };
          }
          estado.paso = 'menu';
          return { texto: `${ctx.cfg.mensajes.bienvenida}\n\n${textoMenu()}`, botones: MENU_BOTONES };
        }
      }
    }
  }
}

export function estadoFallbackInicial(): EstadoFallback {
  return { paso: 'menu' };
}

/** Deja el estado limpio en el menu, sin perder la referencia del objeto. */
function reiniciar(estado: EstadoFallback): void {
  for (const k of Object.keys(estado) as Array<keyof EstadoFallback>) delete estado[k];
  estado.paso = 'menu';
}
