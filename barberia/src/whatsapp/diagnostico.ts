/**
 * Diagnóstico de WhatsApp al arrancar.
 *
 * Hay dos cosas que la interfaz de Meta no muestra claro y que, si faltan,
 * hacen que el bot quede mudo sin ningún error visible:
 *
 *  1. Que el token tenga acceso al número. El usuario del sistema tiene que
 *     tener asignada la cuenta de WhatsApp Business donde vive el número; si
 *     el número se agregó después de crear el token, esa cuenta queda afuera.
 *  2. Que la cuenta de WhatsApp Business esté suscripta a la app. El webhook
 *     se configura en la app, pero cada cuenta tiene que suscribirse a ella
 *     para que Meta le mande los mensajes. Si el número se dio de alta desde
 *     el Administrador de WhatsApp y no desde la app, esto no pasa solo.
 *
 * Acá se chequea lo primero y se resuelve lo segundo (la suscripción es
 * idempotente: repetirla no hace nada). Nunca frena el arranque: solo deja el
 * resultado escrito en el log, con la causa y qué hacer.
 */
import { env, whatsappConfigurado } from '../config/env.js';
import { log } from '../shared/log.js';

const GRAFO = 'https://graph.facebook.com';

export interface ResultadoDiagnostico {
  numero: { ok: true; telefono?: string; nombre?: string; calidad?: string } | { ok: false; error: string };
  suscripcion: { ok: true } | { ok: false; error: string } | { omitida: true };
}

async function llamar(metodo: 'GET' | 'POST', ruta: string): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const r = await fetch(`${GRAFO}/${env.WHATSAPP_GRAPH_VERSION}/${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, json };
}

function mensajeDeError(json: Record<string, unknown>): string {
  const e = json.error as { message?: string; code?: number } | undefined;
  return e ? `${e.message ?? 'error sin mensaje'} (código ${e.code ?? '?'})` : 'respuesta inesperada de Meta';
}

export async function diagnosticarWhatsApp(): Promise<ResultadoDiagnostico | null> {
  if (!whatsappConfigurado) return null;

  let numero: ResultadoDiagnostico['numero'];
  try {
    const r = await llamar(
      'GET',
      `${env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`,
    );
    if (r.ok) {
      numero = {
        ok: true,
        telefono: r.json.display_phone_number as string | undefined,
        nombre: r.json.verified_name as string | undefined,
        calidad: r.json.quality_rating as string | undefined,
      };
      log.info({ telefono: numero.telefono, nombre: numero.nombre, calidad: numero.calidad }, 'WhatsApp: el token llega al número');
    } else {
      numero = { ok: false, error: mensajeDeError(r.json) };
      log.error(
        { err: numero.error },
        'WhatsApp: el token NO tiene acceso al número. Asigná la cuenta de WhatsApp Business del número al usuario del sistema (Configuración de la empresa → Usuarios del sistema → Asignar activos)',
      );
    }
  } catch (e) {
    numero = { ok: false, error: e instanceof Error ? e.message : String(e) };
    log.error({ err: numero.error }, 'WhatsApp: no se pudo consultar el número');
  }

  let suscripcion: ResultadoDiagnostico['suscripcion'];
  if (!env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    suscripcion = { omitida: true };
    log.warn('WhatsApp: falta WHATSAPP_BUSINESS_ACCOUNT_ID, no se puede confirmar que la cuenta esté suscripta a la app');
  } else {
    try {
      const r = await llamar('POST', `${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/subscribed_apps`);
      if (r.ok) {
        suscripcion = { ok: true };
        log.info({ cuenta: env.WHATSAPP_BUSINESS_ACCOUNT_ID }, 'WhatsApp: cuenta suscripta a la app, los mensajes van a llegar al webhook');
      } else {
        suscripcion = { ok: false, error: mensajeDeError(r.json) };
        log.error({ cuenta: env.WHATSAPP_BUSINESS_ACCOUNT_ID, err: suscripcion.error }, 'WhatsApp: no se pudo suscribir la cuenta a la app');
      }
    } catch (e) {
      suscripcion = { ok: false, error: e instanceof Error ? e.message : String(e) };
      log.error({ err: suscripcion.error }, 'WhatsApp: no se pudo suscribir la cuenta a la app');
    }
  }

  return { numero, suscripcion };
}
