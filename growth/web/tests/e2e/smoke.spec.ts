import { expect, test } from '@playwright/test';
import { NAV } from '../../src/lib/nav';

const EMAIL = process.env.GROWTH_DEMO_EMAIL || '';
const PASSWORD = process.env.GROWTH_DEMO_PASSWORD || '';
const SHOTS = process.env.GROWTH_SHOTS_DIR;

test('login y recorrido por todas las secciones sin errores', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, 'Faltan GROWTH_DEMO_EMAIL / GROWTH_DEMO_PASSWORD');
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && /supabase\.co/.test(r.url())) errores.push(`${r.status()} ${r.url()}`); });

  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('así viene', { timeout: 20_000 });

  // Elegir el workspace demo si hay más de uno
  const sel = page.getByLabel('Workspace');
  const opt = await sel.locator('option', { hasText: '(demo)' }).first().getAttribute('value');
  if (opt) await sel.selectOption(opt);

  for (const item of NAV.flatMap((g) => g.items)) {
    await page.goto(item.to);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.cargando')).toHaveCount(0, { timeout: 20_000 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${item.to.replace(/\//g, '_') || '_'}.png`, fullPage: true });
  }

  // Perfil de un prospecto y de un usuario
  await page.goto('/prospects');
  await page.locator('tbody tr').first().click();
  await expect(page.getByText('Línea de tiempo')).toBeVisible();
  await page.waitForLoadState('networkidle');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/prospect-detail.png`, fullPage: true });
  await page.goto('/users');
  await page.locator('tbody tr').first().click();
  await expect(page.getByText('Eventos de la app')).toBeVisible();

  expect(errores, errores.join('\n')).toEqual([]);
});
