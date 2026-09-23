-- Migraciones incrementales.
-- Se aplican con "ALTER TABLE ... ADD COLUMN" y el driver ignora el error si la
-- columna ya existe: asi el esquema se actualiza solo al desplegar una version
-- nueva, sin pasos manuales.
ALTER TABLE turnos ADD COLUMN descuento_porcentaje REAL NOT NULL DEFAULT 0;
ALTER TABLE turnos ADD COLUMN beneficio_id TEXT;
