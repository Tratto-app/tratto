/**
 * Worker de sincronizacion con Google Sheets.
 *
 * Diseño deliberado: Google Sheets NUNCA bloquea una reserva. Cuando se crea,
 * cambia o cancela un turno, se encola un evento en la tabla `sheets_outbox`
 * dentro de la misma transaccion. Este worker vacia esa cola despues, con
 * reintentos y backoff exponencial. Si Google esta caido, el cliente igual
 * recibe su turno confirmado y la planilla se pone al dia sola cuando vuelve.
 */
import { env, sheetsConfigurado } from '../config/env.js';
import { log } from '../shared/log.js';
import { outboxRepo, type EventoOutbox } from '../database/repositories/outbox.js';
import { turnosRepo } from '../database/repositories/turnos.js';
import type { Contexto } from '../booking/servicio.js';
import { ErrorSheets } from './sheets-api.js';
import { asegurarEstructura, refrescarClientes, refrescarHoy, refrescarSemana, volcarTodo, volcarTurno } from './planilla.js';

const MAX_INTENTOS_LOG = 5;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_TOPE_MS = 30 * 60_000;

function proximoIntento(intentos: number, ahoraMs: number): number {
  return ahoraMs + Math.min(BACKOFF_BASE_MS * 2 ** intentos, BACKOFF_TOPE_MS);
}

/**
 * Crear las hojas cuesta llamadas a la API, asi que se hace una sola vez por
 * proceso, antes de la primera escritura. Si alguien borra una pestaña a mano,
 * se recupera reiniciando el servicio o con el boton "Resincronizar".
 */
let estructuraVerificada = false;

async function asegurarEstructuraUnaVez(spreadsheetId: string): Promise<void> {
  if (estructuraVerificada) return;
  await asegurarEstructura(spreadsheetId);
  estructuraVerificada = true;
}

/** Solo para tests: olvida que ya verifico la estructura. */
export function reiniciarCacheDeEstructura(): void {
  estructuraVerificada = false;
}

export interface ResultadoSync {
  procesados: number;
  fallados: number;
  pendientes: number;
  vistasRefrescadas: boolean;
}

async function procesarEvento(ctx: Contexto, spreadsheetId: string, ev: EventoOutbox): Promise<void> {
  if (ev.tipo === 'refrescar_vistas') return; // el refresco va al final del ciclo
  if (!ev.turnoId) return;
  const turno = await turnosRepo.porId(ctx.db, ev.turnoId);
  if (!turno) {
    log.warn({ evento: ev.id, turno: ev.turnoId }, 'evento de Sheets sin turno asociado; se descarta');
    return;
  }
  await volcarTurno(spreadsheetId, turno, ctx.cfg.negocio.timezone);
}

/** Procesa un lote de la cola. Devuelve cuantos eventos quedaron sin resolver. */
export async function sincronizarPendientes(ctx: Contexto): Promise<ResultadoSync> {
  const base: ResultadoSync = { procesados: 0, fallados: 0, pendientes: 0, vistasRefrescadas: false };
  if (!sheetsConfigurado || !env.GOOGLE_SPREADSHEET_ID) return base;

  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;
  const ahoraMs = ctx.ahora().toMillis();
  const eventos = await outboxRepo.pendientes(ctx.db, ahoraMs, 25);
  if (eventos.length === 0) {
    base.pendientes = await outboxRepo.contar(ctx.db);
    return base;
  }

  try {
    await asegurarEstructuraUnaVez(spreadsheetId);
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : e }, 'no se pudo preparar la planilla; se reintenta en el proximo ciclo');
    base.pendientes = await outboxRepo.contar(ctx.db);
    return base;
  }

  let huboCambios = false;
  for (const ev of eventos) {
    try {
      await procesarEvento(ctx, spreadsheetId, ev);
      await outboxRepo.borrar(ctx.db, ev.id);
      base.procesados++;
      huboCambios = true;
    } catch (e) {
      base.fallados++;
      const mensaje = e instanceof Error ? e.message : String(e);
      const reintentable = !(e instanceof ErrorSheets) || e.reintentable || e.status === 401;
      if (!reintentable) {
        // Error permanente (por ejemplo, planilla inexistente o sin permisos):
        // se pospone igual, pero se avisa fuerte para que alguien lo mire.
        log.error({ evento: ev.id, err: mensaje }, 'error no reintentable sincronizando con Sheets');
      } else if (ev.intentos < MAX_INTENTOS_LOG) {
        log.warn({ evento: ev.id, intentos: ev.intentos, err: mensaje }, 'fallo la sincronizacion con Sheets, se reintenta');
      }
      await outboxRepo.posponer(ctx.db, ev.id, proximoIntento(ev.intentos, ahoraMs), mensaje);
    }
  }

  // Las vistas se rehacen una sola vez por ciclo, no una vez por turno.
  if (huboCambios) {
    try {
      await refrescarHoy(spreadsheetId, ctx);
      await refrescarSemana(spreadsheetId, ctx);
      // La ficha de clientes tambien: si no, un cliente nuevo no aparece hasta
      // que alguien apriete "Resincronizar" a mano.
      await refrescarClientes(spreadsheetId, ctx);
      base.vistasRefrescadas = true;
    } catch (e) {
      log.warn({ err: e instanceof Error ? e.message : e }, 'no se pudieron refrescar las vistas de la planilla');
    }
  }

  base.pendientes = await outboxRepo.contar(ctx.db);
  return base;
}

/** Reconstruye la planilla entera desde la base. Lo usa el CLI y el boton del panel. */
export async function resincronizarTodo(ctx: Contexto): Promise<{ turnos: number; nuevos: number }> {
  if (!sheetsConfigurado || !env.GOOGLE_SPREADSHEET_ID) {
    throw new Error('Google Sheets no esta configurado (falta GOOGLE_SPREADSHEET_ID o las credenciales)');
  }
  return volcarTodo(env.GOOGLE_SPREADSHEET_ID, ctx);
}

export function arrancarWorkerDeSheets(ctx: Contexto): { detener: () => void } {
  if (!sheetsConfigurado || !env.GOOGLE_SPREADSHEET_ID) {
    log.warn('Google Sheets deshabilitado o sin configurar: los turnos se guardan solo en la base de datos');
    return { detener: () => {} };
  }

  let corriendo = false;

  const tick = async () => {
    if (corriendo) return;
    corriendo = true;
    try {
      const r = await sincronizarPendientes(ctx);
      if (r.procesados > 0) log.info({ ...r }, 'sincronizacion con Sheets');
    } catch (e) {
      log.error({ err: e instanceof Error ? e.message : e }, 'fallo el ciclo de sincronizacion con Sheets');
    } finally {
      corriendo = false;
    }
  };

  const intervalo = setInterval(() => void tick(), env.SHEETS_INTERVALO_MS);
  intervalo.unref?.();
  void tick();
  log.info({ cadaMs: env.SHEETS_INTERVALO_MS }, 'worker de Google Sheets iniciado');
  return { detener: () => clearInterval(intervalo) };
}
