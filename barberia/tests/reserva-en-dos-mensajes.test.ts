/**
 * Reservar en dos mensajes: el cliente elige el horario en uno y confirma en
 * el siguiente. Reproduce una conversación real de producción:
 *
 *   cliente: "quiero corte el jueves a las 10"   → la IA aparta el horario
 *   cliente: "sí, soy Santi"                      → la IA ya no lo veía
 *
 * El historial que ve el modelo es solo texto, así que en el segundo mensaje
 * no tenía el reserva_id. Volvía a consultar, su propio horario apartado le
 * figuraba ocupado y le decía al cliente "ya no hay lugar".
 *
 * Además, varios errores de formato típicos de un modelo chico que la
 * herramienta tiene que perdonar o explicar, en vez de contestar "no hay".
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { procesarMensaje } from '../src/conversation/orquestador.js';
import { turnosDeCliente } from '../src/booking/servicio.js';
import { ejecutarHerramienta } from '../src/ai/herramientas.js';
import type { ProveedorIA, PedidoInicial, RespuestaModelo, ResultadoDeHerramienta } from '../src/ai/proveedores/tipos.js';
import { contextoDePrueba, JUEVES, TELEFONO_A } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

/**
 * Modelo guionado: para cada mensaje del cliente, una lista de pasos. Guarda
 * lo que recibió (prompt volátil) y lo que le devolvieron las herramientas.
 */
function modeloGuionado(turnos: RespuestaModelo[][]) {
  const prompts: string[] = [];
  // Lo que ve el modelo: solo `datos` de cada herramienta, serializado.
  const resultados: Array<Record<string, unknown>> = [];
  let turno = 0;
  const proveedor: ProveedorIA = {
    nombre: 'openai',
    modelo: 'guionado',
    iniciar(pedido: PedidoInicial) {
      prompts.push(pedido.sistemaVolatil);
      const pasos = turnos[turno++] ?? [];
      let i = 0;
      return {
        async siguiente() {
          return pasos[i++] ?? { texto: 'listo', herramientas: [], motivo: 'texto' };
        },
        agregarResultados(rs: ResultadoDeHerramienta[]) {
          for (const r of rs) resultados.push(JSON.parse(r.contenido) as Record<string, unknown>);
        },
      };
    },
  };
  return { proveedor, prompts, resultados };
}

const herramienta = (nombre: string, entrada: unknown): RespuestaModelo => ({
  texto: '',
  herramientas: [{ id: `call_${nombre}`, nombre, entrada }],
  motivo: 'herramientas',
});
const texto = (t: string): RespuestaModelo => ({ texto: t, herramientas: [], motivo: 'texto' });

