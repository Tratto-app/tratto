import { DateTime } from 'luxon';
import { cargarConfigNegocio } from '../src/config/negocio.js';
import { crearSqlite } from '../src/database/sqlite.js';
import type { BaseDeDatos } from '../src/database/tipos.js';
import type { Contexto } from '../src/booking/servicio.js';

export const CONFIG_TEST = 'tests/fixtures/negocio.test.json';
export const ZONA = 'America/Argentina/Buenos_Aires';

/** Miercoles 16/09/2026, 11:00 hora de Buenos Aires. Referencia fija de todos los tests. */
export const AHORA_FIJO = DateTime.fromISO('2026-09-16T11:00:00', { zone: ZONA });

export const MIERCOLES = '2026-09-16';
export const JUEVES = '2026-09-17';
export const SABADO = '2026-09-19';
export const DOMINGO = '2026-09-20';
export const LUNES_FERIADO = '2026-09-21';
export const JUEVES_ESPECIAL = '2026-09-24';
export const EN_VACACIONES = '2026-10-06';

export async function contextoDePrueba(opciones: { ahora?: DateTime } = {}): Promise<Contexto & { cerrar: () => Promise<void> }> {
  const cfg = cargarConfigNegocio(CONFIG_TEST);
  const db: BaseDeDatos = crearSqlite(':memory:');
  await db.migrar();
  let reloj = opciones.ahora ?? AHORA_FIJO;
  return {
    db,
    cfg,
    ahora: () => reloj,
    cerrar: () => db.cerrar(),
    // @ts-expect-error utilidad solo para tests: mover el reloj
    avanzar(minutos: number) {
      reloj = reloj.plus({ minutes: minutos });
    },
  };
}

export function moverReloj(ctx: Contexto, minutos: number): void {
  (ctx as unknown as { avanzar: (m: number) => void }).avanzar(minutos);
}

export const TELEFONO_A = '5491133334444';
export const TELEFONO_B = '5491155556666';
