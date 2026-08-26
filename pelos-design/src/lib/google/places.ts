import 'server-only';

import { manualReviews, REVIEWS_UNAVAILABLE, type Review, type ReviewsSummary } from '@/data/reviews';

/**
 * Capa de acceso a Google Places (API v1).
 *
 * Sólo corre en el servidor: el `import 'server-only'` rompe el build si
 * alguien intenta importarlo desde un componente cliente, así que la API key
 * no puede filtrarse al bundle del navegador.
 *
 * Nunca lanza hacia arriba: ante cualquier fallo devuelve el respaldo manual
 * o un resumen vacío, y la página sigue funcionando.
 */

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places';
const FIELD_MASK = 'rating,userRatingCount,googleMapsUri,reviews';

/** Cuánto vive la respuesta en caché antes de volver a pedirla. */
const REVALIDATE_SECONDS = 60 * 60 * 12;

interface PlacesReview {
  name?: string;
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string; uri?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
}

interface PlacesResponse {
  rating?: number;
  userRatingCount?: number;
  reviews?: PlacesReview[];
}

function normalise(review: PlacesReview, index: number): Review | null {
  const text = review.text?.text ?? review.originalText?.text ?? '';
  const author = review.authorAttribution?.displayName?.trim();
  // Sin texto o sin autor no es una reseña que valga la pena mostrar.
  if (!text.trim() || !author) return null;

  return {
    id: review.name ?? `place-review-${index}`,
    author,
    rating: typeof review.rating === 'number' ? review.rating : 0,
    text: text.trim(),
    publishedAt: review.publishTime ?? null,
    relativeTime: review.relativePublishTimeDescription ?? null,
    authorUrl: review.authorAttribution?.uri ?? null,
  };
}

/**
 * Trae el resumen de reseñas de la ficha de Google.
 * Si no hay credenciales o la llamada falla, cae en los datos manuales.
 */
export async function fetchGoogleReviews(): Promise<ReviewsSummary> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const placeId = process.env.GOOGLE_PLACE_ID?.trim();

  if (!apiKey || !placeId) return manualReviews;

  try {
    const response = await fetch(`${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
        // Google devuelve las reseñas en el idioma pedido cuando existe traducción.
        'Accept-Language': 'es-AR',
      },
      next: { revalidate: REVALIDATE_SECONDS, tags: ['google-reviews'] },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      console.warn(`[places] respuesta ${response.status} al pedir la ficha`);
      return manualReviews;
    }

    const data = (await response.json()) as PlacesResponse;

    const reviews = (data.reviews ?? [])
      .map(normalise)
      .filter((review): review is Review => review !== null);

    // Sin puntaje ni reseñas, la respuesta no aporta nada: mejor el respaldo.
    if (typeof data.rating !== 'number' && reviews.length === 0) return manualReviews;

    return {
      rating: typeof data.rating === 'number' ? data.rating : null,
      total: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
      reviews,
      source: 'google-places',
    };
  } catch (error) {
    console.warn('[places] no se pudieron traer las reseñas:', error);
    return manualReviews;
  }
}

/** Punto de entrada único para la interfaz. Nunca falla. */
export async function getReviews(): Promise<ReviewsSummary> {
  try {
    return await fetchGoogleReviews();
  } catch {
    return REVIEWS_UNAVAILABLE;
  }
}
