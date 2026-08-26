import 'server-only';

import { localPriceList, type PriceGroup, type PriceList } from '@/data/prices';

/**
 * Lee la lista de precios desde una planilla de Google publicada.
 *
 * El salón edita la planilla como cualquier otra y la web se actualiza sola.
 * No hace falta cuenta de servicio ni API key: se usa la URL de publicación en
 * CSV, que Google sirve como archivo estático.
 *
 * La planilla tiene tres columnas, con encabezado en la primera fila:
 *
 *   Categoria | Servicio            | Precio
 *   Color     | Coloración          | $ 45.000
 *   Color     | Mechas y claritos   | $ 52.000
 *   Corte     | Corte               | $ 22.000
 *
 * Una cuarta columna opcional, "Nota", se imprime debajo del servicio.
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

/** Convierte las filas de la planilla en grupos de precios. */
export function rowsToGroups(rows: string[][]): PriceGroup[] {
  const groups = new Map<string, PriceGroup>();

  // Se saltea el encabezado si la primera celda dice algo parecido a "categoría".
  const first = rows[0]?.[0]?.trim().toLowerCase() ?? '';
  const body = /categor/.test(first) ? rows.slice(1) : rows;

  for (const row of body) {
    const category = row[0]?.trim();
    const name = row[1]?.trim();
    if (!category || !name) continue;

    const rawPrice = row[2]?.trim() ?? '';
    const note = row[3]?.trim();

    let group = groups.get(category);
    if (!group) {
      group = { title: category, items: [] };
      groups.set(category, group);
    }

    group.items.push({
      name,
      // Una celda vacía significa "todavía sin confirmar", no cero.
      price: rawPrice.length > 0 ? rawPrice : null,
      ...(note ? { note } : {}),
    });
  }

  return [...groups.values()].filter((group) => group.items.length > 0);
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

    const groups = rowsToGroups(parseCsv(await response.text()));
    if (groups.length === 0) {
      console.warn('[precios] la planilla no tiene filas usables');
      return localPriceList;
    }

    return {
      groups,
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
