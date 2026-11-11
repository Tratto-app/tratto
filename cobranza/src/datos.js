// Acceso a los datos. Dos implementaciones con la misma interfaz:
//   repoD1(db)      → la base D1 de Cloudflare (SQLite) de cada negocio
//   repoMemoria()   → en memoria, para el modo demo y las pruebas
// La interfaz es chica a propósito (filas, fila, insertar, actualizar, borrar,
// config): todas las reglas viven en logica.js y nucleo.js, así las dos
// implementaciones no pueden comportarse distinto.

export const TABLAS = {
  clientes: ['id', 'nombre', 'telefono', 'mail', 'acepta', 'pausado', 'baja', 'creado'],
  deudas: ['id', 'cliente_id', 'concepto', 'monto', 'vence', 'repite', 'dia_mes', 'estado', 'pagada_el', 'medio',
    'token', 'mp_preferencia', 'mp_link', 'mp_pago', 'av_previo', 'av_dia', 'av_vencido', 'av_ultimo',
    'siguiente_creada', 'creado'],
  mensajes: ['id', 'cliente_id', 'deuda_id', 'etapa', 'canal', 'estado', 'wa_id', 'error', 'dia', 'creado'],
  respuestas: ['id', 'cliente_id', 'telefono', 'texto', 'wa_id', 'creado'],
  sesiones: ['id', 'hash', 'vence'],
};

