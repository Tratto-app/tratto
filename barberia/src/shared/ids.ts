import { randomUUID, randomBytes } from 'node:crypto';

/** Id legible para el barbero: TUR-3F9K2A. Se muestra en Sheets y en el panel. */
export function idTurno(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin I/L/O/0/1 para no confundir
  let out = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) out += alfabeto[bytes[i]! % alfabeto.length];
  return `TUR-${out}`;
}

export function uuid(): string {
  return randomUUID();
}

export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
