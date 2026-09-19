export type Driver = 'sqlite' | 'postgres';

export interface Ejecutor {
  /** Devuelve filas. Los placeholders se escriben siempre con `?`. */
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Ejecuta sin devolver filas. */
  exec(sql: string, params?: readonly unknown[]): Promise<{ filas: number }>;
}

export interface Transaccion extends Ejecutor {
  /**
   * Serializa todas las escrituras de la agenda.
   *
   * SQLite ya queda serializado por `BEGIN IMMEDIATE` (un unico escritor).
   * PostgreSQL toma un advisory lock de transaccion, de modo que dos instancias
   * del backend no puedan calcular disponibilidad y escribir en paralelo.
   */
  bloquearAgenda(): Promise<void>;
}

export interface BaseDeDatos extends Ejecutor {
  readonly driver: Driver;
  /** Transaccion de escritura serializada. Hace rollback ante cualquier excepcion. */
  transaccion<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T>;
  migrar(): Promise<void>;
  cerrar(): Promise<void>;
}
