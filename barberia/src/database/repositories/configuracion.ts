import type { Ejecutor } from '../tipos.js';

/**
 * Configuración editada desde el panel. Vive en la base porque en hostings con
 * disco efímero (Render) el archivo config/negocio.json vuelve a la versión del
 * repositorio en cada despliegue: sin esto, un precio cambiado desde el panel
 * se perdía en el siguiente deploy.
 */
export const configuracionRepo = {
  async leer(ex: Ejecutor, clave: string): Promise<unknown | null> {
    const filas = await ex.query<{ valor_json: string }>('SELECT valor_json FROM configuracion WHERE clave = ?', [clave]);
    if (!filas[0]) return null;
    try {
      return JSON.parse(filas[0].valor_json) as unknown;
    } catch {
      return null;
    }
  },

  async guardar(ex: Ejecutor, clave: string, valor: unknown, ahoraIso: string): Promise<void> {
    await ex.exec(
      `INSERT INTO configuracion (clave, valor_json, actualizado_en) VALUES (?,?,?)
       ON CONFLICT (clave) DO UPDATE SET valor_json = excluded.valor_json, actualizado_en = excluded.actualizado_en`,
      [clave, JSON.stringify(valor), ahoraIso],
    );
  },
};
