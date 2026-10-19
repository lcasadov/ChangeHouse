import { expect, test } from '@playwright/test';

import { PAGES, rejectCookies } from './fixtures';

test.describe('320 px de ancho', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of PAGES) {
    test(`Scenario: Pantalla estrecha - ${path} no desplaza en horizontal ni corta contenido`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator('#cookie-banner')).toBeVisible();

      for (const stage of ['aviso visible', 'aviso cerrado']) {
        if (stage === 'aviso cerrado') await rejectCookies(page);

        const overflow = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const cut = [
            ...document.querySelectorAll<HTMLElement>('h1, h2, h3, p, a, button, summary, li'),
          ]
            .filter(
              (element) =>
                element.offsetParent !== null || getComputedStyle(element).position === 'fixed',
            )
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && (rect.left < -1 || rect.right > width + 1);
            })
            .map((element) => element.textContent.trim().slice(0, 30));
          return { scroll: document.documentElement.scrollWidth, width, cut };
        });

        expect(overflow.scroll, stage).toBeLessThanOrEqual(overflow.width);
        expect(overflow.cut, stage).toEqual([]);
      }
    });
  }

  test('Scenario: Pantalla estrecha - los controles táctiles miden al menos 44 px', async ({
    page,
  }) => {
    await page.goto('/');
    await rejectCookies(page);

    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('a[href]:not(.skip-link), button, summary')]
        .filter((element) => element.offsetParent !== null)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.height < 43.5;
        })
        .map((element) => element.textContent.trim().slice(0, 30)),
    );
    expect(small).toEqual([]);
  });
});

test.describe('primera pantalla', () => {
  test('Scenario: Primera pantalla - titular, frase y botón visibles sin desplazarse', async ({
    page,
  }) => {
    await page.goto('/');
    await rejectCookies(page);

    const title = page.getByRole('heading', {
      level: 1,
      name: 'Cambia de casa sin vender primero',
    });
    const cta = page.getByRole('link', { name: 'Apúntate a la lista de espera' }).first();
    await expect(title).toBeInViewport();
    await expect(cta).toBeInViewport();
    await expect(page.locator('#inicio .subtitle')).toBeInViewport();

    await cta.click();
    await expect(page).toHaveURL(/#lista-de-espera$/);
    await expect(page.locator('#lista-de-espera')).toBeInViewport();
  });

  test('con «reducir movimiento» las casas no se animan', async ({ browser }) => {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto('/');

    const animations = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.playState === 'running').length,
    );
    expect(animations).toBe(0);
  });
});

test('Scenario: Cómo funciona en tres pasos - se ve exactamente tres', async ({ page }) => {
  await page.goto('/');
  await rejectCookies(page);

  const steps = page.locator('#como-funciona ol > li');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('Publica tu casa');
  await expect(steps.nth(1)).toContainText('Marca las que te gustan');
  await expect(steps.nth(2)).toContainText('gestoría');
});