export const VERSION_ESQUEMA = 1;
export const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT)`,
  `CREATE TABLE IF NOT EXISTS clientes (
     id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, telefono TEXT, mail TEXT,
     acepta INTEGER NOT NULL DEFAULT 0, pausado INTEGER NOT NULL DEFAULT 0, baja INTEGER NOT NULL DEFAULT 0,
     creado TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS clientes_telefono ON clientes (telefono)`,
  `CREATE TABLE IF NOT EXISTS deudas (
     id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, concepto TEXT NOT NULL,
     monto INTEGER NOT NULL, vence TEXT NOT NULL, repite TEXT NOT NULL DEFAULT 'unico', dia_mes INTEGER,
     estado TEXT NOT NULL DEFAULT 'pendiente', pagada_el TEXT, medio TEXT, token TEXT NOT NULL,
     mp_preferencia TEXT, mp_link TEXT, mp_pago TEXT,
     av_previo TEXT, av_dia TEXT, av_vencido TEXT, av_ultimo TEXT,
     siguiente_creada INTEGER NOT NULL DEFAULT 0, creado TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS deudas_estado ON deudas (estado, vence)`,
  `CREATE INDEX IF NOT EXISTS deudas_cliente ON deudas (cliente_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS deudas_token ON deudas (token)`,
  `CREATE TABLE IF NOT EXISTS mensajes (
     id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, deuda_id INTEGER, etapa TEXT,
     canal TEXT NOT NULL, estado TEXT NOT NULL, wa_id TEXT, error TEXT, dia TEXT NOT NULL, creado TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS mensajes_dia ON mensajes (dia)`,
  `CREATE INDEX IF NOT EXISTS mensajes_cliente ON mensajes (cliente_id)`,
  `CREATE INDEX IF NOT EXISTS mensajes_wa ON mensajes (wa_id)`,
  `CREATE TABLE IF NOT EXISTS respuestas (
     id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER, telefono TEXT, texto TEXT, wa_id TEXT,
     creado TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS respuestas_cliente ON respuestas (cliente_id)`,
  `CREATE TABLE IF NOT EXISTS sesiones (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, vence TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sesiones_hash ON sesiones (hash)`,
];

function columnas(tabla) {
  const c = TABLAS[tabla];
  if (!c) throw new Error(`Tabla desconocida: ${tabla}`);
  return c;
}
function revisar(tabla, datos) {
  const c = columnas(tabla);
  for (const k of Object.keys(datos)) if (!c.includes(k)) throw new Error(`Columna desconocida: ${tabla}.${k}`);
}
// Un filtro es { columna: valor } · { columna: null } · { columna: { desde, hasta } }
// (desde incluido, hasta sin incluir) · { columna: { en: [a, b] } }.
function esRango(v) { return v !== null && typeof v === 'object'; }

// ── Cloudflare D1 ──────────────────────────────────────────────────────────
export function repoD1(db) {
  let listo = false;
  function donde(tabla, filtros = {}) {
    revisar(tabla, filtros);
    const partes = [], valores = [];
    for (const [k, v] of Object.entries(filtros)) {
      if (v === null) partes.push(`${k} IS NULL`);
      else if (esRango(v)) {
        if ('desde' in v) { partes.push(`${k} >= ?`); valores.push(v.desde); }
        if ('hasta' in v) { partes.push(`${k} < ?`); valores.push(v.hasta); }
        if ('en' in v) {
          if (!v.en.length) partes.push('0');
          else { partes.push(`${k} IN (${v.en.map(() => '?').join(',')})`); valores.push(...v.en); }
        }
      } else { partes.push(`${k} = ?`); valores.push(v); }
    }
    return { sql: partes.length ? ` WHERE ${partes.join(' AND ')}` : '', valores };
  }
  return {
    // Crea las tablas la primera vez. Una sola consulta en el arranque normal.
    async preparar() {
      if (listo) return;
      let version = 0;
      try {
        const f = await db.prepare(`SELECT valor FROM config WHERE clave = 'esquema'`).first();
        version = Number(f?.valor || 0);
      } catch { version = 0; }
      if (version < VERSION_ESQUEMA) {
        await db.batch([
          ...ESQUEMA.map((s) => db.prepare(s)),
          db.prepare(`INSERT OR REPLACE INTO config (clave, valor) VALUES ('esquema', ?)`).bind(String(VERSION_ESQUEMA)),
        ]);
      }
      listo = true;
    },
    async filas(tabla, filtros = {}, { orden, limite } = {}) {
      const { sql, valores } = donde(tabla, filtros);
      let q = `SELECT * FROM ${tabla}${sql}`;
      if (orden) {
        const [col, sentido] = orden.split(' ');
        if (!columnas(tabla).includes(col)) throw new Error(`Orden desconocido: ${orden}`);
        q += ` ORDER BY ${col} ${sentido === 'desc' ? 'DESC' : 'ASC'}, id ${sentido === 'desc' ? 'DESC' : 'ASC'}`;
      } else q += ' ORDER BY id ASC';
      if (limite) q += ` LIMIT ${Number(limite) | 0}`;
      const r = await db.prepare(q).bind(...valores).all();
      return (r.results || []).map((x) => ({ ...x }));
    },
    async fila(tabla, id) {
      columnas(tabla);
      const f = await db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).bind(Number(id)).first();
      return f ? { ...f } : null;
    },
    async insertar(tabla, datos) {
      revisar(tabla, datos);
      const ks = Object.keys(datos);
      const r = await db.prepare(`INSERT INTO ${tabla} (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')})`)
        .bind(...ks.map((k) => datos[k] ?? null)).run();
      return Number(r.meta.last_row_id);
    },
    async actualizar(tabla, id, datos) {
      revisar(tabla, datos);
      const ks = Object.keys(datos);
      if (!ks.length) return;
      await db.prepare(`UPDATE ${tabla} SET ${ks.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
        .bind(...ks.map((k) => datos[k] ?? null), Number(id)).run();
    },
    async borrar(tabla, filtros) {
      const { sql, valores } = donde(tabla, filtros);
      if (!sql) throw new Error('borrar() necesita un filtro');
      await db.prepare(`DELETE FROM ${tabla}${sql}`).bind(...valores).run();
    },
    async config() {
      const r = await db.prepare('SELECT clave, valor FROM config').all();
      return Object.fromEntries((r.results || []).map((f) => [f.clave, f.valor]));
    },
    async guardarConfig(cambios) {
      const pares = Object.entries(cambios);
      if (!pares.length) return;
      await db.batch(pares.map(([k, v]) => (v === null || v === undefined
        ? db.prepare('DELETE FROM config WHERE clave = ?').bind(k)
        : db.prepare('INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)').bind(k, String(v)))));
    },
  };
}

// ── En memoria (demo y pruebas) ────────────────────────────────────────────
export function repoMemoria() {
  const tablas = Object.fromEntries(Object.keys(TABLAS).map((t) => [t, []]));
  const proximo = Object.fromEntries(Object.keys(TABLAS).map((t) => [t, 1]));
  const cfg = {};
  const cumple = (fila, filtros) => Object.entries(filtros).every(([k, v]) => {
    const x = fila[k] ?? null;
    if (v === null) return x === null;
    if (esRango(v)) {
      if ('desde' in v && !(x !== null && x >= v.desde)) return false;
      if ('hasta' in v && !(x !== null && x < v.hasta)) return false;
      if ('en' in v && !v.en.includes(x)) return false;
      return true;
    }
    return x === v;
  });
  const vacia = (tabla) => Object.fromEntries(columnas(tabla).map((c) => [c, null]));
  const DEFECTO = { clientes: { acepta: 0, pausado: 0, baja: 0 }, deudas: { repite: 'unico', estado: 'pendiente', siguiente_creada: 0 } };
  return {
    async preparar() {},
    async filas(tabla, filtros = {}, { orden, limite } = {}) {
      revisar(tabla, filtros);
      let r = tablas[tabla].filter((f) => cumple(f, filtros)).map((f) => ({ ...f }));
      const [col, sentido] = (orden || 'id asc').split(' ');
      if (!columnas(tabla).includes(col)) throw new Error(`Orden desconocido: ${orden}`);
      const s = sentido === 'desc' ? -1 : 1;
      r.sort((a, b) => (a[col] < b[col] ? -s : a[col] > b[col] ? s : (a.id - b.id) * s));
      if (limite) r = r.slice(0, limite);
      return r;
    },
    async fila(tabla, id) {
      const f = tablas[columnas(tabla) && tabla].find((x) => x.id === Number(id));
      return f ? { ...f } : null;
    },
    async insertar(tabla, datos) {
      revisar(tabla, datos);
      const id = proximo[tabla]++;
      tablas[tabla].push({ ...vacia(tabla), ...(DEFECTO[tabla] || {}), ...datos, id });
      return id;
    },
    async actualizar(tabla, id, datos) {
      revisar(tabla, datos);
      const f = tablas[tabla].find((x) => x.id === Number(id));
      if (f) Object.assign(f, datos);
    },
    async borrar(tabla, filtros) {
      revisar(tabla, filtros);
      if (!Object.keys(filtros).length) throw new Error('borrar() necesita un filtro');
      tablas[tabla] = tablas[tabla].filter((f) => !cumple(f, filtros));
    },
    async config() { return { ...cfg }; },
    async guardarConfig(cambios) {
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null || v === undefined) delete cfg[k]; else cfg[k] = String(v);
      }
    },
  };
}
