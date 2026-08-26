import { existsSync } from 'node:fs';
import path from 'node:path';

/** Ruta pública del documento oficial de precios. */
export const PRICE_LIST_PATH = '/precios.pdf';

/**
 * ¿Está publicado el PDF de precios?
 *
 * Se chequea en el servidor durante el render. Si el salón todavía no subió
 * el archivo, la sección de precios ofrece pedirlo por mensaje en lugar de
 * mostrar un link que descarga un 404.
 */
export function priceListAvailable(): boolean {
  try {
    return existsSync(path.join(process.cwd(), 'public', 'precios.pdf'));
  } catch {
    return false;
  }
}
