/**
 * Cierre de semana: el balance del domingo y la limpieza que viene después.
 *
 * Lo más importante que se prueba acá es el ORDEN: el resumen se calcula con
 * los turnos todavía en la base. Si se limpiara primero, el balance daría cero
 * y el barbero perdería la información para siempre.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { cierreSemanal, limpiarTurnosViejos } from '../src/mantenimiento/tareas.js';
import { calcularResumenSemanal, resumenComoTexto } from '../src/reportes/semanal.js';
import { resumenesRepo } from '../src/database/repositories/resumenes.js';
import { crearTurno, cancelarTurno, marcarEstadoTurno } from '../src/booking/servicio.js';
import { contextoDePrueba, ZONA, TELEFONO_A, TELEFONO_B } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

// Semana del lunes 14/09/2026 al domingo 20/09/2026.
const LUNES = '2026-09-14';
const MARTES = '2026-09-15';
const MIERCOLES = '2026-09-16';
const VIERNES = '2026-09-18';
const SABADO = '2026-09-19';
const DOMINGO_NOCHE = DateTime.fromISO('2026-09-20T20:30:00', { zone: ZONA });

/** Contexto con el reloj puesto en un momento concreto. */
async function contextoEn(momento: DateTime) {
  const ctx = await contextoDePrueba();
  return Object.assign(ctx, { ahora: () => momento });
}

async function conDomingo(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoEn(DOMINGO_NOCHE);
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

/** Carga turnos de la semana como los cargaría el barbero (forzado). */
async function sembrarSemana(ctx: Ctx) {
  const turnos = [
    { tel: TELEFONO_A, nombre: 'Agustín', servicio: 'corte', fecha: MARTES, hora: '10:00' },
    { tel: TELEFONO_B, nombre: 'Beto', servicio: 'corte_barba', fecha: MARTES, hora: '11:00' },
    { tel: '5491100000003', nombre: 'Carlos', servicio: 'corte', fecha: MIERCOLES, hora: '15:00' },
    { tel: '5491100000004', nombre: 'Diego', servicio: 'barba', fecha: VIERNES, hora: '16:00' },
    { tel: '5491100000005', nombre: 'Esteban', servicio: 'corte', fecha: VIERNES, hora: '17:00' },
    { tel: TELEFONO_A, nombre: 'Agustín', servicio: 'corte', fecha: VIERNES, hora: '18:00' },
    { tel: '5491100000006', nombre: 'Fabián', servicio: 'corte', fecha: SABADO, hora: '10:00' },
  ];
  const creados = [];
  for (const t of turnos) {
    creados.push(
      await crearTurno(ctx, {
        telefono: t.tel, nombre: t.nombre, servicioId: t.servicio, fecha: t.fecha, hora: t.hora,
        origen: 'panel', forzar: true,
      }),
    );
  }
  return creados;
}

describe('cálculo del balance', () => {
  test('cuenta turnos, clientes, facturación y ocupación', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const r = await calcularResumenSemanal(ctx, { desde: LUNES });

      assert.equal(r.desde, LUNES);
      assert.equal(r.hasta, '2026-09-20');
      assert.equal(r.atendidos, 7);
      assert.equal(r.clientes, 6, 'Agustín vino dos veces: es un cliente, no dos');
      // 5 cortes (8000) + 1 corte+barba (12000) + 1 barba (5000)
      assert.equal(r.facturado, 5 * 8000 + 12000 + 5000);
      assert.equal(r.preciosIncompletos, false);
      assert.ok(r.ocupacion > 0 && r.ocupacion < 100);
      assert.equal(r.minutosTrabajados, 5 * 45 + 75 + 30);
    });
  });

  test('separa clientes nuevos de los que volvieron', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const r = await calcularResumenSemanal(ctx, { desde: LUNES });
      assert.equal(r.clientesNuevos, 6, 'todos reservaron por primera vez esta semana');
      assert.equal(r.clientesQueVolvieron, 0);
      assert.equal(r.clientesNuevos + r.clientesQueVolvieron, r.clientes);
    });
  });

  test('no cuenta como facturado lo cancelado ni al que no vino', async () => {
    await conDomingo(async (ctx) => {
      const creados = await sembrarSemana(ctx);
      await cancelarTurno(ctx, creados[0]!.id, { origen: 'panel', forzar: true });
      await marcarEstadoTurno(ctx, creados[1]!.id, 'no_show');

      const r = await calcularResumenSemanal(ctx, { desde: LUNES });
      assert.equal(r.atendidos, 5);
      assert.equal(r.cancelados, 1);
      assert.equal(r.noShow, 1);
      assert.equal(r.facturado, 4 * 8000 + 5000, 'ni el cancelado ni el no_show suman plata');
    });
  });

  test('identifica el servicio más pedido y el día más fuerte', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const r = await calcularResumenSemanal(ctx, { desde: LUNES });
      assert.equal(r.porServicio[0]?.servicio, 'Corte');
      assert.equal(r.porServicio[0]?.cantidad, 5);
      assert.equal(r.diaMasFuerte?.dia, 'viernes');
      assert.equal(r.diaMasFuerte?.cantidad, 3);
    });
  });

  test('una semana sin turnos da un balance en cero, no un error', async () => {
    await conDomingo(async (ctx) => {
      const r = await calcularResumenSemanal(ctx, { desde: LUNES });
      assert.equal(r.atendidos, 0);
      assert.equal(r.facturado, 0);
      assert.equal(r.ocupacion, 0);
      assert.match(resumenComoTexto(r), /No hubo turnos/);
    });
  });

  test('con los precios en 0 avisa en vez de decir que facturaste nada', async () => {
    await conDomingo(async (ctx) => {
      const sinPrecios = {
        ...ctx,
        cfg: { ...ctx.cfg, servicios: ctx.cfg.servicios.map((s) => ({ ...s, precio: 0 })) },
      };
      await crearTurno(sinPrecios, {
        telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: MARTES, hora: '10:00', origen: 'panel', forzar: true,
      });
      const r = await calcularResumenSemanal(sinPrecios, { desde: LUNES });
      assert.equal(r.preciosIncompletos, true);
      assert.match(resumenComoTexto(r), /Cargá los precios/);
    });
  });
});

