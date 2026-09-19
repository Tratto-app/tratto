import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelarTurno,
  consultarDisponibilidad,
  confirmarHold,
  crearHold,
  crearTurno,
  modificarTurno,
  turnosDeCliente,
  bloquearHorario,
  agendaSemanal,
} from '../src/booking/servicio.js';
import { limpiarTurnosViejos } from '../src/mantenimiento/tareas.js';
import { ErrorDeNegocio } from '../src/shared/errores.js';
import {
  contextoDePrueba,
  moverReloj,
  MIERCOLES,
  JUEVES,
  SABADO,
  DOMINGO,
  LUNES_FERIADO,
  JUEVES_ESPECIAL,
  EN_VACACIONES,
  TELEFONO_A,
  TELEFONO_B,
} from './helpers.js';

async function conContexto(fn: (ctx: Awaited<ReturnType<typeof contextoDePrueba>>) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

describe('creacion de turnos', () => {
  test('crea un turno y lo devuelve con horario de fin calculado', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, {
        telefono: TELEFONO_A,
        nombre: 'Agustín',
        servicioId: 'corte',
        fecha: SABADO,
        hora: '17:30',
        origen: 'whatsapp',
      });
      assert.equal(t.estado, 'reservado');
      assert.equal(t.horaInicio, '17:30');
      assert.equal(t.horaFin, '18:15'); // corte = 45 min
      assert.equal(t.precio, 8000);
      assert.equal(t.nombreCliente, 'Agustín');
      assert.match(t.id, /^TUR-[A-Z0-9]{6}$/);
    });
  });

  test('el turno queda asociado al cliente y aparece en sus turnos', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Agustín', servicioId: 'corte', fecha: SABADO, hora: '17:30', origen: 'whatsapp' });
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.fecha, SABADO);
    });
  });

  test('rechaza un servicio inexistente', async () => {
    await conContexto(async (ctx) => {
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'masajes', fecha: SABADO, hora: '17:30', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'SERVICIO_INEXISTENTE',
      );
    });
  });

  test('rechaza un turno fuera del horario de atencion', async () => {
    await conContexto(async (ctx) => {
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '21:00', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'FUERA_DE_HORARIO',
      );
    });
  });

  test('rechaza un turno que cae en la pausa del mediodia', async () => {
    await conContexto(async (ctx) => {
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '13:30', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'FUERA_DE_HORARIO',
      );
    });
  });

  test('rechaza un turno que no termina antes del cierre del tramo', async () => {
    await conContexto(async (ctx) => {
      // 12:30 + 45 min = 13:15, pasado el cierre de las 13:00
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '12:30', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'FUERA_DE_HORARIO',
      );
    });
  });

  test('rechaza dias cerrados: domingo, feriado y vacaciones', async () => {
    await conContexto(async (ctx) => {
      for (const fecha of [DOMINGO, LUNES_FERIADO, EN_VACACIONES]) {
        await assert.rejects(
          () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha, hora: '11:00', origen: 'whatsapp' }),
          (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'DIA_CERRADO',
          `deberia rechazar ${fecha}`,
        );
      }
    });
  });

  test('respeta la anticipacion minima', async () => {
    await conContexto(async (ctx) => {
      // Son las 11:00 y la anticipacion minima es de 60 minutos.
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: MIERCOLES, hora: '11:30', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'ANTICIPACION_MINIMA',
      );
    });
  });

  test('el panel puede forzar un turno sobre la hora', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, {
        telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: MIERCOLES, hora: '11:30', origen: 'panel', forzar: true,
      });
      assert.equal(t.estado, 'reservado');
    });
  });

  test('limita la cantidad de turnos futuros por cliente', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '15:00', origen: 'whatsapp' });
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '16:00', origen: 'whatsapp' });
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'LIMITE_TURNOS',
      );
    });
  });
});

