/**
 * Revisión de punta a punta del chat: que lo que lee el cliente y lo que queda
 * en la agenda del barbero sean siempre lo mismo, y que la charla no se rompa
 * con los casos de todos los días (dos mensajes seguidos, la IA que se corta,
 * un "sí" que no es un nombre, un "listo" que no es una reseña).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { procesarMensaje, confirmaResena } from '../src/conversation/orquestador.js';
import { crearHold, crearTurno, cancelarTurno, modificarTurno, turnosDeCliente, turnoPorId, agendaDelDia } from '../src/booking/servicio.js';
import { conversacionesRepo } from '../src/database/repositories/conversaciones.js';
import { calcularResumenSemanal } from '../src/reportes/semanal.js';
import type { ProveedorIA, PedidoInicial, RespuestaModelo } from '../src/ai/proveedores/tipos.js';
import { extraerNombre } from '../src/shared/texto.js';
import { contextoDePrueba, JUEVES, SABADO, TELEFONO_A, TELEFONO_B, moverReloj } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

async function conContexto(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

type Paso = RespuestaModelo | 'fallar' | { esperar: number; luego: RespuestaModelo };

/** Modelo guionado: una lista de pasos por mensaje del cliente. Guarda lo que recibió. */
function modeloGuionado(turnos: Paso[][]) {
  const mensajes: string[] = [];
  let turno = 0;
  const proveedor: ProveedorIA = {
    nombre: 'openai',
    modelo: 'guionado',
    iniciar(pedido: PedidoInicial) {
      mensajes.push(pedido.mensaje);
      const pasos = turnos[turno++] ?? [];
      let i = 0;
      return {
        async siguiente() {
          const paso = pasos[i++] ?? { texto: 'ok', herramientas: [], motivo: 'texto' as const };
          if (paso === 'fallar') throw new Error('529 overloaded');
          if ('esperar' in paso) {
            await new Promise((r) => setTimeout(r, paso.esperar));
            return paso.luego;
          }
          return paso;
        },
        agregarResultados() {},
      };
    },
  };
  return { proveedor, mensajes };
}

const herramienta = (nombre: string, entrada: unknown): RespuestaModelo => ({
  texto: '',
  herramientas: [{ id: `call_${nombre}_${Math.random()}`, nombre, entrada }],
  motivo: 'herramientas',
});
const texto = (t: string): RespuestaModelo => ({ texto: t, herramientas: [], motivo: 'texto' });

const decir = (ctx: Ctx, proveedor: ProveedorIA, mensaje: string, extra: { titulo?: string; telefono?: string } = {}) =>
  procesarMensaje(
    ctx,
    { telefono: extra.telefono ?? TELEFONO_A, texto: mensaje, ...(extra.titulo ? { titulo: extra.titulo } : {}), idExterno: `m-${Math.random()}`, origen: 'whatsapp' },
    { proveedorIA: proveedor },
  );

