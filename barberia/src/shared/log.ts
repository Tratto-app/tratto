import pino from 'pino';
import { env, esProduccion, esTest } from '../config/env.js';

/**
 * Logger unico del sistema. Nunca loguea tokens ni el cuerpo completo de un
 * mensaje de cliente: los telefonos se enmascaran y los secretos se redactan.
 */
export const log = pino({
  level: esTest ? 'silent' : env.LOG_LEVEL,
  base: undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'token',
      'access_token',
      'apiKey',
      'password',
      '*.access_token',
      '*.refresh_token',
    ],
    censor: '[redactado]',
  },
  transport: !esProduccion && !esTest ? { target: 'pino/file', options: { destination: 1 } } : undefined,
});

/** +5491122223333 -> +54911****3333 (para logs y para el panel). */
export function enmascararTelefono(tel: string): string {
  const limpio = tel.replace(/[^\d+]/g, '');
  if (limpio.length <= 8) return '***';
  return `${limpio.slice(0, 6)}****${limpio.slice(-4)}`;
}

export function logConTelefono(telefono: string) {
  return log.child({ cliente: enmascararTelefono(telefono) });
}
