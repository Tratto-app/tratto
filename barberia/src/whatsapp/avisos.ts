/** Avisos al barbero por WhatsApp (derivaciones, errores que necesitan a alguien). */
import { env } from '../config/env.js';
import { log } from '../shared/log.js';
import { whatsapp } from './cliente.js';

/**
 * Le manda un mensaje al barbero. Devuelve si se pudo entregar.
 *
 * Ojo con la ventana de 24 h de WhatsApp: si el barbero no le escribió al bot
 * en el último día, Meta rechaza el texto libre (error 131047). Por eso los
 * avisos importantes nunca dependen solo de esto: el resumen semanal queda
 * guardado en la planilla y en el panel aunque el mensaje no salga.
 */
export async function avisarAlBarbero(texto: string): Promise<boolean> {
  if (!env.BARBERO_WHATSAPP) {
    log.warn({ aviso: texto.slice(0, 80) }, 'no hay BARBERO_WHATSAPP configurado: el aviso no se envía');
    return false;
  }
  try {
    await whatsapp.enviarTexto(env.BARBERO_WHATSAPP, texto);
    return true;
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    if (/131047|re-?engagement/i.test(mensaje)) {
      log.warn('no se pudo avisar al barbero: pasaron más de 24 h desde su último mensaje al bot');
    } else {
      log.error({ err: mensaje }, 'no se pudo avisar al barbero');
    }
    return false;
  }
}