describe('lo que lee el cliente sale de la agenda, no de la redacción del modelo', () => {
  test('al apartar: ficha con servicio, día, hora y precio exactos, aunque el modelo diga otra cosa', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = modeloGuionado([
        [
          herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte' }),
          // El modelo se equivoca de día y de precio: el cliente no lo tiene que ver.
          texto('Te guardo el viernes a las 11 por $5000, ¿confirmamos?'),
        ],
      ]);
      const r = await decir(ctx, proveedor, 'corte el jueves a las 10');
      assert.match(r.texto, /Corte/);
      assert.match(r.texto, /Jueves 17\/09 \(mañana\)/);
      assert.match(r.texto, /10:00 hs/);
      assert.match(r.texto, /\$8\.000/);
      assert.match(r.texto, /tu nombre/i, 'cliente nuevo: se le pide el nombre para confirmar');
      assert.doesNotMatch(r.texto, /viernes|11|5000/i);
      assert.doesNotMatch(r.texto, /\bmin\b/, 'sin duraciones');
    });
  });

  test('al confirmar: el mensaje trae los datos guardados y el turno queda en la agenda del barbero', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = modeloGuionado([
        [herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte' }), texto('¿Confirmamos?')],
        [herramienta('confirmar_reserva', { reserva_id: 'X', nombre: 'Santi' }), texto('¡Listo Santi, te espero el sábado!')],
      ]);
      await decir(ctx, proveedor, 'corte el jueves a las 10');
      const r = await decir(ctx, proveedor, 'sí, soy Santi');
      assert.match(r.texto, /¡Listo, Santi! ✅/);
      assert.match(r.texto, /quedó confirmado/);
      assert.match(r.texto, /Jueves 17\/09/);
      assert.match(r.texto, /10:00 hs/);
      assert.doesNotMatch(r.texto, /sábado/i, 'el error del modelo no llega al cliente');

      const agenda = await agendaDelDia(ctx, JUEVES);
      const turno = agenda.turnos.find((t) => t.telefono === TELEFONO_A);
      assert.ok(turno, 'el turno tiene que estar en la agenda del barbero');
      assert.equal(turno.estado, 'reservado');
      assert.equal(turno.horaInicio, '10:00');
      assert.equal(turno.nombreCliente, 'Santi');
      assert.equal(turno.servicioNombre, 'Corte');
    });
  });

  test('si el modelo se corta después de confirmar, el cliente igual se entera de que quedó confirmado', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = modeloGuionado([
        [herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte', nombre: 'Santi' }), texto('¿Confirmamos?')],
        [herramienta('confirmar_reserva', { reserva_id: 'X' }), 'fallar'],
      ]);
      await decir(ctx, proveedor, 'corte el jueves a las 10, soy Santi');
      const r = await decir(ctx, proveedor, 'dale');
      assert.match(r.texto, /quedó confirmado/, `respuesta: ${r.texto}`);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 1);
    });
  });

  test('si la IA se cae justo cuando el cliente dice "sí", el menú confirma ese mismo horario', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = modeloGuionado([
        [herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte', nombre: 'Santi' }), texto('¿Confirmamos?')],
        ['fallar'],
      ]);
      await decir(ctx, proveedor, 'corte el jueves a las 10, soy Santi');
      const r = await decir(ctx, proveedor, 'sí');
      assert.equal(r.usoIA, false);
      assert.match(r.texto, /quedó confirmado/, `respuesta: ${r.texto}`);
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.horaInicio, '10:00');
    });
  });
});

describe('dos mensajes seguidos del mismo cliente', () => {
  test('se atienden de a uno: el segundo no pisa el horario que apartó el primero', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = modeloGuionado([
        [{ esperar: 60, luego: herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte' }) }, texto('¿Confirmamos?')],
        [texto('¡Hola! Ya te respondo.')],
      ]);
      // Llegan casi juntos, como dos webhooks de WhatsApp.
      await Promise.all([decir(ctx, proveedor, 'corte el jueves a las 10'), decir(ctx, proveedor, 'hola?')]);

      const conv = await conversacionesRepo.obtener(ctx.db, TELEFONO_A);
      assert.ok((conv.estado as Record<string, unknown>).reservaPendiente, 'se perdió el horario apartado');
      assert.equal(conv.historial.length, 4, 'tienen que quedar los dos mensajes y las dos respuestas');
      assert.equal(conv.historial[0]!.texto, 'corte el jueves a las 10', 'en orden de llegada');
    });
  });
});

describe('botones', () => {
  test('la IA recibe lo que decía el botón, no su id interno', async () => {
    await conContexto(async (ctx) => {
      const { proveedor, mensajes } = modeloGuionado([[texto('ok')]]);
      await decir(ctx, proveedor, 'confirmar_si', { titulo: '✅ Sí, confirmar' });
      assert.equal(mensajes[0], '✅ Sí, confirmar');
      const conv = await conversacionesRepo.obtener(ctx.db, TELEFONO_A);
      assert.equal(conv.historial[0]!.texto, '✅ Sí, confirmar', 'el historial también muestra lo que leyó el cliente');
    });
  });
});

describe('nombres', () => {
  const casos: Array<[string, string]> = [
    ['Santi', 'Santi'],
    ['soy Santi', 'Santi'],
    ['sí, soy Santi', 'Santi'],
    ['me llamo Juan Pérez', 'Juan Pérez'],
    ['a nombre de Lucas', 'Lucas'],
    ['maria de los angeles', 'Maria de los Angeles'],
    ['Sí', ''],
    ['dale', ''],
    ['hola', ''],
    ['gracias!', ''],
    ['123', ''],
    ['quiero reservar un turno para mañana a la tarde', ''],
  ];
  for (const [entrada, esperado] of casos) {
    test(`"${entrada}" → "${esperado}"`, () => assert.equal(extraerNombre(entrada), esperado));
  }
});

describe('reseñas', () => {
  test('un "listo" o "ya está" suelto no es una reseña', () => {
    for (const t of ['listo', 'ya está', 'hecho', 'listo gracias', 'dale']) assert.equal(confirmaResena(t), false, t);
  });
  test('sí lo es cuando lo dice claro', () => {
    for (const t of ['ya la dejé', 'la subí recién', 'listo, ya dejé la reseña', 'ya puse las 5 estrellas en google', 'resena_hecha']) {
      assert.equal(confirmaResena(t), true, t);
    }
  });
});