describe('doble reserva', () => {
  test('no permite dos turnos en el mismo horario', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO',
      );
    });
  });

  test('no permite turnos que se superponen parcialmente', async () => {
    await conContexto(async (ctx) => {
      // 17:00 a 17:45
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      // 17:30 arrancaria adentro del anterior
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:30', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO',
      );
      // 16:30 + 45 = 17:15, tambien pisa
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '16:30', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO',
      );
    });
  });

  test('permite un turno pegado, sin superposicion', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const t = await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:45', origen: 'whatsapp' });
      assert.equal(t.horaInicio, '17:45');
    });
  });

  test('dos clientes pidiendo el mismo horario a la vez: uno solo lo consigue', async () => {
    await conContexto(async (ctx) => {
      const intentos = [TELEFONO_A, TELEFONO_B, '5491199998888', '5491177776666'].map((tel, i) =>
        crearTurno(ctx, { telefono: tel, nombre: `Cliente${i}`, servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' }),
      );
      const resultados = await Promise.allSettled(intentos);
      const ok = resultados.filter((r) => r.status === 'fulfilled');
      const fallados = resultados.filter((r) => r.status === 'rejected');
      assert.equal(ok.length, 1, 'tiene que ganar exactamente uno');
      assert.equal(fallados.length, 3);
      for (const f of fallados) {
        const e = (f as PromiseRejectedResult).reason;
        assert.ok(e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO', `error inesperado: ${e}`);
      }
      const enBase = await ctx.db.query<{ n: number }>(
        "SELECT COUNT(*) AS n FROM turnos WHERE estado IN ('pendiente','reservado','confirmado')",
      );
      assert.equal(Number(enBase[0]!.n), 1, 'en la base tiene que quedar un unico turno vivo');
    });
  });

  test('la reserva temporal bloquea el horario para los demas', async () => {
    await conContexto(async (ctx) => {
      const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
      assert.equal(hold.estado, 'pendiente');
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO',
      );
    });
  });

  test('la reserva temporal vencida libera el horario', async () => {
    await conContexto(async (ctx) => {
      await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
      moverReloj(ctx, 11); // hold_minutos = 10
      const t = await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(t.telefono, TELEFONO_B);
    });
  });

  test('confirmar una reserva temporal vencida falla y no crea el turno', async () => {
    await conContexto(async (ctx) => {
      const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
      moverReloj(ctx, 11);
      await assert.rejects(
        () => confirmarHold(ctx, hold.id, { telefono: TELEFONO_A, nombre: 'Ana' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'HOLD_VENCIDO',
      );
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);
    });
  });

  test('confirmar una reserva temporal la convierte en turno firme', async () => {
    await conContexto(async (ctx) => {
      const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: '', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
      const turno = await confirmarHold(ctx, hold.id, { telefono: TELEFONO_A, nombre: 'Agustín' });
      assert.equal(turno.estado, 'reservado');
      assert.equal(turno.nombreCliente, 'Agustín');
      assert.equal(turno.holdVenceMs, null);
      // idempotente: confirmar dos veces no rompe ni duplica
      const otra = await confirmarHold(ctx, hold.id, { telefono: TELEFONO_A, nombre: 'Agustín' });
      assert.equal(otra.id, turno.id);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 1);
    });
  });

  test('un cliente no puede confirmar la reserva temporal de otro', async () => {
    await conContexto(async (ctx) => {
      const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
      await assert.rejects(
        () => confirmarHold(ctx, hold.id, { telefono: TELEFONO_B, nombre: 'Beto' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'TURNO_NO_ENCONTRADO',
      );
    });
  });
});

describe('disponibilidad', () => {
  test('ofrece horarios alineados a la grilla y respeta los tramos', async () => {
    await conContexto(async (ctx) => {
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      assert.equal(r.abierto, true);
      assert.equal(r.horarios[0], '10:00');
      assert.ok(r.horarios.includes('12:15'), 'deberia entrar el ultimo corte de la mañana');
      assert.ok(!r.horarios.includes('12:30'), '12:30 + 45 min se pasa de las 13:00');
      assert.ok(!r.horarios.includes('13:30'), 'no hay turnos en la pausa');
      assert.ok(r.horarios.includes('15:00'));
      assert.ok(r.horarios.includes('19:15'), 'ultimo corte de la tarde');
      assert.ok(!r.horarios.includes('19:30'), '19:30 + 45 min se pasa de las 20:00');
    });
  });

  test('no ofrece un horario ya ocupado', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      for (const h of ['16:30', '16:45', '17:00', '17:15', '17:30']) {
        assert.ok(!r.horarios.includes(h), `${h} se superpone con el turno de las 17:00 y no deberia ofrecerse`);
      }
      assert.ok(r.horarios.includes('17:45'));
      assert.ok(r.horarios.includes('16:15'), '16:15 + 45 = 17:00, justo antes: es valido');
    });
  });

  test('dia cerrado devuelve vacio y sugiere los proximos dias con lugar', async () => {
    await conContexto(async (ctx) => {
      const r = await consultarDisponibilidad(ctx, { fecha: DOMINGO, servicioId: 'corte' });
      assert.equal(r.abierto, false);
      assert.equal(r.horarios.length, 0);
      assert.ok(r.proximos_dias_con_lugar.length > 0);
      assert.ok(!r.proximos_dias_con_lugar.includes(LUNES_FERIADO));
    });
  });

  test('respeta el horario especial de un dia puntual', async () => {
    await conContexto(async (ctx) => {
      const r = await consultarDisponibilidad(ctx, { fecha: JUEVES_ESPECIAL, servicioId: 'corte' });
      assert.deepEqual(r.horarios, ['10:00', '10:15', '10:30', '10:45', '11:00', '11:15']);
    });
  });

  test('filtra por franja del dia', async () => {
    await conContexto(async (ctx) => {
      const tarde = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte', rango: 'tarde' });
      assert.ok(tarde.horarios.every((h) => h >= '15:00' && h < '19:00'));
      const desde17 = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte', desdeHora: '17:00' });
      assert.ok(desde17.horarios.every((h) => h >= '17:00'));
    });
  });

  test('un servicio mas largo genera menos horarios', async () => {
    await conContexto(async (ctx) => {
      const corte = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      const completo = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte_barba' });
      assert.ok(completo.total_disponibles < corte.total_disponibles);
      assert.ok(!completo.horarios.includes('12:15'), 'corte+barba dura 75 min: no entra antes de las 13:00');
    });
  });

  test('sugiere pocas opciones bien repartidas', async () => {
    await conContexto(async (ctx) => {
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      assert.ok(r.horarios_sugeridos.length <= ctx.cfg.reglas.max_opciones_horarios);
      assert.ok(r.horarios_sugeridos.length >= 2);
      assert.equal(r.horarios_sugeridos[0], r.horarios[0]);
    });
  });
});

