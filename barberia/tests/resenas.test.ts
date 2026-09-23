/**
 * Reseña en Google → 10% de descuento → el cliente marcado en la agenda.
 *
 * Lo delicado acá es que el descuento no se pueda regalar ni usar dos veces:
 * son plata del barbero.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { crearTurno, crearHold, confirmarHold, cancelarTurno, agendaDelDia, modificarTurno } from '../src/booking/servicio.js';
import { procesarMensaje } from '../src/conversation/orquestador.js';
import { registrarResenaDeCliente } from '../src/conversation/resenas.js';
import { mensajeDeResena, enviarRecordatoriosPendientes } from '../src/mantenimiento/tareas.js';
import { beneficiosRepo } from '../src/database/repositories/beneficios.js';
import { recordatoriosRepo } from '../src/database/repositories/recordatorios.js';
import { conversacionesRepo } from '../src/database/repositories/conversaciones.js';
import { ejecutarHerramienta } from '../src/ai/herramientas.js';
import { contextoDePrueba, ZONA, SABADO, TELEFONO_A, TELEFONO_B } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

async function conContexto(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

/** Deja al cliente en el estado "le pedimos la reseña y estamos esperando". */
async function pedirleResena(ctx: Ctx, telefono: string, turnoId = 'TUR-ORIGEN') {
  const ahora = ctx.ahora();
  const conv = await conversacionesRepo.obtener(ctx.db, telefono);
  (conv.estado as Record<string, unknown>).esperandoResena = { turnoId, ts: ahora.toMillis() };
  await conversacionesRepo.guardar(ctx.db, conv, ahora.toUTC().toISO()!);
}

describe('el pedido de reseña', () => {
  test('se programa solo para el cliente nuevo, una hora después del corte', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, {
        telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp',
      });
      const programados = await ctx.db.query<{ aviso_id: string; programado_ms: number }>(
        'SELECT aviso_id, programado_ms FROM recordatorios WHERE turno_id = ?', [t.id],
      );
      const resena = programados.find((p) => p.aviso_id === 'resena');
      assert.ok(resena, 'al cliente nuevo hay que pedirle la reseña');
      assert.equal(Number(resena.programado_ms), t.finMs + 3_600_000, 'una hora después de terminar');
    });
  });

  test('al cliente que ya vino no se le vuelve a pedir', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '11:00', origen: 'whatsapp' });
      const segundo = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const programados = await ctx.db.query<{ aviso_id: string }>('SELECT aviso_id FROM recordatorios WHERE turno_id = ?', [segundo.id]);
      assert.ok(!programados.some((p) => p.aviso_id === 'resena'), 'ya se la pedimos la primera vez');
    });
  });

  test('sin link de Google cargado no se pide nada', async () => {
    await conContexto(async (ctx) => {
      const sinLink = { ...ctx, cfg: { ...ctx.cfg, resenas: { ...ctx.cfg.resenas, link_google_maps: '' } } };
      const t = await crearTurno(sinLink, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const programados = await ctx.db.query('SELECT aviso_id FROM recordatorios WHERE turno_id = ?', [t.id]);
      assert.equal(programados.filter((p: { aviso_id: string }) => p.aviso_id === 'resena').length, 0);
    });
  });

  test('el mensaje trae el link y el descuento', async () => {
    await conContexto(async (ctx) => {
      const texto = mensajeDeResena(ctx, 'Agustín');
      assert.match(texto, /Agustín/);
      assert.match(texto, /g\.page\/r\/barberia-de-prueba\/review/);
      assert.match(texto, /10% de descuento/);
      assert.ok(!texto.includes('{'), 'no pueden quedar marcadores sin reemplazar');
    });
  });

  test('no se manda antes de que el turno termine', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const r = await enviarRecordatoriosPendientes(ctx);
      assert.equal(r.enviados, 0, 'el turno todavía no pasó');
    });
  });
});

