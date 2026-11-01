import { expect, type Page } from '@playwright/test';

import { PASSWORD, type Person } from './api';

/** Entra en la app con email y contraseña desde la pantalla de bienvenida, como lo haría una persona. */
export async function signIn(page: Page, person: Pick<Person, 'email'>): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await page.getByLabel('Email').fill(person.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Entra y espera a que se vean las pestañas de la app (la cuenta ya está dada de alta). */
export async function signInToTabs(page: Page, person: Pick<Person, 'email'>): Promise<void> {
  await signIn(page, person);
  await expect(page.getByRole('tab', { name: 'Perfil' })).toBeVisible();
}

/** Abre una pestaña de la barra principal. */
export async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name }).click();
}
