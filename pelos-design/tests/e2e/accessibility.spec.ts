import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/servicios', '/legales/privacidad'];

test.describe('Accesibilidad', () => {
  for (const path of PAGES) {
    test(`${path} no tiene violaciones de WCAG 2.2 AA`, async ({ page }) => {
      await page.goto(path);
      // Desactivar animaciones para que axe mida estados finales.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        help: v.help,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      }));

      expect(JSON.stringify(summary, null, 1)).toBe('[]');
    });
  }

  test('cada foto de la galería lleva su rótulo visible', async ({ page }) => {
    await page.goto('/#trabajos');
    const plates = page.locator('#trabajos button.group');
    const count = await plates.count();
    expect(count).toBeGreaterThan(3);

    for (let i = 0; i < count; i++) {
      const caption = plates.nth(i).locator('span.uppercase');
      await expect(caption).toBeVisible();
      await expect(caption).not.toBeEmpty();
    }
  });

  test('el visor de galería atrapa el foco y se cierra con teclado', async ({ page }) => {
    await page.goto('/#trabajos');
    await page.locator('#trabajos button.group').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-label', /imagen 1 de/i);

    // Las flechas navegan entre fotos.
    await page.keyboard.press('ArrowRight');
    await expect(dialog).toHaveAttribute('aria-label', /imagen 2 de/i);
    await page.keyboard.press('ArrowLeft');
    await expect(dialog).toHaveAttribute('aria-label', /imagen 1 de/i);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // El foco vuelve a la miniatura que lo abrió.
    await expect(page.locator('#trabajos button.group').first()).toBeFocused();
  });

  test('el visor abierto no tiene violaciones', async ({ page }) => {
    await page.goto('/#trabajos');
    await page.locator('#trabajos button.group').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test('el comparador antes/después se maneja con teclado', async ({ page }) => {
    await page.goto('/#trabajos');
    const slider = page.getByRole('slider');
    await expect(slider).toHaveCount(1);
    await expect(slider).toHaveAccessibleName(/comparar antes y después/i);

    await slider.focus();
    const initial = await slider.inputValue();
    await page.keyboard.press('ArrowRight');
    expect(Number(await slider.inputValue())).toBeGreaterThan(Number(initial));

    await page.keyboard.press('Home');
    expect(await slider.inputValue()).toBe('0');
    await page.keyboard.press('End');
    expect(await slider.inputValue()).toBe('100');
  });

  test('las preguntas frecuentes se abren con teclado', async ({ page }) => {
    await page.goto('/#preguntas');
    const first = page.locator('#preguntas details').first();
    await expect(first).not.toHaveAttribute('open', '');

    await first.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('open', '');
  });

  test('se respeta prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // Con movimiento reducido el contenido tiene que estar visible sin animar.
    const opacity = await page
      .locator('.reveal')
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
  });

  test('el foco es siempre visible', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return { width: cs.outlineWidth, style: cs.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });
});

test.describe('Responsive', () => {
  const viewports = [
    { name: '375', width: 375, height: 812 },
    { name: '390', width: 390, height: 844 },
    { name: '412', width: 412, height: 915 },
    { name: '768', width: 768, height: 1024 },
    { name: '1024', width: 1024, height: 768 },
    { name: '1280', width: 1280, height: 800 },
    { name: '1440', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    test(`sin desborde horizontal a ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);

      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const offenders: string[] = [];
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > docWidth + 1.5) {
            offenders.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)}`);
          }
        }
        return { scrollWidth: document.documentElement.scrollWidth, docWidth, offenders };
      });

      expect(overflow.offenders).toEqual([]);
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.docWidth + 1);
    });
  }

  test('los objetivos táctiles llegan al mínimo recomendado', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sólo aplica en viewport móvil');
    await page.goto('/');

    const small = await page.locator('main a, main button, header button').evaluateAll((els) =>
      els
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          // Los enlaces dentro de un párrafo quedan exentos: WCAG 2.2 los
          // excluye del criterio de tamaño mínimo.
          if (el.closest('p, dd, figcaption, address, li.flex')) return false;
          return rect.height < 24 || rect.width < 24;
        })
        .map((el) => `${el.tagName}: ${(el.textContent || '').trim().slice(0, 30)}`),
    );

    expect(small).toEqual([]);
  });
});
