/**
 * Autenticacion con Google usando solo `fetch` y `node:crypto`.
 *
 * Soporta las dos formas razonables para una barberia:
 *  1. OAuth con refresh token — la planilla vive en el Drive del barbero.
 *  2. Cuenta de servicio — la planilla se comparte con el mail de la cuenta.
 *
 * Se eligio no usar el paquete `googleapis` (decenas de MB) porque solo hacen
 * falta cuatro endpoints REST.
 */
import { createSign } from 'node:crypto';
import { env } from '../config/env.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

let cache: { token: string; venceMs: number } | null = null;

interface RespuestaToken {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

async function tokenPorRefreshToken(): Promise<{ token: string; venceMs: number }> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    refresh_token: env.GOOGLE_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await r.json()) as RespuestaToken;
  if (!r.ok || !json.access_token) {
    throw new Error(`Google rechazo el refresh token: ${json.error ?? r.status} ${json.error_description ?? ''}`.trim());
  }
  return { token: json.access_token, venceMs: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000 };
}

async function tokenPorCuentaDeServicio(): Promise<{ token: string; venceMs: number }> {
  const cred = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON!) as { client_email: string; private_key: string };
  if (!cred.client_email || !cred.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no tiene client_email o private_key');
  }
  const ahora = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: cred.client_email, scope: SCOPE, aud: TOKEN_URL, exp: ahora + 3600, iat: ahora }),
  );
  const firma = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(cred.private_key.replace(/\\n/g, '\n'))
    .toString('base64url');

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${header}.${claims}.${firma}`,
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await r.json()) as RespuestaToken;
  if (!r.ok || !json.access_token) {
    throw new Error(`Google rechazo la cuenta de servicio: ${json.error ?? r.status} ${json.error_description ?? ''}`.trim());
  }
  return { token: json.access_token, venceMs: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000 };
}

/** Devuelve un access token valido, reusando el anterior mientras no venza. */
export async function tokenDeAcceso(): Promise<string> {
  if (cache && cache.venceMs > Date.now()) return cache.token;
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN) {
    cache = await tokenPorRefreshToken();
  } else if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    cache = await tokenPorCuentaDeServicio();
  } else {
    throw new Error('Falta configurar Google: OAuth (CLIENT_ID/SECRET/REFRESH_TOKEN) o GOOGLE_SERVICE_ACCOUNT_JSON');
  }
  return cache.token;
}

export function limpiarCacheDeToken(): void {
  cache = null;
}