describe('el texto que le llega al barbero', () => {
  test('trae los números de la semana en pocas líneas', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const texto = resumenComoTexto(await calcularResumenSemanal(ctx, { desde: LUNES }));
      assert.match(texto, /7 turnos atendidos/);
      assert.match(texto, /6 clientes, 6 nuevos/);
      assert.match(texto, /\$57\.000/);
      assert.match(texto, /Lo más pedido: Corte \(5\)/);
      assert.match(texto, /Tu día más fuerte: viernes/);
      assert.ok(texto.split('\n').length <= 14, 'tiene que entrar en un mensaje de WhatsApp');
    });
  });

  test('compara contra la semana anterior cuando hay con qué', async () => {
    await conDomingo(async (ctx) => {
      // Se guarda a mano un balance de la semana previa.
      await resumenesRepo.guardar(
        ctx.db,
        { ...(await calcularResumenSemanal(ctx, { desde: '2026-09-07' })), desde: '2026-09-07', hasta: '2026-09-13', atendidos: 4, clientes: 4, facturado: 36000 },
        ctx.ahora().toUTC().toISO()!,
      );
      await sembrarSemana(ctx);
      const r = await calcularResumenSemanal(ctx, { desde: LUNES });
      assert.equal(r.comparacion?.atendidos, 3);
      assert.equal(r.comparacion?.facturado, 57000 - 36000);
      assert.match(resumenComoTexto(r), /Contra la semana pasada: \+3 turnos/);
    });
  });
});

