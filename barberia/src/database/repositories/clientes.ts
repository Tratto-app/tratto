import type { Ejecutor } from '../tipos.js';
import type { Cliente } from '../../booking/tipos.js';

interface FilaCliente {
  telefono: string;
  nombre: string;
  total_turnos: number;
  primera_visita: string | null;
  ultima_visita: string | null;
  notas: string;
  bloqueado: number;
  creado_en: string;
  actualizado_en: string;
}

const mapear = (f: FilaCliente): Cliente => ({
  telefono: f.telefono,
  nombre: f.nombre ?? '',
  totalTurnos: Number(f.total_turnos),
  primeraVisita: f.primera_visita,
  ultimaVisita: f.ultima_visita,
  notas: f.notas ?? '',
  bloqueado: Number(f.bloqueado) === 1,
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
});

export const clientesRepo = {
  async porTelefono(ex: Ejecutor, telefono: string): Promise<Cliente | null> {
    const filas = await ex.query<FilaCliente>('SELECT * FROM clientes WHERE telefono = ?', [telefono]);
    return filas[0] ? mapear(filas[0]) : null;
  },

  /** Alta o actualizacion del nombre. No pisa un nombre cargado con uno vacio. */
  async registrar(ex: Ejecutor, telefono: string, nombre: string, ahoraIso: string): Promise<void> {
    await ex.exec(
      `INSERT INTO clientes (telefono, nombre, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (telefono) DO UPDATE SET
         nombre = CASE WHEN excluded.nombre <> '' THEN excluded.nombre ELSE clientes.nombre END,
         actualizado_en = excluded.actualizado_en`,
      [telefono, nombre, ahoraIso, ahoraIso],
    );
  },

  async marcarVisita(ex: Ejecutor, telefono: string, ahoraIso: string): Promise<void> {
    await ex.exec(
      `UPDATE clientes SET
         total_turnos = total_turnos + 1,
         primera_visita = COALESCE(primera_visita, ?),
         ultima_visita = ?,
         actualizado_en = ?
       WHERE telefono = ?`,
      [ahoraIso, ahoraIso, ahoraIso, telefono],
    );
  },

  async listar(ex: Ejecutor, limite = 500): Promise<Cliente[]> {
    const filas = await ex.query<FilaCliente>(
      'SELECT * FROM clientes ORDER BY ultima_visita DESC NULLS LAST, creado_en DESC LIMIT ?',
      [limite],
    );
    return filas.map(mapear);
  },

  async guardarNotas(ex: Ejecutor, telefono: string, notas: string, ahoraIso: string): Promise<void> {
    await ex.exec('UPDATE clientes SET notas = ?, actualizado_en = ? WHERE telefono = ?', [notas, ahoraIso, telefono]);
  },
};
