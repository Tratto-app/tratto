/**
 * `npm run sheets:setup`
 * Crea las hojas y los encabezados en la planilla, y avisa si algo falta.
 */
import { env, sheetsConfigurado } from '../config/env.js';
import { sheets } from './sheets-api.js';
import { asegurarEstructura, HOJAS } from './planilla.js';
import { crearBaseDeDatos } from '../database/index.js';
import { crearContexto } from '../booking/servicio.js';
import { resincronizarTodo } from './sync.js';

if (!sheetsConfigurado || !env.GOOGLE_SPREADSHEET_ID) {
  console.error('❌ Falta configurar Google. Revisá el README (sección "Conectar Google Sheets").');
  console.error('   Necesitás GOOGLE_SPREADSHEET_ID y, o bien GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN,');
  console.error('   o bien GOOGLE_SERVICE_ACCOUNT_JSON.');
  process.exit(1);
}

const id = env.GOOGLE_SPREADSHEET_ID;
try {
  const titulo = await sheets.titulo(id);
  console.log(`📄 Planilla encontrada: "${titulo}"`);
  await asegurarEstructura(id);
  console.log(`✅ Hojas listas: ${HOJAS.join(', ')}`);

  const db = crearBaseDeDatos();
  await db.migrar();
  const ctx = crearContexto(db);
  const r = await resincronizarTodo(ctx);
  await db.cerrar();
  console.log(`✅ Datos volcados: ${r.turnos} turno(s) en la hoja.`);
  console.log(`🔗 https://docs.google.com/spreadsheets/d/${id}/edit`);
} catch (e) {
  console.error('❌ Error preparando la planilla:', e instanceof Error ? e.message : e);
  console.error('   Revisá que la planilla exista y que la cuenta tenga permiso de edición.');
  process.exitCode = 1;
}