describe('el cierre del domingo', () => {
  test('calcula el balance ANTES de limpiar', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const r = await cierreSemanal(ctx);

      assert.equal(r.corrio, true);
      assert.equal(r.resumen?.atendidos, 7, 'el balance tiene que ver los 7 turnos');
      assert.equal(r.resumen?.facturado, 57000);
      assert.ok((r.turnosBorrados ?? 0) > 0, 'y después tiene que haber limpiado');

      // El balance sobrevive a la limpieza.
      const guardado = await resumenesRepo.porSemana(ctx.db, LUNES);
      assert.equal(guardado?.atendidos, 7);
      assert.equal(guardado?.facturado, 57000);
    });
  });

  test('la semana queda limpia pero el balance no se pierde', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      await cierreSemanal(ctx);

      const quedan = await ctx.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM turnos');
      assert.equal(Number(quedan[0]!.n), 0, 'la semana que terminó se borra entera');

      const resumenes = await resumenesRepo.ultimos(ctx.db);
      assert.equal(resumenes.length, 1);
      assert.equal(resumenes[0]!.atendidos, 7, 'el balance de esa semana tiene que seguir estando');
      assert.equal(resumenes[0]!.facturado, 57000);
    });
  });

  test('los clientes siguen reconocidos después de vaciar la semana', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      await cierreSemanal(ctx);
      const clientes = await ctx.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM clientes');
      assert.equal(Number(clientes[0]!.n), 6, 'la ficha de los clientes no se toca');
    });
  });

  test('no corre si no es domingo', async () => {
    const ctx = await contextoEn(DateTime.fromISO('2026-09-17T20:30:00', { zone: ZONA })); // jueves
    try {
      await sembrarSemana(ctx);
      const r = await cierreSemanal(ctx);
      assert.equal(r.corrio, false);
      assert.match(r.motivo ?? '', /no es el dia/);
      const quedan = await ctx.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM turnos');
      assert.equal(Number(quedan[0]!.n), 7, 'no puede borrar nada un jueves');
    } finally {
      await ctx.cerrar();
    }
  });

  test('no corre el domingo temprano: espera la hora configurada', async () => {
    const ctx = await contextoEn(DateTime.fromISO('2026-09-20T09:00:00', { zone: ZONA }));
    try {
      const r = await cierreSemanal(ctx);
      assert.equal(r.corrio, false);
      assert.match(r.motivo ?? '', /temprano/);
    } finally {
      await ctx.cerrar();
    }
  });

  test('no se repite si el proceso se reinicia el mismo domingo', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const primera = await cierreSemanal(ctx);
      assert.equal(primera.corrio, true);

      const segunda = await cierreSemanal(ctx);
      assert.equal(segunda.corrio, false, 'no puede mandar dos veces el mismo resumen');
      assert.match(segunda.motivo ?? '', /ya se hizo/);
    });
  });

  test('se puede apagar desde la configuración', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const apagado = { ...ctx, cfg: { ...ctx.cfg, cierre_semanal: { ...ctx.cfg.cierre_semanal, activo: false } } };
      const r = await cierreSemanal(apagado);
      assert.equal(r.corrio, false);
      assert.equal(await limpiarTurnosViejos(apagado), 0, 'apagado tampoco borra nada');
    });
  });

  test('los turnos futuros nunca se tocan', async () => {
    await conDomingo(async (ctx) => {
      await sembrarSemana(ctx);
      const futuro = await crearTurno(ctx, {
        telefono: '5491100009999', nombre: 'Del mes que viene', servicioId: 'corte',
        fecha: '2026-10-15', hora: '11:00', origen: 'whatsapp',
      });
      await cierreSemanal(ctx);
      const quedan = await ctx.db.query<{ id: string }>('SELECT id FROM turnos WHERE id = ?', [futuro.id]);
      assert.equal(quedan.length, 1, 'un turno de octubre no puede desaparecer en el cierre de septiembre');
    });
  });
});