describe('carga del descuento', () => {
  test('solo si de verdad le pedimos una reseña', async () => {
    await conContexto(async (ctx) => {
      const sinPedido = await registrarResenaDeCliente(ctx, TELEFONO_A, ctx.ahora().toMillis());
      assert.equal(sinPedido.otorgado, false);
      assert.match(sinPedido.motivo ?? '', /no se le pidió/);
      assert.equal(await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis()), null);
    });
  });

  test('el cliente avisa y queda cargado', async () => {
    await conContexto(async (ctx) => {
      await pedirleResena(ctx, TELEFONO_A);
      const r = await registrarResenaDeCliente(ctx, TELEFONO_A, ctx.ahora().toMillis());
      assert.equal(r.otorgado, true);
      assert.equal(r.descuento, 10);
      const beneficio = await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis());
      assert.equal(beneficio?.descuentoPorcentaje, 10);
      assert.equal(beneficio?.estado, 'disponible');
    });
  });

  test('por WhatsApp, apretando el botón o escribiéndolo', async () => {
    await conContexto(async (ctx) => {
      await pedirleResena(ctx, TELEFONO_A);
      const r = await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: 'resena_hecha', idExterno: 'm1', origen: 'whatsapp' });
      assert.match(r.texto, /descuento/i);
      assert.ok(await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis()));

      await pedirleResena(ctx, TELEFONO_B);
      await procesarMensaje(ctx, { telefono: TELEFONO_B, texto: 'ya la dejé!', idExterno: 'm2', origen: 'whatsapp' });
      assert.ok(await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_B, ctx.ahora().toMillis()));
    });
  });

  test('no se puede reclamar dos veces', async () => {
    await conContexto(async (ctx) => {
      await pedirleResena(ctx, TELEFONO_A);
      await registrarResenaDeCliente(ctx, TELEFONO_A, ctx.ahora().toMillis());
      const segunda = await registrarResenaDeCliente(ctx, TELEFONO_A, ctx.ahora().toMillis());
      assert.equal(segunda.otorgado, false, 'el pedido ya fue consumido');
      const todos = await beneficiosRepo.listar(ctx.db);
      assert.equal(todos.length, 1);
    });
  });

  test('vence el reclamo si pasó más de una semana', async () => {
    await conContexto(async (ctx) => {
      await pedirleResena(ctx, TELEFONO_A);
      const dentroDeDosSemanas = ctx.ahora().plus({ days: 14 }).toMillis();
      const r = await registrarResenaDeCliente(ctx, TELEFONO_A, dentroDeDosSemanas);
      assert.equal(r.otorgado, false);
      assert.match(r.motivo ?? '', /demasiado tiempo/);
    });
  });

  test('la IA tampoco puede regalar descuentos por su cuenta', async () => {
    await conContexto(async (ctx) => {
      const llamador = { ctx, telefono: TELEFONO_A, nombreConocido: 'Ana', estado: {}, origen: 'whatsapp' as const };
      const r = await ejecutarHerramienta('registrar_resena', {}, llamador);
      assert.equal(r.ok, false, 'sin pedido previo, la herramienta rechaza');
      assert.equal(await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis()), null);

      await pedirleResena(ctx, TELEFONO_A);
      const conPedido = await ejecutarHerramienta('registrar_resena', {}, llamador);
      assert.equal(conPedido.ok, true);
    });
  });
});

