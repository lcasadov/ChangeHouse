import { expect, test } from '@playwright/test';

import { call, PLACES, registerAdmin, registerPerson, submittedHome } from './support/api';
import { openTab, signInToTabs } from './support/app';

test.describe('moderación de viviendas por la administración', () => {
  test('Scenario: la administración aprueba una vivienda en revisión y queda publicada', async ({
    browser,
    page,
  }) => {
    const owner = await registerPerson('Olivia Propietaria', 'moderacion');
    const home = await submittedHome(owner, { type: 'piso', place: PLACES.chamberi });
    const admin = await registerAdmin();

    await signInToTabs(page, admin);
    await openTab(page, 'Administración');
    await expect(page.getByText('Las más antiguas, primero.')).toBeVisible();
    await page.getByRole('link', { name: /^Revisar Piso en Chamberí/ }).click();

    await page.getByRole('button', { name: 'Aprobar' }).click();
    await expect(page.getByText('¿Aprobar esta vivienda?')).toBeVisible();
    await page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(page.getByText('Vivienda aprobada: ya está publicada.')).toBeVisible();

    // Para la propietaria, la vivienda pasa de «En revisión» a «Publicada»
    const [published] = await call<{ id: string; status: string }[]>(owner, 'GET', '/me/homes');
    expect(published).toMatchObject({ id: home.id, status: 'published' });
    const ownerPage = await (await browser.newContext({ locale: 'es-ES' })).newPage();
    await signInToTabs(ownerPage, owner);
    await openTab(ownerPage, 'Mis casas');
    await expect(ownerPage.getByText('Publicada')).toBeVisible();
    await ownerPage.getByRole('link', { name: /^Ver el detalle de Piso en Chamberí/ }).click();
    await expect(
      ownerPage.getByText('Tu casa está publicada y puede recibir matches.'),
    ).toBeVisible();
  });

  test('Scenario: la administración rechaza una vivienda y su propietaria ve el motivo', async ({
    browser,
    page,
  }) => {
    const owner = await registerPerson('Rosa Rechazada', 'rechazo');
    const home = await submittedHome(owner, { type: 'bajo', place: PLACES.lavapies });
    const admin = await registerAdmin();

    await signInToTabs(page, admin);
    await openTab(page, 'Administración');
    await page.getByRole('link', { name: /^Revisar Bajo en Lavapiés/ }).click();
    await page.getByRole('button', { name: 'Rechazar' }).click();
    await page.getByLabel('Motivo del rechazo').fill('Las fotos no corresponden a la vivienda');
    await page.getByRole('button', { name: 'Rechazar vivienda' }).click();
    await expect(
      page.getByText('Vivienda rechazada: su propietario verá el motivo.'),
    ).toBeVisible();

    const [rejected] = await call<{ id: string; status: string }[]>(owner, 'GET', '/me/homes');
    expect(rejected).toMatchObject({ id: home.id, status: 'draft' });
    const ownerPage = await (await browser.newContext({ locale: 'es-ES' })).newPage();
    await signInToTabs(ownerPage, owner);
    await openTab(ownerPage, 'Mis casas');
    await expect(
      ownerPage.getByText(
        'No hemos podido publicar tu casa. Motivo: Las fotos no corresponden a la vivienda',
      ),
    ).toBeVisible();
  });

  test('Scenario: una cuenta que no es administradora no ve Administración', async ({ page }) => {
    const person = await registerPerson('Nadia Normal', 'normal');
    await signInToTabs(page, person);
    await expect(page.getByRole('tab', { name: 'Administración' })).toHaveCount(0);
  });
});
