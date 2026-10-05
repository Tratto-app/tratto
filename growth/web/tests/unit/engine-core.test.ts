import { describe, expect, it } from 'vitest';
import {
  buildRedirectUrl, classifyReply, detectDevice, detectObjection, matchCond, mockAnalyze, mockMessage, nextPosition, renderTemplate, waitMs,
  type Step,
} from '../../../supabase/functions/_shared/engine-core';

const OBJ = [
  { id: '1', label: 'Precio', patterns: ['cuanto sale', 'precio'], response: 'Es gratis para pedir.' },
  { id: '2', label: 'Seguridad', patterns: ['mis datos', 'segura'], response: 'El chat es privado.' },
];

describe('renderTemplate', () => {
  it('reemplaza variables y deja vacío lo que falta', () => {
    expect(renderTemplate('Hola {{first_name}}! {{link}}', { first_name: 'Ana' })).toBe('Hola Ana!');
    expect(renderTemplate('Hola {{ first_name }} , ¿todo bien?', { first_name: 'Ana' })).toBe('Hola Ana, ¿todo bien?');
    expect(renderTemplate('{{x}}', { x: null })).toBe('');
  });
});

describe('detectDevice', () => {
  it('reconoce Android, iPhone y PC', () => {
    expect(detectDevice('Mozilla/5.0 (Linux; Android 14)')).toBe('android');
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('ios');
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0)')).toBe('desktop');
    expect(detectDevice('')).toBe('other');
  });
});

describe('buildRedirectUrl', () => {
  const base = { token: 'abc123', slug: 'demo', play_store_url: 'https://play.google.com/store/apps/details?id=x', app_store_url: 'https://apps.apple.com/app/id1', website: 'https://example.com' };
  it('Play recibe referrer con UTM y gid', () => {
    const u = new URL(buildRedirectUrl({ ...base, target: 'play', utm_source: 'instagram' })!);
    const ref = new URLSearchParams(u.searchParams.get('referrer')!);
    expect(u.hostname).toBe('play.google.com');
    expect(ref.get('gid')).toBe('abc123');
    expect(ref.get('utm_source')).toBe('instagram');
    expect(ref.get('utm_campaign')).toBe('demo');
  });
  it('App Store recibe ct', () => {
    expect(buildRedirectUrl({ ...base, target: 'appstore', utm_campaign: 'Lanzamiento' })).toContain('ct=Lanzamiento');
  });
  it('si falta la tienda cae a la web, y nunca redirige a http inseguro', () => {
    expect(buildRedirectUrl({ ...base, target: 'play', play_store_url: null })).toContain('https://example.com/');
    expect(buildRedirectUrl({ token: 't', slug: 's', target: 'custom', custom_url: 'http://malo.com', website: null })).toBeNull();
  });
});

describe('matchCond (mismo lenguaje que growth_match en SQL)', () => {
  const p = { status: 'replied', score: 72, tags: ['vip'], city: 'CABA', email: null, replied_at: new Date(Date.now() - 2 * 864e5).toISOString() };
  it('operadores básicos', () => {
    expect(matchCond(p, { field: 'status', op: 'eq', value: 'REPLIED' })).toBe(true);
    expect(matchCond(p, { field: 'score', op: 'gte', value: 72 })).toBe(true);
    expect(matchCond(p, { field: 'score', op: 'lt', value: 50 })).toBe(false);
    expect(matchCond(p, { field: 'tags', op: 'has_tag', value: 'vip' })).toBe(true);
    expect(matchCond(p, { field: 'email', op: 'is_null' })).toBe(true);
    expect(matchCond(p, { field: 'status', op: 'in', value: ['new', 'replied'] })).toBe(true);
    expect(matchCond(p, { field: 'city', op: 'contains', value: 'ab' })).toBe(true);
  });
  it('fechas relativas', () => {
    expect(matchCond(p, { field: 'replied_at', op: 'within_days', value: 3 })).toBe(true);
    expect(matchCond(p, { field: 'replied_at', op: 'older_than_days', value: 1 })).toBe(true);
    expect(matchCond(p, { field: 'replied_at', op: 'older_than_days', value: 5 })).toBe(false);
  });
  it('grupos all / any y regla vacía', () => {
    expect(matchCond(p, { all: [{ field: 'score', op: 'gt', value: 70 }, { field: 'status', op: 'eq', value: 'new' }] })).toBe(false);
    expect(matchCond(p, { any: [{ field: 'score', op: 'gt', value: 70 }, { field: 'status', op: 'eq', value: 'new' }] })).toBe(true);
    expect(matchCond(p, {})).toBe(true);
    expect(matchCond(p, { field: 'score', op: 'inventado', value: 1 })).toBe(false);
  });
});

describe('nextPosition y waitMs', () => {
  const steps: Step[] = [0, 1, 2, 5].map((position) => ({ position, type: 'x', config: {}, on_true: null, on_false: null }));
  it('sigue al próximo paso, respeta ramas y -1 termina', () => {
    expect(nextPosition(steps, steps[0])).toBe(1);
    expect(nextPosition(steps, steps[2])).toBe(5);
    expect(nextPosition(steps, steps[3])).toBe(-1);
    expect(nextPosition(steps, { ...steps[0], on_true: 5, on_false: -1 }, true)).toBe(5);
    expect(nextPosition(steps, { ...steps[0], on_true: 5, on_false: -1 }, false)).toBe(-1);
    expect(nextPosition(steps, { ...steps[0], on_true: 99 }, true)).toBe(-1);
  });
  it('limita las esperas entre 1 minuto y 90 días', () => {
    expect(waitMs({ minutes: 0 })).toBe(24 * 3600e3);
    expect(waitMs({ minutes: 0.1 })).toBe(60e3);
    expect(waitMs({ days: 365 })).toBe(90 * 864e5);
    expect(waitMs({ days: 1, hours: 2 })).toBe(26 * 3600e3);
  });
});

describe('lectura de respuestas', () => {
  it('detecta la objeción más específica sin importar tildes', () => {
    expect(detectObjection('¿Cuánto sale?', OBJ)?.label).toBe('Precio');
    expect(detectObjection('no quiero dar mis datos', OBJ)?.label).toBe('Seguridad');
    expect(detectObjection('hola', OBJ)).toBeNull();
  });
  it('clasifica interés y opt-out', () => {
    expect(classifyReply('Me interesa, pasame el link').intent).toBe('high');
    expect(classifyReply('¿Cómo funciona?').intent).toBe('medium');
    expect(classifyReply('No me interesa, gracias').intent).toBe('none');
    expect(classifyReply('Baja por favor').optOut).toBe(true);
    expect(classifyReply('Dale, pasame el link pero cuanto sale?', OBJ).intent).toBe('medium');
  });
});

describe('IA de respaldo (sin proveedor)', () => {
  it('score acotado y explicable', () => {
    const a = mockAnalyze({ email: 'a@b.c', replied_at: 'x', interest: 'high', status: 'interested' });
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.next_action).toBe('Enviar el link de descarga');
    expect(mockAnalyze({ status: 'not_interested', interest: 'high' }).score).toBeLessThanOrEqual(10);
  });
  it('los mensajes por email y WhatsApp incluyen cómo darse de baja', () => {
    expect(mockMessage({ first_name: 'Ana' }, { app_name: 'X' }, 'email')).toMatch(/baja/);
    expect(mockMessage({ first_name: 'Ana' }, { app_name: 'X' }, 'whatsapp')).toMatch(/BAJA/);
    expect(mockMessage({}, { app_name: 'X' }, 'instagram', 'https://l')).toContain('https://l');
  });
});
