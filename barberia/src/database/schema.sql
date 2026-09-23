-- Esquema comun a SQLite y PostgreSQL.
-- Convenciones:
--   * Los instantes se guardan como epoch milisegundos UTC (columnas *_ms).
--   * Las fechas/horas "del negocio" (fecha, hora_inicio, hora_fin) se guardan
--     en hora local de la barberia, porque es lo que el barbero lee en el panel
--     y en Google Sheets.
--   * Los timestamps de auditoria son texto ISO-8601 en UTC.
--   * Los booleanos son INTEGER 0/1 (portabilidad SQLite <-> PostgreSQL).

CREATE TABLE IF NOT EXISTS clientes (
  telefono        TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL DEFAULT '',
  total_turnos    INTEGER NOT NULL DEFAULT 0,
  primera_visita  TEXT,
  ultima_visita   TEXT,
  notas           TEXT NOT NULL DEFAULT '',
  bloqueado       INTEGER NOT NULL DEFAULT 0,
  creado_en       TEXT NOT NULL,
  actualizado_en  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turnos (
  id              TEXT PRIMARY KEY,
  telefono        TEXT NOT NULL,
  nombre_cliente  TEXT NOT NULL DEFAULT '',
  servicio_id     TEXT NOT NULL,
  servicio_nombre TEXT NOT NULL,
  precio          REAL NOT NULL DEFAULT 0,
  duracion_min    INTEGER NOT NULL,
  fecha           TEXT NOT NULL,
  hora_inicio     TEXT NOT NULL,
  hora_fin        TEXT NOT NULL,
  inicio_ms       BIGINT NOT NULL,
  fin_ms          BIGINT NOT NULL,
  estado          TEXT NOT NULL,
  origen          TEXT NOT NULL DEFAULT 'whatsapp',
  hold_vence_ms   BIGINT,
  observaciones   TEXT NOT NULL DEFAULT '',
  creado_en       TEXT NOT NULL,
  actualizado_en  TEXT NOT NULL,
  cancelado_en    TEXT,
  cancelado_por   TEXT,
  CONSTRAINT turnos_rango_valido CHECK (fin_ms > inicio_ms),
  CONSTRAINT turnos_estado_valido CHECK (
    estado IN ('pendiente','reservado','confirmado','cancelado','completado','no_show','expirado')
  )
);

CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos (fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_inicio ON turnos (inicio_ms);
CREATE INDEX IF NOT EXISTS idx_turnos_telefono ON turnos (telefono, inicio_ms);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos (estado, inicio_ms);

-- Ultima linea de defensa contra la doble reserva exacta.
-- (El solapamiento parcial lo cubre la transaccion serializada del repositorio
--  y, en PostgreSQL, ademas la restriccion de exclusion de schema.postgres.sql.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_inicio_unico
  ON turnos (inicio_ms)
  WHERE estado IN ('pendiente','reservado','confirmado');

CREATE TABLE IF NOT EXISTS bloqueos (
  id            TEXT PRIMARY KEY,
  fecha         TEXT NOT NULL,
  hora_inicio   TEXT NOT NULL,
  hora_fin      TEXT NOT NULL,
  inicio_ms     BIGINT NOT NULL,
  fin_ms        BIGINT NOT NULL,
  dia_completo  INTEGER NOT NULL DEFAULT 0,
  motivo        TEXT NOT NULL DEFAULT '',
  creado_en     TEXT NOT NULL,
  CONSTRAINT bloqueos_rango_valido CHECK (fin_ms > inicio_ms)
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_fecha ON bloqueos (fecha);
CREATE INDEX IF NOT EXISTS idx_bloqueos_inicio ON bloqueos (inicio_ms);

CREATE TABLE IF NOT EXISTS conversaciones (
  telefono           TEXT PRIMARY KEY,
  modo               TEXT NOT NULL DEFAULT 'bot',
  estado_json        TEXT NOT NULL DEFAULT '{}',
  historial_json     TEXT NOT NULL DEFAULT '[]',
  ultimo_mensaje_ms  BIGINT NOT NULL DEFAULT 0,
  actualizado_en     TEXT NOT NULL,
  CONSTRAINT conversaciones_modo_valido CHECK (modo IN ('bot','humano'))
);

-- Idempotencia: WhatsApp reintenta los webhooks y puede repetir un mensaje.
CREATE TABLE IF NOT EXISTS mensajes_procesados (
  id           TEXT PRIMARY KEY,
  telefono     TEXT NOT NULL DEFAULT '',
  recibido_ms  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mensajes_recibido ON mensajes_procesados (recibido_ms);

-- Cola de sincronizacion hacia Google Sheets. Sheets nunca bloquea una reserva:
-- si falla, el evento queda en esta cola y se reintenta con backoff.
CREATE TABLE IF NOT EXISTS sheets_outbox (
  id                 TEXT PRIMARY KEY,
  tipo               TEXT NOT NULL,
  turno_id           TEXT,
  creado_ms          BIGINT NOT NULL,
  proximo_intento_ms BIGINT NOT NULL,
  intentos           INTEGER NOT NULL DEFAULT 0,
  ultimo_error       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_outbox_proximo ON sheets_outbox (proximo_intento_ms);

CREATE TABLE IF NOT EXISTS recordatorios (
  turno_id      TEXT NOT NULL,
  aviso_id      TEXT NOT NULL,
  programado_ms BIGINT NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'pendiente',
  enviado_en    TEXT,
  error         TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (turno_id, aviso_id),
  CONSTRAINT recordatorios_estado_valido CHECK (estado IN ('pendiente','enviado','cancelado','error'))
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_programado ON recordatorios (estado, programado_ms);

-- Beneficios del cliente (hoy: el descuento por dejar reseña en Google Maps).
-- Viven aparte de los turnos porque sobreviven al vaciado semanal: un cliente
-- puede dejar la reseña hoy y usar el descuento el mes que viene.
CREATE TABLE IF NOT EXISTS beneficios (
  id                   TEXT PRIMARY KEY,
  telefono             TEXT NOT NULL,
  tipo                 TEXT NOT NULL,
  descuento_porcentaje REAL NOT NULL,
  estado               TEXT NOT NULL,
  turno_origen         TEXT,
  turno_usado          TEXT,
  vence_ms             BIGINT,
  creado_en            TEXT NOT NULL,
  actualizado_en       TEXT NOT NULL,
  CONSTRAINT beneficios_estado_valido CHECK (estado IN ('disponible','usado','vencido','anulado'))
);

CREATE INDEX IF NOT EXISTS idx_beneficios_cliente ON beneficios (telefono, estado);

-- Resumen de cada semana cerrada. Se guarda ANTES de la limpieza, asi que
-- sobrevive al borrado de los turnos y sirve para comparar semana contra semana.
CREATE TABLE IF NOT EXISTS resumenes_semanales (
  semana_desde  TEXT PRIMARY KEY,
  semana_hasta  TEXT NOT NULL,
  datos_json    TEXT NOT NULL,
  creado_en     TEXT NOT NULL
);

-- Balance de cada mes cerrado, armado a partir de los resumenes semanales.
CREATE TABLE IF NOT EXISTS resumenes_mensuales (
  mes         TEXT PRIMARY KEY,
  datos_json  TEXT NOT NULL,
  creado_en   TEXT NOT NULL
);

-- Bitacora de auditoria: quien hizo que y cuando. Sirve para soporte y para
-- reconstruir que paso si un cliente reclama.
CREATE TABLE IF NOT EXISTS eventos (
  id        TEXT PRIMARY KEY,
  ts_ms     BIGINT NOT NULL,
  tipo      TEXT NOT NULL,
  turno_id  TEXT,
  telefono  TEXT NOT NULL DEFAULT '',
  detalle   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_eventos_ts ON eventos (ts_ms);
