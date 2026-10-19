import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend } from '../test-support/fake-backend';
import { renderSessionApp, TEST_LEGAL_URLS } from '../test-support/render-session-app';

const { onboarding } = es.account;

const button = (name: string) => screen.getByRole('button', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });

/** Una persona autenticada que aún no está dada de alta: la API responde 404 a `GET /me`. */
async function openOnboarding(
  overrides: { backend?: FakeBackend; displayName?: string | null } = {},
) {
  const auth = new FakeAuthService({
    initialUser: authUser({ displayName: overrides.displayName ?? null }),
  });
  const backend = overrides.backend ?? new FakeBackend({ registered: false });
  await renderSessionApp({ auth, backend });
  await screen.findByRole('header', { name: onboarding.title });
  return { auth, backend };
}

describe('Alta en ChangeHouse con consentimiento', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Scenario: Primer acceso completo', async () => {
    const { backend } = await openOnboarding();

    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), '  Ana García ');
    await fireEvent.press(checkbox(onboarding.terms));
    await fireEvent.press(checkbox(onboarding.privacy));
    await fireEvent.press(button(onboarding.submit));

    // Entra en las pestañas
    expect(await screen.findByText(es.discovery.end.title)).toBeTruthy();
    // Una única llamada a PUT /me con el token, el nombre y las versiones vigentes aceptadas
    const [put, ...others] = backend.requestsTo('PUT', '/me');
    expect(others).toEqual([]);
    expect(put).toMatchObject({
      authorization: 'Bearer token-de-prueba',
      body: {
        displayName: 'Ana García',
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
      },
    });
  });

  it('Scenario: Sin aceptar los textos legales', async () => {
    const { backend } = await openOnboarding();

    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'Ana');
    await fireEvent.press(button(onboarding.submit));

    // Se indica qué falta junto a cada casilla y no se llama a la API
    expect(await screen.findByText(onboarding.errors.termsRequired)).toBeTruthy();
    expect(screen.getByText(onboarding.errors.privacyRequired)).toBeTruthy();
    expect(backend.requestsTo('PUT', '/me')).toEqual([]);
    expect(screen.queryByText(es.discovery.end.title)).toBeNull();
  });

  it('Scenario: Sin aceptar los textos legales - solo se señala lo que falta', async () => {
    const { backend } = await openOnboarding();

    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'Ana');
    await fireEvent.press(checkbox(onboarding.terms));
    await fireEvent.press(button(onboarding.submit));

    expect(await screen.findByText(onboarding.errors.privacyRequired)).toBeTruthy();
    expect(screen.queryByText(onboarding.errors.termsRequired)).toBeNull();
    expect(backend.requestsTo('PUT', '/me')).toEqual([]);
  });

  it('marcar la casilla quita su error', async () => {
    await openOnboarding();
    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'Ana');
    await fireEvent.press(button(onboarding.submit));
    await screen.findByText(onboarding.errors.privacyRequired);

    await fireEvent.press(checkbox(onboarding.privacy));

    expect(screen.queryByText(onboarding.errors.privacyRequired)).toBeNull();
    expect(screen.getByText(onboarding.errors.termsRequired)).toBeTruthy();
  });

  it('exige un nombre visible de 1 a 60 caracteres', async () => {
    const { backend } = await openOnboarding();
    await fireEvent.press(checkbox(onboarding.terms));
    await fireEvent.press(checkbox(onboarding.privacy));

    await fireEvent.press(button(onboarding.submit));
    expect(await screen.findByText(onboarding.errors.displayNameRequired)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'a'.repeat(61));
    await fireEvent.press(button(onboarding.submit));
    expect(await screen.findByText(onboarding.errors.displayNameTooLong)).toBeTruthy();
    expect(screen.queryByText(onboarding.errors.displayNameRequired)).toBeNull();

    expect(backend.requestsTo('PUT', '/me')).toEqual([]);
  });

  it('propone el nombre que ya dio el proveedor (Google o Apple)', async () => {
    await openOnboarding({ displayName: 'Ana García' });

    expect(screen.getByLabelText(onboarding.displayName).props.value).toBe('Ana García');
  });

  it('enlaza a los textos legales indicando la versión vigente', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openOnboarding();

    await fireEvent.press(
      screen.getByRole('link', {
        name: onboarding.readTerms.replace('{{version}}', TERMS_VERSION),
      }),
    );
    await fireEvent.press(
      screen.getByRole('link', {
        name: onboarding.readPrivacy.replace('{{version}}', PRIVACY_VERSION),
      }),
    );

    expect(open).toHaveBeenNthCalledWith(1, TEST_LEGAL_URLS.terms);
    expect(open).toHaveBeenNthCalledWith(2, TEST_LEGAL_URLS.privacy);
  });

  it('un fallo de red al guardar se explica, conserva lo escrito y permite reintentar', async () => {
    const backend = new FakeBackend({ registered: false });
    await openOnboarding({ backend });
    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'Ana');
    await fireEvent.press(checkbox(onboarding.terms));
    await fireEvent.press(checkbox(onboarding.privacy));

    backend.failNext = 'network';
    await fireEvent.press(button(onboarding.submit));
    expect(await screen.findByText(onboarding.errors.network)).toBeTruthy();
    expect(screen.getByLabelText(onboarding.displayName).props.value).toBe('Ana');

    await fireEvent.press(button(onboarding.submit));
    expect(await screen.findByText(es.discovery.end.title)).toBeTruthy();
  });

  it('si los textos legales han cambiado, pide actualizar la app', async () => {
    const backend = new FakeBackend({ registered: false });
    await openOnboarding({ backend });
    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'Ana');
    await fireEvent.press(checkbox(onboarding.terms));
    await fireEvent.press(checkbox(onboarding.privacy));

    backend.failNext = 'legal-outdated';
    await fireEvent.press(button(onboarding.submit));

    expect(await screen.findByText(onboarding.errors.legalOutdated)).toBeTruthy();
  });

  it('un error inesperado del servidor se explica sin detalles internos', async () => {
    const backend = new FakeBackend({ registered: false });
    await openOnboarding({ backend });
    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'Ana');
    await fireEvent.press(checkbox(onboarding.terms));
    await fireEvent.press(checkbox(onboarding.privacy));

    backend.failNext = 'server';
    await fireEvent.press(button(onboarding.submit));

    expect(await screen.findByText(onboarding.errors.unknown)).toBeTruthy();
    expect(screen.queryByText(/500|corr-1/)).toBeNull();
  });

  it('bloquea el reenvío mientras se guarda: una sola llamada aunque se pulse dos veces', async () => {
    const { backend } = await openOnboarding();
    await fireEvent.changeText(screen.getByLabelText(onboarding.displayName), 'Ana');
    await fireEvent.press(checkbox(onboarding.terms));
    await fireEvent.press(checkbox(onboarding.privacy));

    const release = backend.hold();
    await fireEvent.press(button(onboarding.submit));
    await fireEvent.press(button(onboarding.submit));
    expect(button(onboarding.submit).props.accessibilityState).toMatchObject({ busy: true });
    release();

    await screen.findByText(es.discovery.end.title);
    expect(backend.requestsTo('PUT', '/me')).toHaveLength(1);
  });

  it('quien ya está dado de alta no vuelve a ver el alta', async () => {
    const auth = new FakeAuthService({ initialUser: authUser() });
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });

    expect(await screen.findByText(es.discovery.end.title)).toBeTruthy();
    expect(screen.queryByRole('header', { name: onboarding.title })).toBeNull();
  });
});