describe('uso del descuento', () => {
  async function conDescuento(ctx: Ctx, telefono: string) {
    await pedirleResena(ctx, telefono);
    await registrarResenaDeCliente(ctx, telefono, ctx.ahora().toMillis());
  }

  test('el próximo turno sale un 10% más barato', async () => {
    await conContexto(async (ctx) => {
      await conDescuento(ctx, TELEFONO_A);
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(t.precio, 7200, 'corte de 8000 con 10% off');
      assert.equal(t.descuentoPorcentaje, 10);
      assert.ok(t.beneficioId);
    });
  });

  test('el descuento se consume: el turno siguiente vuelve a precio pleno', async () => {
    await conContexto(async (ctx) => {
      await conDescuento(ctx, TELEFONO_A);
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '11:00', origen: 'whatsapp' });
      const segundo = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(segundo.precio, 8000);
      assert.equal(segundo.descuentoPorcentaje, 0);
    });
  });

  test('si el cliente cancela, el descuento vuelve a estar disponible', async () => {
    await conContexto(async (ctx) => {
      await conDescuento(ctx, TELEFONO_A);
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(t.descuentoPorcentaje, 10);

      await cancelarTurno(ctx, t.id, { telefono: TELEFONO_A, origen: 'whatsapp' });
      const beneficio = await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis());
      assert.ok(beneficio, 'no se puede perder el descuento por cancelar');

      const nuevo = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp' });
      assert.equal(nuevo.precio, 7200);
    });
  });

  test('sobrevive a reprogramar el turno', async () => {
    await conContexto(async (ctx) => {
      await conDescuento(ctx, TELEFONO_A);
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const movido = await modificarTurno(ctx, t.id, { hora: '18:00' }, { telefono: TELEFONO_A, origen: 'whatsapp' });
      assert.equal(movido.descuentoPorcentaje, 10);
      assert.equal(movido.precio, 7200);
      const usados = await beneficiosRepo.listar(ctx.db);
      assert.equal(usados.filter((b) => b.estado === 'usado').length, 1, 'sigue habiendo un solo beneficio usado');
    });
  });

  test('la reserva temporal no consume el descuento si nunca se confirma', async () => {
    await conContexto(async (ctx) => {
      await conDescuento(ctx, TELEFONO_A);
      const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
      assert.equal(hold.precio, 7200, 'el resumen ya muestra el precio con descuento');
      const beneficio = await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis());
      assert.ok(beneficio, 'todavía no se consumió');

      await confirmarHold(ctx, hold.id, { telefono: TELEFONO_A, nombre: 'Ana' });
      assert.equal(await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis()), null);
    });
  });

  test('el barbero puede sacarlo si el cliente mintió', async () => {
    await conContexto(async (ctx) => {
      await conDescuento(ctx, TELEFONO_A);
      const beneficio = await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, ctx.ahora().toMillis());
      await beneficiosRepo.anular(ctx.db, beneficio!.id, ctx.ahora().toUTC().toISO()!);
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(t.precio, 8000, 'sin descuento');
    });
  });

  test('el descuento vence', async () => {
    await conContexto(async (ctx) => {
      await conDescuento(ctx, TELEFONO_A);
      const dentroDeCuatroMeses = ctx.ahora().plus({ days: 120 }).toMillis();
      assert.equal(await beneficiosRepo.disponibleDe(ctx.db, TELEFONO_A, dentroDeCuatroMeses), null, 'vence a los 90 días');
    });
  });
});

describe('el barbero lo ve marcado en su agenda', () => {
  test('la agenda del día marca al cliente con descuento', async () => {
    await conContexto(async (ctx) => {
      await pedirleResena(ctx, TELEFONO_A);
      await registrarResenaDeCliente(ctx, TELEFONO_A, ctx.ahora().toMillis());

      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Premiado', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Comun', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp' });

      const dia = await agendaDelDia(ctx, SABADO);
      const premiado = dia.turnos.find((t) => t.nombreCliente === 'Premiado')!;
      const comun = dia.turnos.find((t) => t.nombreCliente === 'Comun')!;
      assert.equal(premiado.descuentoPorcentaje, 10, 'el turno con descuento queda marcado');
      assert.equal(premiado.precio, 7200);
      assert.equal(comun.descuentoPorcentaje, 0, 'el otro no');
      assert.equal(comun.precio, 8000);
    });
  });
});
