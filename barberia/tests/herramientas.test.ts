/**
 * Las herramientas del agente.
 *
 * Acá se prueba lo más delicado del diseño: que el modelo NO pueda hacer nada
 * que el backend no autorice, aunque un cliente intente convencerlo.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarHerramienta, DEFINICIONES, type Llamador } from '../src/ai/herramientas.js';
import { crearTurno, turnosDeCliente } from '../src/booking/servicio.js';
import { contextoDePrueba, SABADO, DOMINGO, TELEFONO_A, TELEFONO_B } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

async function conContexto(fn: (ctx: Ctx, llamador: Llamador) => Promise<void>) {
  const ctx = await contextoDePrueba();
  const llamador: Llamador = { ctx, telefono: TELEFONO_A, nombreConocido: 'Agustín', estado: {}, origen: 'whatsapp' };
  try {
    await fn(ctx, llamador);
  } finally {
    await ctx.cerrar();
  }
}

const datos = (r: { datos: unknown }) => r.datos as Record<string, any>;

describe('definiciones expuestas al modelo', () => {
  test('el agente no tiene herramientas de barbero', () => {
    const nombres = DEFINICIONES.map((d) => d.nombre);
    for (const prohibida of ['bloquear_horario', 'block_time', 'agenda_semanal', 'cambiar_precios', 'get_weekly_schedule']) {
      assert.ok(!nombres.includes(prohibida), `el agente no debería poder ejecutar ${prohibida}`);
    }
  });

  test('todas las herramientas declaran un esquema cerrado', () => {
    for (const d of DEFINICIONES) {
      const esquema = d.esquema as { additionalProperties?: boolean };
      assert.equal(esquema.additionalProperties, false, `${d.nombre} acepta propiedades libres`);
    }
  });
});

describe('validación de argumentos', () => {
  test('rechaza una herramienta que no existe', async () => {
    await conContexto(async (_ctx, llamador) => {
      const r = await ejecutarHerramienta('borrar_todo', {}, llamador);
      assert.equal(r.ok, false);
      assert.equal(datos(r).error, 'herramienta_desconocida');
    });
  });

  test('rechaza fechas y horas mal formadas', async () => {
    await conContexto(async (_ctx, llamador) => {
      const mala = await ejecutarHerramienta('consultar_disponibilidad', { fecha: 'el sábado', servicio_id: 'corte' }, llamador);
      assert.equal(mala.ok, false);
      assert.equal(datos(mala).error, 'argumentos_invalidos');

      const horaMala = await ejecutarHerramienta('reservar_horario', { fecha: SABADO, hora: '25:99', servicio_id: 'corte' }, llamador);
      assert.equal(horaMala.ok, false);
    });
  });

  test('rechaza campos inventados por el modelo', async () => {
    await conContexto(async (_ctx, llamador) => {
      const r = await ejecutarHerramienta(
        'reservar_horario',
        { fecha: SABADO, hora: '17:00', servicio_id: 'corte', telefono: TELEFONO_B, precio: 0 },
        llamador,
      );
      assert.equal(r.ok, false, 'no puede colar un teléfono ni un precio por la puerta de atrás');
    });
  });

  test('un servicio inexistente devuelve un error entendible, no una excepción', async () => {
    await conContexto(async (_ctx, llamador) => {
      const r = await ejecutarHerramienta('consultar_disponibilidad', { fecha: SABADO, servicio_id: 'masajes' }, llamador);
      assert.equal(r.ok, false);
      assert.equal(datos(r).error, 'SERVICIO_INEXISTENTE');
      assert.ok(typeof datos(r).mensaje_para_el_cliente === 'string');
    });
  });
});

describe('el teléfono lo pone el backend, no el modelo', () => {
  test('mis_turnos solo devuelve los turnos de quien está hablando', async () => {
    await conContexto(async (ctx, llamador) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Agustín', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp' });

      const r = await ejecutarHerramienta('mis_turnos', {}, llamador);
      assert.equal(datos(r).cantidad, 1);
      assert.equal(datos(r).turnos[0].hora, '17:00');
    });
  });

  test('no se puede cancelar el turno de otra persona aunque se sepa el id', async () => {
    await conContexto(async (ctx, llamador) => {
      const ajeno = await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp' });
      const r = await ejecutarHerramienta('cancelar_turno', { turno_id: ajeno.id }, llamador);
      assert.equal(r.ok, false);
      assert.equal(datos(r).error, 'TURNO_NO_ENCONTRADO');
      assert.equal((await turnosDeCliente(ctx, TELEFONO_B)).length, 1, 'el turno ajeno sigue vivo');
    });
  });

  test('tampoco se puede mover el turno de otra persona', async () => {
    await conContexto(async (ctx, llamador) => {
      const ajeno = await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp' });
      const r = await ejecutarHerramienta('modificar_turno', { turno_id: ajeno.id, hora: '19:00' }, llamador);
      assert.equal(r.ok, false);
      const sigue = await turnosDeCliente(ctx, TELEFONO_B);
      assert.equal(sigue[0]!.horaInicio, '18:00');
    });
  });
});

describe('reservar de verdad', () => {
  test('reservar_horario aparta el horario pero NO crea el turno', async () => {
    await conContexto(async (ctx, llamador) => {
      const r = await ejecutarHerramienta('reservar_horario', { fecha: SABADO, hora: '17:00', servicio_id: 'corte' }, llamador);
      assert.equal(r.ok, true);
      assert.ok(datos(r).reserva_id);
      assert.match(String(datos(r).siguiente_paso), /confirmar_reserva/);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0, 'todavía no es un turno');
    });
  });

  test('confirmar_reserva sí lo crea', async () => {
    await conContexto(async (ctx, llamador) => {
      const hold = await ejecutarHerramienta('reservar_horario', { fecha: SABADO, hora: '17:00', servicio_id: 'corte' }, llamador);
      const r = await ejecutarHerramienta('confirmar_reserva', { reserva_id: datos(hold).reserva_id, nombre: 'Agustín' }, llamador);
      assert.equal(r.ok, true);
      assert.equal(datos(r).confirmado, true);
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.nombreCliente, 'Agustín');
    });
  });

  test('un horario ocupado devuelve error de negocio, no una excepción', async () => {
    await conContexto(async (ctx, llamador) => {
      await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const r = await ejecutarHerramienta('reservar_horario', { fecha: SABADO, hora: '17:00', servicio_id: 'corte' }, llamador);
      assert.equal(r.ok, false);
      assert.equal(datos(r).error, 'HORARIO_OCUPADO');
      assert.match(String(datos(r).mensaje_para_el_cliente), /ocup|opciones/i);
    });
  });

  test('un día cerrado no ofrece horarios pero sugiere alternativas', async () => {
    await conContexto(async (_ctx, llamador) => {
      const r = await ejecutarHerramienta('consultar_disponibilidad', { fecha: DOMINGO, servicio_id: 'corte' }, llamador);
      assert.equal(r.ok, true);
      assert.equal(datos(r).abierto, false);
      assert.equal(datos(r).horarios_para_ofrecer.length, 0);
      assert.ok(datos(r).proximos_dias_con_lugar.length > 0);
    });
  });

  test('soltar_reserva libera el horario para otro cliente', async () => {
    await conContexto(async (ctx, llamador) => {
      const hold = await ejecutarHerramienta('reservar_horario', { fecha: SABADO, hora: '17:00', servicio_id: 'corte' }, llamador);
      await ejecutarHerramienta('soltar_reserva', { reserva_id: datos(hold).reserva_id }, llamador);
      const otro = await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(otro.horaInicio, '17:00');
    });
  });
});

describe('información del negocio', () => {
  test('los precios salen de la configuración', async () => {
    await conContexto(async (_ctx, llamador) => {
      const r = await ejecutarHerramienta('obtener_servicios', {}, llamador);
      const corte = datos(r).servicios.find((s: { id: string }) => s.id === 'corte');
      assert.equal(corte.precio, 8000);
      assert.match(corte.precio_texto, /8\.000/);
      // El negocio no quiere mostrar duraciones: si el modelo las ve, las dice.
      assert.equal(corte.duracion_min, undefined);
      assert.equal(corte.duracion_texto, undefined);
    });
  });

  test('los horarios de atención vienen con un resumen legible', async () => {
    await conContexto(async (_ctx, llamador) => {
      const r = await ejecutarHerramienta('obtener_horarios_de_atencion', {}, llamador);
      assert.match(String(datos(r).resumen), /martes a sábado/i);
      assert.match(String(datos(r).resumen), /cerrado/i);
    });
  });

  test('derivar_a_persona deja marcado el pedido', async () => {
    await conContexto(async (_ctx, llamador) => {
      const r = await ejecutarHerramienta('derivar_a_persona', { motivo: 'quiere hablar del precio' }, llamador);
      assert.equal(r.ok, true);
      assert.ok(llamador.estado.pedidoDerivacion, 'el orquestador se guía por esta marca para pausar el bot');
    });
  });
});
