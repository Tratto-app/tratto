/**
 * LISTA DE PRECIOS — copia local.
 *
 * Transcripción literal de la lista oficial del salón (Canva, "Agosto –
 * Octubre"). Los precios dependen del LARGO del cabello: el mismo servicio
 * vale distinto en corto, mediano, largo y extra largo.
 *
 * Esta es la copia de respaldo que viaja con el sitio. Normalmente los precios
 * salen de la planilla de Google que edita el salón (ver README). Si la
 * planilla no está configurada o falla, se muestra esto.
 *
 * REGLAS DE TRANSCRIPCIÓN
 * - Los importes están tal cual la lista oficial. No se corrigió ninguno,
 *   ni siquiera los que rompen el patrón de la grilla (ver NOTAS abajo).
 * - Sólo se normalizaron erratas evidentes de tipeo en los NOMBRES
 *   ("BRSHING" → Brushing, "PLANCHTIA" → planchita) y se pasó de mayúsculas
 *   sostenidas a mayúscula inicial, que se lee mejor en pantalla.
 * - Un servicio sin importe en la lista original queda en null y la web
 *   muestra "Consultar".
 *
 * NOTAS PARA EL SALÓN
 * - "Color rojos" y "Tono sobre tono" figuran en $60.000 para cabello extra
 *   largo, por debajo de lo que valen en largo ($70.000) y por debajo del
 *   "Color" del mismo largo ($75.000). En los otros tres largos siempre están
 *   por encima del "Color". Se transcribió lo que dice la lista; conviene
 *   revisarlo.
 * - "Balayage" en cabello corto aparece sin precio en la lista original.
 */

/** Importe por largo, en el mismo orden que `tiers`. null = a consultar. */
export interface PriceRow {
  name: string;
  prices: (string | null)[];
  note?: string;
}

export interface PriceGroup {
  title: string;
  items: PriceRow[];
}

export interface PriceList {
  /** Largos de cabello, en orden. */
  tiers: string[];
  groups: PriceGroup[];
  /** Vigencia declarada por el salón. null = no se afirma ninguna. */
  validFrom: string | null;
  source: 'sheet' | 'local';
}

export const localPriceList: PriceList = {
  tiers: ['Corto', 'Mediano', 'Largo', 'Extra largo'],
  validFrom: 'agosto',
  source: 'local',
  groups: [
    {
      title: 'Corte y peinado',
      items: [
        { name: 'Corte', prices: ['$40.000', '$40.000', '$40.000', '$40.000'] },
        { name: 'Lavado', prices: ['$15.000', '$15.000', '$15.000', '$15.000'] },
        { name: 'Brushing', prices: ['$24.000', '$26.000', '$28.000', '$35.000'] },
        { name: 'Brushing con planchita', prices: ['$26.000', '$28.000', '$35.000', '$38.000'] },
        { name: 'Brushing con movimiento', prices: ['$28.000', '$30.000', '$38.000', '$40.000'] },
        { name: 'Modelado', prices: ['$15.000', '$15.000', '$15.000', '$17.000'] },
      ],
    },
    {
      title: 'Tratamientos',
      items: [
        { name: 'Nutrición post color', prices: ['$18.000', '$20.000', '$24.000', '$24.000'] },
        { name: 'Nutrición + lavado', prices: ['$35.000', '$38.000', '$40.000', '$42.000'] },
        { name: 'Shock de keratina', prices: ['$60.000', '$65.000', '$70.000', '$75.000'] },
        { name: 'Alisado sin formol', prices: ['$80.000', '$100.000', '$130.000', '$150.000'] },
      ],
    },
    {
      title: 'Color',
      items: [
        { name: 'Color', prices: ['$55.000', '$60.000', '$65.000', '$75.000'] },
        { name: 'Color rojos', prices: ['$60.000', '$65.000', '$70.000', '$60.000'] },
        { name: 'Tono sobre tono', prices: ['$60.000', '$65.000', '$70.000', '$60.000'] },
        { name: 'Iluminación', prices: ['$120.000', '$150.000', '$180.000', '$220.000'] },
        { name: 'Color + iluminación', prices: ['$160.000', '$190.000', '$220.000', '$265.000'] },
        { name: 'Oscuros', prices: ['$100.000', '$130.000', '$150.000', '$180.000'] },
        { name: 'Claros y oscuros', prices: ['$150.000', '$170.000', '$200.000', '$250.000'] },
        { name: 'Balayage', prices: [null, '$200.000', '$250.000', '$300.000'] },
        { name: 'Pigmentación', prices: ['$45.000', '$50.000', '$55.000', '$60.000'] },
        { name: 'Decoloración', prices: ['$90.000', '$120.000', '$130.000', '$150.000'] },
        { name: 'Limpieza de color', prices: ['$55.000', '$60.000', '$65.000', '$75.000'] },
        { name: 'Aplicación de color', prices: ['$45.000', '$45.000', '$45.000', '$45.000'] },
        { name: 'Permanente', prices: ['$80.000', '$150.000', '$180.000', '$220.000'] },
      ],
    },
  ],
};

/** ¿Hay al menos un importe cargado? */
export function hasPrices(list: PriceList): boolean {
  return list.groups.some((group) =>
    group.items.some((item) => item.prices.some((price) => price !== null)),
  );
}

/** Precio de un servicio para un largo dado, o null si no está cargado. */
export function priceFor(item: PriceRow, tierIndex: number): string | null {
  return item.prices[tierIndex] ?? null;
}

/**
 * Convierte "$40.000" en 40000.
 * El punto es separador de miles en Argentina, no decimal.
 * Devuelve null si la celda no tiene un número reconocible.
 */
export function parsePriceValue(price: string | null): number | null {
  if (!price) return null;
  const digits = price.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(/,/g, '.');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Mínimo y máximo de un servicio a lo largo de todos los largos. */
export function itemPriceRange(item: PriceRow): { min: number; max: number } | null {
  const values = item.prices
    .map(parsePriceValue)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Mínimo y máximo de toda la lista. Sirve para el `priceRange` del schema. */
export function listPriceRange(list: PriceList): { min: number; max: number } | null {
  const ranges = list.groups
    .flatMap((group) => group.items)
    .map(itemPriceRange)
    .filter((range): range is { min: number; max: number } => range !== null);
  if (ranges.length === 0) return null;
  return {
    min: Math.min(...ranges.map((range) => range.min)),
    max: Math.max(...ranges.map((range) => range.max)),
  };
}

/** Formatea un importe en pesos argentinos, sin decimales. */
export function formatArs(value: number): string {
  return `$${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}
