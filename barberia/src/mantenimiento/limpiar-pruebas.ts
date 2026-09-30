/**
 * Limpieza de los turnos de prueba de la puesta en marcha.
 *
 * Corre una sola vez al arrancar, y solo si está cargada la variable
 * LIMPIAR_PRUEBAS_HASTA=AAAA-MM-DD. Borra todo lo anterior o igual a esa fecha:
 *   - en la base: turnos, el balance de esas semanas y los clientes que
 *     quedaron sin ningún turno (eran de prueba);
 *   - en la planilla: esas filas de "Turnos" y de "Balance semanal", y
 *     rehace "Clientes", "Hoy" y "Agenda semanal".
 * Es idempotente: si vuelve a correr no encuentra nada. Después de usarla se
 * saca la variable.
 */
import { DateTime } from 'luxon';
import type { Contexto } from '../booking/servicio.js';
import { env, sheetsConfigurado } from '../config/env.js';
import { esFechaValida } from '../shared/tiempo.js';
import { log } from '../shared/log.js';
import { sheets } from '../google/sheets-api.js';
import { ENCABEZADOS_TURNOS, HOJA_BALANCE, HOJA_TURNOS, refrescarClientes, refrescarHoy, refrescarSemana } from '../google/planilla.js';

export interface ResultadoLimpieza {
  turnos: number;
  semanas: number;
  clientes: number;
  filasTurnos: number;
  filasBalance: number;
}

export async function limpiarPruebas(ctx: Contexto, hasta: string): Promise<ResultadoLimpieza> {
  if (!esFechaValida(hasta)) throw new Error(`LIMPIAR_PRUEBAS_HASTA inválida: "${hasta}" (usar AAAA-MM-DD)`);
  // Fin de ese día en hora del negocio, para comparar con los timestamps UTC.
  const limite = DateTime.fromISO(hasta, { zone: ctx.cfg.negocio.timezone }).endOf('day').toUTC().toISO()!;

  const r = await ctx.db.transaccion(async (tx) => {
    await tx.bloquearAgenda();
    const ids = (await tx.query<{ id: string }>('SELECT id FROM turnos WHERE fecha <= ?', [hasta])).map((f) => f.id);
    for (const id of ids) {
      await tx.exec('DELETE FROM recordatorios WHERE turno_id = ?', [id]);
      await tx.exec('DELETE FROM sheets_outbox WHERE turno_id = ?', [id]);
    }
    const turnos = (await tx.exec('DELETE FROM turnos WHERE fecha <= ?', [hasta])).filas;
    const semanas = (await tx.exec('DELETE FROM resumenes_semanales WHERE semana_desde <= ?', [hasta])).filas;
    // Clientes que solo existieron por las pruebas: dados de alta hasta esa
    // fecha y sin ningún turno que quede en la base.
    const clientes = (
      await tx.exec('DELETE FROM clientes WHERE creado_en <= ? AND telefono NOT IN (SELECT telefono FROM turnos)', [limite])
    ).filas;
    return { turnos, semanas, clientes };
  });

  let filasTurnos = 0;
  let filasBalance = 0;
  if (sheetsConfigurado && env.GOOGLE_SPREADSHEET_ID) {
    const id = env.GOOGLE_SPREADSHEET_ID;
    const ultima = String.fromCharCode(64 + ENCABEZADOS_TURNOS.length);

    // Turnos: la fecha va en la primera columna, en formato AAAA-MM-DD.
    const filas = await sheets.leer(id, `${HOJA_TURNOS}!A2:${ultima}`, { sinFormato: true });
    const quedan = filas.filter((f) => !(String(f[0] ?? '') <= hasta && /^\d{4}-\d{2}-\d{2}$/.test(String(f[0] ?? ''))));
    filasTurnos = filas.length - quedan.length;
    if (filasTurnos > 0) {
      await sheets.limpiar(id, `${HOJA_TURNOS}!A2:${ultima}`);
      if (quedan.length) await sheets.escribir(id, `${HOJA_TURNOS}!A2:${ultima}${quedan.length + 1}`, quedan, { talCual: true });
    }

    // Balance semanal: la primera columna es "AAAA-MM-DD al AAAA-MM-DD".
    const balance = await sheets.leer(id, `${HOJA_BALANCE}!A2:K`);
    const siguen = balance.filter((f) => !(String(f[0] ?? '').slice(0, 10) <= hasta && /^\d{4}-\d{2}-\d{2}/.test(String(f[0] ?? ''))));
    filasBalance = balance.length - siguen.length;
    if (filasBalance > 0) {
      await sheets.limpiar(id, `${HOJA_BALANCE}!A2:K`);
      if (siguen.length) await sheets.escribir(id, `${HOJA_BALANCE}!A2:K${siguen.length + 1}`, siguen);
    }

    await refrescarClientes(id, ctx);
    await refrescarHoy(id, ctx);
    await refrescarSemana(id, ctx);
  }

  const resultado = { ...r, filasTurnos, filasBalance };
  log.info({ hasta, ...resultado }, 'limpieza de turnos de prueba hecha');
  return resultado;
}
