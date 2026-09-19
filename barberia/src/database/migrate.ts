/** `npm run db:migrate` — crea/actualiza el esquema. Es idempotente. */
import { crearBaseDeDatos } from './index.js';
import { log } from '../shared/log.js';

const db = crearBaseDeDatos();
try {
  await db.migrar();
  // eslint-disable-next-line no-console
  console.log(`✅ Esquema aplicado (${db.driver})`);
} catch (e) {
  log.error({ err: e }, 'fallo la migracion');
  // eslint-disable-next-line no-console
  console.error('❌ Falló la migración:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await db.cerrar();
}