describe('menú sin IA', () => {
  const sinIA: ProveedorIA = {
    nombre: 'claude',
    modelo: 'caido',
    iniciar: () => ({
      async siguiente(): Promise<never> {
        throw new Error('caido');
      },
      agregarResultados() {},
    }),
  };

  test('"cambiar mi turno" lo mueve de verdad: no lo cancela ni deja al cliente sin turno', async () => {
    await conContexto(async (ctx) => {
      const original = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '11:00', origen: 'whatsapp' });
      const pregunta = await decir(ctx, sinIA, 'quiero cambiar mi turno');
      assert.match(pregunta.texto, /qué día/i);
      await decir(ctx, sinIA, `dia_${SABADO}`);
      const confirma = await decir(ctx, sinIA, 'hora_17:00');
      assert.match(confirma.texto, /Antes: .*11:00/);
      assert.match(confirma.texto, /Ahora: .*17:00/);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A))[0]!.horaInicio, '11:00', 'hasta que diga que sí, no se toca');

      const listo = await decir(ctx, sinIA, 'cambio_si');
      assert.match(listo.texto, /quedó así/);
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.horaInicio, '17:00');
      assert.equal((await turnoPorId(ctx, original.id))?.estado, 'cancelado');
    });
  });

  test('una respuesta que no es ni sí ni no, al confirmar, no suelta el horario', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín']) await decir(ctx, sinIA, m);
      const r = await decir(ctx, sinIA, 'y cuánto sale?');
      assert.match(r.texto, /confirmo/i);
      const conv = await conversacionesRepo.obtener(ctx.db, TELEFONO_A);
      const id = (conv.estado as { reservaPendiente?: string }).reservaPendiente;
      assert.ok(id);
      assert.equal((await turnoPorId(ctx, id))?.estado, 'pendiente', 'el horario sigue guardado');
      const ok = await decir(ctx, sinIA, 'perfecto');
      assert.match(ok.texto, /quedó confirmado/);
    });
  });

  test('"corte el sábado" en el primer mensaje va directo a los horarios de ese día', async () => {
    await conContexto(async (ctx) => {
      const r = await decir(ctx, sinIA, 'quiero un corte el sábado');
      assert.match(r.texto, /horarios/i);
      assert.match(r.texto, /sábado 19\/09/i);
    });
  });

  test('a "¿me pasás tu nombre?" un "sí" no queda como nombre', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30']) await decir(ctx, sinIA, m);
      const r = await decir(ctx, sinIA, 'sí');
      assert.match(r.texto, /nombre/i);
      const resumen = await decir(ctx, sinIA, 'soy Agustín');
      assert.match(resumen.texto, /👤 Agustín/);
    });
  });
});

describe('reglas de la agenda', () => {
  test('sobre la hora el cliente no puede mover el turno (el panel sí)', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: JUEVES, hora: '10:00', origen: 'whatsapp' });
      moverReloj(ctx, 22 * 60 + 30); // jueves 09:30: falta media hora
      await assert.rejects(
        () => modificarTurno(ctx, t.id, { hora: '16:00' }, { telefono: TELEFONO_A, origen: 'whatsapp' }),
        (e: unknown) => (e as { codigo?: string }).codigo === 'CANCELACION_TARDIA',
      );
      const movido = await modificarTurno(ctx, t.id, { hora: '16:00' }, { origen: 'panel' });
      assert.equal(movido.horaInicio, '16:00');
    });
  });

  test('el balance no cuenta como cancelado un horario que nadie confirmó ni un turno que se movió', async () => {
    await conContexto(async (ctx) => {
      const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '11:00' });
      await cancelarTurno(ctx, hold.id, { telefono: TELEFONO_A, origen: 'whatsapp', forzar: true });
      const t = await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '12:00', origen: 'whatsapp' });
      await modificarTurno(ctx, t.id, { hora: '17:00' }, { telefono: TELEFONO_B, origen: 'whatsapp' });

      const r = await calcularResumenSemanal(ctx, { incluirFuturos: true });
      assert.equal(r.cancelados, 0);
      const agenda = await agendaDelDia(ctx, SABADO);
      assert.deepEqual(agenda.turnos.map((x) => x.horaInicio), ['17:00'], 'el barbero ve solo el turno vigente');
    });
  });
});
