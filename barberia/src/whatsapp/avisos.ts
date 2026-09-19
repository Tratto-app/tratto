/** Avisos al barbero por WhatsApp (derivaciones, errores que necesitan a alguien). */
import { env } from '../config/env.js';
import { log } from '../shared/log.js';
import { whatsapp } from './cliente.js';

export async function avisarAlBarbero(texto: string): Promise<void> {
  if (!env.BARBERO_WHATSAPP) {
    log.warn({ aviso: texto.slice(0, 80) }, 'no hay BARBERO_WHATSAPP configurado: el aviso no se envía');
    return;
  }
  try {
    await whatsapp.enviarTexto(env.BARBERO_WHATSAPP, texto);
  } catch (e) {
    log.error({ err: e instanceof Error ? e.message : e }, 'no se pudo avisar al barbero');
  }
}
