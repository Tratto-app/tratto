import type { Ejecutor } from '../tipos.js';

export type ModoConversacion = 'bot' | 'humano';

export interface RegistroConversacion {
  telefono: string;
  modo: ModoConversacion;
  estado: Record<string, unknown>;
  historial: MensajeHistorial[];
  ultimoMensajeMs: number;
}

export interface MensajeHistorial {
  rol: 'cliente' | 'bot';
  texto: string;
  ts: number;
}

const VACIA = (telefono: string): RegistroConversacion => ({
  telefono,
  modo: 'bot',
  estado: {},
  historial: [],
  ultimoMensajeMs: 0,
});

function parsear<T>(json: string, porDefecto: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return porDefecto;
  }
}

export const conversacionesRepo = {
  async obtener(ex: Ejecutor, telefono: string): Promise<RegistroConversacion> {
    const filas = await ex.query<{
      telefono: string;
      modo: ModoConversacion;
      estado_json: string;
      historial_json: string;
      ultimo_mensaje_ms: number;
    }>('SELECT * FROM conversaciones WHERE telefono = ?', [telefono]);
    const f = filas[0];
    if (!f) return VACIA(telefono);
    return {
      telefono: f.telefono,
      modo: f.modo,
      estado: parsear<Record<string, unknown>>(f.estado_json, {}),
      historial: parsear<MensajeHistorial[]>(f.historial_json, []),
      ultimoMensajeMs: Number(f.ultimo_mensaje_ms),
    };
  },

  async guardar(ex: Ejecutor, c: RegistroConversacion, ahoraIso: string): Promise<void> {
    await ex.exec(
      `INSERT INTO conversaciones (telefono, modo, estado_json, historial_json, ultimo_mensaje_ms, actualizado_en)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT (telefono) DO UPDATE SET
         modo = excluded.modo,
         estado_json = excluded.estado_json,
         historial_json = excluded.historial_json,
         ultimo_mensaje_ms = excluded.ultimo_mensaje_ms,
         actualizado_en = excluded.actualizado_en`,
      [c.telefono, c.modo, JSON.stringify(c.estado), JSON.stringify(c.historial), c.ultimoMensajeMs, ahoraIso],
    );
  },

  async cambiarModo(ex: Ejecutor, telefono: string, modo: ModoConversacion, ahoraIso: string): Promise<void> {
    await ex.exec(
      `INSERT INTO conversaciones (telefono, modo, actualizado_en) VALUES (?,?,?)
       ON CONFLICT (telefono) DO UPDATE SET modo = excluded.modo, actualizado_en = excluded.actualizado_en`,
      [telefono, modo, ahoraIso],
    );
  },

  async enModoHumano(ex: Ejecutor, limite = 50): Promise<string[]> {
    const filas = await ex.query<{ telefono: string }>(
      "SELECT telefono FROM conversaciones WHERE modo = 'humano' ORDER BY actualizado_en DESC LIMIT ?",
      [limite],
    );
    return filas.map((f) => f.telefono);
  },
};

export const mensajesRepo = {
  /** Devuelve true si el mensaje es nuevo; false si ya se habia procesado. */
  async registrarSiEsNuevo(ex: Ejecutor, id: string, telefono: string, ahoraMs: number): Promise<boolean> {
    const r = await ex.exec(
      'INSERT INTO mensajes_procesados (id, telefono, recibido_ms) VALUES (?,?,?) ON CONFLICT (id) DO NOTHING',
      [id, telefono, ahoraMs],
    );
    return r.filas > 0;
  },

  async limpiarViejos(ex: Ejecutor, anteriorAMs: number): Promise<number> {
    const r = await ex.exec('DELETE FROM mensajes_procesados WHERE recibido_ms < ?', [anteriorAMs]);
    return r.filas;
  },
};