describe('bloqueos', () => {
  test('un bloqueo manual saca los horarios de la oferta', async () => {
    await conContexto(async (ctx) => {
      await bloquearHorario(ctx, { fecha: SABADO, desde: '16:00', hasta: '17:00', motivo: 'dentista' });
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      for (const h of ['15:30', '16:00', '16:15', '16:45']) {
        assert.ok(!r.horarios.includes(h), `${h} cae dentro del bloqueo`);
      }
      assert.ok(r.horarios.includes('17:00'), 'justo al terminar el bloqueo vuelve a haber lugar');
    });
  });

  test('no se puede reservar dentro de un bloqueo', async () => {
    await conContexto(async (ctx) => {
      await bloquearHorario(ctx, { fecha: SABADO, desde: '16:00', hasta: '17:00', motivo: 'dentista' });
      await assert.rejects(
        () => crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '16:00', origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO',
      );
    });
  });

  test('bloquear el dia completo deja el dia sin horarios', async () => {
    await conContexto(async (ctx) => {
      await bloquearHorario(ctx, { fecha: SABADO, diaCompleto: true, motivo: 'cerrado por mudanza' });
      const r = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
      assert.equal(r.total_disponibles, 0);
    });
  });
});

describe('cancelar y modificar', () => {
  test('cancela un turno y libera el horario', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const cancelado = await cancelarTurno(ctx, t.id, { telefono: TELEFONO_A, origen: 'whatsapp' });
      assert.equal(cancelado.estado, 'cancelado');
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);
      const t2 = await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(t2.horaInicio, '17:00');
    });
  });

  test('un cliente no puede cancelar el turno de otro', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await assert.rejects(
        () => cancelarTurno(ctx, t.id, { telefono: TELEFONO_B, origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'TURNO_NO_ENCONTRADO',
      );
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 1);
    });
  });

  test('no deja cancelar sobre la hora, pero el barbero si', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: MIERCOLES, hora: '12:15', origen: 'panel', forzar: true });
      await assert.rejects(
        () => cancelarTurno(ctx, t.id, { telefono: TELEFONO_A, origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'CANCELACION_TARDIA',
      );
      const cancelado = await cancelarTurno(ctx, t.id, { origen: 'panel' });
      assert.equal(cancelado.estado, 'cancelado');
    });
  });

  test('mueve un turno a otro horario', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const movido = await modificarTurno(ctx, t.id, { hora: '18:00' }, { telefono: TELEFONO_A, origen: 'whatsapp' });
      assert.equal(movido.horaInicio, '18:00');
      assert.notEqual(movido.id, t.id, 'la reprogramacion genera un turno nuevo y cancela el anterior');
      const vigentes = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(vigentes.length, 1);
      assert.equal(vigentes[0]!.horaInicio, '18:00');
    });
  });

  test('mover un turno a un horario ocupado falla y deja el original intacto', async () => {
    await conContexto(async (ctx) => {
      const mio = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp' });
      await assert.rejects(
        () => modificarTurno(ctx, mio.id, { hora: '18:00' }, { telefono: TELEFONO_A, origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO',
      );
      const vigentes = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(vigentes.length, 1, 'el cliente no puede quedarse sin turno por un intento fallido');
      assert.equal(vigentes[0]!.id, mio.id);
      assert.equal(vigentes[0]!.horaInicio, '17:00');
    });
  });

  test('puede mover un turno dentro de su propio horario', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const movido = await modificarTurno(ctx, t.id, { hora: '17:15' }, { telefono: TELEFONO_A, origen: 'whatsapp' });
      assert.equal(movido.horaInicio, '17:15');
    });
  });

  test('cambiar de servicio recalcula duracion y precio', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      const movido = await modificarTurno(ctx, t.id, { servicioId: 'corte_barba' }, { telefono: TELEFONO_A, origen: 'whatsapp' });
      assert.equal(movido.duracionMin, 75);
      assert.equal(movido.horaFin, '18:15');
      assert.equal(movido.precio, 12000);
    });
  });

  test('un cliente no puede mover el turno de otro', async () => {
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await assert.rejects(
        () => modificarTurno(ctx, t.id, { hora: '18:00' }, { telefono: TELEFONO_B, origen: 'whatsapp' }),
        (e: unknown) => e instanceof ErrorDeNegocio && e.codigo === 'TURNO_NO_ENCONTRADO',
      );
    });
  });
});

