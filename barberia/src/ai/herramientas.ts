/**
 * Herramientas del agente.
 *
 * Regla central del diseño: la IA INTERPRETA, el SISTEMA EJECUTA.
 *
 *  - El modelo no puede escribir en la base: solo puede pedir que se ejecute
 *    una de estas funciones, con argumentos que se validan con zod.
 *  - El telefono del cliente NUNCA viene del modelo: lo pone el backend a
 *    partir del canal (el `wa_id` del webhook). Asi el modelo no puede
 *    cancelar ni consultar el turno de otra persona aunque se lo pidan.
 *  - Las funciones del barbero (bloquear horarios, ver la agenda completa,
 *    cambiar precios) NO estan expuestas al agente: viven en el panel web.
 */
import { z } from 'zod';
import {
  cancelarTurno,
  confirmarHold,
  consultarDisponibilidad,
  crearHold,
  modificarTurno,
  obtenerHorariosAtencion,
  obtenerInfoNegocio,
  obtenerServicios,
  turnoPorId,
  turnosDeCliente,
  type Contexto,
} from '../booking/servicio.js';
import type { Turno } from '../booking/tipos.js';
import { describirHorarios } from '../booking/disponibilidad.js';
import { esErrorDeNegocio } from '../shared/errores.js';
import { enmascararTelefono, log } from '../shared/log.js';
import { esFechaValida, esHoraValida, fechaHumana, fechaRelativaHumana } from '../shared/tiempo.js';
import { extraerNombre, formatearPrecio } from '../shared/texto.js';
import { resolverServicio, serviciosActivos } from '../config/negocio.js';
import { DateTime } from 'luxon';
import type { DefinicionHerramienta } from './proveedores/tipos.js';

/** Contexto de quien esta hablando. Lo arma el backend, no el modelo. */
export interface Llamador {
  ctx: Contexto;
  telefono: string;
  nombreConocido: string;
  /** Estado de la conversacion; las herramientas pueden dejar rastros ahi. */
  estado: Record<string, unknown>;
  origen: 'whatsapp' | 'simulador';
  /**
   * Lo que las herramientas hicieron con turnos en este mensaje. Con esto el
   * orquestador arma el mensaje final con los datos exactos del turno, en vez
   * de confiar en cómo los redactó el modelo.
   */
  acciones?: AccionSobreTurno[];
}

export interface AccionSobreTurno {
  tipo: 'apartado' | 'confirmado' | 'modificado' | 'cancelado' | 'soltado';
  turno: Turno;
}

function registrarAccion(llamador: Llamador, tipo: AccionSobreTurno['tipo'], turno: Turno): void {
  (llamador.acciones ??= []).push({ tipo, turno });
}

export interface ResultadoHerramienta {
  ok: boolean;
  datos: unknown;
}

const fechaSchema = z.string().refine(esFechaValida, 'la fecha tiene que ser YYYY-MM-DD');
const horaSchema = z.string().refine(esHoraValida, 'la hora tiene que ser HH:mm en 24 horas');

const esquemas = {
  obtener_servicios: z.object({}).strict(),
  obtener_horarios_de_atencion: z.object({}).strict(),
  obtener_informacion_del_negocio: z.object({}).strict(),
  consultar_disponibilidad: z
    .object({
      fecha: fechaSchema,
      servicio_id: z.string().min(1),
      franja: z.enum(['mañana', 'tarde', 'noche']).nullish(),
      desde_hora: horaSchema.nullish(),
      hasta_hora: horaSchema.nullish(),
    })
    .strict(),
  reservar_horario: z
    .object({
      fecha: fechaSchema,
      hora: horaSchema,
      servicio_id: z.string().min(1),
      nombre: z.string().max(60).nullish(),
    })
    .strict(),
  confirmar_reserva: z.object({ reserva_id: z.string().min(1), nombre: z.string().max(60).nullish() }).strict(),
  soltar_reserva: z.object({ reserva_id: z.string().min(1) }).strict(),
  mis_turnos: z.object({}).strict(),
  modificar_turno: z
    .object({
      turno_id: z.string().min(1),
      fecha: fechaSchema.nullish(),
      hora: horaSchema.nullish(),
      servicio_id: z.string().min(1).nullish(),
    })
    .strict(),
  cancelar_turno: z.object({ turno_id: z.string().min(1), motivo: z.string().max(120).nullish() }).strict(),
  derivar_a_persona: z.object({ motivo: z.string().max(200).nullish() }).strict(),
  registrar_resena: z.object({}).strict(),
} as const;

