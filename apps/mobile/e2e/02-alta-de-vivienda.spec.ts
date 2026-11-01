import { expect, test } from '@playwright/test';

import { call, COMPLETE_DETAILS, PLACES, registerPerson } from './support/api';
import { openTab, signInToTabs } from './support/app';
import { seedReadyPhotos } from './support/db';

const next = 'Guardar y continuar';

test.describe('alta de una vivienda con el asistente', () => {
  test('Scenario: el propietario completa el asistente y envía la vivienda a revisión', async ({
    page,
  }) => {
    const owner = await registerPerson('Olga Propietaria', 'propietaria');
    await signInToTabs(page, owner);
    await openTab(page, 'Mis casas');
    await expect(page.getByText('Aún no has publicado ninguna casa')).toBeVisible();
    await page.getByRole('button', { name: 'Publicar mi casa' }).click();

    // Paso 1: fotos. La subida real a fake-gcs no es viable en local (ver support/db.ts): se
    // continúa sin fotos y se siembran por SQL en cuanto existe el borrador
    await expect(page.getByRole('heading', { name: 'Fotos de tu casa' })).toBeVisible();
    await expect(page.getByText('Paso 1 de 7')).toBeVisible();
    await expect(
      page.getByText('Añade al menos 3 fotos para poder enviar tu casa a revisión.'),
    ).toBeVisible();
    await page.getByRole('button', { name: next }).click();

    // Paso 2: tipo y dirección, con las sugerencias de prueba (sin claves de Google)
    await expect(page.getByRole('heading', { name: 'Tipo y dirección' })).toBeVisible();
    await page.getByRole('radio', { name: 'Piso' }).click();
    await page.getByLabel('Dirección').fill('Pez');
    await page.getByRole('button', { name: PLACES.malasana.formatted }).click();
    await page.getByRole('button', { name: next }).click();

    // Paso 3: régimen (libre por defecto). El borrador ya existe: se siembran sus fotos
    await expect(page.getByRole('heading', { name: 'Régimen de protección' })).toBeVisible();
    const [draft] = await call<{ id: string; status: string }[]>(owner, 'GET', '/me/homes');
    expect(draft?.status).toBe('draft');
    await seedReadyPhotos(draft?.id ?? '');
    await page.getByRole('button', { name: next }).click();

    // Paso 4: características
    await expect(page.getByRole('heading', { name: 'Características' })).toBeVisible();
    await page.getByLabel('Superficie útil (m²)').fill('80');
    await page.getByLabel('Superficie construida (m²)').fill('95');
    await page.getByLabel('Dormitorios').fill('3');
    await page.getByLabel('Baños').fill('2');
    await page.getByRole('checkbox', { name: 'Tiene ascensor' }).click();
    await page.getByRole('button', { name: next }).click();

    // Paso 5: valor y cargas
    await expect(page.getByRole('heading', { name: 'Valor y cargas' })).toBeVisible();
    await page.getByLabel('Valor mínimo (€)').fill('200000');
    await page.getByLabel('Valor máximo (€)').fill('220000');
    await page.getByRole('checkbox', { name: 'Es mi vivienda habitual' }).click();
    await page.getByRole('button', { name: next }).click();

    // Paso 6: ubicación visible (solo la zona, por defecto)
    await expect(page.getByRole('heading', { name: 'Ubicación visible' })).toBeVisible();
    await page.getByRole('button', { name: next }).click();

    // Paso 7: revisión y envío
    await expect(page.getByRole('heading', { name: 'Revisa tu casa' })).toBeVisible();
    await expect(page.getByText('3/20 fotos')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar a revisión' }).click();

    await expect(page.getByText('Estamos revisando tu casa.')).toBeVisible();
    const [submitted] = await call<{ status: string }[]>(owner, 'GET', '/me/homes');
    expect(submitted?.status).toBe('in_review');
  });

  test('Scenario: una vivienda sin fotos suficientes no se puede enviar a revisión', async ({
    page,
  }) => {
    const owner = await registerPerson('Pablo Sinfotos', 'sinfotos');
    const euros = 20_000_000;
    const home = await call<{ id: string }>(owner, 'POST', '/homes', {
      type: 'piso',
      address: PLACES.chamberi,
      ...COMPLETE_DETAILS,
      valueMinCents: euros,
      valueMaxCents: euros,
    });
    await signInToTabs(page, owner);
    await openTab(page, 'Mis casas');
    await page.getByRole('link', { name: /^Ver el detalle de Piso en Chamberí/ }).click();

    await page.getByRole('button', { name: 'Enviar a revisión' }).click();

    await expect(
      page.getByText('Faltan datos para enviar tu casa a revisión: Fotos (mínimo 3).'),
    ).toBeVisible();
    const [stillDraft] = await call<{ id: string; status: string }[]>(owner, 'GET', '/me/homes');
    expect(stillDraft).toMatchObject({ id: home.id, status: 'draft' });
  });
});
