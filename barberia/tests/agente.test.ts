/**
 * Loop de herramientas del agente, con un modelo simulado.
 *
 * No se llama a la API de Anthropic: se inyecta un doble que devuelve las
 * respuestas que interesan probar (pide herramienta, contesta, se rehúsa,
 * falla). Así se verifica el contrato del agente sin gastar tokens.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import { responder, ErrorIA, type ClienteIA } from '../src/ai/agente.js';
import type { Llamador } from '../src/ai/herramientas.js';
import { turnosDeCliente, crearTurno } from '../src/booking/servicio.js';
import { contextoDePrueba, SABADO, TELEFONO_A, TELEFONO_B, AHORA_FIJO } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

function mensaje(contenido: Anthropic.Beta.BetaContentBlock[], stop: Anthropic.Beta.BetaStopReason): Anthropic.Beta.BetaMessage {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: contenido,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as unknown as Anthropic.Beta.BetaMessage;
}

const texto = (t: string) => ({ type: 'text' as const, text: t, citations: null }) as unknown as Anthropic.Beta.BetaContentBlock;
const usoDeHerramienta = (name: string, input: unknown, id = `tu_${name}`) =>
  ({ type: 'tool_use' as const, id, name, input }) as unknown as Anthropic.Beta.BetaContentBlock;

/** Cliente falso: devuelve la lista de respuestas en orden y guarda lo que recibió. */
function clienteFalso(respuestas: Anthropic.Beta.BetaMessage[] | (() => never)) {
  const recibido: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  let i = 0;
  const cliente: ClienteIA = {
    async crear(parametros) {
      recibido.push(parametros);
      if (typeof respuestas === 'function') respuestas();
      const r = respuestas[i++];
      if (!r) throw new Error('el test no preparó suficientes respuestas');
      return r;
    },
  };
  return { cliente, recibido };
}

async function armar(ctx: Ctx, telefono = TELEFONO_A) {
  const llamador: Llamador = { ctx, telefono, nombreConocido: 'Agustín', estado: {}, origen: 'whatsapp' };
  return {
    llamador,
    datos: {
      ahora: AHORA_FIJO,
      cfg: ctx.cfg,
      nombreCliente: 'Agustín',
      esClienteConocido: true,
      cantidadDeVisitas: 3,
      turnosVigentes: [],
    },
  };
}

async function conContexto(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

describe('loop de herramientas', () => {
  test('ejecuta la herramienta que pide el modelo y devuelve el texto final', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente, recibido } = clienteFalso([
        mensaje([usoDeHerramienta('consultar_disponibilidad', { fecha: SABADO, servicio_id: 'corte' })], 'tool_use'),
        mensaje([texto('Para el sábado tengo 15:00, 16:00 y 17:30. ¿Cuál te sirve?')], 'end_turn'),
      ]);

      const r = await responder({ mensaje: '¿tenés lugar el sábado?', historial: [], datos, llamador }, cliente);

      assert.deepEqual(r.herramientasUsadas, ['consultar_disponibilidad']);
      assert.equal(r.iteraciones, 2);
      assert.match(r.texto, /17:30/);

      // La segunda llamada tiene que incluir el resultado de la herramienta.
      const segunda = recibido[1]!;
      const ultimo = segunda.messages[segunda.messages.length - 1]!;
      assert.equal(ultimo.role, 'user');
      const bloques = ultimo.content as Anthropic.Beta.BetaContentBlockParam[];
      assert.equal(bloques[0]!.type, 'tool_result');
    });
  });

  test('el prompt estable va cacheado y separado de lo que cambia', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente, recibido } = clienteFalso([mensaje([texto('¡Hola!')], 'end_turn')]);
      await responder({ mensaje: 'hola', historial: [], datos, llamador }, cliente);

      const sistema = recibido[0]!.system as Anthropic.Beta.BetaTextBlockParam[];
      assert.equal(sistema.length, 2);
      assert.deepEqual(sistema[0]!.cache_control, { type: 'ephemeral' });
      assert.equal(sistema[1]!.cache_control, undefined);
      assert.match(sistema[0]!.text, /NUNCA inventes horarios/);
      assert.match(sistema[1]!.text, /2026-09-16 = miércoles/, 'el calendario tiene que ir en la parte volátil');
    });
  });

  test('una reserva confirmada por el modelo queda realmente en la base', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente } = clienteFalso([
        mensaje([usoDeHerramienta('reservar_horario', { fecha: SABADO, hora: '17:30', servicio_id: 'corte' })], 'tool_use'),
        mensaje([texto('Antes de confirmar: corte, sábado 17:30, Agustín. ¿Confirmamos?')], 'end_turn'),
      ]);
      await responder({ mensaje: 'quiero el sábado a las 17:30', historial: [], datos, llamador }, cliente);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0, 'todavía es solo una reserva temporal');

      const reservaId = String(llamador.estado.reservaPendiente);
      const { cliente: cliente2 } = clienteFalso([
        mensaje([usoDeHerramienta('confirmar_reserva', { reserva_id: reservaId, nombre: 'Agustín' })], 'tool_use'),
        mensaje([texto('¡Listo, Agustín! Te esperamos el sábado a las 17:30 ✂️')], 'end_turn'),
      ]);
      await responder({ mensaje: 'dale, confirmá', historial: [], datos, llamador }, cliente2);

      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.horaInicio, '17:30');
    });
  });

  test('si la herramienta falla, el modelo recibe el error y no se corta el flujo', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:30', origen: 'whatsapp' });
      const { llamador, datos } = await armar(ctx);
      const { cliente, recibido } = clienteFalso([
        mensaje([usoDeHerramienta('reservar_horario', { fecha: SABADO, hora: '17:30', servicio_id: 'corte' })], 'tool_use'),
        mensaje([texto('Uy, justo se ocupó. Tengo 18:15 o 19:00.')], 'end_turn'),
      ]);
      const r = await responder({ mensaje: 'quiero las 17:30', historial: [], datos, llamador }, cliente);

      const bloques = recibido[1]!.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
      assert.equal(bloques[0]!.is_error, true);
      assert.match(String(bloques[0]!.content), /HORARIO_OCUPADO/);
      assert.match(r.texto, /ocupó/);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);
    });
  });

  test('corta si el modelo se queda en loop pidiendo herramientas', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const enBucle = Array.from({ length: 20 }, () =>
        mensaje([texto('un momento'), usoDeHerramienta('obtener_servicios', {})], 'tool_use'),
      );
      const { cliente } = clienteFalso(enBucle);
      const r = await responder({ mensaje: 'hola', historial: [], datos, llamador }, cliente);
      assert.ok(r.iteraciones <= 6, `iteró ${r.iteraciones} veces`);
      assert.ok(r.texto.length > 0);
    });
  });
});

