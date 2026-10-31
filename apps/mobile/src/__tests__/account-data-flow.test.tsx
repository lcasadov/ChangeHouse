import { fireEvent, screen } from '@testing-library/react-native';

import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import { FakeDataExporter } from '../test-support/fake-data-exporter';
import { renderSessionApp } from '../test-support/render-session-app';
import { THEME_NAMES } from '../test-utils';

const { profile } = es;
const { deleteAccount } = profile;

const button = (name: string) => screen.getByRole('button', { name });

async function openProfile(theme: 'light' | 'dark' = 'light') {
  const auth = new FakeAuthService({ initialUser: authUser() });
  const backend = new FakeBackend({ registered: true, profile: me({ displayName: 'Ana' }) });
  const dataExporter = new FakeDataExporter();
  await renderSessionApp({ auth, backend, dataExporter, theme });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.profile }));
  await screen.findByRole('header', { name: profile.title });
  return { auth, backend, dataExporter };
}

/** Recorre los dos pasos hasta dejar la palabra escrita. */
async function reachConfirmation(word = 'ELIMINAR') {
  await fireEvent.press(button(deleteAccount.action));
  await fireEvent.press(await screen.findByRole('button', { name: deleteAccount.continue }));
  await fireEvent.changeText(await screen.findByLabelText(deleteAccount.confirmField), word);
}

describe('Eliminar mi cuenta', () => {
  it('Scenario: Doble confirmación - el primer paso explica qué se borra y qué se conserva', async () => {
    const { backend } = await openProfile();

    await fireEvent.press(button(deleteAccount.action));

    expect(await screen.findByText(deleteAccount.explainTitle)).toBeTruthy();
    expect(screen.getByText(deleteAccount.explainDescription)).toBeTruthy();
    expect(deleteAccount.explainDescription).toMatch(/consentimientos/);
    expect(backend.requestsTo('DELETE', '/me')).toEqual([]);
  });

  it('el segundo paso pide escribir ELIMINAR y mientras no coincida exactamente el botón sigue deshabilitado', async () => {
    const { backend } = await openProfile();

    await reachConfirmation('eliminar');

    expect(screen.getByText(deleteAccount.confirmDescription)).toBeTruthy();
    expect(button(deleteAccount.confirm).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(button(deleteAccount.confirm));
    expect(backend.requestsTo('DELETE', '/me')).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText(deleteAccount.confirmField), 'ELIMINAR');
    expect(button(deleteAccount.confirm).props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('Scenario: Eliminación completa - llama a deleteMe y cierra la sesión', async () => {
    const { auth, backend } = await openProfile();

    await reachConfirmation();
    await fireEvent.press(button(deleteAccount.confirm));

    expect(await screen.findByText(es.auth.welcome.title)).toBeTruthy();
    const [request, ...others] = backend.requestsTo('DELETE', '/me');
    expect(others).toEqual([]);
    expect(request?.authorization).toBe('Bearer token-de-prueba');
    expect(auth.signOutCalls).toBe(1);
    expect(auth.user).toBeNull();
  });

  it('cancelar en cualquier paso no elimina nada y mantiene la sesión', async () => {
    const { auth, backend } = await openProfile();

    await fireEvent.press(button(deleteAccount.action));
    await fireEvent.press(await screen.findByRole('button', { name: deleteAccount.cancel }));
    expect(screen.queryByText(deleteAccount.explainTitle)).toBeNull();

    await reachConfirmation();
    await fireEvent.press(screen.getByRole('button', { name: deleteAccount.cancel }));
    expect(screen.queryByText(deleteAccount.confirmTitle)).toBeNull();

    expect(backend.requestsTo('DELETE', '/me')).toEqual([]);
    expect(auth.user).not.toBeNull();
    // Al volver a empezar el campo está vacío
    await fireEvent.press(button(deleteAccount.action));
    await fireEvent.press(await screen.findByRole('button', { name: deleteAccount.continue }));
    expect((await screen.findByLabelText(deleteAccount.confirmField)).props.value).toBe('');
  });

  it.each([
    ['network', deleteAccount.errors.network],
    ['server', deleteAccount.errors.unknown],
  ] as const)(
    'un fallo %s se explica, mantiene la sesión y permite reintentar',
    async (failure, message) => {
      const { auth, backend } = await openProfile();
      await reachConfirmation();

      backend.failNext = failure;
      await fireEvent.press(button(deleteAccount.confirm));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.queryByText(/500|corr-1/)).toBeNull();
      expect(auth.signOutCalls).toBe(0);
      expect(auth.user).not.toBeNull();

      await fireEvent.press(button(deleteAccount.confirm));
      expect(await screen.findByText(es.auth.welcome.title)).toBeTruthy();
      expect(auth.signOutCalls).toBe(1);
    },
  );
});

describe('Descargar mis datos', () => {
  it('Scenario: Exportación - pide la exportación y entrega el JSON para guardar o compartir', async () => {
    const { backend, dataExporter } = await openProfile();

    await fireEvent.press(button(profile.export.action));

    expect(await screen.findByText(profile.export.done)).toBeTruthy();
    expect(backend.requestsTo('GET', '/me/export')).toHaveLength(1);
    expect(dataExporter.delivered).toHaveLength(1);
    const [file] = dataExporter.delivered;
    expect(file?.filename).toBe('changehouse-mis-datos.json');
    expect(JSON.parse(file?.content ?? '')).toMatchObject({
      account: { email: 'ana@example.com' },
    });
  });

  it.each([
    ['network', profile.export.errors.network],
    ['server', profile.export.errors.unknown],
  ] as const)(
    'un fallo %s de la API se explica sin entregar nada y permite reintentar',
    async (failure, message) => {
      const { backend, dataExporter } = await openProfile();

      backend.failNext = failure;
      await fireEvent.press(button(profile.export.action));
      expect(await screen.findByText(message)).toBeTruthy();
      expect(dataExporter.delivered).toEqual([]);

      await fireEvent.press(button(profile.export.action));
      expect(await screen.findByText(profile.export.done)).toBeTruthy();
      expect(screen.queryByText(message)).toBeNull();
      expect(dataExporter.delivered).toHaveLength(1);
    },
  );

  it('si el fichero no se puede guardar o compartir lo explica y permite reintentar', async () => {
    const { dataExporter } = await openProfile();

    dataExporter.failNext = true;
    await fireEvent.press(button(profile.export.action));
    expect(await screen.findByText(profile.export.errors.delivery)).toBeTruthy();

    await fireEvent.press(button(profile.export.action));
    expect(await screen.findByText(profile.export.done)).toBeTruthy();
  });

  it('bloquea el reenvío mientras prepara los datos: una sola petición', async () => {
    const { backend } = await openProfile();

    const release = backend.hold();
    await fireEvent.press(button(profile.export.action));
    await fireEvent.press(button(profile.export.action));
    release();

    await screen.findByText(profile.export.done);
    expect(backend.requestsTo('GET', '/me/export')).toHaveLength(1);
  });
});

describe.each(THEME_NAMES)('tema %s', (theme) => {
  it('muestra las dos acciones y el diálogo de eliminación', async () => {
    await openProfile(theme);

    expect(button(profile.export.action)).toBeTruthy();
    await reachConfirmation();
    expect(screen.getByText(deleteAccount.confirmTitle)).toBeTruthy();
  });
});
