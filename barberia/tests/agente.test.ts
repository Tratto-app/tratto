/**
 * Detalles del agente que no dependen del proveedor: cómo arma la conversación
 * y cómo limpia el texto antes de mandárselo al cliente.
 *
 * El loop de herramientas contra cada API está en proveedores.test.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { responder, ErrorIA } from '../src/ai/agente.js';
import type { ProveedorIA, PedidoInicial, RespuestaModelo } from '../src/ai/proveedores/tipos.js';
import { contextoDePrueba, TELEFONO_A, AHORA_FIJO } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

/** Proveedor de mentira: devuelve lo que se le indique y guarda lo que recibió. */
function proveedorFalso(respuestas: RespuestaModelo[] | (() => never)) {
  const recibido: PedidoInicial[] = [];
  let i = 0;
  const proveedor: ProveedorIA = {
    nombre: 'claude',
    modelo: 'falso',
    iniciar(pedido) {
      recibido.push(pedido);
      return {
        async siguiente() {
          if (typeof respuestas === 'function') respuestas();
          return respuestas[i++] ?? { texto: 'listo', herramientas: [], motivo: 'texto' };
        },
        agregarResultados() {},
      };
    },
  };
  return { proveedor, recibido };
}

const soloTexto = (texto: string): RespuestaModelo => ({ texto, herramientas: [], motivo: 'texto' });

async function conContexto(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

function pedido(ctx: Ctx, mensaje: string, historial: Array<{ rol: 'cliente' | 'bot'; texto: string }> = []) {
  return {
    mensaje,
    historial,
    datos: {
      ahora: AHORA_FIJO,
      cfg: ctx.cfg,
      nombreCliente: 'Agustín',
      esClienteConocido: true,
      cantidadDeVisitas: 3,
      turnosVigentes: [],
    },
    llamador: { ctx, telefono: TELEFONO_A, nombreConocido: 'Agustín', estado: {}, origen: 'whatsapp' as const },
  };
}

describe('armado de la conversación', () => {
  test('el historial y el mensaje nuevo llegan completos al proveedor', async () => {
    await conContexto(async (ctx) => {
      const { proveedor, recibido } = proveedorFalso([soloTexto('ok')]);
      await responder(
        pedido(ctx, 'el sábado', [
          { rol: 'cliente', texto: 'hola' },
          { rol: 'bot', texto: '¿qué servicio?' },
          { rol: 'cliente', texto: 'corte' },
        ]),
        proveedor,
      );
      const p = recibido[0]!;
      assert.equal(p.mensaje, 'el sábado');
      assert.equal(p.historial.length, 3);
      assert.ok(p.herramientas.length > 0, 'las herramientas tienen que viajar');
      assert.match(p.sistemaEstable, /NUNCA inventes horarios/);
      assert.match(p.sistemaVolatil, /2026-09-16 = miércoles/);
    });
  });
});

describe('limpieza de la respuesta', () => {
  test('saca markdown que WhatsApp no entiende', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = proveedorFalso([soloTexto('**Listo!** Te espero.')]);
      const r = await responder(pedido(ctx, 'dale'), proveedor);
      assert.ok(!r.texto.includes('**'));
      assert.match(r.texto, /\*Listo!\*/);
    });
  });

  test('no deja escapar ids internos', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = proveedorFalso([soloTexto('Reservé TUR-ABC123 para el sábado.')]);
      const r = await responder(pedido(ctx, 'dale'), proveedor);
      assert.ok(!r.texto.includes('TUR-ABC123'), `se filtró un id interno: ${r.texto}`);
    });
  });

  test('recorta respuestas demasiado largas para WhatsApp', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = proveedorFalso([soloTexto('palabra '.repeat(500))]);
      const r = await responder(pedido(ctx, 'contame todo'), proveedor);
      assert.ok(r.texto.length <= ctx.cfg.agente.max_caracteres_respuesta + 1);
    });
  });
});

describe('fallas del modelo', () => {
  test('si no devuelve texto, se considera fallo y no se contesta vacío', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = proveedorFalso([soloTexto('')]);
      await assert.rejects(
        () => responder(pedido(ctx, 'hola'), proveedor),
        (e: unknown) => e instanceof ErrorIA && e.motivo === 'sin_respuesta',
      );
    });
  });

  test('un error de la API se convierte en ErrorIA', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = proveedorFalso((() => {
        throw new Error('503 service unavailable');
      }) as () => never);
      await assert.rejects(
        () => responder(pedido(ctx, 'hola'), proveedor),
        (e: unknown) => e instanceof ErrorIA && e.motivo === 'api',
      );
    });
  });
});
