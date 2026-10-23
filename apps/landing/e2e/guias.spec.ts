import { expect, test } from '@playwright/test';

import { expectNoAxeViolations, rejectCookies } from './fixtures';

// El sitio se construye con las guías de e2e/guias-content (ver playwright.config.ts)
const SITE = 'https://changehouse.app';

test('Scenario: Listado de guías - muestra las publicadas, la más reciente primero', async ({
  page,
}) => {
  await page.goto('/guias');

  await expect(page.getByRole('heading', { level: 1, name: 'Guías' })).toBeVisible();
  const titles = await page.locator('main li h2').allTextContents();
  expect(titles.map((title) => title.trim())).toEqual([
    'Guía de prueba reciente',
    'Guía de prueba antigua',
  ]);
  await expect(page.locator('main li time').first()).toHaveText('20 de marzo de 2026');
});

test('Scenario: Artículo - muestra índice, tiempo de lectura y acceso a la lista de espera', async ({
  page,
}) => {
  await page.goto('/guias');
  await page.getByRole('link', { name: 'Guía de prueba reciente' }).click();

  await expect(page).toHaveURL(/\/guias\/reciente$/);
  await expect(page.getByText('1 min de lectura')).toBeVisible();
  const toc = page.getByRole('navigation', { name: 'Índice de secciones' });
  await toc.getByRole('link', { name: 'Segunda sección' }).click();
  await expect(page).toHaveURL(/#segunda-secci%C3%B3n$/);

  await page.locator('.guide-cta').getByRole('link').click();
  await expect(page).toHaveURL(/\/#lista-de-espera$/);
});

test('Scenario: Borradores fuera - la guía en borrador no tiene página ni aparece en el feed', async ({
  page,
  request,
}) => {
  const response = await page.goto('/guias/borrador');
  expect(response?.status()).toBe(404);

  await page.goto('/guias');
  await expect(page.getByText('Guía de prueba en borrador')).toHaveCount(0);
  expect(await (await request.get('/guias/rss.xml')).text()).not.toContain('borrador');
});

test('Scenario: Datos estructurados - el head de la guía contiene JSON-LD de tipo Article', async ({
  page,
}) => {
  await page.goto('/guias/reciente');

  const raw = await page.locator('head script[type="application/ld+json"]').textContent();
  const data = JSON.parse(raw ?? '{}') as Record<string, unknown>;
  expect(data).toMatchObject({
    '@type': 'Article',
    headline: 'Guía de prueba reciente',
    datePublished: '2026-03-20T00:00:00.000Z',
  });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${SITE}/guias/reciente`,
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
});

test('Scenario: Datos estructurados - el mapa del sitio incluye el listado y las guías publicadas', async ({
  request,
}) => {
  const map = await (await request.get('/sitemap-0.xml')).text();

  expect(map).toContain(`<loc>${SITE}/guias</loc>`);
  expect(map).toContain(`<loc>${SITE}/guias/reciente</loc>`);
  expect(map).toContain(`<loc>${SITE}/guias/antigua</loc>`);
  expect(map).not.toContain('/guias/borrador');
});

test('Scenario: Feed - /guias/rss.xml contiene las guías publicadas', async ({ request }) => {
  const response = await request.get('/guias/rss.xml');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('xml');
  const feed = await response.text();
  expect(feed).toContain('<title>Guía de prueba reciente</title>');
  expect(feed).toContain(`<link>${SITE}/guias/reciente</link>`);
  expect(feed).toContain('<title>Guía de prueba antigua</title>');
});

test('Scenario: Feed - el listado anuncia el feed para los lectores', async ({ page }) => {
  await page.goto('/guias');

  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    'href',
    '/guias/rss.xml',
  );
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`tema ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const path of ['/guias', '/guias/reciente']) {
      test(`Scenario: Tema oscuro del sistema - ${path} sin infracciones de axe (${scheme})`, async ({
        page,
      }) => {
        await page.goto(path);
        await rejectCookies(page);
        await expectNoAxeViolations(page);
      });
    }
  });
}
