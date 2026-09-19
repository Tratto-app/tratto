/**
 * Verificación del driver de PostgreSQL contra un servidor real.
 *
 * Es el motor recomendado para producción, así que no alcanza con probar
 * SQLite: acá se comprueba que la restricción de exclusión y el advisory lock
 * realmente impiden la doble reserva.
 *
 * Se saltea si no hay servidor. Para correrlo:
 *
 *   DATABASE_URL_TEST=postgresql://usuario@localhost:5432/barberia_test npm run test:postgres
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { crearPostgres, aPlaceholdersPg } from '../src/database/postgres.js';
import type { BaseDeDatos } from '../src/database/tipos.js';
import { cargarConfigNegocio } from '../src/config/negocio.js';
import {
  cancelarTurno,
  consultarDisponibilidad,
  crearContexto,
  crearTurno,
  modificarTurno,
  type Contexto,
} from '../src/booking/servicio.js';
import { ErrorDeNegocio } from '../src/shared/errores.js';
import { CONFIG_TEST, AHORA_FIJO, SABADO } from './helpers.js';

const URL = process.env.DATABASE_URL_TEST ?? '';
const hayServidor = /^postgres(ql)?:\/\//.test(URL);

describe('driver de PostgreSQL', { skip: hayServidor ? false : 'definí DATABASE_URL_TEST para correr estos tests' }, () => {
  let db: BaseDeDatos;
  let ctx: Contexto;

  before(async () => {
    db = crearPostgres(URL);
    await db.exec(
      'DROP TABLE IF EXISTS turnos, clientes, bloqueos, conversaciones, mensajes_procesados, sheets_outbox, recordatorios, eventos CASCADE',
    );
    await db.migrar();
    ctx = { ...crearContexto(db, cargarConfigNegocio(CONFIG_TEST)), ahora: () => AHORA_FIJO as DateTime };
  });

  after(async () => {
    await db?.cerrar();
  });

  test('traduce los placeholders portables a la forma de PostgreSQL', () => {
    assert.equal(aPlaceholdersPg('SELECT * FROM t WHERE a = ? AND b = ?'), 'SELECT * FROM t WHERE a = $1 AND b = $2');
    assert.equal(aPlaceholdersPg('SELECT 1'), 'SELECT 1');
  });

  test('crea la restricción de exclusión que impide turnos superpuestos', async () => {
    const filas = await db.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conname = 'turnos_sin_superposicion'",
    );
    assert.equal(filas.length, 1, 'falta la restricción de exclusión');
  });

  test('crea y lee un turno', async () => {
    const t = await crearTurno(ctx, {
      telefono: '5491111111111', nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '10:00', origen: 'whatsapp',
    });
    assert.equal(t.horaInicio, '10:00');
    assert.equal(t.horaFin, '10:45');
    const disp = await consultarDisponibilidad(ctx, { fecha: SABADO, servicioId: 'corte' });
    assert.ok(!disp.horarios.includes('10:00'));
  });

  test('seis reservas simultáneas del mismo horario dejan una sola', async () => {
    const intentos = Array.from({ length: 6 }, (_, i) =>
      crearTurno(ctx, {
        telefono: `54911999${String(i).padStart(4, '0')}`,
        nombre: `Cliente ${i}`, servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp',
      }),
    );
    const resultados = await Promise.allSettled(intentos);
    const ok = resultados.filter((r) => r.status === 'fulfilled');
    assert.equal(ok.length, 1, 'tiene que ganar exactamente uno');
    for (const r of resultados.filter((x) => x.status === 'rejected')) {
      const e = (r as PromiseRejectedResult).reason;
      assert.ok(e instanceof ErrorDeNegocio && e.codigo === 'HORARIO_OCUPADO', `error inesperado: ${e}`);
    }
    const vivos = await db.query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM turnos WHERE estado IN ('pendiente','reservado','confirmado') AND hora_inicio = '18:00'",
    );
    assert.equal(Number(vivos[0]!.n), 1);
  });

  test('el motor rechaza un solapamiento aunque se inserte por SQL directo', async () => {
    const base = await crearTurno(ctx, {
      telefono: '5491133334444', nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '12:00', origen: 'whatsapp',
    });
    await assert.rejects(
      () =>
        db.exec(
          `INSERT INTO turnos (id,telefono,nombre_cliente,servicio_id,servicio_nombre,precio,duracion_min,fecha,hora_inicio,hora_fin,inicio_ms,fin_ms,estado,origen,creado_en,actualizado_en)
           VALUES ('TUR-DIRECT','549','X','corte','Corte',0,45,?,'12:15','13:00',?,?,'reservado','panel','x','x')`,
          [SABADO, base.inicioMs + 60_000, base.finMs + 60_000],
        ),
      /exclusion constraint|turnos_sin_superposicion|unique/i,
    );
  });

  test('reprograma y cancela igual que en SQLite', async () => {
    const t = await crearTurno(ctx, {
      telefono: '5491155556666', nombre: 'Caro', servicioId: 'barba', fecha: SABADO, hora: '15:00', origen: 'whatsapp',
    });
    const movido = await modificarTurno(ctx, t.id, { hora: '16:00' }, { telefono: '5491155556666', origen: 'whatsapp' });
    assert.equal(movido.horaInicio, '16:00');
    const cancelado = await cancelarTurno(ctx, movido.id, { telefono: '5491155556666', origen: 'whatsapp' });
    assert.equal(cancelado.estado, 'cancelado');
  });
});
