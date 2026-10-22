import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const PAGES = ['/', '/aviso-legal', '/privacidad', '/cookies', '/terminos'] as const;

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Falla con el detalle de cada infracción de WCAG 2.2 AA que axe-core encuentre en la página. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
  );
  expect(summary).toEqual([]);
}

/** Guarda la decisión de cookies para que el aviso no estorbe en pruebas que no tratan de él. */
export async function rejectCookies(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Rechazar' }).click();
  await expect(page.locator('#cookie-banner')).toBeHidden();
}
