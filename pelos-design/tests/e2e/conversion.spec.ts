import { test, expect } from '@playwright/test';

test.describe('Llamadas a la acción', () => {
  test('el CTA principal lleva al bloque de reserva', async ({ page }) => {
    await page.goto('/');
    await page.locator('main').getByRole('link', { name: 'Reservar turno' }).first().click();
    await expect(page).toHaveURL(/#reservar$/);
    await expect(page.locator('#reservar')).toBeInViewport();
  });

  test('el CTA de contacto apunta a WhatsApp o a Instagram, nunca a un link roto', async ({
    page,
  }) => {
    await page.goto('/');
    const contact = page
      .locator('main a[href*="wa.me"], main a[href*="instagram.com"]')
      .first();
    const href = await contact.getAttribute('href');
    expect(href).toBeTruthy();

    if (href!.includes('wa.me')) {
      // Formato correcto: sólo dígitos y mensaje predefinido codificado.
      expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
      expect(decodeURIComponent(href!)).toContain('turno');
    } else {
      expect(href).toContain('instagram.com/pelosdesign');
    }
  });

  test('el CTA terciario lleva a la lista de precios', async ({ page }) => {
    await page.goto('/');
    await page.locator('main').getByRole('link', { name: 'Ver precios' }).first().click();
    await expect(page).toHaveURL(/\/precios$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('con su precio');
  });

  test('los enlaces externos se abren en pestaña nueva y de forma segura', async ({ page }) => {
    await page.goto('/');
    const externals = page.locator('a[href^="http"]:not([href*="localhost"])');
    const count = await externals.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = externals.nth(i);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('el botón flotante de contacto aparece al bajar, sólo en escritorio', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    const float = page.locator('a.fixed[href*="wa.me"], a.fixed[href*="instagram.com"]').first();

    if (isMobile) {
      // En mobile ya está la barra fija: dos accesos al mismo canal se pisarían.
      await expect(float).toBeHidden();
      return;
    }

    await expect(float).toHaveAttribute('aria-hidden', 'true');

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
    await page.waitForTimeout(500);

    await expect(float).toHaveAttribute('aria-hidden', 'false');
    await expect(float).toHaveCSS('opacity', /^(1|0\.99)/);
    await expect(float).toHaveAttribute('target', '_blank');
    await expect(float).toHaveAccessibleName(/escribinos por/i);
  });

  test('la barra fija móvil aparece al bajar y no antes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sólo aplica en viewport móvil');
    await page.goto('/');

    const bar = page.locator('div.fixed.inset-x-0.bottom-0');
    await expect(bar).toHaveAttribute('aria-hidden', 'true');

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
    await page.waitForTimeout(600);
    await expect(bar).toHaveAttribute('aria-hidden', 'false');
    await expect(bar.getByRole('link', { name: 'Reservar turno' })).toBeVisible();
  });
});

test.describe('Precios', () => {
  test('muestra la lista completa en la propia página', async ({ page }) => {
    await page.goto('/precios');
    const section = page.locator('main');

    for (const group of ['Corte y peinado', 'Tratamientos', 'Color']) {
      await expect(
        section.getByRole('heading', { name: group, level: 3 }).first(),
      ).toBeVisible();
    }
    await expect(section.getByText('Balayage').first()).toBeVisible();

    // Cada servicio muestra un importe o dice "Consultar": nunca queda vacío.
    const rows = section.locator('[role="tabpanel"]:not([hidden]) dl > div');
    const count = await rows.count();
    expect(count).toBeGreaterThan(15);
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('dd').first()).not.toBeEmpty();
    }
  });

  test('el selector de largo cambia los precios', async ({ page }) => {
    await page.goto('/precios');
    const section = page.locator('main');

    const tabs = section.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

    // El corte vale igual en todos los largos; el color no.
    const visible = () => section.locator('[role="tabpanel"]:not([hidden])');
    const colorRow = () =>
      visible().locator('dl > div').filter({ hasText: /^Color/ }).first();

    const shortColor = await colorRow().locator('dd').first().innerText();

    await tabs.nth(3).click();
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');

    const longColor = await colorRow().locator('dd').first().innerText();
    expect(longColor).not.toBe(shortColor);

    // Sólo un panel visible por vez, pero los cuatro están en el HTML.
    await expect(section.locator('[role="tabpanel"]')).toHaveCount(4);
    await expect(section.locator('[role="tabpanel"]:not([hidden])')).toHaveCount(1);
  });

  test('el selector se maneja con teclado', async ({ page }) => {
    await page.goto('/precios');
    const tabs = page.locator('main').getByRole('tab');

    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('End');
    await expect(tabs.nth(3)).toBeFocused();

    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();

    // Del primero hacia atrás se va al último: el ciclo se cierra.
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.nth(3)).toBeFocused();
  });

  test('los precios de todos los largos están en el HTML', async ({ page }) => {
    // Aunque en pantalla se vea uno solo, los buscadores tienen que ver todo.
    await page.goto('/precios');
    const html = await page.locator('main').innerHTML();
    for (const price of ['$40.000', '$55.000', '$75.000', '$300.000']) {
      expect(html, `falta ${price} en el HTML`).toContain(price);
    }
  });

  test('el PDF existe y se sirve como PDF', async ({ page, request }) => {
    await page.goto('/precios');
    const link = page.locator('a[href="/precios.pdf"]').first();
    await expect(link).toBeVisible();

    const href = await link.getAttribute('href');
    expect(href).toBe('/precios.pdf');

    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('pdf');

    const body = await response.body();
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('ofrece descargar el archivo', async ({ page }) => {
    await page.goto('/precios');
    const download = page.locator('a[href="/precios.pdf"][download]');
    await expect(download).toHaveCount(1);
    await expect(download).toContainText('Descargar');
  });

  test('la home no repite la lista: sólo enlaza a ella', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('#precios');

    // Ni tabla ni selector de largo en la portada.
    await expect(section.getByRole('tab')).toHaveCount(0);
    await expect(section.locator('dl > div')).toHaveCount(3); // las tres aclaraciones

    const cta = section.getByRole('link', { name: /ver listado de precios/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/precios');
  });
});

test.describe('Ubicación', () => {
  test('muestra la semana completa de horarios', async ({ page }) => {
    await page.goto('/#encontranos');
    const section = page.locator('#encontranos');

    // Se acota al listado de la semana: fuera de él, el indicador de estado
    // también puede decir "Cerrado" según la hora en que se corra el test.
    const week = section.getByRole('list', { name: /horarios de atención/i });

    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      await expect(week.getByText(day, { exact: true })).toBeVisible();
    }

    // Los días que abre muestran el rango; los otros dicen "Cerrado".
    await expect(week.getByText('10:00 – 17:30')).toHaveCount(3);
    await expect(week.getByText('10:00 – 16:00')).toHaveCount(1);
    await expect(week.getByText('Cerrado', { exact: true })).toHaveCount(3);
  });

  test('dice si el salón está abierto en este momento', async ({ page }) => {
    await page.goto('/#encontranos');
    // Se calcula en el navegador, así que aparece recién después de montar.
    const status = page.locator('#encontranos [aria-live="polite"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/Abierto ahora|Cerrado/);
  });

  test('muestra la dirección, cómo llegar y el mapa', async ({ page }) => {
    await page.goto('/#encontranos');
    const section = page.locator('#encontranos');

    await expect(section.getByText('Yerbal 880').first()).toBeVisible();
    await expect(section.getByRole('link', { name: /cómo llegar/i }).first()).toBeVisible();
    await expect(section.getByRole('link', { name: /abrir en google maps/i })).toBeVisible();

    const map = section.locator('iframe');
    await expect(map).toHaveAttribute('loading', 'lazy');
    await expect(map).toHaveAttribute('title', /ubicación/i);
  });

  test('hay un respaldo legible si el mapa no carga', async ({ page }) => {
    // Se bloquea Google para simular el peor caso.
    await page.route('**://*.google.com/**', (route) => route.abort());
    await page.goto('/#encontranos');

    const section = page.locator('#encontranos');
    await expect(
      section.getByRole('link', { name: /abrir la ubicación en google maps/i }),
    ).toBeAttached();
  });
});

test.describe('Reseñas', () => {
  test('muestra la puntuación y la cantidad reales de Google', async ({ page }) => {
    await page.goto('/#opiniones');
    const section = page.locator('#opiniones');

    await expect(section.getByText('5,0', { exact: true })).toBeVisible();
    await expect(section.getByText(/sobre 176 reseñas en Google/i)).toBeVisible();

    // La puntuación también tiene que ser legible por lector de pantalla.
    await expect(section.getByText(/Puntuación media de 5.0 sobre 5/i)).toBeAttached();
  });

  test('muestra reseñas con autor y fecha', async ({ page }) => {
    await page.goto('/#opiniones');
    const quotes = page.locator('#opiniones blockquote');

    const count = await quotes.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < count; i++) {
      await expect(quotes.nth(i)).not.toBeEmpty();
    }

    // Cada reseña lleva quién la escribió y hace cuánto.
    const captions = page.locator('#opiniones figcaption');
    await expect(captions).toHaveCount(count);
    await expect(captions.first()).toHaveText(/hace/i);
  });

  test('las reseñas cortadas enlazan a Google en vez de completarse', async ({ page }) => {
    await page.goto('/#opiniones');
    const more = page.locator('#opiniones a', { hasText: /seguir leyendo/i });

    const count = await more.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(more.nth(i)).toHaveAttribute('href', /maps\.app\.goo\.gl/);
      await expect(more.nth(i)).toHaveAttribute('target', '_blank');
    }
  });

  test('el puntaje publicado coincide con el del JSON-LD', async ({ page }) => {
    await page.goto('/');
    const nodes = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).flatMap((raw) => JSON.parse(raw)['@graph'] as Record<string, unknown>[]);

    const salon = nodes.find((node) => node['@type'] === 'HairSalon')!;
    const rating = salon.aggregateRating as { ratingValue: number; reviewCount: number };

    expect(rating.ratingValue).toBe(5);
    expect(rating.reviewCount).toBe(176);

    // Lo que dice el schema tiene que ser lo mismo que ve la clienta.
    await expect(page.locator('#opiniones').getByText('5,0', { exact: true })).toBeVisible();
  });

  test('siempre lleva a la ficha real de Google', async ({ page }) => {
    await page.goto('/#opiniones');
    await expect(
      page.locator('#opiniones a[href*="maps.app.goo.gl"]').last(),
    ).toBeVisible();
  });
});
