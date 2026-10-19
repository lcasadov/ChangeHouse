import { fireEvent, screen } from '@testing-library/react-native';

import type { Home } from '../features/homes/homes-api';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend } from '../test-support/fake-backend';
import { completeHome, draftHome, readyPhotos } from '../test-support/fake-homes';
import { renderSessionApp } from '../test-support/render-session-app';
import { THEME_NAMES } from '../test-utils';

jest.setTimeout(30_000);

const { homes: h } = es;

const REASON = 'Las fotos no corresponden a la vivienda';
const TITLE = 'Piso en Malasaña';
const notice = (reason: string) => h.rejection.notice.replace('{{reason}}', reason);
const correctLabel = h.rejection.actionLabel.replace('{{title}}', TITLE);

/** Un borrador que el equipo rechazó: completo (tiene fotos) y con el motivo. */
const rejected = (overrides: Partial<Home> = {}) =>
  completeHome({ status: 'draft', moderationNote: REASON, ...overrides });

async function openHomes(homes: readonly Home[], theme?: 'light' | 'dark') {
  const auth = new FakeAuthService({ initialUser: authUser() });
  const backend = new FakeBackend({ registered: true, homes });
  await renderSessionApp({ auth, backend, ...(theme ? { theme } : {}) });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
  return backend;
}

describe('Aviso de rechazo en «Mis casas»', () => {
  it.each(THEME_NAMES)(
    'Scenario: Rechazar con motivo - en el tema %s el propietario ve el motivo y puede corregirla y reenviarla',
    async (theme) => {
      await openHomes([rejected()], theme);

      expect(await screen.findByText(notice(REASON))).toBeTruthy();
      expect(screen.getByRole('alert')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: correctLabel }));

      // Retoma el asistente en el primer paso que falta: la revisión final, donde está el envío
      expect(await screen.findByRole('progressbar')).toBeTruthy();
      expect(await screen.findByRole('button', { name: h.submit.action })).toBeTruthy();
    },
  );

  it('un borrador sin rechazo no muestra el aviso y conserva su acción habitual', async () => {
    await openHomes([draftHome({ moderationNote: null })]);

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(h.rejection.action)).toBeNull();
  });

  it('una vivienda ya reenviada a revisión conserva el motivo pero no muestra el aviso', async () => {
    await openHomes([rejected({ status: 'in_review' })]);

    expect(await screen.findByText(es.homes.status.in_review)).toBeTruthy();
    expect(screen.queryByText(notice(REASON))).toBeNull();
  });

  it('corregir una vivienda con datos por rellenar retoma el asistente en el paso que falta', async () => {
    await openHomes([draftHome({ moderationNote: REASON, photos: readyPhotos(3) })]);

    await fireEvent.press(await screen.findByRole('button', { name: correctLabel }));

    expect(await screen.findByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: h.submit.action })).toBeNull();
  });
});

describe('Aviso de rechazo en el detalle del propietario', () => {
  it('muestra el motivo y «Corregir y reenviar» en lugar de las acciones habituales del borrador', async () => {
    await openHomes([rejected()]);

    await fireEvent.press(await screen.findByRole('link', { name: `Ver el detalle de ${TITLE}` }));

    expect(await screen.findByText(notice(REASON))).toBeTruthy();
    expect(screen.queryByRole('button', { name: h.submit.action })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: h.rejection.action }));
    expect(await screen.findByRole('progressbar')).toBeTruthy();
  });

  it('un borrador nunca rechazado mantiene «Enviar a revisión» y «Editar datos»', async () => {
    await openHomes([completeHome({ status: 'draft' })]);

    await fireEvent.press(await screen.findByRole('link', { name: `Ver el detalle de ${TITLE}` }));

    expect(await screen.findByRole('button', { name: h.submit.action })).toBeTruthy();
    expect(screen.getByRole('button', { name: h.detail.edit })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
