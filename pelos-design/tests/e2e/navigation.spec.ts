import { test, expect } from '@playwright/test';

test.describe('Navegación', () => {
  test('la home carga con un único H1', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText('El color');
  });

  test('el enlace para saltar al contenido funciona con teclado', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /saltar al contenido/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenido$/);
  });

  test('todas las secciones ancladas del nav existen', async ({ page }) => {
    await page.goto('/');
    for (const id of ['trabajos', 'opiniones', 'nosotros', 'precios', 'encontranos']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test('se puede llegar a la página de servicios y volver', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Ver todos los servicios en detalle' }).click();
    await expect(page).toHaveURL(/\/servicios$/);
    await expect(page.locator('h1')).toContainText('Todo lo que hacemos');

    await page.getByRole('navigation', { name: /ruta de navegación/i })
      .getByRole('link', { name: 'Inicio' })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('la página 404 responde con contenido útil', async ({ page }) => {
    const response = await page.goto('/una-ruta-que-no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('no existe');
    await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeVisible();
  });

  test('ningún enlace interno queda roto', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[href^="/"]:not([href^="//"])').evaluateAll((els) =>
      [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href')!))],
    );
    expect(hrefs.length).toBeGreaterThan(3);

    for (const href of hrefs) {
      const path = href.split('#')[0] || '/';
      const response = await request.get(path);
      expect(response.status(), `${path} devolvió ${response.status()}`).toBeLessThan(400);
    }
  });
});

test.describe('Menú móvil', () => {
  test.skip(({ isMobile }) => !isMobile, 'sólo aplica en viewport móvil');

  test('abre, navega y cierra con Escape', async ({ page }) => {
    await page.goto('/');
    // Se localiza por aria-controls porque el nombre accesible cambia de
    // "Abrir menú" a "Cerrar menú" al desplegarse, que es lo correcto.
    const toggle = page.locator('button[aria-controls="menu-movil"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAccessibleName(/abrir menú/i);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAccessibleName(/cerrar menú/i);

    const menu = page.locator('#menu-movil');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Servicios' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAccessibleName(/abrir menú/i);
  });

  test('el menú lleva a la página de servicios', async ({ page }) => {
    await page.goto('/');
    await page.locator('button[aria-controls="menu-movil"]').click();
    await page.locator('#menu-movil').getByRole('link', { name: 'Servicios' }).click();
    await expect(page).toHaveURL(/\/servicios$/);
  });
});
