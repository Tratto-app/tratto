/**
 * Tope de turnos por día: con ese número, el día se da por completo aunque la
 * agenda tenga huecos, y al cliente se le ofrece el horario libre más cercano
 * de los días siguientes.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  agendaDelDia,
  cancelarTurno,
  consultarDisponibilidad,
  crearHold,
  crearTurno,
  modificarTurno,
} from '../src/booking/servicio.js';
import { procesarMensaje } from '../src/conversation/orquestador.js';
import { ejecutarHerramienta } from '../src/ai/herramientas.js';
import type { ProveedorIA } from '../src/ai/proveedores/tipos.js';
import { contextoDePrueba, moverReloj, SABADO, TELEFONO_A, TELEFONO_B } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

/** Contexto con tope de 2 turnos por día (más fácil de llenar que 7). */
async function conTope(fn: (ctx: Ctx) => Promise<void>, maximo = 2) {
  const ctx = await contextoDePrueba();
  ctx.cfg = { ...ctx.cfg, reglas: { ...ctx.cfg.reglas, max_turnos_por_dia: maximo } };
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

const TEL_C = '5491177778888';
const TEL_D = '5491199990000';

async function llenarSabado(ctx: Ctx) {
  await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '10:00', origen: 'whatsapp' });
  await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '11:00', origen: 'whatsapp' });
}

describe('tope de turnos por día', () => {
  test('con el tope alcanzado el día no ofrece horarios, aunque tenga huecos', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      assert.equal(r.dia_completo, true);
      assert.deepEqual(r.horarios, []);
      // Sábado 19 → lunes 21 es feriado en los tests → el siguiente con lugar es el martes 22.
      assert.deepEqual(r.primer_horario_libre, { fecha: '2026-09-22', hora: '10:00' });
      assert.ok(r.proximos_dias_con_lugar.length > 0);
      const agenda = await agendaDelDia(ctx, SABADO);
      assert.equal(agenda.huecos_libres.length, 0, 'el panel tampoco muestra lugares libres');
    });
  });

  test('nadie puede reservar ese día por WhatsApp, ni apartando ni directo', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
      await assert.rejects(
        () => crearHold(ctx, { telefono: TEL_C, nombre: 'Caro', servicioId: 'corte', fecha: SABADO, hora: '17:00' }),
        (e: unknown) => (e as { codigo?: string }).codigo === 'DIA_COMPLETO',
      );
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TEL_C, nombre: 'Caro', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' }),
        (e: unknown) => (e as { codigo?: string }).codigo === 'DIA_COMPLETO',
      );
    });
  });

  test('el barbero desde el panel sí puede pasar el tope', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
      const extra = await crearTurno(ctx, {
        telefono: TEL_C, nombre: 'Caro', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'panel', forzar: true,
      });
      assert.equal(extra.estado, 'reservado');
    });
  });

  test('un horario apartado cuenta mientras está vigente (dos clientes no pasan el tope a la vez)', async () => {
    await conTope(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '10:00', origen: 'whatsapp' });
      await crearHold(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '11:00' });
      await assert.rejects(
        () => crearHold(ctx, { telefono: TEL_C, nombre: 'Caro', servicioId: 'corte', fecha: SABADO, hora: '17:00' }),
        (e: unknown) => (e as { codigo?: string }).codigo === 'DIA_COMPLETO',
      );
      // Cuando el apartado vence, el lugar vuelve a estar.
      moverReloj(ctx, 15);
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      assert.ok(!r.dia_completo);
      assert.ok(r.horarios.length > 0);
    });
  });

  test('un turno cancelado libera el lugar', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
      const [primero] = (await agendaDelDia(ctx, SABADO)).turnos;
      await cancelarTurno(ctx, primero!.id, { origen: 'panel' });
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      assert.ok(!r.dia_completo);
    });
  });

  test('mover un turno dentro del mismo día completo se puede (no se cuenta a sí mismo)', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
      const [primero] = (await agendaDelDia(ctx, SABADO)).turnos;
      const movido = await modificarTurno(ctx, primero!.id, { hora: '17:00' }, { telefono: primero!.telefono, origen: 'whatsapp' });
      assert.equal(movido.horaInicio, '17:00');
    });
  });

  test('sin tope (0) se reserva normal', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
      await crearTurno(ctx, { telefono: TEL_C, nombre: 'Caro', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await crearTurno(ctx, { telefono: TEL_D, nombre: 'Dani', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp' });
    }, 0);
  });

  test('la IA recibe que el día está completo y el horario más cercano', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
      const r = await ejecutarHerramienta(
        'consultar_disponibilidad',
        { fecha: SABADO, servicio_id: 'corte' },
        { ctx, telefono: TEL_C, nombreConocido: '', estado: {}, origen: 'whatsapp' },
      );
      const datos = r.datos as { dia_completo?: boolean; primer_horario_libre?: { fecha: string; hora: string; dia: string } };
      assert.equal(datos.dia_completo, true);
      assert.equal(datos.primer_horario_libre?.fecha, '2026-09-22');
      assert.equal(datos.primer_horario_libre?.hora, '10:00');
      assert.match(datos.primer_horario_libre?.dia ?? '', /martes 22\/09/);
    });
  });

  test('el menú pasa solo al día más cercano con lugar y lo dice', async () => {
    await conTope(async (ctx) => {
      await llenarSabado(ctx);
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
      const decir = (texto: string) =>
        procesarMensaje(ctx, { telefono: TEL_C, texto, idExterno: `t-${Math.random()}`, origen: 'whatsapp' }, { proveedorIA: sinIA });
      await decir('1');
      await decir('srv_corte');
      const r = await decir(`dia_${SABADO}`);
      assert.match(r.texto, /Ese día ya está completo/);
      assert.match(r.texto, /martes 22\/09 a las 10:00 hs/);
      assert.ok(r.lista?.opciones.some((o) => o.id === 'hora_10:00'), 'el horario más cercano se puede elegir con un toque');
      const elegir = await decir('hora_10:00');
      assert.match(elegir.texto, /nombre/i);
    });
  });
});
