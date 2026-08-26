import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { manualReviews } from '@/data/reviews';

/**
 * El cliente de Places es el camino más frágil del sitio: depende de una API
 * externa. Estos tests verifican que ante cualquier respuesta rara caiga en el
 * respaldo en lugar de romper la página o publicar datos a medias.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ORIGINAL_ENV = { ...process.env };

async function loadClient() {
  vi.resetModules();
  return import('@/lib/google/places');
}

function mockFetch(response: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => response,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  process.env.GOOGLE_PLACE_ID = 'test-place';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe('cliente de Google Places', () => {
  it('conserva el guard que impide usarlo desde el navegador', () => {
    // En tests `server-only` está stubbeado, así que la única forma de
    // comprobar la protección es sobre el archivo fuente. Sin este import, la
    // API key podría terminar en el bundle del cliente.
    const source = readFileSync(
      path.join(process.cwd(), 'src/lib/google/places.ts'),
      'utf8',
    );
    expect(source).toMatch(/^import 'server-only';/m);
  });

  it('sin credenciales no llama a la API y usa el respaldo', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const fetchMock = mockFetch({});
    const { getReviews } = await loadClient();

    const result = await getReviews();
    expect(fetchMock).not.toHaveBeenCalled();
    // Cae en los datos cargados a mano, sin inventar nada por su cuenta.
    expect(result).toEqual(manualReviews);
  });

  it('normaliza una respuesta válida', async () => {
    mockFetch({
      rating: 4.9,
      userRatingCount: 154,
      reviews: [
        {
          name: 'places/x/reviews/1',
          rating: 5,
          text: { text: 'Salí feliz con el color.' },
          authorAttribution: { displayName: 'Ana', uri: 'https://example.com/ana' },
          publishTime: '2026-02-10T12:00:00Z',
          relativePublishTimeDescription: 'hace 6 meses',
        },
      ],
    });
    const { getReviews } = await loadClient();

    const result = await getReviews();
    expect(result.source).toBe('google-places');
    expect(result.rating).toBe(4.9);
    expect(result.total).toBe(154);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]).toMatchObject({
      author: 'Ana',
      rating: 5,
      text: 'Salí feliz con el color.',
      relativeTime: 'hace 6 meses',
    });
  });

  it('manda la API key por cabecera y nunca por la URL', async () => {
    const fetchMock = mockFetch({ rating: 5, userRatingCount: 1 });
    const { getReviews } = await loadClient();
    await getReviews();

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, options] = call as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).not.toContain('test-key');
    expect(options.headers['X-Goog-Api-Key']).toBe('test-key');
    // El field mask evita traer campos que no se usan y que se facturan aparte.
    expect(options.headers['X-Goog-FieldMask']).toContain('rating');
  });

  it('descarta reseñas sin texto o sin autor', async () => {
    mockFetch({
      rating: 4.8,
      userRatingCount: 10,
      reviews: [
        { rating: 5, text: { text: '   ' }, authorAttribution: { displayName: 'Vacía' } },
        { rating: 5, text: { text: 'Buenísimo' } },
        { rating: 4, text: { text: 'Muy bien' }, authorAttribution: { displayName: 'Sol' } },
      ],
    });
    const { getReviews } = await loadClient();

    const result = await getReviews();
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]?.author).toBe('Sol');
  });

  it('ante un error HTTP cae en el respaldo sin lanzar', async () => {
    mockFetch({ error: 'nope' }, false, 403);
    const { getReviews } = await loadClient();

    const result = await getReviews();
    expect(result).toEqual(manualReviews);
  });

  it('ante un fallo de red cae en el respaldo sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const { getReviews } = await loadClient();

    await expect(getReviews()).resolves.toMatchObject({ source: 'manual' });
  });

  it('una respuesta vacía no se toma como dato válido', async () => {
    mockFetch({});
    const { getReviews } = await loadClient();

    const result = await getReviews();
    expect(result).toEqual(manualReviews);
  });

  it('acepta puntaje sin reseñas textuales', async () => {
    mockFetch({ rating: 4.7, userRatingCount: 88 });
    const { getReviews } = await loadClient();

    const result = await getReviews();
    expect(result.source).toBe('google-places');
    expect(result.rating).toBe(4.7);
    expect(result.total).toBe(88);
    expect(result.reviews).toHaveLength(0);
  });
});