describe('agenda', () => {
  test('la agenda semanal trae los 7 dias con los turnos ubicados', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'barba', fecha: JUEVES, hora: '15:00', origen: 'whatsapp' });
      const semana = await agendaSemanal(ctx, MIERCOLES);
      assert.equal(semana.length, 7);
      const sab = semana.find((d) => d.fecha === SABADO)!;
      assert.equal(sab.turnos.length, 1);
      assert.equal(sab.turnos[0]!.nombreCliente, 'Ana');
      const dom = semana.find((d) => d.fecha === DOMINGO)!;
      assert.equal(dom.abierto, false);
      assert.equal(dom.turnos.length, 0);
    });
  });
});

describe('limpieza semanal de la base', () => {
  test('borra los turnos que ya pasaron y deja los futuros', async () => {
    await conContexto(async (ctx) => {
      // Uno de hace dos semanas y uno de la semana que viene.
      const viejo = await crearTurno(ctx, {
        telefono: TELEFONO_B, nombre: 'Viejo', servicioId: 'corte', fecha: '2026-09-02', hora: '11:00',
        origen: 'panel', forzar: true,
      });
      const futuro = await crearTurno(ctx, {
        telefono: TELEFONO_A, nombre: 'Futuro', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp',
      });

      const borrados = await limpiarTurnosViejos(ctx);
      assert.equal(borrados, 1);

      const quedan = await ctx.db.query<{ id: string }>('SELECT id FROM turnos ORDER BY id');
      assert.deepEqual(quedan.map((f) => f.id), [futuro.id]);
      assert.notEqual(futuro.id, viejo.id);
    });
  });

  test('no toca un turno de ayer: la ventana es de una semana', async () => {
    await conContexto(async (ctx) => {
      // conservar_dias = 7 y "hoy" es el 16/09, así que el 15/09 se conserva.
      await crearTurno(ctx, {
        telefono: TELEFONO_B, nombre: 'Ayer', servicioId: 'corte', fecha: '2026-09-15', hora: '11:00',
        origen: 'panel', forzar: true,
      });
      assert.equal(await limpiarTurnosViejos(ctx), 0);
    });
  });

  test('el cliente sigue siendo reconocido después de la limpieza', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, {
        telefono: TELEFONO_B, nombre: 'Roberto', servicioId: 'corte', fecha: '2026-09-02', hora: '11:00',
        origen: 'panel', forzar: true,
      });
      await limpiarTurnosViejos(ctx);
      const cliente = await ctx.db.query<{ nombre: string; total_turnos: number }>(
        'SELECT nombre, total_turnos FROM clientes WHERE telefono = ?', [TELEFONO_B],
      );
      assert.equal(cliente[0]?.nombre, 'Roberto');
      assert.equal(Number(cliente[0]?.total_turnos), 1);
    });
  });

  test('se puede apagar desde la configuración', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, {
        telefono: TELEFONO_B, nombre: 'Viejo', servicioId: 'corte', fecha: '2026-09-02', hora: '11:00',
        origen: 'panel', forzar: true,
      });
      const sinLimpieza = { ...ctx, cfg: { ...ctx.cfg, limpieza: { activa: false, conservar_dias: 7 } } };
      assert.equal(await limpiarTurnosViejos(sinLimpieza), 0);
    });
  });
});
