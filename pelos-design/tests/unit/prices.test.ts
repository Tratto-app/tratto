import { describe, it, expect } from 'vitest';

import { parseCsv, rowsToPriceList, toCsvUrl } from '@/lib/prices/sheet';
import { localPriceList, hasPrices, priceFor } from '@/data/prices';

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
  const csv = `Categoria,Servicio,Corto,Mediano,Largo,Extra largo,Nota
Corte y peinado,Corte,$40.000,$40.000,$40.000,$40.000,
Corte y peinado,Brushing,$24.000,$26.000,$28.000,$35.000,Incluye lavado
Color,Balayage,,$200.000,$250.000,$300.000,
`;

  it('lee los largos desde el encabezado, en orden', () => {
    const parsed = rowsToPriceList(parseCsv(csv));
    expect(parsed?.tiers).toEqual(['Corto', 'Mediano', 'Largo', 'Extra largo']);
  });

  it('agrupa por categoría respetando el orden de la planilla', () => {
    const parsed = rowsToPriceList(parseCsv(csv));
    expect(parsed?.groups.map((g) => g.title)).toEqual(['Corte y peinado', 'Color']);
    expect(parsed?.groups[0]?.items).toHaveLength(2);
  });

  it('asocia cada importe con su largo', () => {
    const parsed = rowsToPriceList(parseCsv(csv));
    const brushing = parsed?.groups[0]?.items[1];
    expect(brushing?.prices).toEqual(['$24.000', '$26.000', '$28.000', '$35.000']);
  });

  it('una celda de precio vacía significa "a consultar", no cero', () => {
    const parsed = rowsToPriceList(parseCsv(csv));
    const balayage = parsed?.groups[1]?.items[0];
    expect(balayage?.prices[0]).toBeNull();
    expect(balayage?.prices[1]).toBe('$200.000');
  });

  it('conserva la nota cuando existe y la omite cuando no', () => {
    const parsed = rowsToPriceList(parseCsv(csv));
    expect(parsed?.groups[0]?.items[1]?.note).toBe('Incluye lavado');
    expect(parsed?.groups[0]?.items[0]?.note).toBeUndefined();
  });

  it('acepta encabezados con tilde y en cualquier capitalización', () => {
    const parsed = rowsToPriceList(
      parseCsv('CATEGORÍA,Servicio,Corto\nColor,Balayage,$100'),
    );
    expect(parsed?.tiers).toEqual(['Corto']);
    expect(parsed?.groups[0]?.items[0]?.name).toBe('Balayage');
  });

  it('el salón puede renombrar o agregar largos sin tocar código', () => {
    const parsed = rowsToPriceList(
      parseCsv('Categoria,Servicio,Muy corto,Corto,XL\nColor,Color,$10,$20,$30'),
    );
    expect(parsed?.tiers).toEqual(['Muy corto', 'Corto', 'XL']);
    expect(parsed?.groups[0]?.items[0]?.prices).toEqual(['$10', '$20', '$30']);
  });

  it('ignora filas sin categoría o sin servicio', () => {
    const parsed = rowsToPriceList(
      parseCsv('Categoria,Servicio,Corto\nColor,,$10\n,Corte,$20\nColor,Baño,$30'),
    );
    expect(parsed?.groups).toHaveLength(1);
    expect(parsed?.groups[0]?.items).toHaveLength(1);
    expect(parsed?.groups[0]?.items[0]?.name).toBe('Baño');
  });

  it('devuelve null si falta una columna obligatoria', () => {
    expect(rowsToPriceList(parseCsv('Servicio,Corto\nCorte,$10'))).toBeNull();
    expect(rowsToPriceList(parseCsv('Categoria,Corto\nColor,$10'))).toBeNull();
  });

  it('devuelve null si no hay ninguna columna de largo', () => {
    expect(rowsToPriceList(parseCsv('Categoria,Servicio,Nota\nColor,Corte,algo'))).toBeNull();
  });

  it('devuelve null si no hay nada usable', () => {
    expect(rowsToPriceList(parseCsv('\n\n'))).toBeNull();
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

describe('copia local: la lista oficial del salón', () => {
  it('tiene los cuatro largos de la lista impresa', () => {
    expect(localPriceList.tiers).toEqual(['Corto', 'Mediano', 'Largo', 'Extra largo']);
  });

  it('tiene los tres bloques de la lista impresa', () => {
    expect(localPriceList.groups.map((g) => g.title)).toEqual([
      'Corte y peinado',
      'Tratamientos',
      'Color',
    ]);
  });

  it('cada servicio tiene un importe por cada largo', () => {
    for (const group of localPriceList.groups) {
      for (const item of group.items) {
        expect(item.prices, `${item.name} no cubre los cuatro largos`).toHaveLength(
          localPriceList.tiers.length,
        );
      }
    }
  });

  it('los importes están cargados', () => {
    expect(hasPrices(localPriceList)).toBe(true);
  });

  it('todos los importes tienen formato de precio argentino', () => {
    for (const group of localPriceList.groups) {
      for (const item of group.items) {
        for (const price of item.prices) {
          if (price === null) continue;
          expect(price, `${item.name}: "${price}"`).toMatch(/^\$\d{1,3}(\.\d{3})*$/);
        }
      }
    }
  });

  it('respeta los datos de la lista original, incluidos los huecos', () => {
    const color = localPriceList.groups.find((g) => g.title === 'Color');
    const balayage = color?.items.find((i) => i.name === 'Balayage');
    // En la lista original, balayage en cabello corto figura sin precio.
    expect(priceFor(balayage!, 0)).toBeNull();
    expect(priceFor(balayage!, 3)).toBe('$300.000');
  });

  it('el corte vale igual en todos los largos, como en la lista original', () => {
    const corte = localPriceList.groups[0]?.items.find((i) => i.name === 'Corte');
    expect(new Set(corte?.prices)).toEqual(new Set(['$40.000']));
  });

  it('detecta cuando no hay ningún importe cargado', () => {
    expect(
      hasPrices({
        ...localPriceList,
        groups: [{ title: 'Color', items: [{ name: 'Color', prices: [null, null] }] }],
      }),
    ).toBe(false);
  });
});
