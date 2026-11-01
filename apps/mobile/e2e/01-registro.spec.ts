import { expect, test } from '@playwright/test';

import { PASSWORD, uniqueEmail } from './support/api';

test.describe('registro con email y contraseña', () => {
  test('Scenario: una persona nueva crea su cuenta, completa el perfil y llega a las pestañas', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Cambia de casa sin vender primero' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
    await page.getByLabel('Email').fill(uniqueEmail('registro'));
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // Alta de perfil: nombre visible y aceptación de los textos legales
    await expect(page.getByRole('heading', { name: 'Un último paso' })).toBeVisible();
    await page.getByLabel('Tu nombre').fill('Carmen Registro');
    await page.getByRole('checkbox', { name: 'Acepto los términos y condiciones' }).click();
    await page.getByRole('checkbox', { name: 'Acepto la política de privacidad' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Ya dentro: las pestañas de una cuenta normal (sin Administración)
    await expect(page.getByRole('tab', { name: 'Explorar' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Matches' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Mis casas' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Perfil' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Administración' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Perfil' }).click();
    await expect(page.getByLabel('Nombre visible')).toHaveValue('Carmen Registro');
  });

  test('Scenario: el alta no avanza sin aceptar los términos y la privacidad', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Empezar' }).click();
    await page.getByLabel('Email').fill(uniqueEmail('registro'));
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await page.getByLabel('Tu nombre').fill('Sin Aceptar');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(
      page.getByText('Para continuar tienes que aceptar los términos y condiciones.'),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Explorar' })).toHaveCount(0);
  });

  test('Scenario: una contraseña demasiado corta se rechaza antes de crear la cuenta', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Empezar' }).click();
    await page.getByLabel('Email').fill(uniqueEmail('registro'));
    await page.getByLabel('Contraseña', { exact: true }).fill('corta');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  });
});
