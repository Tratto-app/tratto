import { describe, it, expect } from 'vitest';

import { parseCsv, rowsToGroups, toCsvUrl } from '@/lib/prices/sheet';
import { localPriceList, hasPrices } from '@/data/prices';

/**
 * La planilla la edita el salón, así que hay que asumir lo peor: filas vacías,
 * comas dentro de un nombre, tildes, encabezados con otro texto, celdas sin
 * precio. Nada de eso puede romper la página.
 */

describe('parser de CSV', () => {
  it('separa filas y columnas', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('respeta las comas dentro de un campo entrecomillado', () => {
    const rows = parseCsv('Color,"Mechas, claritos y babylights",$ 50.000');
    expect(rows[0]).toEqual(['Color', 'Mechas, claritos y babylights', '$ 50.000']);
  });

  it('interpreta las comillas dobles escapadas', () => {
    const rows = parseCsv('Corte,"Corte ""a navaja""",$ 20.000');
    expect(rows[0]?.[1]).toBe('Corte "a navaja"');
  });

  it('tolera saltos de línea de Windows y filas vacías', () => {
    const rows = parseCsv('a,b\r\n\r\nc,d\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('no pierde la última fila si el archivo no termina en salto', () => {
    expect(parseCsv('a,b\nc,d')).toHaveLength(2);
  });
});

describe('armado de la lista', () => {
  const csv = `Categoria,Servicio,Precio,Nota
Color,Coloración,$ 45.000,
Color,Mechas y claritos,$ 52.000,Según el largo
Corte,Corte,$ 22.000,
Corte,Flequillo,,
`;

  it('agrupa por categoría respetando el orden de la planilla', () => {
    const groups = rowsToGroups(parseCsv(csv));
    expect(groups.map((g) => g.title)).toEqual(['Color', 'Corte']);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('descarta la fila de encabezado', () => {
    const groups = rowsToGroups(parseCsv(csv));
    expect(groups.some((g) => g.title.toLowerCase().includes('categor'))).toBe(false);
  });

  it('una celda de precio vacía significa "sin confirmar", no cero', () => {
    const groups = rowsToGroups(parseCsv(csv));
    const flequillo = groups[1]?.items.find((i) => i.name === 'Flequillo');
    expect(flequillo?.price).toBeNull();
  });

  it('conserva la nota cuando existe y la omite cuando no', () => {
    const groups = rowsToGroups(parseCsv(csv));
    expect(groups[0]?.items[1]?.note).toBe('Según el largo');
    expect(groups[0]?.items[0]?.note).toBeUndefined();
  });

  it('ignora filas sin categoría o sin servicio', () => {
    const groups = rowsToGroups(parseCsv('Color,,$ 10\n,Corte,$ 20\nColor,Baño,$ 30'));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(1);
    expect(groups[0]?.items[0]?.name).toBe('Baño');
  });

  it('acepta una planilla sin fila de encabezado', () => {
    const groups = rowsToGroups(parseCsv('Color,Coloración,$ 45.000'));
    expect(groups[0]?.items[0]?.name).toBe('Coloración');
  });

  it('devuelve una lista vacía si no hay nada usable', () => {
    expect(rowsToGroups(parseCsv('\n\n'))).toEqual([]);
  });
});

describe('normalización de la URL de la planilla', () => {
  it('acepta el link de edición y lo convierte a CSV', () => {
    const url = toCsvUrl('https://docs.google.com/spreadsheets/d/ABC123_xyz/edit#gid=0');
    expect(url).toBe(
      'https://docs.google.com/spreadsheets/d/ABC123_xyz/export?format=csv&gid=0',
    );
  });

  it('conserva el gid de la hoja cuando no es la primera', () => {
    const url = toCsvUrl('https://docs.google.com/spreadsheets/d/ABC/edit#gid=987654');
    expect(url).toContain('gid=987654');
  });

  it('deja pasar un link que ya está publicado como CSV', () => {
    const published =
      'https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=0&single=true&output=csv';
    expect(toCsvUrl(published)).toBe(published);
  });

  it('devuelve null si no es una planilla de Google', () => {
    expect(toCsvUrl('https://example.com/precios')).toBeNull();
    expect(toCsvUrl('   ')).toBeNull();
  });
});

describe('copia local de respaldo', () => {
  it('trae las categorías del salón aunque no tenga importes', () => {
    expect(localPriceList.groups.map((g) => g.title)).toEqual([
      'Color',
      'Corte',
      'Tratamientos',
      'Peinados',
    ]);
    expect(localPriceList.groups.every((g) => g.items.length > 0)).toBe(true);
  });

  it('no inventa importes', () => {
    expect(hasPrices(localPriceList)).toBe(false);
  });

  it('detecta cuando sí hay importes cargados', () => {
    expect(
      hasPrices({
        ...localPriceList,
        groups: [{ title: 'Color', items: [{ name: 'Coloración', price: '$ 45.000' }] }],
      }),
    ).toBe(true);
  });
});
