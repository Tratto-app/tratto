/**
 * Los dos proveedores, contra un servidor que imita sus APIs.
 *
 * No se gastan tokens ni hacen falta claves: lo que se verifica es que cada
 * adaptador arme bien el pedido y lea bien la respuesta, que es donde se rompen
 * estas integraciones.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { levantarModeloFalso } = await import('./modelo-falso.js');
const modelo = await levantarModeloFalso();

process.env.NODE_ENV = 'test';
process.env.AI_BASE_URL = modelo.urlClaude;
process.env.OPENAI_BASE_URL = modelo.urlOpenAI;
process.env.AI_API_KEY = 'clave-falsa';
process.env.OPENAI_API_KEY = 'clave-falsa';

const { crearProveedorClaude } = await import('../src/ai/proveedores/claude.js');
const { crearProveedorOpenAI } = await import('../src/ai/proveedores/openai.js');
const { responder, ErrorIA } = await import('../src/ai/agente.js');
const { DEFINICIONES } = await import('../src/ai/herramientas.js');
const { crearTurno, turnosDeCliente } = await import('../src/booking/servicio.js');
const { contextoDePrueba, SABADO, TELEFONO_A, TELEFONO_B, AHORA_FIJO } = await import('./helpers.js');

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

const proveedores = [
  { nombre: 'claude', crear: () => crearProveedorClaude({ apiKey: 'x', modelo: 'falso' }) },
  { nombre: 'openai', crear: () => crearProveedorOpenAI({ apiKey: 'x', modelo: 'falso' }) },
];

let ctx: Ctx;

beforeEach(async () => {
  if (ctx) await ctx.cerrar();
  ctx = await contextoDePrueba();
  modelo.pedidos.length = 0;
  modelo.guion = [];
});

after(async () => {
  await ctx?.cerrar();
  await modelo.cerrar();
});

function pedidoBase(ctxActual: Ctx, mensaje: string) {
  return {
    mensaje,
    historial: [],
    datos: {
      ahora: AHORA_FIJO,
      cfg: ctxActual.cfg,
      nombreCliente: 'Agustín',
      esClienteConocido: true,
      cantidadDeVisitas: 2,
      turnosVigentes: [],
    },
    llamador: { ctx: ctxActual, telefono: TELEFONO_A, nombreConocido: 'Agustín', estado: {}, origen: 'whatsapp' as const },
  };
}

for (const p of proveedores) {
  describe(`proveedor ${p.nombre}`, () => {
    test('contesta texto simple', async () => {
      modelo.guion = [{ texto: '¡Buenas! ¿Qué día te viene bien? ✂️' }];
      const r = await responder(pedidoBase(ctx, 'hola'), p.crear());
      assert.match(r.texto, /qué día/i);
      assert.equal(r.proveedor, p.nombre);
      assert.equal(r.iteraciones, 1);
    });

    test('ejecuta la herramienta que pide y sigue la conversación', async () => {
      modelo.guion = [
        { herramientas: [{ nombre: 'consultar_disponibilidad', entrada: { fecha: SABADO, servicio_id: 'corte' } }] },
        { texto: 'Para el sábado tengo 15:00 y 17:30. ¿Cuál te sirve?' },
      ];
      const r = await responder(pedidoBase(ctx, '¿tenés lugar el sábado?'), p.crear());
      assert.deepEqual(r.herramientasUsadas, ['consultar_disponibilidad']);
      assert.equal(r.iteraciones, 2);
      assert.match(r.texto, /17:30/);
    });

    test('una reserva confirmada por el modelo queda en la base', async () => {
      modelo.guion = [
        { herramientas: [{ nombre: 'reservar_horario', entrada: { fecha: SABADO, hora: '17:30', servicio_id: 'corte' } }] },
        { texto: 'Antes de confirmar: corte, sábado 17:30. ¿Confirmamos?' },
      ];
      const pedido = pedidoBase(ctx, 'quiero el sábado a las 17:30');
      await responder(pedido, p.crear());
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0, 'todavía es una reserva temporal');

      modelo.guion = [
        { herramientas: [{ nombre: 'confirmar_reserva', entrada: { reserva_id: String(pedido.llamador.estado.reservaPendiente), nombre: 'Agustín' } }] },
        { texto: '¡Listo, Agustín! Te esperamos ✂️' },
      ];
      await responder({ ...pedido, mensaje: 'dale' }, p.crear());
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.horaInicio, '17:30');
    });

    test('le devuelve al modelo el error de una herramienta que falla', async () => {
      await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:30', origen: 'whatsapp' });
      modelo.guion = [
        { herramientas: [{ nombre: 'reservar_horario', entrada: { fecha: SABADO, hora: '17:30', servicio_id: 'corte' } }] },
        { texto: 'Uy, se ocupó. Tengo 18:15.' },
      ];
      const r = await responder(pedidoBase(ctx, 'quiero las 17:30'), p.crear());
      assert.match(r.texto, /ocupó/);

      const ultimoPedido = modelo.pedidos[modelo.pedidos.length - 1]!.cuerpo;
      assert.match(JSON.stringify(ultimoPedido), /HORARIO_OCUPADO/, 'el modelo tiene que enterarse del error');
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);
    });

    test('un rechazo del modelo se convierte en ErrorIA', async () => {
      modelo.guion = [{ rehusar: true }];
      await assert.rejects(
        () => responder(pedidoBase(ctx, 'hola'), p.crear()),
        (e: unknown) => e instanceof ErrorIA && e.motivo === 'rehuso',
      );
    });

    test('manda todas las herramientas con nombre, descripción y esquema', async () => {
      modelo.guion = [{ texto: 'ok' }];
      await responder(pedidoBase(ctx, 'hola'), p.crear());
      const cuerpo = JSON.stringify(modelo.pedidos[0]!.cuerpo);
      for (const definicion of DEFINICIONES) {
        assert.ok(cuerpo.includes(definicion.nombre), `falta la herramienta ${definicion.nombre}`);
      }
      assert.match(cuerpo, /NUNCA inventes horarios/, 'el prompt de reglas tiene que viajar');
      assert.match(cuerpo, /2026-09-16 = miércoles/, 'y el calendario del día también');
    });

    test('corta si el modelo se queda pidiendo herramientas para siempre', async () => {
      modelo.guion = Array.from({ length: 30 }, () => ({
        texto: 'un momento',
        herramientas: [{ nombre: 'obtener_servicios', entrada: {} }],
      }));
      const r = await responder(pedidoBase(ctx, 'hola'), p.crear());
      assert.ok(r.iteraciones <= 6, `iteró ${r.iteraciones} veces`);
      assert.ok(r.texto.length > 0);
    });
  });
}

describe('diferencias propias de cada protocolo', () => {
  test('Claude manda el prompt estable cacheado y aparte del volátil', async () => {
    modelo.guion = [{ texto: 'ok' }];
    await responder(pedidoBase(ctx, 'hola'), crearProveedorClaude({ apiKey: 'x', modelo: 'falso' }));
    const cuerpo = modelo.pedidos[0]!.cuerpo as { system: Array<{ text: string; cache_control?: unknown }> };
    assert.equal(cuerpo.system.length, 2);
    assert.deepEqual(cuerpo.system[0]!.cache_control, { type: 'ephemeral' });
    assert.equal(cuerpo.system[1]!.cache_control, undefined);
  });

  test('OpenAI manda el sistema en instructions y las herramientas planas', async () => {
    modelo.guion = [{ texto: 'ok' }];
    await responder(pedidoBase(ctx, 'hola'), crearProveedorOpenAI({ apiKey: 'x', modelo: 'falso' }));
    const cuerpo = modelo.pedidos[0]!.cuerpo as {
      instructions: string;
      tools: Array<{ type: string; name: string; parameters: unknown }>;
      input: Array<{ role?: string; content?: unknown }>;
    };
    assert.match(cuerpo.instructions, /NUNCA inventes horarios/);
    assert.equal(cuerpo.tools[0]!.type, 'function');
    assert.equal(cuerpo.tools[0]!.name, DEFINICIONES[0]!.nombre);
    assert.ok(cuerpo.tools[0]!.parameters, 'las herramientas van con su JSON Schema');
    assert.equal(cuerpo.input.at(-1)!.role, 'user');
  });

  test('OpenAI devuelve los resultados como function_call_output', async () => {
    modelo.guion = [
      { herramientas: [{ nombre: 'obtener_servicios', entrada: {} }] },
      { texto: 'Hacemos corte, barba y corte + barba.' },
    ];
    await responder(pedidoBase(ctx, 'qué hacen'), crearProveedorOpenAI({ apiKey: 'x', modelo: 'falso' }));
    const segundo = modelo.pedidos[1]!.cuerpo as { input: Array<Record<string, unknown>> };
    const salida = segundo.input.find((i) => i.type === 'function_call_output');
    assert.ok(salida, 'falta el resultado de la herramienta');
    assert.ok(String(salida.call_id).startsWith('call_'));
  });

  test('si OpenAI manda argumentos rotos, la validación los rechaza sin romper', async () => {
    modelo.guion = [
      { herramientas: [{ nombre: 'consultar_disponibilidad', entrada: { fecha: 'el sábado' } }] },
      { texto: '¿Para qué día lo querés?' },
    ];
    const r = await responder(pedidoBase(ctx, 'el sábado'), crearProveedorOpenAI({ apiKey: 'x', modelo: 'falso' }));
    assert.match(r.texto, /qué día/i);
    assert.match(JSON.stringify(modelo.pedidos[1]!.cuerpo), /argumentos_invalidos/);
  });
});
