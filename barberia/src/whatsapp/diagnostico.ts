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
 *
 * Además revisa las plantillas (recordatorio y reseña): tienen que existir en
 * ESTA cuenta, con el nombre y el idioma configurados y aprobadas. Una
 * plantilla creada en otra cuenta (por ejemplo, la de prueba) o con otro
 * nombre hace que el recordatorio falle recién el día anterior al turno.
 */
import { env, whatsappConfigurado } from '../config/env.js';
import { log } from '../shared/log.js';

const GRAFO = 'https://graph.facebook.com';

export interface PlantillaDeMeta {
  nombre: string;
  estado: string;
  idioma: string;
  categoria: string;
}

export interface ResultadoDiagnostico {
  numero: { ok: true; telefono?: string; nombre?: string; calidad?: string } | { ok: false; error: string };
  suscripcion: { ok: true } | { ok: false; error: string } | { omitida: true };
  plantillas?: { ok: true; lista: PlantillaDeMeta[]; problemas: string[] } | { ok: false; error: string };
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

  const plantillas = env.WHATSAPP_BUSINESS_ACCOUNT_ID ? await revisarPlantillas() : undefined;

  return { numero, suscripcion, ...(plantillas ? { plantillas } : {}) };
}

/** Qué plantillas usa el sistema, según el entorno. */
function plantillasConfiguradas(): Array<{ para: string; variable: string; nombre: string }> {
  return [
    { para: 'recordatorio de 24 h', variable: 'WHATSAPP_PLANTILLA_RECORDATORIO', nombre: process.env.WHATSAPP_PLANTILLA_RECORDATORIO ?? '' },
    { para: 'pedido de reseña', variable: 'WHATSAPP_PLANTILLA_RESENA', nombre: process.env.WHATSAPP_PLANTILLA_RESENA ?? '' },
  ];
}

async function revisarPlantillas(): Promise<NonNullable<ResultadoDiagnostico['plantillas']>> {
  try {
    const r = await llamar('GET', `${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,language,category&limit=100`);
    if (!r.ok) {
      const error = mensajeDeError(r.json);
      log.warn({ err: error }, 'WhatsApp: no se pudieron listar las plantillas');
      return { ok: false, error };
    }
    const lista: PlantillaDeMeta[] = ((r.json.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
      nombre: String(p.name ?? ''),
      estado: String(p.status ?? ''),
      idioma: String(p.language ?? ''),
      categoria: String(p.category ?? ''),
    }));
    log.info({ plantillas: lista.map((p) => `${p.nombre} (${p.idioma}, ${p.estado}, ${p.categoria})`) }, 'WhatsApp: plantillas de la cuenta');

    const idioma = process.env.WHATSAPP_PLANTILLA_IDIOMA ?? 'es_AR';
    const problemas: string[] = [];
    for (const c of plantillasConfiguradas()) {
      if (!c.nombre) {
        problemas.push(`${c.variable} vacía: el ${c.para} sale como texto y falla si pasaron más de 24 h desde el último mensaje del cliente`);
        continue;
      }
      const mismoNombre = lista.filter((p) => p.nombre === c.nombre);
      const exacta = mismoNombre.find((p) => p.idioma === idioma);
      if (mismoNombre.length === 0) problemas.push(`${c.variable}="${c.nombre}" no existe en esta cuenta (${c.para})`);
      else if (!exacta) problemas.push(`${c.variable}="${c.nombre}" existe pero en ${mismoNombre.map((p) => p.idioma).join(', ')}, no en ${idioma} (WHATSAPP_PLANTILLA_IDIOMA)`);
      else if (exacta.estado !== 'APPROVED') problemas.push(`${c.variable}="${c.nombre}" está ${exacta.estado}, todavía no se puede usar`);
    }
    for (const p of problemas) log.warn({ problema: p }, 'WhatsApp: revisá las plantillas');
    if (problemas.length === 0) log.info('WhatsApp: plantillas de recordatorio y reseña listas');
    return { ok: true, lista, problemas };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log.warn({ err: error }, 'WhatsApp: no se pudieron listar las plantillas');
    return { ok: false, error };
  }
}
