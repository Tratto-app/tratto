import 'server-only';

import { localPriceList, type PriceGroup, type PriceList } from '@/data/prices';

/**
 * Lee la lista de precios desde una planilla de Google publicada.
 *
 * El salón edita la planilla como cualquier otra y la web se actualiza sola.
 * No hace falta cuenta de servicio ni API key: se usa la URL de publicación en
 * CSV, que Google sirve como archivo estático.
 *
 * La planilla tiene UNA FILA POR SERVICIO y UNA COLUMNA POR LARGO de cabello,
 * igual que la lista impresa del salón. Encabezado en la primera fila:
 *
 *   Categoria       | Servicio | Corto   | Mediano | Largo   | Extra largo | Nota
 *   Corte y peinado | Corte    | $40.000 | $40.000 | $40.000 | $40.000     |
 *   Color           | Balayage |         | $200.000| $250.000| $300.000    |
 *
 * Así, cambiar el precio de un servicio es tocar una sola fila.
 *
 * Los largos se leen del encabezado: cualquier columna que no sea "Categoria",
 * "Servicio" ni "Nota" se toma como un largo, en el orden en que aparezca. El
 * salón puede renombrarlos o agregar uno sin que haya que tocar código.
 *
 * Una celda de precio vacía significa "a consultar", no cero.
 *
 * Ante cualquier problema —planilla sin configurar, sin conexión, formato
 * inesperado— devuelve la copia local. La página nunca queda sin precios.
 */

const REVALIDATE_SECONDS = 60 * 10;

/**
 * Parser de CSV que respeta comillas dobles y comas dentro de un campo.
 * Se escribe a mano en lugar de sumar una dependencia: son treinta líneas y
 * el formato que emite Google es acotado y estable.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // Dos comillas seguidas dentro de un campo entrecomillado son una comilla.
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  // Última fila, si el archivo no termina en salto de línea.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Columnas que NO son un largo de cabello. */
const RESERVED_HEADERS = ['categoria', 'categoría', 'servicio', 'nota', 'notas'];

function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface SheetShape {
  tiers: string[];
  groups: PriceGroup[];
}

/**
 * Convierte las filas de la planilla en largos + grupos de precios.
 * Devuelve null si la planilla no tiene un encabezado utilizable.
 */
export function rowsToPriceList(rows: string[][]): SheetShape | null {
  const header = rows[0];
  if (!header) return null;

  const headerNames = header.map((cell) => normalise(cell));
  const categoryIndex = headerNames.findIndex((name) => name.startsWith('categor'));
  const serviceIndex = headerNames.findIndex((name) => name === 'servicio');
  if (categoryIndex === -1 || serviceIndex === -1) return null;

  const noteIndex = headerNames.findIndex((name) => name.startsWith('nota'));

  // Todo lo que no sea columna reservada es un largo de cabello.
  const tierColumns: { index: number; label: string }[] = [];
  header.forEach((cell, index) => {
    const label = cell.trim();
    if (!label) return;
    if (RESERVED_HEADERS.includes(normalise(label))) return;
    tierColumns.push({ index, label });
  });

  if (tierColumns.length === 0) return null;

  const groups = new Map<string, PriceGroup>();

  for (const row of rows.slice(1)) {
    const category = row[categoryIndex]?.trim();
    const name = row[serviceIndex]?.trim();
    if (!category || !name) continue;

    let group = groups.get(category);
    if (!group) {
      group = { title: category, items: [] };
      groups.set(category, group);
    }

    const note = noteIndex >= 0 ? row[noteIndex]?.trim() : undefined;

    group.items.push({
      name,
      prices: tierColumns.map(({ index }) => {
        const cell = row[index]?.trim() ?? '';
        return cell.length > 0 ? cell : null;
      }),
      ...(note ? { note } : {}),
    });
  }

  const usable = [...groups.values()].filter((group) => group.items.length > 0);
  if (usable.length === 0) return null;

  return { tiers: tierColumns.map((column) => column.label), groups: usable };
}

/**
 * Normaliza la URL que pegue el salón.
 * Acepta tanto el link de publicación en CSV como el link normal de la
 * planilla, del que se puede derivar la exportación.
 */
export function toCsvUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  if (url.includes('output=csv') || url.endsWith('.csv')) return url;

  const match = url.match(/\/spreadsheets\/d\/(?:e\/)?([A-Za-z0-9_-]+)/);
  if (!match?.[1]) return null;

  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0';
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

export async function fetchPriceList(): Promise<PriceList> {
  const configured = process.env.PRICES_SHEET_URL?.trim();
  if (!configured) return localPriceList;

  const csvUrl = toCsvUrl(configured);
  if (!csvUrl) {
    console.warn('[precios] PRICES_SHEET_URL no parece una planilla de Google');
    return localPriceList;
  }

  try {
    const response = await fetch(csvUrl, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ['precios'] },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      console.warn(`[precios] la planilla respondió ${response.status}`);
      return localPriceList;
    }

    const parsed = rowsToPriceList(parseCsv(await response.text()));
    if (!parsed) {
      console.warn('[precios] la planilla no tiene un encabezado o filas usables');
      return localPriceList;
    }

    return {
      tiers: parsed.tiers,
      groups: parsed.groups,
      validFrom: process.env.PRICES_VALID_FROM?.trim() || null,
      source: 'sheet',
    };
  } catch (error) {
    console.warn('[precios] no se pudo leer la planilla:', error);
    return localPriceList;
  }
}

/** Punto de entrada único. Nunca lanza. */
export async function getPriceList(): Promise<PriceList> {
  try {
    return await fetchPriceList();
  } catch {
    return localPriceList;
  }
}
