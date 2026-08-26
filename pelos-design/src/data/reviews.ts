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
  /**
   * La reseña se muestra recortada porque el original está cortado en Google.
   * La interfaz agrega los puntos suspensivos y el enlace para leerla entera.
   */
  truncated?: boolean;
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
 * RESEÑAS CARGADAS A MANO
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Estos datos son de la ficha de Google del salón: promedio 5,0 sobre 176
 * reseñas, con cuatro opiniones textuales.
 *
 * CÓMO SE TRANSCRIBIERON
 * - El promedio y la cantidad son los que muestra Google, sin redondear.
 * - Los nombres se pasaron a mayúscula inicial (Google los muestra tal como
 *   los escribió cada persona, a veces todo en minúscula).
 * - Se corrigieron tildes y signos de apertura faltantes, y se reemplazaron
 *   los saltos de línea por punto. No se cambió ni una palabra ni el sentido.
 * - Dos reseñas están cortadas en Google con un "más": van marcadas con
 *   `truncated`, y la interfaz agrega los puntos suspensivos y el enlace para
 *   leerlas enteras. No se completó lo que no se pudo leer.
 * - Las fechas de Google son relativas ("hace 2 meses"), así que se guardan
 *   como tales en `relativeTime` en lugar de inventar una fecha exacta.
 *
 * MANTENIMIENTO
 * Lo ideal es configurar GOOGLE_MAPS_API_KEY y GOOGLE_PLACE_ID (ver README):
 * con eso el sitio trae solo el promedio, la cantidad y las reseñas más
 * recientes, y esto deja de tener que actualizarse a mano.
 *
 * REGLA: nunca completar estos campos "a ojo". Un promedio inventado es
 * publicidad engañosa y Google penaliza los datos estructurados falsos.
 */
export const manualReviews: ReviewsSummary = {
  // Datos tomados de la ficha de Google del salón.
  rating: 5,
  total: 176,
  reviews: [
    {
      id: 'google-karina-gonzalez',
      author: 'Karina Gonzalez',
      rating: 5,
      text: 'Tengo cabello finito y no abundante, por eso me sorprendió mi corte de pelo «mágico». ¡Salí feliz!',
      publishedAt: null,
      relativeTime: 'hace un mes',
      authorUrl: null,
      truncated: true,
    },
    {
      id: 'google-alicia-caprino',
      author: 'Alicia Caprino',
      rating: 5,
      text: 'Excelente lugar. Abel un muy buen profesional, muy bien atendida por Martina, lo recomiendo.',
      publishedAt: null,
      relativeTime: 'hace 2 meses',
      authorUrl: null,
    },
    {
      id: 'google-patricia-blanco',
      author: 'Patricia Blanco',
      rating: 5,
      text: 'Excelente la atención. Hace años que me atiendo con Abel y Martina, siempre contenta con el corte',
      publishedAt: null,
      relativeTime: 'hace 5 meses',
      authorUrl: null,
      truncated: true,
    },
    {
      id: 'google-emilse-mozotegui',
      author: 'Emilse Mozotegui',
      rating: 5,
      text: 'Fui por primera vez, a hacerme mi primer tono sobre tono, un color más jugado al mío y oscuro. Son excelentes, me quedó un brillo hermoso. Súper dedicados con cada cliente. ¡Volveremos!',
      publishedAt: null,
      relativeTime: 'hace un año',
      authorUrl: null,
    },
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
