import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { cspOf, withOrigins } from '../../../scripts/hosting-csp.mjs';
import { es } from '../src/i18n/es';
import { PAGES, rejectCookies } from './fixtures';

// `astro preview` no sirve las cabeceras de Hosting: se aplican aquí a cada documento, con la política
// de firebase.json y el origen local de la API. Una violación de la CSP rompe esta prueba.
const firebase = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../firebase.json'), 'utf8'),
) as Record<string, unknown>;
const API_ORIGIN = 'http://localhost:8080';
const CSP = withOrigins(cspOf(firebase, 'landing'), 'landing', { API_ORIGIN });

async function enforceHostingHeaders(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': CSP,
        'x-frame-options': 'DENY',
      },
    });
  });
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text());
  });
  return violations;
}

test('Scenario: La landing funciona con la política - sin violaciones en ninguna página', async ({
  page,
}) => {
  const violations = await enforceHostingHeaders(page);
  await page.route(`${API_ORIGIN}/v1/waitlist`, (route) =>
    route.fulfill({
      status: 202,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
      },
    }),
  );

  for (const path of PAGES) {
    await page.goto(path);
    if (path === '/') {
      await rejectCookies(page);
      const toggle = page.locator('#preguntas .toggle').first();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const { waitlist } = es;
      await page.getByLabel(waitlist.fields.email.label).fill('juan@example.com');
      await page.getByLabel(waitlist.fields.municipality.label).fill('Madrid');
      await page.getByLabel(waitlist.fields.homeType.label).selectOption('piso');
      await page.getByLabel(waitlist.fields.lookingFor.label).fill('Un ático con terraza');
      await page.getByLabel(waitlist.fields.consent.label).check();
      await page.getByRole('button', { name: waitlist.submit }).click();
      await expect(page.locator('#waitlist-success')).toContainText(waitlist.success.title);
    }
  }

  expect(violations).toEqual([]);
});

test('Scenario: Incrustar la landing en otra página - las cabeceras lo prohíben', async ({
  page,
}) => {
  await enforceHostingHeaders(page);
  const response = await page.goto('/');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});
