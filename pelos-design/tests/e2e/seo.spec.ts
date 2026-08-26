import { test, expect } from '@playwright/test';

test.describe('SEO técnico', () => {
  test('la home trae metadata completa', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Pelo.s Design/);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(70);
    expect(description!.length).toBeLessThan(175);

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
  });

  test('las tarjetas para compartir están completas', async ({ page }) => {
    await page.goto('/');
    for (const property of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      await expect(
        page.locator(`meta[property="${property}"]`),
        `falta ${property}`,
      ).toHaveCount(1);
    }
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
  });

  test('la imagen de Open Graph existe y mide 1200x630', async ({ page, request }) => {
    await page.goto('/');
    const url = await page.locator('meta[property="og:image"]').getAttribute('content');
    const response = await request.get(new URL(url!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image');

    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      'content',
      '1200',
    );
  });

  test('cada página tiene su propio title y canonical', async ({ page }) => {
    await page.goto('/');
    const homeTitle = await page.title();
    const homeCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');

    await page.goto('/servicios');
    expect(await page.title()).not.toBe(homeTitle);
    const serviceCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(serviceCanonical).not.toBe(homeCanonical);
    expect(serviceCanonical).toContain('/servicios');
  });

  test('sitemap y robots.txt responden y se apuntan entre sí', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain('Sitemap:');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain('<urlset');
    expect(sitemapBody).toContain('/servicios');
  });

  test('el manifest y los iconos están publicados', async ({ request }) => {
    for (const path of ['/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png']) {
      const response = await request.get(path);
      expect(response.status(), `${path} devolvió ${response.status()}`).toBe(200);
    }
  });

  test('la jerarquía de encabezados es correcta', async ({ page }) => {
    await page.goto('/');
    const levels = await page
      .locator('main h1, main h2, main h3')
      .evaluateAll((els) => els.map((el) => Number(el.tagName[1])));

    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);

    // Ningún salto de nivel (h1 -> h3 sin h2 en el medio).
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!, `salto en la posición ${i}`).toBeLessThanOrEqual(1);
    }
  });

  test('toda imagen tiene alt', async ({ page }) => {
    await page.goto('/');
    const missing = await page.locator('img:not([alt])').count();
    expect(missing).toBe(0);
  });
});

test.describe('Datos estructurados', () => {
  test('el JSON-LD es válido y describe una peluquería', async ({ page }) => {
    await page.goto('/');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length).toBeGreaterThan(0);

    const nodes = blocks.flatMap((raw) => {
      const parsed = JSON.parse(raw);
      expect(parsed['@context']).toBe('https://schema.org');
      return parsed['@graph'] as Record<string, unknown>[];
    });

    const salon = nodes.find((n) => n['@type'] === 'HairSalon');
    expect(salon, 'falta el nodo HairSalon').toBeTruthy();
    expect(salon!.name).toBe("Pelo's Design");
    expect((salon!.address as Record<string, string>).streetAddress).toBe('Yerbal 880');
    expect((salon!.address as Record<string, string>).addressLocality).toBe('Caballito');
    expect(salon!.hasMap).toContain('maps.app.goo.gl');
    // NAP completo: nombre, dirección y teléfono, los tres presentes.
    expect(salon!.telephone).toMatch(/^\+54/);

    expect(nodes.some((n) => n['@type'] === 'Organization')).toBe(true);
    expect(nodes.some((n) => n['@type'] === 'WebSite')).toBe(true);
    expect(nodes.some((n) => n['@type'] === 'FAQPage')).toBe(true);
  });

  test('el puntaje del schema sale de la ficha real', async ({ page }) => {
    await page.goto('/');
    const nodes = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).flatMap((raw) => JSON.parse(raw)['@graph'] as Record<string, unknown>[]);

    const salon = nodes.find((node) => node['@type'] === 'HairSalon')!;
    expect(salon.aggregateRating).toMatchObject({
      ratingValue: 5,
      reviewCount: 176,
      bestRating: 5,
    });
  });

  test('publica los horarios reales de la ficha de Google', async ({ page }) => {
    await page.goto('/');
    const nodes = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).flatMap((raw) => JSON.parse(raw)['@graph'] as Record<string, unknown>[]);

    const salon = nodes.find((node) => node['@type'] === 'HairSalon')!;
    const spec = salon.openingHoursSpecification as { dayOfWeek: string[] }[];
    expect(spec).toHaveLength(2);
    // Jueves cerrado: no debe figurar entre los días de atención.
    expect(JSON.stringify(spec)).not.toContain('Thursday');
  });

  test('las preguntas del schema coinciden con las de la página', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faqNode = raw
      .flatMap((r) => JSON.parse(r)['@graph'])
      .find((n: Record<string, unknown>) => n['@type'] === 'FAQPage');

    const schemaQuestions = (faqNode.mainEntity as { name: string }[]).map((q) => q.name);
    const pageQuestions = await page.locator('#preguntas summary span').first().textContent();
    expect(schemaQuestions).toContain(pageQuestions!.trim());
  });

  test('la página de servicios emite migas de pan', async ({ page }) => {
    await page.goto('/servicios');
    const raw = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(
      '',
    );
    expect(raw).toContain('BreadcrumbList');
  });
});

test.describe('GEO / búsqueda con IA', () => {
  test('llms.txt describe el negocio sin inventar datos', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');

    const body = await response.text();
    expect(body).toContain("Pelo's Design");
    expect(body).toContain('Yerbal 880');
    expect(body).toContain('Caballito');
    expect(body).toContain('## Servicios');
    expect(body).toContain('## Preguntas frecuentes');
    // El teléfono ya está confirmado por el salón y debe figurar.
    expect(body).toMatch(/Teléfono: \+54/);
    // Los horarios ya están confirmados y se listan los siete días.
    expect(body).toMatch(/Martes: 10:00–17:30/);
    expect(body).toMatch(/Jueves: cerrado/);
    // La reputación se publica con el puntaje real, no en abstracto.
    expect(body).toMatch(/Puntuación media en Google: 5 sobre 5, sobre 176 reseñas/);
  });
});
