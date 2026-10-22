import { expect, type Page, test } from '@playwright/test';

const ALLOWED = 'changehouse:analytics-allowed';
const REVOKED = 'changehouse:analytics-revoked';

/** Cuenta los avisos de analítica que emite la página, antes de que se ejecute su código. */
async function countAnalyticsEvents(page: Page): Promise<void> {
  await page.addInitScript(
    ([allowed, revoked]) => {
      const counts = { allowed: 0, revoked: 0 };
      Object.assign(window, { analyticsCounts: counts });
      document.addEventListener(allowed!, () => (counts.allowed += 1));
      document.addEventListener(revoked!, () => (counts.revoked += 1));
    },
    [ALLOWED, REVOKED],
  );
}

const analyticsCounts = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { analyticsCounts: { allowed: number; revoked: number } })
        .analyticsCounts,
  );

const storedKeys = (page: Page) =>
  page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookie: document.cookie,
  }));

test('Scenario: Sin cookies no esenciales antes de decidir - no hay cookies, almacenamiento ni terceros', async ({
  page,
  context,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await countAnalyticsEvents(page);

  await page.goto('/');
  await expect(page.locator('#cookie-banner')).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(await context.cookies()).toEqual([]);
  expect(await storedKeys(page)).toEqual({ local: [], session: [], cookie: '' });
  expect(requested.filter((url) => !url.startsWith('http://localhost:4399/'))).toEqual([]);
  expect(await analyticsCounts(page)).toEqual({ allowed: 0, revoked: 0 });
});

test('Scenario: Rechazar es tan fácil como aceptar - mismo tamaño, mismo nivel y un solo clic', async ({
  page,
}) => {
  await page.goto('/');
  const boxes = await Promise.all(
    ['Aceptar', 'Rechazar', 'Configurar'].map((name) =>
      page.locator('#cookie-banner').getByRole('button', { name, exact: true }).boundingBox(),
    ),
  );

  const [accept, reject, configure] = boxes;
  expect(accept && reject && configure).toBeTruthy();
  expect(reject!.width).toBeCloseTo(accept!.width, 0);
  expect(reject!.height).toBeCloseTo(accept!.height, 0);
  expect(configure!.width).toBeCloseTo(accept!.width, 0);
  expect(reject!.y).toBeCloseTo(accept!.y, 0);

  await page.getByRole('button', { name: 'Rechazar' }).click();
  await expect(page.locator('#cookie-banner')).toBeHidden();
});

test('Scenario: La elección se recuerda - tras rechazar no se vuelve a preguntar ni se carga analítica', async ({
  page,
  context,
}) => {
  await countAnalyticsEvents(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Rechazar' }).click();

  expect(await storedKeys(page)).toEqual({
    local: ['changehouse.consent'],
    session: [],
    cookie: '',
  });
  expect(await page.evaluate(() => localStorage.getItem('changehouse.consent'))).toBe('rejected');

  await page.reload();
  await page.goto('/privacidad');

  await expect(page.locator('#cookie-banner')).toBeHidden();
  expect(await context.cookies()).toEqual([]);
  expect(await analyticsCounts(page)).toEqual({ allowed: 0, revoked: 0 });
});

test('Scenario: Cambiar la elección - el enlace del pie permite aceptar y revocar al instante', async ({
  page,
}) => {
  await countAnalyticsEvents(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.locator('#cookie-banner')).toBeHidden();
  await expect(page.locator('#cookie-status')).toHaveText(/guardado/);
  expect(await analyticsCounts(page)).toEqual({ allowed: 1, revoked: 0 });

  const footerButton = page.getByRole('button', { name: 'Configurar cookies' });
  await footerButton.click();
  await expect(page.locator('#cookie-banner')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu privacidad, tu decisión' })).toBeFocused();

  const analytics = page.getByLabel('Analítica');
  await expect(analytics).toBeChecked();
  await analytics.uncheck();
  await page.getByRole('button', { name: 'Guardar mi elección' }).click();

  await expect(page.locator('#cookie-banner')).toBeHidden();
  await expect(footerButton).toBeFocused();
  expect(await analyticsCounts(page)).toEqual({ allowed: 1, revoked: 1 });
  expect(await page.evaluate(() => localStorage.getItem('changehouse.consent'))).toBe('rejected');
});

test('Scenario: Cambiar la elección - «Configurar» se opera con teclado y anuncia su estado', async ({
  page,
}) => {
  await page.goto('/');
  const configure = page.getByRole('button', { name: 'Configurar', exact: true });

  await configure.focus();
  await page.keyboard.press('Enter');

  await expect(configure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#cookie-settings')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Analítica')).toBeFocused();
});
