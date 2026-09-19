/**
 * Qué pasa cuando algo falla.
 *
 * La regla del sistema: ante cualquier duda, NO se le confirma un turno al
 * cliente. Es preferible pedirle que reintente que prometerle un horario que
 * no quedó guardado.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearTurno, crearHold, confirmarHold, turnosDeCliente } from '../src/booking/servicio.js';
import { procesarMensaje } from '../src/conversation/orquestador.js';
import { outboxRepo } from '../src/database/repositories/outbox.js';
import { ErrorSheets } from '../src/google/sheets-api.js';
import { ErrorDeNegocio } from '../src/shared/errores.js';
import type { BaseDeDatos } from '../src/database/tipos.js';
import { contextoDePrueba, SABADO, TELEFONO_A } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

async function conContexto(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

/** Envuelve la base para que las escrituras fallen, como si se cayera el motor. */
function baseRota(db: BaseDeDatos): BaseDeDatos {
  return {
    ...db,
    driver: db.driver,
    query: db.query.bind(db),
    exec: db.exec.bind(db),
    transaccion: async () => {
      throw new Error('SQLITE_BUSY: database is locked');
    },
    migrar: db.migrar.bind(db),
    cerrar: db.cerrar.bind(db),
  };
}

describe('error de base de datos', () => {
  test('si la base falla, la reserva falla: nunca se confirma a medias', async () => {
    await conContexto(async (ctx) => {
      const roto = { ...ctx, db: baseRota(ctx.db) };
      await assert.rejects(
        () => crearTurno(roto, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' }),
        /database is locked/,
      );
      // Con la base sana, el horario sigue libre: no quedó nada a medio escribir.
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      assert.equal(t.horaInicio, '17:00');
    });
  });

  test('el bot NO le dice al cliente que el turno quedó reservado si falló al guardarlo', async () => {
    await conContexto(async (ctx) => {
      for (const texto of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín']) {
        await procesarMensaje(ctx, { telefono: TELEFONO_A, texto, idExterno: `m-${texto}`, origen: 'whatsapp' });
      }
      // Justo antes de confirmar, se cae la base.
      const roto = { ...ctx, db: baseRota(ctx.db) };
      const r = await procesarMensaje(roto, { telefono: TELEFONO_A, texto: 'sí', idExterno: 'm-si', origen: 'whatsapp' });

      assert.doesNotMatch(r.texto, /quedó reservado|te esperamos/i, `el bot prometió un turno que no existe: "${r.texto}"`);
      assert.ok(r.texto.length > 0, 'igual tiene que decirle algo al cliente');
    });
  });

  test('una reserva temporal que no se puede confirmar no deja turno vivo', async () => {
    await conContexto(async (ctx) => {
      const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
      const roto = { ...ctx, db: baseRota(ctx.db) };
      await assert.rejects(() => confirmarHold(roto, hold.id, { telefono: TELEFONO_A, nombre: 'Ana' }));
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0, 'el hold no cuenta como turno del cliente');
    });
  });
});

describe('error de Google Sheets', () => {
  test('clasifica bien qué vale la pena reintentar', () => {
    assert.equal(new ErrorSheets(500, 'server error').reintentable, true);
    assert.equal(new ErrorSheets(429, 'cuota').reintentable, true);
    assert.equal(new ErrorSheets(0, 'sin red').reintentable, true);
    assert.equal(new ErrorSheets(404, 'planilla inexistente').reintentable, false);
    assert.equal(new ErrorSheets(403, 'sin permisos').reintentable, false);
  });

  test('la cola de sincronización guarda, pospone con backoff y no pierde eventos', async () => {
    await conContexto(async (ctx) => {
      const ahora = ctx.ahora().toMillis();
      await outboxRepo.encolar(ctx.db, 'turno_alta', 'TUR-ABC123', ahora);
      let pendientes = await outboxRepo.pendientes(ctx.db, ahora);
      assert.equal(pendientes.length, 1);

      // Falla el envío: se pospone, y deja de estar pendiente hasta que llegue la hora.
      await outboxRepo.posponer(ctx.db, pendientes[0]!.id, ahora + 30_000, 'Sheets respondio 500');
      assert.equal((await outboxRepo.pendientes(ctx.db, ahora)).length, 0);
      pendientes = await outboxRepo.pendientes(ctx.db, ahora + 31_000);
      assert.equal(pendientes.length, 1);
      assert.equal(pendientes[0]!.intentos, 1);
      assert.match(pendientes[0]!.ultimoError, /500/);

      // El evento sigue en la cola hasta que se procesa bien.
      assert.equal(await outboxRepo.contar(ctx.db), 1);
      await outboxRepo.borrar(ctx.db, pendientes[0]!.id);
      assert.equal(await outboxRepo.contar(ctx.db), 0);
    });
  });

  test('un turno se crea igual aunque Google Sheets no esté disponible', async () => {
    // En el entorno de tests no hay credenciales de Google: si la reserva
    // dependiera de la planilla, este test fallaría.
    await conContexto(async (ctx) => {
      const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '16:00', origen: 'whatsapp' });
      assert.equal(t.estado, 'reservado');
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 1);
    });
  });
});

describe('errores que ve el cliente', () => {
  test('los errores de negocio traen un mensaje apto para WhatsApp', () => {
    const e = new ErrorDeNegocio('X', 'detalle interno con nombres de tablas', 'Se me complicó, probá de nuevo.');
    assert.equal(e.mensajeCliente, 'Se me complicó, probá de nuevo.');
    assert.notEqual(e.mensajeCliente, e.message);
  });

  test('nunca se filtra el detalle interno al cliente', async () => {
    await conContexto(async (ctx) => {
      await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
      try {
        await crearTurno(ctx, { telefono: '5491100001111', nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
        assert.fail('tendría que haber fallado');
      } catch (e) {
        assert.ok(e instanceof ErrorDeNegocio);
        assert.doesNotMatch(e.mensajeCliente, /turnos|SQL|TUR-|constraint|superpone/i, `se filtró info interna: ${e.mensajeCliente}`);
      }
    });
  });
});
