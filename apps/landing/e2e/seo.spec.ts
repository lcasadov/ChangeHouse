import { expect, test } from '@playwright/test';

import { PAGES } from './fixtures';

const SITE = 'https://changehouse.app';

test('Scenario: Mapa del sitio - robots.txt referencia el mapa del sitio', async ({ request }) => {
  const response = await request.get('/robots.txt');

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
});

test('Scenario: Mapa del sitio - el índice existe y el mapa incluye la principal y las legales', async ({
  request,
}) => {
  const index = await request.get('/sitemap-index.xml');
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain(`${SITE}/sitemap-0.xml`);

  const map = await (await request.get('/sitemap-0.xml')).text();
  for (const path of PAGES) {
    const expected = path === '/' ? `<loc>${SITE}/</loc>` : `<loc>${SITE}${path}</loc>`;
    expect(map, path).toContain(expected);
  }
});

test('Scenario: Metadatos por página - título, descripción e imagen propios en cada página', async ({
  page,
  request,
}) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();

  for (const path of PAGES) {
    await page.goto(path);

    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');

    expect(title.length, path).toBeGreaterThan(5);
    expect(description?.length, path).toBeGreaterThan(40);
    expect(canonical, path).toBe(`${SITE}${path}`);
    expect(image, path).toBe(`${SITE}/og.png`);
    titles.add(title);
    descriptions.add(description ?? '');
  }

  expect(titles.size).toBe(PAGES.length);
  expect(descriptions.size).toBe(PAGES.length);

  const asset = await request.get('/og.png');
  expect(asset.status()).toBe(200);
  expect(asset.headers()['content-type']).toBe('image/png');
});

test('Scenario: Enlaces legales en el pie - cada enlace abre su página', async ({ page }) => {
  await page.goto('/');
  const targets = [
    ['Aviso legal', '/aviso-legal', 'Aviso legal'],
    ['Privacidad', '/privacidad', 'Política de privacidad'],
    ['Cookies', '/cookies', 'Política de cookies'],
    ['Términos de uso', '/terminos', 'Términos de uso'],
  ] as const;

  for (const [link, path, heading] of targets) {
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: link }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText('Borrador pendiente de revisión jurídica')).toBeVisible();
  }
});