describe('manejo de fallas del modelo', () => {
  test('un rehúso del modelo se convierte en ErrorIA (el orquestador cae al menú)', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente } = clienteFalso([mensaje([], 'refusal' as Anthropic.Beta.BetaStopReason)]);
      await assert.rejects(
        () => responder({ mensaje: 'hola', historial: [], datos, llamador }, cliente),
        (e: unknown) => e instanceof ErrorIA && e.motivo === 'rehuso',
      );
    });
  });

  test('un error de la API se convierte en ErrorIA', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente } = clienteFalso((() => {
        throw new Error('503 service unavailable');
      }) as () => never);
      await assert.rejects(
        () => responder({ mensaje: 'hola', historial: [], datos, llamador }, cliente),
        (e: unknown) => e instanceof ErrorIA && e.motivo === 'api',
      );
    });
  });

  test('si el modelo no devuelve texto, se considera fallo y no se responde vacío', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente } = clienteFalso([mensaje([], 'end_turn')]);
      await assert.rejects(
        () => responder({ mensaje: 'hola', historial: [], datos, llamador }, cliente),
        (e: unknown) => e instanceof ErrorIA && e.motivo === 'sin_respuesta',
      );
    });
  });
});

describe('armado de la conversación', () => {
  test('el historial se manda alternando roles y arrancando por el cliente', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente, recibido } = clienteFalso([mensaje([texto('ok')], 'end_turn')]);
      await responder(
        {
          mensaje: 'el sábado',
          historial: [
            { rol: 'bot', texto: 'primer mensaje del bot que hay que descartar' },
            { rol: 'cliente', texto: 'hola' },
            { rol: 'bot', texto: '¿qué servicio?' },
            { rol: 'cliente', texto: 'corte' },
            { rol: 'cliente', texto: 'para mí' },
          ],
          datos,
          llamador,
        },
        cliente,
      );

      const mensajes = recibido[0]!.messages;
      assert.equal(mensajes[0]!.role, 'user', 'la conversación tiene que arrancar con el cliente');
      for (let i = 1; i < mensajes.length; i++) {
        assert.notEqual(mensajes[i]!.role, mensajes[i - 1]!.role, 'no puede haber dos turnos seguidos del mismo rol');
      }
      assert.match(String(mensajes.at(-1)!.content), /el sábado/);
    });
  });

  test('limpia markdown y no filtra ids internos al cliente', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente } = clienteFalso([
        mensaje([texto('**Listo!** Reservé TUR-ABC123 para el sábado.')], 'end_turn'),
      ]);
      const r = await responder({ mensaje: 'dale', historial: [], datos, llamador }, cliente);
      assert.ok(!r.texto.includes('**'));
      assert.ok(!r.texto.includes('TUR-ABC123'), `se filtró un id interno: ${r.texto}`);
    });
  });

  test('recorta respuestas demasiado largas para WhatsApp', async () => {
    await conContexto(async (ctx) => {
      const { llamador, datos } = await armar(ctx);
      const { cliente } = clienteFalso([mensaje([texto('palabra '.repeat(500))], 'end_turn')]);
      const r = await responder({ mensaje: 'contame todo', historial: [], datos, llamador }, cliente);
      assert.ok(r.texto.length <= ctx.cfg.agente.max_caracteres_respuesta + 1);
    });
  });
});
