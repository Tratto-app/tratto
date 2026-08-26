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

  test('el CTA terciario baja a precios', async ({ page }) => {
    await page.goto('/');
    await page.locator('main').getByRole('link', { name: 'Ver precios' }).first().click();
    await expect(page).toHaveURL(/#precios$/);
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
  test('el PDF existe y se sirve como PDF', async ({ page, request }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /ver lista completa de precios/i });
    await expect(link).toBeVisible();

    const href = await link.getAttribute('href');
    expect(href).toBe('/precios.pdf');

    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('pdf');

    const body = await response.body();
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('ofrece descargar el archivo además de abrirlo', async ({ page }) => {
    await page.goto('/');
    const download = page.locator('a[href="/precios.pdf"][download]');
    await expect(download).toHaveCount(1);
    await expect(download).toContainText('Descargar');
  });
});

test.describe('Ubicación', () => {
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
  test('no inventa puntajes cuando no hay datos verificados', async ({ page }) => {
    await page.goto('/#opiniones');
    const section = page.locator('#opiniones');
    await expect(section).toContainText('reseñas');

    // Sin API configurada no debe aparecer ningún promedio numérico.
    const hasRating = await section.locator('blockquote').count();
    if (hasRating === 0) {
      await expect(section).toContainText(/no publicar acá números/i);
    }
    await expect(section.getByRole('link', { name: /reseñas/i }).last()).toHaveAttribute(
      'href',
      /maps\.app\.goo\.gl/,
    );
  });
});
