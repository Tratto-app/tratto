import type { Ejecutor } from '../tipos.js';
import type { ResumenSemanal } from '../../reportes/semanal.js';
import type { ResumenMensual } from '../../reportes/mensual.js';

/**
 * Los resúmenes se guardan aparte de los turnos a propósito: la limpieza
 * semanal borra los turnos viejos, pero el balance de cada semana queda.
 */
export const resumenesRepo = {
  async guardar(ex: Ejecutor, resumen: ResumenSemanal, ahoraIso: string): Promise<void> {
    await ex.exec(
      `INSERT INTO resumenes_semanales (semana_desde, semana_hasta, datos_json, creado_en)
       VALUES (?,?,?,?)
       ON CONFLICT (semana_desde) DO UPDATE SET
         semana_hasta = excluded.semana_hasta,
         datos_json = excluded.datos_json,
         creado_en = excluded.creado_en`,
      [resumen.desde, resumen.hasta, JSON.stringify(resumen), ahoraIso],
    );
  },

  async porSemana(ex: Ejecutor, semanaDesde: string): Promise<ResumenSemanal | null> {
    const filas = await ex.query<{ datos_json: string }>(
      'SELECT datos_json FROM resumenes_semanales WHERE semana_desde = ?',
      [semanaDesde],
    );
    if (!filas[0]) return null;
    try {
      return JSON.parse(filas[0].datos_json) as ResumenSemanal;
    } catch {
      return null;
    }
  },

  async ultimos(ex: Ejecutor, limite = 12): Promise<ResumenSemanal[]> {
    const filas = await ex.query<{ datos_json: string }>(
      'SELECT datos_json FROM resumenes_semanales ORDER BY semana_desde DESC LIMIT ?',
      [limite],
    );
    return filas
      .map((f) => {
        try {
          return JSON.parse(f.datos_json) as ResumenSemanal;
        } catch {
          return null;
        }
      })
      .filter((r): r is ResumenSemanal => r !== null);
  },
};

/** Balances mensuales. Se arman a partir de los semanales y tambien perduran. */
export const resumenesMensualesRepo = {
  async guardar(ex: Ejecutor, resumen: ResumenMensual, ahoraIso: string): Promise<void> {
    await ex.exec(
      `INSERT INTO resumenes_mensuales (mes, datos_json, creado_en) VALUES (?,?,?)
       ON CONFLICT (mes) DO UPDATE SET datos_json = excluded.datos_json, creado_en = excluded.creado_en`,
      [resumen.mes, JSON.stringify(resumen), ahoraIso],
    );
  },

  async porMes(ex: Ejecutor, mes: string): Promise<ResumenMensual | null> {
    const filas = await ex.query<{ datos_json: string }>('SELECT datos_json FROM resumenes_mensuales WHERE mes = ?', [mes]);
    if (!filas[0]) return null;
    try {
      return JSON.parse(filas[0].datos_json) as ResumenMensual;
    } catch {
      return null;
    }
  },

  async ultimos(ex: Ejecutor, limite = 12): Promise<ResumenMensual[]> {
    const filas = await ex.query<{ datos_json: string }>(
      'SELECT datos_json FROM resumenes_mensuales ORDER BY mes DESC LIMIT ?',
      [limite],
    );
    return filas
      .map((f) => {
        try {
          return JSON.parse(f.datos_json) as ResumenMensual;
        } catch {
          return null;
        }
      })
      .filter((r): r is ResumenMensual => r !== null);
  },
};
