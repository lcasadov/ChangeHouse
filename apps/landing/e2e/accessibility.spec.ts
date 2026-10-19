import { expect, test } from '@playwright/test';

import { expectNoAxeViolations, PAGES, rejectCookies } from './fixtures';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`tema ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(`Scenario: Tema oscuro del sistema - ${path} sin infracciones de axe (${scheme}, aviso visible)`, async ({
        page,
      }) => {
        await page.goto(path);
        await expect(page.locator('#cookie-banner')).toBeVisible();
        await expectNoAxeViolations(page);
      });

      test(`Scenario: Tema oscuro del sistema - ${path} sin infracciones de axe (${scheme}, aviso cerrado)`, async ({
        page,
      }) => {
        await page.goto(path);
        await rejectCookies(page);
        await expectNoAxeViolations(page);
      });
    }
  });
}

test('Scenario: Tema oscuro del sistema - usa la paleta oscura', async ({ browser }) => {
  const dark = await browser.newPage({ colorScheme: 'dark' });
  const light = await browser.newPage({ colorScheme: 'light' });
  await dark.goto('/');
  await light.goto('/');

  const background = (page: typeof dark) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await background(dark)).toBe('rgb(18, 24, 38)');
  expect(await background(light)).toBe('rgb(255, 255, 255)');
});

test('Scenario: Navegación con teclado - Tab recorre todo en orden lógico con el foco visible', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#cookie-banner')).toBeVisible();

  const tabbableCount = await page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, input:not([disabled])',
        ),
      ].filter((element) => element.offsetParent !== null).length,
  );
  expect(tabbableCount).toBeGreaterThan(15);

  const visited: Array<{ order: number; visible: boolean; name: string }> = [];
  for (let step = 0; step < tabbableCount; step += 1) {
    await page.keyboard.press('Tab');
    visited.push(
      await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const all = [...document.querySelectorAll('*')];
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          order: all.indexOf(element),
          visible:
            style.outlineStyle !== 'none' &&
            Number.parseFloat(style.outlineWidth) > 0 &&
            rect.width > 0,
          name: element.textContent.trim().slice(0, 40),
        };
      }),
    );
  }

  expect(visited.filter((item) => !item.visible)).toEqual([]);
  const orders = visited.map((item) => item.order);
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
  expect(new Set(orders).size).toBe(tabbableCount);
});

test('Scenario: Preguntas frecuentes desplegables - se abren con teclado y anuncian su estado', async ({
  page,
}) => {
  await page.goto('/');
  await rejectCookies(page);
  const first = page.locator('#preguntas .toggle').first();
  const answer = page.locator('#preguntas [data-faq-item]').first().locator('.answer');

  await expect(answer).toBeHidden();
  await first.focus();
  await page.keyboard.press('Enter');

  await expect(answer).toBeVisible();
  await expect(first).toHaveAccessibleName(/vender mi casa/);
  expect(await first.ariaSnapshot()).toContain('[expanded]');

  await page.keyboard.press('Space');
  await expect(answer).toBeHidden();
  expect(await first.ariaSnapshot()).not.toContain('[expanded]');
});

test('Scenario: Preguntas frecuentes desplegables - se abren con el ratón', async ({ page }) => {
  await page.goto('/');
  await rejectCookies(page);
  const summary = page.locator('#preguntas .toggle').nth(1);

  await summary.click();

  await expect(page.locator('#preguntas [data-faq-item]').nth(1).locator('.answer')).toBeVisible();
});
