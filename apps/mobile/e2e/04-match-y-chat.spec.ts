import { expect, test } from '@playwright/test';

import { likeHome } from './support/api';
import { openTab, signInToTabs } from './support/app';
import { compatiblePair } from './support/scenario';

test.describe('descubrimiento, match directo y chat', () => {
  test('Scenario: dos personas con viviendas compatibles se dan me gusta, ven el match y chatean', async ({
    browser,
    page,
  }) => {
    const { first: ana, second: beto } = await compatiblePair({
      first: { name: 'Ana Getafe', type: 'duplex' },
      second: { name: 'Beto Alcalá', type: 'atico' },
    });
    // Beto ya le dio me gusta a la casa de Ana (preparado por la API)
    await likeHome(beto.person, beto.home.id, ana.home.id);

    // Ana descubre la casa de Beto y le da me gusta: el match se forma
    await signInToTabs(page, ana.person);
    await openTab(page, 'Explorar');
    await expect(page.getByText('Ático en Centro histórico').first()).toBeVisible();
    await page.getByRole('button', { name: 'Me gusta' }).click();
    await expect(page.getByText('¡Tenéis un match!')).toBeVisible();
    await page.getByRole('button', { name: 'Ver match' }).click();

    // Detalle del match de Ana
    await expect(page.getByText('Match con Beto Alcalá')).toBeVisible();
    await expect(page.getByText('0 de 2 han confirmado su interés')).toBeVisible();

    // Beto también ve el match en su lista
    const betoPage = await (await browser.newContext({ locale: 'es-ES' })).newPage();
    await signInToTabs(betoPage, beto.person);
    await openTab(betoPage, 'Matches');
    await expect(betoPage.getByText('Match directo')).toBeVisible();
    await betoPage.getByRole('button', { name: /Match directo/ }).click();
    await expect(betoPage.getByText('Match con Ana Getafe')).toBeVisible();

    // Chat: Ana escribe y Beto lo ve (Firestore del emulador)
    await page.getByRole('button', { name: 'Abrir chat' }).click();
    await expect(page.getByText('Chat con Beto Alcalá')).toBeVisible();
    await page.getByLabel('Escribe un mensaje').fill('Hola Beto, ¿quedamos para ver las casas?');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(page.getByText('Hola Beto, ¿quedamos para ver las casas?')).toBeVisible();

    await betoPage.getByRole('button', { name: 'Abrir chat' }).click();
    await expect(betoPage.getByText('Hola Beto, ¿quedamos para ver las casas?')).toBeVisible();

    // Y la respuesta de Beto llega a Ana
    await betoPage.getByLabel('Escribe un mensaje').fill('¡Claro! El sábado por la mañana.');
    await betoPage.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(page.getByText('¡Claro! El sábado por la mañana.')).toBeVisible();
  });

  test('Scenario: sin me gusta de la otra parte no hay match', async ({ page }) => {
    const { first: carla, second: dani } = await compatiblePair({
      first: { name: 'Carla Chalet', type: 'chalet' },
      second: { name: 'Dani Adosado', type: 'adosado' },
    });

    await signInToTabs(page, carla.person);
    await openTab(page, 'Explorar');
    await expect(page.getByText('Adosado en Centro histórico').first()).toBeVisible();
    await page.getByRole('button', { name: 'Me gusta' }).click();
    await expect(page.getByText('Me gusta enviado')).toBeVisible();
    await expect(page.getByText('¡Tenéis un match!')).toHaveCount(0);

    await openTab(page, 'Matches');
    await expect(page.getByText('Todavía no tienes matches')).toBeVisible();
    expect(dani.home.id).not.toBe('');
  });
});
