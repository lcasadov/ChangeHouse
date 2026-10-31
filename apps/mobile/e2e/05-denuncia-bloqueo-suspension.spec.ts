import { expect, test } from '@playwright/test';

import { call, type Person } from './support/api';
import { openTab, signIn, signInToTabs } from './support/app';
import { matchedPair } from './support/scenario';

/** El chat se crea en segundo plano tras el match: se reintenta hasta que la API lo da por listo. */
async function sendWhenChatIsReady(sender: Person, matchId: string, text: string) {
  await expect
    .poll(
      async () => {
        try {
          await call(sender, 'POST', `/matches/${matchId}/messages`, { text });
          return 'enviado';
        } catch {
          return 'chat sin preparar';
        }
      },
      { timeout: 20_000 },
    )
    .toBe('enviado');
}

test.describe('denuncias, bloqueos y suspensiones', () => {
  test('Scenario: denunciar un mensaje llega a la administración y bloquear a su autor lo confirma', async ({
    browser,
    page,
  }) => {
    const {
      first: ana,
      second: beto,
      admin,
      matchId,
    } = await matchedPair({
      first: { name: 'Ana Denuncia', type: 'casa' },
      second: { name: 'Beto Moles', type: 'estudio' },
    });
    await sendWhenChatIsReady(beto.person, matchId, 'Te ofrezco un chollo, mándame dinero ya');

    // Ana abre el chat y denuncia el mensaje
    await signInToTabs(page, ana.person);
    await openTab(page, 'Matches');
    await page.getByRole('button', { name: /Match directo/ }).click();
    await page.getByRole('button', { name: 'Abrir chat' }).click();
    await expect(page.getByText('Te ofrezco un chollo, mándame dinero ya')).toBeVisible();
    await page.getByRole('button', { name: /^Más opciones de un mensaje de Beto Moles/ }).click();
    await page.getByRole('button', { name: 'Denunciar' }).click();
    await page.getByRole('radio', { name: 'Posible estafa' }).click();
    await page.getByRole('button', { name: 'Enviar denuncia' }).click();
    await expect(
      page.getByText('Gracias. Hemos recibido tu denuncia y el equipo la revisará.'),
    ).toBeVisible();

    // La denuncia aparece en la cola de la administración, con la copia del mensaje, y se resuelve
    const adminPage = await (await browser.newContext({ locale: 'es-ES' })).newPage();
    await signInToTabs(adminPage, admin);
    await openTab(adminPage, 'Administración');
    await adminPage.getByRole('tab', { name: 'Denuncias' }).click();
    await expect(adminPage.getByText('Motivo: Posible estafa')).toBeVisible();
    await expect(adminPage.getByText('«Te ofrezco un chollo, mándame dinero ya»')).toBeVisible();
    await adminPage.getByRole('button', { name: /^Resolver la denuncia/ }).click();
    await adminPage.getByLabel('Nota de la resolución').fill('Mensaje revisado: intento de estafa');
    await adminPage.getByRole('button', { name: 'Resolver denuncia' }).click();
    await expect(adminPage.getByText('Denuncia resuelta: ya no aparece en la cola.')).toBeVisible();

    // Ana bloquea al autor del mensaje
    await page.getByRole('button', { name: /^Más opciones de un mensaje de Beto Moles/ }).click();
    await page.getByRole('button', { name: 'Bloquear' }).click();
    await expect(page.getByText('Bloquear a Beto Moles')).toBeVisible();
    await page
      .getByRole('alertdialog', { name: 'Bloquear a Beto Moles' })
      .getByRole('button', { name: 'Bloquear' })
      .click();
    await expect(page.getByText('Has bloqueado a Beto Moles. Dejaréis de veros.')).toBeVisible();
  });

  test('Scenario: la administración suspende una cuenta y su match se cierra para la otra persona', async ({
    browser,
    page,
  }) => {
    const {
      first: ana,
      second: beto,
      admin,
      matchId,
    } = await matchedPair({
      first: { name: 'Ana Suspensión', type: 'adosado' },
      second: { name: 'Beto Suspendido', type: 'chalet' },
    });

    // La administración busca a Beto y lo suspende con un motivo
    await signInToTabs(page, admin);
    await openTab(page, 'Administración');
    await page.getByRole('tab', { name: 'Usuarios' }).click();
    await page.getByLabel('Buscar por email o nombre').fill(beto.person.email);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page
      .getByRole('button', {
        name: `Suspender o reactivar a Beto Suspendido (${beto.person.email})`,
      })
      .click();
    await page.getByLabel('Motivo', { exact: true }).fill('Incumple las condiciones de uso');
    await page.getByRole('button', { name: 'Suspender', exact: true }).click();
    await page.getByRole('button', { name: 'Suspender cuenta' }).click();
    await expect(
      page.getByText(`Cuenta de Beto Suspendido (${beto.person.email}) suspendida.`),
    ).toBeVisible();

    // Beto, al entrar, solo ve la pantalla de cuenta suspendida
    const betoPage = await (await browser.newContext({ locale: 'es-ES' })).newPage();
    await signIn(betoPage, beto.person);
    await expect(betoPage.getByText('Tu cuenta está suspendida')).toBeVisible();
    await expect(betoPage.getByRole('tab', { name: 'Explorar' })).toHaveCount(0);

    // Ana ve su match cerrado y el chat en solo lectura
    const match = await call<{ status: string }>(ana.person, 'GET', `/matches/${matchId}`);
    expect(match.status).toBe('closed');
    const anaPage = await (await browser.newContext({ locale: 'es-ES' })).newPage();
    await signInToTabs(anaPage, ana.person);
    await openTab(anaPage, 'Matches');
    await expect(anaPage.getByText('Cerrado').first()).toBeVisible();
  });
});