async function conContexto(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

async function decir(ctx: Ctx, proveedor: ProveedorIA, mensaje: string) {
  return procesarMensaje(
    ctx,
    { telefono: TELEFONO_A, texto: mensaje, idExterno: `m-${Math.random()}`, origen: 'whatsapp' },
    { proveedorIA: proveedor },
  );
}

describe('reservar en dos mensajes', () => {
  test('en el segundo mensaje la IA ve el horario apartado y su reserva_id', async () => {
    await conContexto(async (ctx) => {
      const { proveedor, prompts, resultados } = modeloGuionado([
        [herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte' }), texto('¿Confirmamos?')],
        [texto('¿Me pasás tu nombre?')],
      ]);
      await decir(ctx, proveedor, 'quiero corte el jueves a las 10');
      const reservaId = (resultados[0] as { reserva_id: string }).reserva_id;
      assert.ok(reservaId, 'se apartó el horario');

      await decir(ctx, proveedor, 'sí');
      assert.match(prompts[1] ?? '', /Horario apartado esperando que confirme/);
      assert.ok(prompts[1]?.includes(reservaId), 'el prompt del segundo mensaje trae el reserva_id');
    });
  });

  test('si vuelve a consultar, su propio horario apartado le figura libre', async () => {
    await conContexto(async (ctx) => {
      const { proveedor, resultados } = modeloGuionado([
        [herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte' }), texto('¿Confirmamos?')],
        [herramienta('consultar_disponibilidad', { fecha: JUEVES, servicio_id: 'corte' }), texto('ok')],
      ]);
      await decir(ctx, proveedor, 'corte el jueves a las 10');
      await decir(ctx, proveedor, 'dale');
      const libres = (resultados[1] as { todos_los_horarios_libres: string[] }).todos_los_horarios_libres;
      assert.ok(libres.includes('10:00'), `el 10:00 tendría que figurarle libre, salió: ${libres.join(', ')}`);
    });
  });

  test('otro cliente sí lo ve ocupado mientras está apartado', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = modeloGuionado([
        [herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte' }), texto('¿Confirmamos?')],
      ]);
      await decir(ctx, proveedor, 'corte el jueves a las 10');
      const otro = {
        ctx,
        telefono: '5491100000000',
        nombreConocido: '',
        estado: {},
        origen: 'whatsapp' as const,
      };
      const r = await ejecutarHerramienta('consultar_disponibilidad', { fecha: JUEVES, servicio_id: 'corte' }, otro);
      const libres = (r.datos as { todos_los_horarios_libres: string[] }).todos_los_horarios_libres;
      assert.ok(!libres.includes('10:00'), 'para otro cliente el horario apartado está ocupado');
    });
  });

  test('si la IA perdió el reserva_id e inventa uno, se confirma el que el cliente tiene apartado', async () => {
    await conContexto(async (ctx) => {
      const { proveedor } = modeloGuionado([
        [herramienta('reservar_horario', { fecha: JUEVES, hora: '10:00', servicio_id: 'corte' }), texto('¿Confirmamos?')],
        [herramienta('confirmar_reserva', { reserva_id: 'TUR-INVENTADO', nombre: 'Santi' }), texto('¡Listo!')],
      ]);
      await decir(ctx, proveedor, 'corte el jueves a las 10');
      await decir(ctx, proveedor, 'sí, soy Santi');
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]?.horaInicio, '10:00');
      assert.equal(turnos[0]?.estado, 'reservado');
      assert.equal(turnos[0]?.nombreCliente, 'Santi');
    });
  });
});

describe('errores de formato de un modelo chico', () => {
  const llamador = (ctx: Ctx) => ({ ctx, telefono: TELEFONO_A, nombreConocido: '', estado: {}, origen: 'whatsapp' as const });

  test('acepta el servicio por su nombre en vez del id', async () => {
    await conContexto(async (ctx) => {
      const r = await ejecutarHerramienta('consultar_disponibilidad', { fecha: JUEVES, servicio_id: 'Corte + Barba' }, llamador(ctx));
      assert.equal(r.ok, true);
      assert.equal((r.datos as { servicio: string }).servicio, 'Corte + Barba');
    });
  });

  test('acepta la hora como "10 hs", "9:00" o con espacios', async () => {
    await conContexto(async (ctx) => {
      for (const hora of ['10 hs', ' 10:00 ', '10']) {
        const r = await ejecutarHerramienta('reservar_horario', { fecha: JUEVES, hora, servicio_id: 'corte' }, llamador(ctx));
        assert.equal(r.ok, true, `"${hora}" tendría que andar: ${JSON.stringify(r.datos)}`);
        assert.equal((r.datos as { resumen: { hora: string } }).resumen.hora, '10:00');
      }
    });
  });

  test('una fecha pasada no se contesta como "no hay lugar": se explica qué día es hoy', async () => {
    await conContexto(async (ctx) => {
      const r = await ejecutarHerramienta('consultar_disponibilidad', { fecha: '2025-09-17', servicio_id: 'corte' }, llamador(ctx));
      assert.equal(r.ok, false);
      const datos = r.datos as { error: string; mensaje: string };
      assert.equal(datos.error, 'FECHA_PASADA');
      assert.match(datos.mensaje, /hoy es 2026-09-16/);
    });
  });
});
