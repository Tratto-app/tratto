// Hace que la base SQLite que trae Node se comporte como la D1 de Cloudflare
// (misma forma de pedir: prepare → bind → all / first / run, y batch).
// Sirve para las pruebas y para correr la app en la compu sin Cloudflare.
export function d1DeSqlite(db) {
  const sentencia = (sql, args = []) => ({
    bind: (...a) => sentencia(sql, a),
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async run() {
      const r = db.prepare(sql).run(...args);
      return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
    },
  });
  return {
    consultas: 0,
    prepare(sql) { this.consultas += 1; return sentencia(sql); },
    async batch(lista) { const salida = []; for (const s of lista) salida.push(await s.run()); return salida; },
  };
}
