/**
 * Reseñas: tipos y datos de respaldo.
 *
 * REGLA INNEGOCIABLE: acá no se inventa nada. Ni una reseña, ni un puntaje,
 * ni una cantidad. Si no hay datos verificados, la sección muestra el resumen
 * que sí tenemos y manda a la ficha de Google.
 *
 * Tres orígenes posibles, en este orden:
 *   A. Google Places API  → lib/google/places.ts (requiere GOOGLE_MAPS_API_KEY)
 *   B. Datos cargados a mano acá abajo, provistos por el salón
 *   C. Nada: la interfaz degrada a un CTA hacia Google
 */

export interface Review {
  id: string;
  author: string;
  /** 1 a 5. */
  rating: number;
  text: string;
  /** ISO 8601. null si la fuente no lo informa. */
  publishedAt: string | null;
  /** Texto relativo que devuelve Google ("hace 2 meses"). */
  relativeTime: string | null;
  authorUrl: string | null;
}

export interface ReviewsSummary {
  /** Promedio real. null = desconocido, y entonces no se muestra ningún número. */
  rating: number | null;
  /** Cantidad total real. null = desconocida. */
  total: number | null;
  reviews: Review[];
  source: 'google-places' | 'manual' | 'unavailable';
}

/**
 * Datos cargados a mano.
 *
 * PENDIENTE: el salón tiene que pasar su promedio y su cantidad de reseñas
 * reales, o configurar la API de Google. Los agregadores que copian la ficha
 * de Google no son fuente confiable, así que no se transcribe nada de ahí.
 *
 * Para activarlo, completá `rating` y `total` con los números reales de la
 * ficha de Google, y opcionalmente pegá reseñas textuales con permiso.
 */
export const manualReviews: ReviewsSummary = {
  rating: null,
  total: null,
  reviews: [],
  source: 'manual',
};

export const REVIEWS_UNAVAILABLE: ReviewsSummary = {
  rating: null,
  total: null,
  reviews: [],
  source: 'unavailable',
};

/** ¿Hay algo real para mostrar más allá del link a Google? */
export function hasReviewContent(summary: ReviewsSummary): boolean {
  return summary.reviews.length > 0 || summary.rating !== null;
}
