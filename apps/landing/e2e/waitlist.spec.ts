import { expect, type Page, type Route, test } from '@playwright/test';

import { es } from '../src/i18n/es';
import { expectNoAxeViolations, rejectCookies } from './fixtures';

const { waitlist } = es;

// URL por defecto de PUBLIC_API_URL: el formulario nunca llama a la API real en estas pruebas
const API_WAITLIST = 'http://localhost:8080/v1/waitlist';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-expose-headers': 'retry-after',
};

type Handler = (route: Route) => Promise<void>;

/** Simula la API en la red. Responde la petición previa de CORS y delega el POST en `onPost`. */
async function mockApi(page: Page, onPost: Handler): Promise<{ bodies: unknown[] }> {
  const bodies: unknown[] = [];
  await page.route(API_WAITLIST, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    bodies.push(request.postDataJSON());
    await onPost(route);
  });
  return { bodies };
}

const accepted: Handler = (route) => route.fulfill({ status: 202, headers: CORS });

async function open(page: Page) {
  await page.goto('/');
  await rejectCookies(page);
  await page.locator('#lista-de-espera').scrollIntoViewIfNeeded();
}

async function fillValid(page: Page) {
  await page.getByLabel(waitlist.fields.email.label).fill('juan@example.com');
  await page.getByLabel(waitlist.fields.municipality.label).fill('Madrid');
  await page.getByLabel(waitlist.fields.homeType.label).selectOption('piso');
  await page.getByLabel(waitlist.fields.lookingFor.label).fill('Un ático con terraza');
  await page.getByLabel(waitlist.fields.consent.label).check();
}

const submitButton = (page: Page) => page.getByRole('button', { name: waitlist.submit });

test('Scenario: Envío correcto - el botón se deshabilita mientras se envía y después se anuncia la confirmación', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { bodies } = await mockApi(page, async (route) => {
    await gate;
    await accepted(route);
  });
  await open(page);
  await fillValid(page);

  await submitButton(page).click();

  const sending = page.getByRole('button', { name: waitlist.sending });
  await expect(sending).toBeDisabled();
  release();

  const confirmation = page.locator('#waitlist-success');
  await expect(confirmation).toContainText(waitlist.success.title);
  await expect(confirmation).toHaveAttribute('role', 'status');
  await expect(confirmation).toHaveAttribute('aria-live', 'polite');
  expect(bodies).toEqual([
    {
      email: 'juan@example.com',
      municipality: 'Madrid',
      homeType: 'piso',
      lookingFor: 'Un ático con terraza',
      consent: true,
    },
  ]);
  await expectNoAxeViolations(page);
});

test('Scenario: Envío correcto - un doble clic envía una sola alta', async ({ page }) => {
  const { bodies } = await mockApi(page, accepted);
  await open(page);
  await fillValid(page);

  await submitButton(page).dblclick();

  await expect(page.locator('#waitlist-success')).toContainText(waitlist.success.title);
  expect(bodies).toHaveLength(1);
});

test('Scenario: Error de validación en un campo - el error aparece debajo del campo y está asociado a él', async ({
  page,
}) => {
  const { bodies } = await mockApi(page, accepted);
  await open(page);
  const municipality = page.getByLabel(waitlist.fields.municipality.label);

  await municipality.focus();
  await municipality.blur();

  const message = page.locator('#waitlist-municipality-error');
  await expect(message).toHaveText(waitlist.errors.municipality.required);
  await expect(municipality).toHaveAttribute('aria-invalid', 'true');
  await expect(municipality).toHaveAttribute('aria-describedby', 'waitlist-municipality-error');
  await expect(municipality).toHaveAccessibleDescription(waitlist.errors.municipality.required);
  expect(bodies).toEqual([]);
  await expectNoAxeViolations(page);
});

test('Scenario: Error de validación en un campo - al enviar el formulario incompleto el foco va al primer error', async ({
  page,
}) => {
  const { bodies } = await mockApi(page, accepted);
  await open(page);

  await submitButton(page).click();

  await expect(page.getByLabel(waitlist.fields.email.label)).toBeFocused();
  await expect(page.locator('#waitlist-consent-error')).toHaveText(waitlist.errors.consent.invalid);
  expect(bodies).toEqual([]);
});

test('Scenario: Fallo de red o límite superado - con un 429 se invita a reintentarlo y los datos siguen en el formulario', async ({
  page,
}) => {
  await mockApi(page, (route) =>
    route.fulfill({
      status: 429,
      headers: { ...CORS, 'retry-after': '120', 'content-type': 'application/problem+json' },
      body: JSON.stringify({ status: 429, correlationId: 'x' }),
    }),
  );
  await open(page);
  await fillValid(page);

  await submitButton(page).click();

  const alert = page.locator('#waitlist-failure');
  await expect(alert).toContainText(waitlist.rateLimited);
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(page.getByLabel(waitlist.fields.email.label)).toHaveValue('juan@example.com');
  await expect(page.getByLabel(waitlist.fields.municipality.label)).toHaveValue('Madrid');
  await expect(page.getByLabel(waitlist.fields.consent.label)).toBeChecked();
  await expect(submitButton(page)).toBeEnabled();
  await expectNoAxeViolations(page);
});

test('Scenario: Fallo de red o límite superado - si la API no responde se explica y se puede reintentar', async ({
  page,
}) => {
  let attempts = 0;
  await mockApi(page, async (route) => {
    attempts += 1;
    if (attempts === 1) await route.abort('connectionrefused');
    else await accepted(route);
  });
  await open(page);
  await fillValid(page);

  await submitButton(page).click();

  await expect(page.locator('#waitlist-failure')).toContainText(waitlist.unavailable);
  await expect(page.getByLabel(waitlist.fields.email.label)).toHaveValue('juan@example.com');

  await submitButton(page).click();

  await expect(page.locator('#waitlist-success')).toContainText(waitlist.success.title);
  await expect(page.locator('#waitlist-failure')).toHaveText('');
});

test('el formulario se maneja solo con teclado', async ({ page }) => {
  const { bodies } = await mockApi(page, accepted);
  await open(page);

  await page.getByLabel(waitlist.fields.email.label).focus();
  await page.keyboard.type('juan@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Madrid');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Un ático con terraza');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab'); // enlace de la política
  await page.keyboard.press('Tab'); // botón
  await page.keyboard.press('Enter');

  await expect(page.locator('#waitlist-success')).toContainText(waitlist.success.title);
  expect(bodies).toHaveLength(1);
});

test.describe('tema oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('los errores de campo y el aviso de fallo cumplen el contraste', async ({ page }) => {
    await mockApi(page, (route) => route.fulfill({ status: 429, headers: CORS }));
    await open(page);

    await submitButton(page).click();
    await expect(page.locator('#waitlist-email-error')).toBeVisible();
    await expectNoAxeViolations(page);

    await fillValid(page);
    await submitButton(page).click();
    await expect(page.locator('#waitlist-failure')).toContainText(waitlist.rateLimited);
    await expectNoAxeViolations(page);
  });
});
