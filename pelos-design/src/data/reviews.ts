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
 * ────────────────────────────────────────────────────────────────────────────
 * PARA CARGAR LAS RESEÑAS A MANO
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Camino recomendado: configurar GOOGLE_MAPS_API_KEY y GOOGLE_PLACE_ID (ver
 * README). Con eso el sitio trae solo el promedio, la cantidad y las reseñas
 * más recientes, y se mantiene al día sin que nadie toque nada.
 *
 * Camino manual: si todavía no hay API, completá los tres campos de abajo con
 * los datos REALES de la ficha de Google del salón.
 *
 *   1. `rating`: el promedio tal cual figura en Google. Ej: 4.9
 *   2. `total`:  la cantidad de reseñas tal cual figura en Google. Ej: 154
 *   3. `reviews`: copiá las reseñas textuales que quieras mostrar.
 *
 * No completes ninguno "a ojo". Un promedio inventado es publicidad engañosa
 * y además Google penaliza los datos estructurados falsos. Si no tenés el
 * número exacto, dejalo en null: la sección degrada sola y sigue viéndose bien.
 */
export const manualReviews: ReviewsSummary = {
  rating: null,
  total: null,
  reviews: [
    // Ejemplo del formato. Descomentá y reemplazá por reseñas reales:
    // {
    //   id: 'google-1',
    //   author: 'Nombre tal como figura en Google',
    //   rating: 5,
    //   text: 'Texto de la reseña, copiado tal cual.',
    //   publishedAt: '2026-07-15',
    //   relativeTime: null,
    //   authorUrl: null,
    // },
  ],
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
