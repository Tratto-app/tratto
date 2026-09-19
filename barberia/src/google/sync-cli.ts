/** `npm run sheets:sync` — rehace la planilla completa desde la base de datos. */
import { crearBaseDeDatos } from '../database/index.js';
import { crearContexto } from '../booking/servicio.js';
import { resincronizarTodo } from './sync.js';

const db = crearBaseDeDatos();
try {
  await db.migrar();
  const ctx = crearContexto(db);
  const r = await resincronizarTodo(ctx);
  console.log(`✅ Planilla reconstruida: ${r.turnos} turno(s) volcados.`);
} catch (e) {
  console.error('❌ No se pudo sincronizar:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await db.cerrar();
}
