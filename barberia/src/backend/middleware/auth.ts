/**
 * Autenticacion del panel del barbero.
 *
 * Una sola contraseña (es un negocio de una persona), guardada en variable de
 * entorno, y una cookie de sesion firmada con HMAC. Sin base de usuarios ni
 * JWT de terceros: menos piezas, menos superficie de ataque.
 */
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env, esProduccion } from '../../config/env.js';
import { log } from '../../shared/log.js';

const NOMBRE_COOKIE = 'barberia_sesion';

function secreto(): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (esProduccion) throw new Error('SESSION_SECRET es obligatorio en produccion');
  // En desarrollo se deriva uno estable del resto del entorno, para no obligar
  // a configurar nada antes de la primera prueba.
  return createHash('sha256').update(`dev:${env.DASHBOARD_PASSWORD ?? 'sin-clave'}`).digest('hex');
}

function comparar(a: string, b: string): boolean {
  // Se comparan los digest para que el largo no filtre informacion.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function claveCorrecta(intento: string): boolean {
  if (!env.DASHBOARD_PASSWORD) return false;
  return comparar(intento, env.DASHBOARD_PASSWORD);
}

export function firmarSesion(ahoraMs: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: ahoraMs + env.SESSION_HORAS * 3_600_000 })).toString('base64url');
  const firma = createHmac('sha256', secreto()).update(payload).digest('base64url');
  return `${payload}.${firma}`;
}

export function sesionValida(token: string | undefined, ahoraMs: number): boolean {
  if (!token) return false;
  const [payload, firma] = token.split('.');
  if (!payload || !firma) return false;
  const esperada = createHmac('sha256', secreto()).update(payload).digest('base64url');
  if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number };
    return typeof exp === 'number' && exp > ahoraMs;
  } catch {
    return false;
  }
}

export function leerCookie(req: Request, nombre: string): string | undefined {
  const crudo = req.headers.cookie;
  if (!crudo) return undefined;
  for (const parte of crudo.split(';')) {
    const [k, ...resto] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(resto.join('='));
  }
  return undefined;
}

export function ponerCookieDeSesion(res: Response, token: string): void {
  res.cookie(NOMBRE_COOKIE, token, {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'strict',
    maxAge: env.SESSION_HORAS * 3_600_000,
    path: '/',
  });
}

export function borrarCookieDeSesion(res: Response): void {
  res.clearCookie(NOMBRE_COOKIE, { path: '/' });
}

/** Protege las rutas del panel. */
export function requiereAuth(req: Request, res: Response, next: NextFunction): void {
  if (!env.DASHBOARD_PASSWORD) {
    res.status(503).json({ error: 'panel_sin_configurar', mensaje: 'Falta definir DASHBOARD_PASSWORD' });
    return;
  }
  if (!sesionValida(leerCookie(req, NOMBRE_COOKIE), Date.now())) {
    res.status(401).json({ error: 'no_autenticado' });
    return;
  }
  // Defensa simple contra CSRF: la cookie es SameSite=strict y ademas se exige
  // que las mutaciones lleguen como JSON (un form cross-site no puede mandarlo).
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const tipo = String(req.headers['content-type'] ?? '');
    if (!tipo.includes('application/json')) {
      res.status(415).json({ error: 'content_type_invalido' });
      return;
    }
  }
  next();
}

export function registrarIntentoFallido(ip: string): void {
  log.warn({ ip }, 'intento de login fallido en el panel');
}

export const COOKIE_SESION = NOMBRE_COOKIE;
