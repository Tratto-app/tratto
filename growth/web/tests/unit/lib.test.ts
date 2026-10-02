import { describe, expect, it } from 'vitest';
import { delta, pct, rate, ratio } from '../../src/lib/format';
import { resolvePeriod } from '../../src/lib/period';
import { parseCsv } from '../../src/lib/csv';

describe('formatos', () => {
  it('nunca muestra Infinity ni NaN', () => {
    expect(rate(5, 0)).toBeNull();
    expect(ratio(100, 0)).toBeNull();
    expect(pct(null)).toBe('—');
    expect(pct(12.345)).toBe('12,3%');
  });
  it('compara contra el período anterior', () => {
    expect(delta(110, 100)).toEqual({ text: '+10% vs. período anterior', dir: 'sube' });
    expect(delta(90, 100).dir).toBe('baja');
    expect(delta(5, 0).dir).toBe('sube');
    expect(delta(null, 3).text).toBe('');
  });
});

describe('períodos', () => {
  const now = new Date('2026-10-02T15:00:00Z');
  it('7 días, todo y personalizado', () => {
    const p = resolvePeriod('7d', undefined, now);
    expect(new Date(p.to!).getTime() - new Date(p.from!).getTime()).toBe(7 * 864e5);
    expect(resolvePeriod('all', undefined, now).from).toBeNull();
    const c = resolvePeriod('custom', { from: '2026-09-01', to: '2026-09-30' }, now);
    expect(new Date(c.to!).getTime() - new Date(c.from!).getTime()).toBe(30 * 864e5); // incluye el día "hasta"
  });
});

describe('CSV', () => {
  it('soporta comillas, comas internas y punto y coma', () => {
    expect(parseCsv('nombre,email\n"Pérez, Ana",ana@x.com\n')).toEqual([['nombre', 'email'], ['Pérez, Ana', 'ana@x.com']]);
    expect(parseCsv('nombre;telefono\r\nJuan;+54 9 11\r\n')).toEqual([['nombre', 'telefono'], ['Juan', '+54 9 11']]);
    expect(parseCsv('a\n"dice ""hola"""\n')).toEqual([['a'], ['dice "hola"']]);
  });
});
