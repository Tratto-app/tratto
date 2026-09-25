/**
 * Verificacion y parseo del webhook de WhatsApp.
 *
 * Dos controles de seguridad, los dos obligatorios en produccion:
 *   1. GET de verificacion: Meta manda `hub.verify_token`, que tiene que
 *      coincidir con el nuestro.
 *   2. POST de mensajes: cada request viene firmado con HMAC-SHA256 usando el
 *      app secret. Sin firma valida, se descarta.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, esProduccion } from '../config/env.js';
import { log } from '../shared/log.js';
import { sanearMensaje } from '../shared/texto.js';
import type { MensajeWhatsApp, PayloadWebhook } from './tipos.js';

export interface VerificacionWebhook {
  ok: boolean;
  challenge?: string;
  motivo?: string;
}

export function verificarSuscripcion(query: Record<string, unknown>): VerificacionWebhook {
  const modo = String(query['hub.mode'] ?? '');
  const token = String(query['hub.verify_token'] ?? '');
  const challenge = String(query['hub.challenge'] ?? '');
  if (modo !== 'subscribe') return { ok: false, motivo: 'modo invalido' };
  if (!env.WHATSAPP_VERIFY_TOKEN) return { ok: false, motivo: 'WHATSAPP_VERIFY_TOKEN sin configurar' };
  if (!comparacionSegura(token, env.WHATSAPP_VERIFY_TOKEN)) return { ok: false, motivo: 'token de verificacion incorrecto' };
  return { ok: true, challenge };
}

function comparacionSegura(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida la firma `X-Hub-Signature-256` sobre el cuerpo crudo.
 *
 * En desarrollo, si no hay app secret configurado, se deja pasar con un aviso
 * para poder probar con ngrok. En produccion es obligatorio.
 */
export function firmaValida(cuerpoCrudo: Buffer, firmaHeader: string | undefined): boolean {
  if (!env.WHATSAPP_APP_SECRET) {
    if (esProduccion) {
      log.error('WHATSAPP_APP_SECRET sin configurar: se rechaza el webhook');
      return false;
    }
    log.warn('WHATSAPP_APP_SECRET sin configurar: la firma del webhook NO se está validando (solo desarrollo)');
    return true;
  }
  if (!firmaHeader || !firmaHeader.startsWith('sha256=')) return false;
  const esperado = createHmac('sha256', env.WHATSAPP_APP_SECRET).update(cuerpoCrudo).digest('hex');
  return comparacionSegura(firmaHeader.slice('sha256='.length), esperado);
}

export interface MensajeNormalizado {
  id: string;
  telefono: string;
  texto: string;
  /** Texto del botón u opción de lista que tocó (el `texto` trae su id). */
  titulo?: string;
  nombrePerfil: string;
  tipo: string;
  /** true si el cliente mandó audio, foto, ubicación, etc. */
  noEsTexto: boolean;
}

/** Convierte el payload de Meta en mensajes simples. Ignora todo lo demas. */
export function extraerMensajes(payload: PayloadWebhook): MensajeNormalizado[] {
  const salida: MensajeNormalizado[] = [];
  for (const entry of payload.entry ?? []) {
    for (const cambio of entry.changes ?? []) {
      const valor = cambio.value;
      if (!valor?.messages) continue;
      const nombrePerfil = valor.contacts?.[0]?.profile?.name ?? '';
      for (const m of valor.messages) {
        const normalizado = normalizarMensaje(m, nombrePerfil);
        if (normalizado) salida.push(normalizado);
      }
    }
  }
  return salida;
}

function normalizarMensaje(m: MensajeWhatsApp, nombrePerfil: string): MensajeNormalizado | null {
  if (!m.id || !m.from) return null;
  const base = { id: m.id, telefono: m.from, nombrePerfil, tipo: m.type };

  switch (m.type) {
    case 'text':
      return { ...base, texto: sanearMensaje(m.text?.body ?? ''), noEsTexto: false };
    case 'interactive': {
      // Respuesta a un botón o a una lista: se usa el id de la opción, que es
      // lo que entiende el flujo de menú.
      const id = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? '';
      const titulo = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '';
      return { ...base, texto: sanearMensaje(id || titulo), titulo: sanearMensaje(titulo) || undefined, noEsTexto: false };
    }
    case 'button':
      // Botón de respuesta rápida de una plantilla (recordatorio, reseña).
      return {
        ...base,
        texto: sanearMensaje(m.button?.payload ?? m.button?.text ?? ''),
        titulo: sanearMensaje(m.button?.text ?? '') || undefined,
        noEsTexto: false,
      };
    default:
      return { ...base, texto: '', noEsTexto: true };
  }
}

/** Estados de entrega. Solo se loguean los fallidos. */
export function extraerFallosDeEntrega(payload: PayloadWebhook): Array<{ id: string; destinatario: string; error: string }> {
  const salida: Array<{ id: string; destinatario: string; error: string }> = [];
  for (const entry of payload.entry ?? []) {
    for (const cambio of entry.changes ?? []) {
      for (const st of cambio.value?.statuses ?? []) {
        if (st.status === 'failed') {
          salida.push({
            id: st.id,
            destinatario: st.recipient_id,
            error: st.errors?.map((e) => `${e.code} ${e.title}`).join('; ') ?? 'sin detalle',
          });
        }
      }
    }
  }
  return salida;
}
