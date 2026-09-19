/**
 * Punto de entrada.
 *
 * Arranca en este orden: configuracion -> base de datos -> contexto -> workers
 * -> servidor HTTP. Si algo esencial falta, avisa y (en produccion) no arranca.
 */
import { env, esProduccion, revisarEnvProduccion, iaConfigurada, whatsappConfigurado, sheetsConfigurado } from './config/env.js';
import { negocio, revisarConfig } from './config/negocio.js';
import { crearBaseDeDatos } from './database/index.js';
import { crearContexto } from './booking/servicio.js';
import { crearServidor, escuchar } from './backend/servidor.js';
import { arrancarWorkerDeSheets } from './google/sync.js';
import { arrancarWorkerDeRecordatorios } from './reminders/scheduler.js';
import { log } from './shared/log.js';

async function arrancar(): Promise<void> {
  // 1. Configuracion del negocio.
  const avisos = revisarConfig();
  for (const aviso of avisos) log.warn({ aviso }, 'revisá la configuración del negocio');
  const cfg = negocio();

  // 2. Variables de entorno criticas.
  const faltantes = revisarEnvProduccion();
  if (faltantes.length) {
    for (const f of faltantes) log.error({ falta: f }, 'configuración incompleta para producción');
    throw new Error(`No se puede arrancar en producción: ${faltantes.join(' | ')}`);
  }

  // 3. Base de datos.
  const db = crearBaseDeDatos();
  await db.migrar();
  const ctx = crearContexto(db, cfg);
  log.info(
    { negocio: cfg.negocio.nombre, zona: cfg.negocio.timezone, driver: db.driver, ia: iaConfigurada, whatsapp: whatsappConfigurado, sheets: sheetsConfigurado },
    'sistema iniciado',
  );
  if (!iaConfigurada) log.warn('sin AI_API_KEY: el bot atiende en modo menú (los turnos se siguen pudiendo reservar)');
  if (!whatsappConfigurado) log.warn('sin credenciales de WhatsApp: solo funciona el simulador y el panel');

  // 4. Workers en segundo plano.
  const workers = env.WORKERS_HABILITADOS
    ? [arrancarWorkerDeSheets(ctx), arrancarWorkerDeRecordatorios(ctx)]
    : [];

  // 5. Servidor HTTP.
  const app = crearServidor(ctx);
  const servidor = escuchar(app);

  const apagar = async (senal: string) => {
    log.info({ senal }, 'apagando');
    for (const w of workers) w.detener();
    await servidor.cerrar();
    await db.cerrar();
    process.exit(0);
  };
  process.on('SIGTERM', () => void apagar('SIGTERM'));
  process.on('SIGINT', () => void apagar('SIGINT'));
  process.on('unhandledRejection', (razon) => {
    log.error({ err: razon instanceof Error ? razon.stack : String(razon) }, 'promesa rechazada sin manejar');
  });
  process.on('uncaughtException', (e) => {
    log.fatal({ err: e.stack }, 'excepción no capturada');
    if (esProduccion) process.exit(1);
  });
}

arrancar().catch((e) => {
  log.fatal({ err: e instanceof Error ? e.stack : String(e) }, 'no se pudo arrancar');
  // eslint-disable-next-line no-console
  console.error('\n❌ No se pudo arrancar:', e instanceof Error ? e.message : e, '\n');
  process.exit(1);
});
