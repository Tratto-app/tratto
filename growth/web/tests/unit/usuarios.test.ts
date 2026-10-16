import { describe, expect, it } from 'vitest';
import { cuando, esNuevo, porRubro, porZona, reales, repetidos, SIN_RUBRO, SIN_ZONA, type UsuarioApp } from '../../src/lib/usuarios';

const u = (p: Partial<UsuarioApp>): UsuarioApp => ({
  id: Math.random().toString(36), nombre: 'X', email: null, telefono: null, rol: 'ofrece', alta: '2026-10-01T12:00:00Z',
  ultimo_ingreso: null, rubros: [], zonas: [], servicios: 0, pedidos: 0, demo: false, equipo: false, ...p,
});

describe('usuarios', () => {
  it('deja afuera las cuentas demo y las del equipo', () => {
    expect(reales([u({}), u({ demo: true }), u({ equipo: true })])).toHaveLength(1);
  });

  it('cuenta por zona, con quien tiene dos zonas en las dos y "sin zona" al final', () => {
    const z = porZona([u({ zonas: ['CABA', 'GBA Norte'] }), u({ zonas: ['CABA'], rol: 'cliente' }), u({})]);
    expect(z.map(c => [c.nombre, c.n, c.ofrece, c.cliente])).toEqual([['CABA', 2, 1, 1], ['GBA Norte', 1, 1, 0], [SIN_ZONA, 1, 1, 0]]);
  });

  it('cuenta rubros solo de quienes ofrecen servicios', () => {
    const r = porRubro([u({ rubros: ['Pintura'] }), u({ rubros: ['Pintura'] }), u({ rol: 'cliente', rubros: ['Pintura'] }), u({})]);
    expect(r.map(c => [c.nombre, c.n])).toEqual([['Pintura', 2], [SIN_RUBRO, 1]]);
  });

  it('marca nuevos y repetidos', () => {
    const ahora = new Date('2026-10-15T15:00:00Z');
    expect(esNuevo(u({ alta: '2026-10-13T12:00:00Z' }), ahora)).toBe(true);
    expect(esNuevo(u({ alta: '2026-10-01T12:00:00Z' }), ahora)).toBe(false);
    expect([...repetidos([u({ nombre: 'Antonio Duré' }), u({ nombre: 'antonio dure ' }), u({ nombre: 'Otro' })])]).toEqual(['antonio dure']);
  });

  it('dice cuándo en palabras, en hora de Argentina', () => {
    const ahora = new Date('2026-10-15T15:00:00Z');
    expect(cuando('2026-10-15T13:00:00Z', ahora)).toBe('Hoy');
    expect(cuando('2026-10-14T20:00:00Z', ahora)).toBe('Ayer');
    expect(cuando('2026-10-12T20:00:00Z', ahora)).toBe('Hace 3 días');
    expect(cuando(null, ahora)).toBe('Nunca');
  });
});
