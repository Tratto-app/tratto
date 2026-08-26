/**
 * LISTA DE PRECIOS — copia local.
 *
 * Esta es la copia de respaldo que viaja con el sitio. La lista que se muestra
 * normalmente sale de la planilla de Google del salón (ver README), que el
 * salón edita cuando quiere sin tocar nada de código.
 *
 * Si la planilla no está configurada, o Google no responde, la página muestra
 * esta copia. Nunca queda sin precios ni rota.
 *
 * IMPORTANTE: los importes vienen de la lista oficial del salón. No se estiman
 * ni se completan por analogía: un servicio sin precio confirmado se muestra
 * como "Consultar", que es honesto.
 */

export interface PriceItem {
  /** Nombre del servicio tal como lo llama el salón. */
  name: string;
  /** Importe ya formateado ("$ 45.000"). null = todavía sin confirmar. */
  price: string | null;
  /** Aclaración corta que se imprime debajo, si hace falta. */
  note?: string;
}

export interface PriceGroup {
  title: string;
  items: PriceItem[];
}

export interface PriceList {
  groups: PriceGroup[];
  /** Texto de vigencia al pie. null = no se afirma ninguna fecha. */
  validFrom: string | null;
  /** De dónde salieron los datos que se están mostrando. */
  source: 'sheet' | 'local';
}

/**
 * Estructura por defecto, armada con los servicios verificados del salón.
 * Los importes quedan en null hasta que el salón pase su lista.
 */
export const localPriceList: PriceList = {
  validFrom: null,
  source: 'local',
  groups: [
    {
      title: 'Color',
      items: [
        { name: 'Coloración', price: null },
        { name: 'Retoque de raíz', price: null },
        { name: 'Mechas y claritos', price: null },
        { name: 'Balayage y barrido', price: null },
        { name: 'Cobrizos y rojos', price: null },
        { name: 'Baño de color', price: null },
      ],
    },
    {
      title: 'Corte',
      items: [
        { name: 'Corte', price: null },
        { name: 'Capas y movimiento', price: null },
        { name: 'Flequillo', price: null },
        { name: 'Puntas', price: null },
      ],
    },
    {
      title: 'Tratamientos',
      items: [
        { name: 'Hidratación', price: null },
        { name: 'Reconstrucción', price: null },
        { name: 'Alisado y control del frizz', price: null },
      ],
    },
    {
      title: 'Peinados',
      items: [
        { name: 'Brushing', price: null },
        { name: 'Ondas y rulos', price: null },
        { name: 'Peinado para evento', price: null },
      ],
    },
  ],
};

/** ¿Hay al menos un importe cargado? */
export function hasPrices(list: PriceList): boolean {
  return list.groups.some((group) => group.items.some((item) => item.price !== null));
}
