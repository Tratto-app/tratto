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
import type Anthropic from '@anthropic-ai/sdk';
import {
  cancelarTurno,
  confirmarHold,
  consultarDisponibilidad,
  crearHold,
  modificarTurno,
  obtenerHorariosAtencion,
  obtenerInfoNegocio,
  obtenerServicios,
  turnosDeCliente,
  type Contexto,
} from '../booking/servicio.js';
import { describirHorarios } from '../booking/disponibilidad.js';
import { esErrorDeNegocio } from '../shared/errores.js';
import { log } from '../shared/log.js';
import { esFechaValida, esHoraValida, fechaHumana, fechaRelativaHumana } from '../shared/tiempo.js';
import { formatearDuracion, formatearPrecio } from '../shared/texto.js';
import { DateTime } from 'luxon';

/** Contexto de quien esta hablando. Lo arma el backend, no el modelo. */
export interface Llamador {
  ctx: Contexto;
  telefono: string;
  nombreConocido: string;
  /** Estado de la conversacion; las herramientas pueden dejar rastros ahi. */
  estado: Record<string, unknown>;
  origen: 'whatsapp' | 'simulador';
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
} as const;

export type NombreHerramienta = keyof typeof esquemas;

/** Definiciones que se le mandan al modelo. El orden es fijo para no romper el cache. */
export const DEFINICIONES: Anthropic.Tool[] = [
  {
    name: 'obtener_servicios',
    description:
      'Lista los servicios activos con precio y duración. Usala antes de hablar de precios o duraciones: nunca los inventes ni los recuerdes de memoria.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'obtener_horarios_de_atencion',
    description: 'Días y horarios en los que atiende la barbería, más feriados y vacaciones cargados.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'obtener_informacion_del_negocio',
    description: 'Dirección, teléfono, Instagram, medios de pago y política de cancelación.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'consultar_disponibilidad',
    description:
      'Horarios realmente libres para un servicio en una fecha. Es la ÚNICA fuente válida de horarios: no ofrezcas ninguno que no haya salido de acá.',
    input_schema: {
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
    name: 'reservar_horario',
    description:
      'Aparta un horario por unos minutos mientras el cliente confirma. NO crea el turno definitivo. Después de llamarla tenés que mostrar el resumen y preguntar si confirma.',
    input_schema: {
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
    name: 'confirmar_reserva',
    description:
      'Convierte la reserva temporal en turno firme. Llamala SOLO después de que el cliente dijo explícitamente que sí, y sabiendo su nombre.',
    input_schema: {
      type: 'object',
      properties: {
        reserva_id: { type: 'string', description: 'El id que devolvió reservar_horario' },
        nombre: { type: 'string', description: 'Nombre del cliente' },
      },
      required: ['reserva_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'soltar_reserva',
    description: 'Libera una reserva temporal cuando el cliente cambia de idea antes de confirmar.',
    input_schema: {
      type: 'object',
      properties: { reserva_id: { type: 'string' } },
      required: ['reserva_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mis_turnos',
    description: 'Turnos vigentes del cliente con el que estás hablando. Usala antes de modificar o cancelar.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'modificar_turno',
    description:
      'Mueve un turno existente a otra fecha, hora o servicio. Antes verificá con consultar_disponibilidad que el horario nuevo esté libre.',
    input_schema: {
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
    name: 'cancelar_turno',
    description: 'Cancela un turno. Llamala SOLO después de que el cliente confirmó que quiere cancelarlo.',
    input_schema: {
      type: 'object',
      properties: { turno_id: { type: 'string' }, motivo: { type: 'string' } },
      required: ['turno_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'derivar_a_persona',
    description:
      'Avisa al barbero para que atienda personalmente y pausa las respuestas automáticas. Usala si el cliente pide hablar con alguien, se queja, o pide algo que no podés resolver.',
    input_schema: {
      type: 'object',
      properties: { motivo: { type: 'string' } },
      required: [],
      additionalProperties: false,
    },
  },
];

function resumirTurno(t: { id: string; fecha: string; horaInicio: string; horaFin: string; servicioNombre: string; precio: number; nombreCliente: string }, zona: string, ahora: DateTime) {
  const dt = DateTime.fromISO(`${t.fecha}T${t.horaInicio}`, { zone: zona });
  return {
    turno_id: t.id,
    fecha: t.fecha,
    dia: fechaHumana(dt),
    cuando: fechaRelativaHumana(dt, ahora),
    hora: t.horaInicio,
    hora_fin: t.horaFin,
    servicio: t.servicioNombre,
    precio: formatearPrecio(t.precio),
    cliente: t.nombreCliente,
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

  try {
    switch (nombre as NombreHerramienta) {
      case 'obtener_servicios':
        return {
          ok: true,
          datos: {
            servicios: obtenerServicios(ctx).map((s) => ({
              ...s,
              precio_texto: formatearPrecio(s.precio, ctx.cfg.negocio.moneda),
              duracion_texto: formatearDuracion(s.duracion_min),
            })),
          },
        };

      case 'obtener_horarios_de_atencion':
        return { ok: true, datos: { ...obtenerHorariosAtencion(ctx), resumen: describirHorarios(ctx.cfg) } };

      case 'obtener_informacion_del_negocio':
        return { ok: true, datos: obtenerInfoNegocio(ctx) };

      case 'consultar_disponibilidad': {
        const r = await consultarDisponibilidad(ctx, {
          fecha: entrada.fecha as string,
          servicioId: entrada.servicio_id as string,
          rango: (entrada.franja as 'mañana' | 'tarde' | 'noche' | undefined) ?? null,
          desdeHora: (entrada.desde_hora as string | undefined) ?? null,
          hastaHora: (entrada.hasta_hora as string | undefined) ?? null,
        });
        return {
          ok: true,
          datos: {
            fecha: r.fecha,
            dia: fechaHumana(DateTime.fromISO(r.fecha, { zone: zona })),
            abierto: r.abierto,
            motivo_cerrado: r.motivo_cerrado,
            servicio: r.servicio.nombre,
            duracion_min: r.servicio.duracion_min,
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
          nombre: (entrada.nombre as string) || llamador.nombreConocido,
          servicioId: entrada.servicio_id as string,
          fecha: entrada.fecha as string,
          hora: entrada.hora as string,
          origen: llamador.origen === 'simulador' ? 'simulador' : 'whatsapp',
        });
        llamador.estado.reservaPendiente = turno.id;
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
        const turno = await confirmarHold(ctx, entrada.reserva_id as string, {
          telefono,
          nombre: (entrada.nombre as string) || llamador.nombreConocido || undefined,
        });
        delete llamador.estado.reservaPendiente;
        llamador.estado.ultimoTurno = turno.id;
        return { ok: true, datos: { confirmado: true, turno: resumirTurno(turno, zona, ahora) } };
      }

      case 'soltar_reserva': {
        await cancelarTurno(ctx, entrada.reserva_id as string, { telefono, origen: 'whatsapp', forzar: true, motivo: 'el cliente cambio de idea' });
        delete llamador.estado.reservaPendiente;
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
        return { ok: true, datos: { modificado: true, turno: resumirTurno(turno, zona, ahora) } };
      }

      case 'cancelar_turno': {
        const turno = await cancelarTurno(ctx, entrada.turno_id as string, {
          telefono,
          origen: llamador.origen === 'simulador' ? 'simulador' : 'whatsapp',
          motivo: (entrada.motivo as string) ?? '',
        });
        return { ok: true, datos: { cancelado: true, turno: resumirTurno(turno, zona, ahora) } };
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
