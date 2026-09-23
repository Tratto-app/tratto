/**
 * Balance del mes.
 *
 * Se arma sumando los balances semanales guardados, porque a fin de mes los
 * turnos ya fueron borrados por el cierre de cada domingo. Lo que se prueba
 * acá es justamente eso: que el número del mes siga siendo correcto aunque la
 * base esté vacía.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { agregarSemanas, calcularResumenMensual, mesDe, mesPendienteDeCerrar, resumenMensualComoTexto } from '../src/reportes/mensual.js';
import { resumenesRepo, resumenesMensualesRepo } from '../src/database/repositories/resumenes.js';
import type { ResumenSemanal } from '../src/reportes/semanal.js';
import { contextoDePrueba, ZONA } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

function semana(desde: string, hasta: string, datos: Partial<ResumenSemanal> = {}): ResumenSemanal {
  return {
    desde, hasta,
    atendidos: 10, facturado: 90000, preciosIncompletos: false,
    clientes: 8, clientesNuevos: 2, clientesQueVolvieron: 6,
    cancelados: 1, noShow: 0, ocupacion: 50,
    minutosTrabajados: 450, minutosDisponibles: 900,
    porServicio: [{ servicio: 'Corte', cantidad: 7, facturado: 63000 }, { servicio: 'Barba', cantidad: 3, facturado: 27000 }],
    diaMasFuerte: { dia: 'viernes', cantidad: 4 },
    telefonos: ['549100', '549200', '549300', '549400', '549500', '549600', '549700', '549800'],
    comparacion: null,
    ...datos,
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

describe('agregación de semanas', () => {
  test('suma turnos, facturación y clientes nuevos', () => {
    const r = agregarSemanas('2026-09', [
      semana('2026-08-31', '2026-09-06'),
      semana('2026-09-07', '2026-09-13'),
      semana('2026-09-14', '2026-09-20'),
    ]);
    assert.equal(r.semanas, 3);
    assert.equal(r.atendidos, 30);
    assert.equal(r.facturado, 270000);
    assert.equal(r.clientesNuevos, 6);
    assert.equal(r.cancelados, 3);
  });

  test('no cuenta dos veces a la persona que vino en varias semanas', () => {
    const r = agregarSemanas('2026-09', [
      semana('2026-09-07', '2026-09-13', { telefonos: ['549100', '549200'] }),
      semana('2026-09-14', '2026-09-20', { telefonos: ['549200', '549300'] }),
    ]);
    assert.equal(r.atendidos, 20, 'los turnos sí se suman');
    assert.equal(r.personas, 3, '549200 vino las dos semanas: es una sola persona');
  });

  test('la ocupación del mes es sobre el total de minutos, no un promedio de porcentajes', () => {
    const r = agregarSemanas('2026-09', [
      semana('2026-09-07', '2026-09-13', { minutosTrabajados: 900, minutosDisponibles: 900 }),
      semana('2026-09-14', '2026-09-20', { minutosTrabajados: 0, minutosDisponibles: 100 }),
    ]);
    assert.equal(r.ocupacion, 90, '900 de 1000 minutos = 90%, no el promedio entre 100% y 0%');
  });

  test('encuentra la mejor semana y el servicio más pedido', () => {
    const r = agregarSemanas('2026-09', [
      semana('2026-09-07', '2026-09-13', { atendidos: 8 }),
      semana('2026-09-14', '2026-09-20', { atendidos: 15 }),
    ]);
    assert.equal(r.mejorSemana?.desde, '2026-09-14');
    assert.equal(r.mejorSemana?.atendidos, 15);
    assert.equal(r.servicioMasPedido, 'Corte');
  });

  test('un mes sin semanas no rompe', () => {
    const r = agregarSemanas('2026-09', []);
    assert.equal(r.atendidos, 0);
    assert.equal(r.personas, 0);
    assert.match(resumenMensualComoTexto(r), /No hubo turnos/);
  });
});

describe('a qué mes pertenece cada semana', () => {
  test('una semana a caballo entre dos meses cuenta en el mes en que termina', async () => {
    await conContexto(async (ctx) => {
      const ahoraIso = ctx.ahora().toUTC().toISO()!;
      // Del 28/09 al 04/10: termina en octubre.
      await resumenesRepo.guardar(ctx.db, semana('2026-09-28', '2026-10-04', { atendidos: 12 }), ahoraIso);
      await resumenesRepo.guardar(ctx.db, semana('2026-09-21', '2026-09-27', { atendidos: 9 }), ahoraIso);

      const septiembre = await calcularResumenMensual(ctx, '2026-09');
      const octubre = await calcularResumenMensual(ctx, '2026-10');
      assert.equal(septiembre.atendidos, 9);
      assert.equal(octubre.atendidos, 12);
      assert.equal(septiembre.atendidos + octubre.atendidos, 21, 'ninguna semana se cuenta dos veces ni se pierde');
    });
  });

  test('mesDe toma el mes de la fecha', () => {
    assert.equal(mesDe('2026-10-04'), '2026-10');
    assert.equal(mesDe('2026-01-31'), '2026-01');
  });
});

describe('cuándo se cierra el mes', () => {
  test('hay mes pendiente si quedaron semanas del mes anterior sin reportar', async () => {
    await conContexto(async (ctx) => {
      const ahoraIso = ctx.ahora().toUTC().toISO()!;
      await resumenesRepo.guardar(ctx.db, semana('2026-08-24', '2026-08-30'), ahoraIso);
      const enSeptiembre = DateTime.fromISO('2026-09-06T20:00', { zone: ZONA });
      assert.equal(await mesPendienteDeCerrar(ctx, enSeptiembre), '2026-08');
    });
  });

  test('una vez cerrado, no vuelve a quedar pendiente', async () => {
    await conContexto(async (ctx) => {
      const ahoraIso = ctx.ahora().toUTC().toISO()!;
      await resumenesRepo.guardar(ctx.db, semana('2026-08-24', '2026-08-30'), ahoraIso);
      const enSeptiembre = DateTime.fromISO('2026-09-06T20:00', { zone: ZONA });

      const resumen = await calcularResumenMensual(ctx, '2026-08');
      await resumenesMensualesRepo.guardar(ctx.db, resumen, ahoraIso);
      assert.equal(await mesPendienteDeCerrar(ctx, enSeptiembre), null);
    });
  });

  test('sin semanas del mes anterior no hay nada que cerrar', async () => {
    await conContexto(async (ctx) => {
      const enSeptiembre = DateTime.fromISO('2026-09-06T20:00', { zone: ZONA });
      assert.equal(await mesPendienteDeCerrar(ctx, enSeptiembre), null);
    });
  });
});

describe('el texto del balance mensual', () => {
  test('dice turnos, personas, facturado y la mejor semana', () => {
    const r = agregarSemanas('2026-09', [
      semana('2026-09-07', '2026-09-13', { atendidos: 12, facturado: 108000, telefonos: ['a', 'b', 'c'] }),
      semana('2026-09-14', '2026-09-20', { atendidos: 18, facturado: 162000, telefonos: ['b', 'd'] }),
    ]);
    const texto = resumenMensualComoTexto(r);
    assert.match(texto, /Balance de septiembre/);
    assert.match(texto, /30 turnos en 2 semanas/);
    assert.match(texto, /4 personas distintas/);
    assert.match(texto, /\$270\.000/);
    assert.match(texto, /mejor semana: 14\/09/i);
  });

  test('compara contra el mes anterior', () => {
    const agosto = agregarSemanas('2026-08', [semana('2026-08-24', '2026-08-30', { atendidos: 20, facturado: 180000 })]);
    const septiembre = agregarSemanas('2026-09', [semana('2026-09-14', '2026-09-20', { atendidos: 25, facturado: 225000 })], agosto);
    assert.equal(septiembre.comparacion?.atendidos, 5);
    assert.match(resumenMensualComoTexto(septiembre), /Contra el mes anterior: \+5 turnos/);
  });
});