export type NombreHerramienta = keyof typeof esquemas;

/**
 * Definiciones que se le mandan al modelo, en formato neutral: cada proveedor
 * las traduce a su API. El orden es fijo para no romper el cache de prompt.
 */
export const DEFINICIONES: DefinicionHerramienta[] = [
  {
    nombre: 'obtener_servicios',
    descripcion:
      'Lista los servicios activos con su precio. Usala antes de hablar de precios: nunca los inventes ni los recuerdes de memoria.',
    esquema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nombre: 'obtener_horarios_de_atencion',
    descripcion: 'Días y horarios en los que atiende la barbería, más feriados y vacaciones cargados.',
    esquema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nombre: 'obtener_informacion_del_negocio',
    descripcion:
      'Dirección, teléfono, Instagram, medios de pago y política de cancelación. Un dato que no esté cargado NO se inventa: la herramienta te dice qué contestar.',
    esquema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nombre: 'consultar_disponibilidad',
    descripcion:
      'Horarios realmente libres para un servicio en una fecha. Es la ÚNICA fuente válida de horarios: no ofrezcas ninguno que no haya salido de acá.',
    esquema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        servicio_id: { type: 'string', description: 'id del servicio, de obtener_servicios' },
        franja: { type: 'string', enum: ['mañana', 'tarde', 'noche'], description: 'Franja pedida por el cliente, si pidió alguna' },
        desde_hora: { type: 'string', description: 'HH:mm, si el cliente dijo "después de las 17"' },
        hasta_hora: { type: 'string', description: 'HH:mm, si el cliente dijo "antes de las 12"' },
      },
      required: ['fecha', 'servicio_id'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'reservar_horario',
    descripcion:
      'Aparta un horario por unos minutos mientras el cliente confirma. NO crea el turno definitivo. Después de llamarla tenés que mostrar el resumen y preguntar si confirma.',
    esquema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora: { type: 'string', description: 'HH:mm' },
        servicio_id: { type: 'string' },
        nombre: { type: 'string', description: 'Nombre del cliente si ya lo dijo' },
      },
      required: ['fecha', 'hora', 'servicio_id'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'confirmar_reserva',
    descripcion:
      'Convierte la reserva temporal en turno firme. Llamala SOLO en un mensaje posterior al resumen, cuando el cliente dijo explícitamente que sí, y sabiendo su nombre.',
    esquema: {
      type: 'object',
      properties: {
        reserva_id: { type: 'string', description: 'El id que devolvió reservar_horario' },
        nombre: { type: 'string', description: 'Solo el nombre de la persona (ej: "Santi"), sin "soy" ni otras palabras' },
      },
      required: ['reserva_id'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'soltar_reserva',
    descripcion:
      'Libera una reserva temporal (sin confirmar) cuando el cliente cambia de idea antes de confirmar. No sirve para turnos ya confirmados: esos se cancelan con cancelar_turno.',
    esquema: {
      type: 'object',
      properties: { reserva_id: { type: 'string' } },
      required: ['reserva_id'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'mis_turnos',
    descripcion: 'Turnos vigentes del cliente con el que estás hablando. Usala antes de modificar o cancelar.',
    esquema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nombre: 'modificar_turno',
    descripcion:
      'Mueve un turno existente a otra fecha, hora o servicio. Antes verificá con consultar_disponibilidad que el horario nuevo esté libre.',
    esquema: {
      type: 'object',
      properties: {
        turno_id: { type: 'string' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora: { type: 'string', description: 'HH:mm' },
        servicio_id: { type: 'string' },
      },
      required: ['turno_id'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'cancelar_turno',
    descripcion: 'Cancela un turno. Llamala SOLO después de que el cliente confirmó que quiere cancelarlo.',
    esquema: {
      type: 'object',
      properties: { turno_id: { type: 'string' }, motivo: { type: 'string' } },
      required: ['turno_id'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'registrar_resena',
    descripcion:
      'Usala SOLO si el cliente dice que ya dejó la reseña en Google que le pedimos. Le carga el descuento para el próximo corte. Si no le pedimos ninguna reseña, la herramienta la rechaza sola.',
    esquema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    nombre: 'derivar_a_persona',
    descripcion:
      'Avisa al barbero para que atienda personalmente y pausa las respuestas automáticas. Usala si el cliente pide hablar con alguien, se queja, o pide algo que no podés resolver.',
    esquema: {
      type: 'object',
      properties: { motivo: { type: 'string' } },
      required: [],
      additionalProperties: false,
    },
  },
];

function resumirTurno(
  t: { id: string; fecha: string; horaInicio: string; horaFin: string; servicioNombre: string; precio: number; nombreCliente: string; descuentoPorcentaje: number },
  zona: string,
  ahora: DateTime,
) {
  const dt = DateTime.fromISO(`${t.fecha}T${t.horaInicio}`, { zone: zona });
  return {
    turno_id: t.id,
    fecha: t.fecha,
    dia: fechaHumana(dt),
    cuando: fechaRelativaHumana(dt, ahora),
    hora: t.horaInicio,
    servicio: t.servicioNombre,
    precio: formatearPrecio(t.precio),
    ...(t.descuentoPorcentaje > 0
      ? { descuento_aplicado: `${t.descuentoPorcentaje}% por haber dejado reseña — decíselo al cliente` }
      : {}),
    cliente: t.nombreCliente,
  };
}

/**
 * Datos del local para el modelo. Lo que no está cargado va con la
 * instrucción de qué decir, así el modelo no lo inventa ("aceptamos tarjeta",
 * "estamos en la esquina de...").
 */
function infoParaElModelo(ctx: Contexto) {
  const info = obtenerInfoNegocio(ctx);
  const sinDato = (que: string) =>
    `(no cargado) No lo inventes. Si el cliente pregunta ${que}, decile que ese dato se lo pasa el barbero y ofrecele avisarle (derivar_a_persona) si lo necesita ya.`;
  return {
    nombre: info.nombre,
    direccion: info.direccion || sinDato('la dirección'),
    como_llegar: info.como_llegar || undefined,
    telefono: info.telefono || undefined,
    instagram: info.instagram || undefined,
    link_google_maps: info.maps || undefined,
    medios_de_pago: info.medios_de_pago.length ? info.medios_de_pago : sinDato('cómo se paga'),
    politica_cancelacion: info.politica_cancelacion,
    anticipacion_maxima_dias: info.anticipacion_maxima_dias,
  };
}

/**
 * Ejecuta una herramienta. Devuelve siempre un objeto serializable, tambien
 * cuando falla: el modelo tiene que poder leer el error y explicarselo al
 * cliente con sus palabras, sin que se filtre nada interno.
 */
export async function ejecutarHerramienta(
  nombre: string,
  entradaCruda: unknown,
  llamador: Llamador,
): Promise<ResultadoHerramienta> {
  const entradaLimpia = corregirEntrada(entradaCruda, llamador);
  const r = await ejecutarSinRegistro(nombre, entradaLimpia, llamador);
  // Cada herramienta que usa la IA queda en el log: sin esto, cuando el bot
  // dice algo raro no hay forma de saber qué pidió ni qué le contestamos.
  // El nombre y el motivo que escribe el cliente no se registran.
  const { nombre: _n, motivo: _m, ...visible } = (entradaLimpia ?? {}) as Record<string, unknown>;
  const datos = r.datos as Record<string, unknown> | undefined;
  log.info(
    {
      cliente: enmascararTelefono(llamador.telefono),
      herramienta: nombre,
      entrada: visible,
      ok: r.ok,
      ...(r.ok ? {} : { error: datos?.error ?? datos?.codigo, mensaje: datos?.mensaje ?? datos?.mensaje_para_el_cliente }),
      ...(r.ok && nombre === 'consultar_disponibilidad' ? { horarios: (datos?.horarios_para_ofrecer as unknown[] | undefined)?.length ?? 0 } : {}),
    },
    'herramienta de la IA',
  );
  return r;
}

/**
 * Perdona los errores de formato típicos de un modelo chico, antes de validar:
 * el servicio por su nombre en vez del id ("Corte + Barba" en lugar de
 * corte_barba), la hora con espacios o sin cero adelante ("9:00", "10 hs").
 * Todo lo que no se puede corregir con seguridad se deja igual y lo rechaza
 * la validación de siempre.
 */
function corregirEntrada(entrada: unknown, llamador: Llamador): unknown {
  if (!entrada || typeof entrada !== 'object') return entrada;
  const e = { ...(entrada as Record<string, unknown>) };
  const cfg = llamador.ctx.cfg;

  if (typeof e.fecha === 'string') e.fecha = e.fecha.trim();

  if (typeof e.hora === 'string') {
    const h = e.hora.trim().toLowerCase().replace(/\s*(hs|h|horas)$/, '');
    const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(h);
    e.hora = m ? `${(m[1] ?? '').padStart(2, '0')}:${m[2] ?? '00'}` : h;
  }

  if (typeof e.servicio_id === 'string') {
    const id = e.servicio_id.trim();
    const existe = serviciosActivos(cfg).some((s) => s.id === id);
    e.servicio_id = existe ? id : (resolverServicio(cfg, id)?.id ?? id);
  }
  return e;
}

async function ejecutarSinRegistro(
  nombre: string,
  entradaCruda: unknown,
  llamador: Llamador,
): Promise<ResultadoHerramienta> {
  const esquema = esquemas[nombre as NombreHerramienta];
  if (!esquema) {
    return { ok: false, datos: { error: 'herramienta_desconocida', mensaje: `No existe la herramienta ${nombre}` } };
  }

  const parseo = esquema.safeParse(entradaCruda ?? {});
  if (!parseo.success) {
    return {
      ok: false,
      datos: {
        error: 'argumentos_invalidos',
        mensaje: parseo.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; '),
      },
    };
  }

  const { ctx, telefono } = llamador;
  const zona = ctx.cfg.negocio.timezone;
  const ahora = ctx.ahora();
  const entrada = parseo.data as Record<string, unknown>;

  // Una fecha pasada nunca tiene lugar, pero contestar "no hay lugar" hace que
  // el modelo le diga al cliente que está todo ocupado. Pasa cuando el modelo
  // se equivoca de año o de semana: mejor decírselo para que se corrija solo.
  if (typeof entrada.fecha === 'string' && ['consultar_disponibilidad', 'reservar_horario', 'modificar_turno'].includes(nombre)) {
    const hoy = ahora.setZone(zona).toISODate()!;
    if (entrada.fecha < hoy) {
      return {
        ok: false,
        datos: {
          error: 'FECHA_PASADA',
          mensaje: `La fecha ${entrada.fecha} ya pasó: hoy es ${hoy} (${fechaHumana(ahora.setZone(zona))}). Revisá el calendario de "Ahora mismo" y volvé a consultar con la fecha correcta. No le digas al cliente que no hay lugar.`,
        },
      };
    }
  }

  try {
    switch (nombre as NombreHerramienta) {
      case 'obtener_servicios':
        return {
          ok: true,
          datos: {
            // La duración no va: el negocio decidió no mostrársela al cliente,
            // y si el modelo la ve, la termina diciendo. La grilla de horarios
            // la sigue usando por dentro.
            servicios: obtenerServicios(ctx).map(({ duracion_min: _duracion, ...s }) => ({
              ...s,
              precio_texto: formatearPrecio(s.precio, ctx.cfg.negocio.moneda),
            })),
          },
        };

      case 'obtener_horarios_de_atencion':
        return { ok: true, datos: { ...obtenerHorariosAtencion(ctx), resumen: describirHorarios(ctx.cfg) } };

      case 'obtener_informacion_del_negocio':
        return { ok: true, datos: infoParaElModelo(ctx) };

      case 'consultar_disponibilidad': {
        const r = await consultarDisponibilidad(ctx, {
          fecha: entrada.fecha as string,
          servicioId: entrada.servicio_id as string,
          rango: (entrada.franja as 'mañana' | 'tarde' | 'noche' | undefined) ?? null,
          desdeHora: (entrada.desde_hora as string | undefined) ?? null,
          hastaHora: (entrada.hasta_hora as string | undefined) ?? null,
          // El horario que este mismo cliente tiene apartado no cuenta como
          // ocupado para él: si no, al volver a consultar ve su propio hold y
          // le dice que ya no hay lugar.
          excluirTurnoId: typeof llamador.estado.reservaPendiente === 'string' ? llamador.estado.reservaPendiente : undefined,
        });
        return {
          ok: true,
          datos: {
            fecha: r.fecha,
            dia: fechaHumana(DateTime.fromISO(r.fecha, { zone: zona })),
            abierto: r.abierto,
            motivo_cerrado: r.motivo_cerrado,
            servicio: r.servicio.nombre,
            horarios_para_ofrecer: r.horarios_sugeridos,
            todos_los_horarios_libres: r.horarios,
            hay_lugar: r.total_disponibles > 0,
            proximos_dias_con_lugar: r.proximos_dias_con_lugar.map((f) => ({
              fecha: f,
              dia: fechaHumana(DateTime.fromISO(f, { zone: zona })),
            })),
          },
        };
      }

      case 'reservar_horario': {
        const turno = await crearHold(ctx, {
          telefono,
          nombre: extraerNombre((entrada.nombre as string | undefined) ?? '') || llamador.nombreConocido,
          servicioId: entrada.servicio_id as string,
          fecha: entrada.fecha as string,
          hora: entrada.hora as string,
          origen: llamador.origen === 'simulador' ? 'simulador' : 'whatsapp',
        });
        llamador.estado.reservaPendiente = turno.id;
        registrarAccion(llamador, 'apartado', turno);
        return {
          ok: true,
          datos: {
            reserva_id: turno.id,
            vence_en_minutos: ctx.cfg.reglas.hold_minutos,
            resumen: resumirTurno(turno, zona, ahora),
            siguiente_paso:
              'Mostrale el resumen al cliente y preguntale si confirma. El turno NO existe hasta que llames a confirmar_reserva.',
            falta_nombre: !turno.nombreCliente,
          },
        };
      }

      case 'confirmar_reserva': {
        const datosConfirmacion = {
          telefono,
          nombre: extraerNombre((entrada.nombre as string | undefined) ?? '') || llamador.nombreConocido || undefined,
        };
        const pendiente = typeof llamador.estado.reservaPendiente === 'string' ? llamador.estado.reservaPendiente : undefined;
        // El cliente tiene que ver el resumen antes de que el turno quede
        // firme. Si el horario se apartó en este mismo mensaje, todavía no lo
        // vio: se frena y se le muestra.
        const apartadoRecien = llamador.acciones?.some((a) => a.tipo === 'apartado' && (a.turno.id === entrada.reserva_id || a.turno.id === pendiente));
        if (apartadoRecien) {
          return {
            ok: false,
            datos: {
              error: 'FALTA_QUE_EL_CLIENTE_CONFIRME',
              mensaje: 'El horario se acaba de apartar y el cliente todavía no vio el resumen. Mostráselo y preguntale si confirma; confirmá en su próximo mensaje.',
            },
          };
        }
        let turno;
        try {
          turno = await confirmarHold(ctx, entrada.reserva_id as string, datosConfirmacion);
        } catch (e) {
          // Si el modelo perdió o inventó el id, pero este cliente tiene un
          // único horario apartado, se confirma ese: es lo que el cliente está
          // confirmando. Cualquier otro error (venció, falta el nombre) sigue.
          if (!pendiente || pendiente === entrada.reserva_id || !esErrorDeNegocio(e) || e.codigo !== 'TURNO_NO_ENCONTRADO') throw e;
          turno = await confirmarHold(ctx, pendiente, datosConfirmacion);
        }
        delete llamador.estado.reservaPendiente;
        llamador.estado.ultimoTurno = turno.id;
        registrarAccion(llamador, 'confirmado', turno);
        return { ok: true, datos: { confirmado: true, turno: resumirTurno(turno, zona, ahora) } };
      }

      case 'soltar_reserva': {
        // Solo reservas temporales de este cliente. Antes esto cancelaba
        // cualquier turno (con "forzar"), y un id equivocado del modelo podía
        // bajar un turno ya confirmado sin que el cliente lo pidiera.
        const pendiente = typeof llamador.estado.reservaPendiente === 'string' ? llamador.estado.reservaPendiente : undefined;
        let hold = await turnoPorId(ctx, entrada.reserva_id as string);
        if ((!hold || hold.telefono !== telefono || hold.estado !== 'pendiente') && pendiente) hold = await turnoPorId(ctx, pendiente);
        if (!hold || hold.telefono !== telefono || hold.estado !== 'pendiente') {
          delete llamador.estado.reservaPendiente;
          return {
            ok: false,
            datos: {
              error: 'NO_ES_UNA_RESERVA_TEMPORAL',
              mensaje: 'No hay ningún horario apartado sin confirmar para soltar. Si el cliente quiere cancelar un turno confirmado, usá mis_turnos y cancelar_turno (con su confirmación).',
            },
          };
        }
        const soltado = await cancelarTurno(ctx, hold.id, { telefono, origen: 'whatsapp', forzar: true, motivo: 'el cliente cambio de idea' });
        delete llamador.estado.reservaPendiente;
        registrarAccion(llamador, 'soltado', soltado);
        return { ok: true, datos: { liberado: true } };
      }

      case 'mis_turnos': {
        const turnos = await turnosDeCliente(ctx, telefono);
        return {
          ok: true,
          datos: {
            cantidad: turnos.length,
            turnos: turnos.map((t) => resumirTurno(t, zona, ahora)),
            politica_cancelacion: ctx.cfg.reglas.politica_cancelacion,
          },
        };
      }

      case 'modificar_turno': {
        const turno = await modificarTurno(
          ctx,
          entrada.turno_id as string,
          {
            ...(entrada.fecha ? { fecha: entrada.fecha as string } : {}),
            ...(entrada.hora ? { hora: entrada.hora as string } : {}),
            ...(entrada.servicio_id ? { servicioId: entrada.servicio_id as string } : {}),
          },
          { telefono, origen: llamador.origen === 'simulador' ? 'simulador' : 'whatsapp' },
        );
        registrarAccion(llamador, 'modificado', turno);
        return { ok: true, datos: { modificado: true, turno: resumirTurno(turno, zona, ahora) } };
      }

      case 'cancelar_turno': {
        const turno = await cancelarTurno(ctx, entrada.turno_id as string, {
          telefono,
          origen: llamador.origen === 'simulador' ? 'simulador' : 'whatsapp',
          motivo: (entrada.motivo as string) ?? '',
        });
        registrarAccion(llamador, 'cancelado', turno);
        return { ok: true, datos: { cancelado: true, turno: resumirTurno(turno, zona, ahora) } };
      }

      case 'registrar_resena': {
        // El modelo no puede regalar descuentos: el backend verifica que de
        // verdad le hayamos pedido una resena a este cliente hace poco.
        const { registrarResenaDeCliente } = await import('../conversation/resenas.js');
        const r = await registrarResenaDeCliente(ctx, telefono, ahora.toMillis());
        if (!r.otorgado) {
          return { ok: false, datos: { error: 'sin_resena_pendiente', mensaje: r.motivo } };
        }
        return {
          ok: true,
          datos: { descuento_porcentaje: r.descuento, mensaje_sugerido: r.mensaje, vence_en_dias: ctx.cfg.resenas.vence_dias },
        };
      }

      case 'derivar_a_persona': {
        llamador.estado.pedidoDerivacion = { motivo: (entrada.motivo as string) ?? '', ts: ahora.toMillis() };
        return {
          ok: true,
          datos: { avisado: true, mensaje_sugerido: ctx.cfg.mensajes.derivacion_humana },
        };
      }
    }
  } catch (e) {
    if (esErrorDeNegocio(e)) {
      log.info({ herramienta: nombre, codigo: e.codigo }, 'herramienta rechazada por regla de negocio');
      return { ok: false, datos: { error: e.codigo, mensaje_para_el_cliente: e.mensajeCliente } };
    }
    log.error({ herramienta: nombre, err: e instanceof Error ? e.message : e }, 'error ejecutando herramienta');
    return {
      ok: false,
      datos: {
        error: 'error_interno',
        mensaje_para_el_cliente:
          'Estoy teniendo un inconveniente técnico para hacer eso. Dame un momento y volvé a intentar, por favor.',
      },
    };
  }
  return { ok: false, datos: { error: 'no_implementada' } };
}
