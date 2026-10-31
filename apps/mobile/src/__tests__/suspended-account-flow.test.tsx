import { themes } from '@changehouse/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import { renderSessionApp, TEST_LEGAL_URLS } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const { suspended: s } = es.account;
const REASON = 'Fraude reiterado';

async function openApp(
  options: { profile?: ReturnType<typeof me>; theme?: 'light' | 'dark'; url?: string } = {},
) {
  const auth = new FakeAuthService({ initialUser: authUser() });
  const backend = new FakeBackend({
    registered: true,
    profile: options.profile ?? me({ suspended: true }),
  });
  const view = await renderSessionApp({
    auth,
    backend,
    ...(options.theme ? { theme: options.theme } : {}),
    ...(options.url ? { url: options.url } : {}),
  });
  return { auth, backend, view };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Pantalla de cuenta suspendida', () => {
  it('Scenario: Usuario suspendido usa la app - ve la pantalla de cuenta suspendida con el motivo general y el contacto, sin pestañas', async () => {
    const { backend } = await openApp();

    expect(await screen.findByRole('header', { name: s.title })).toBeTruthy();
    expect(screen.getByText(s.reason)).toBeTruthy();
    expect(screen.getByText(s.contact)).toBeTruthy();
    expect(screen.getByRole('link', { name: s.contactLink })).toBeTruthy();
    expect(screen.getByRole('button', { name: es.auth.signOut })).toBeTruthy();
    expect(screen.queryByRole('button', { name: es.tabs.explore })).toBeNull();
    expect(screen.queryByText(REASON)).toBeNull();
    // Sin exportación de datos implementada en la API, la pantalla no la ofrece
    expect(screen.queryByRole('button', { name: /descargar/i })).toBeNull();
    expect(backend.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      'GET /me',
    ]);
  });

  it('Scenario: Usuario suspendido usa la app - cerrar sesión lleva a la bienvenida', async () => {
    const { auth } = await openApp();

    await fireEvent.press(await screen.findByRole('button', { name: es.auth.signOut }));

    expect(await screen.findByText(es.auth.welcome.title)).toBeTruthy();
    expect(auth.signOutCalls).toBe(1);
  });

  it('el enlace de contacto abre la política de privacidad, donde están los datos de contacto', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openApp();

    await fireEvent.press(await screen.findByRole('link', { name: s.contactLink }));

    expect(open).toHaveBeenCalledWith(TEST_LEGAL_URLS.privacy);
  });

  it('una dirección de la app con la cuenta suspendida lleva a la pantalla de cuenta suspendida', async () => {
    await openApp({ url: '/matches' });

    expect(await screen.findByRole('header', { name: s.title })).toBeTruthy();
    expect(screen.queryByRole('button', { name: es.tabs.matches })).toBeNull();
  });

  it('Scenario: Usuario suspendido usa la app - si una respuesta llega con 403 ACCOUNT_SUSPENDED en plena sesión, la app muestra la pantalla de cuenta suspendida', async () => {
    const { backend } = await openApp({ profile: me() });
    await screen.findByRole('button', { name: es.tabs.matches });

    // El admin la suspende mientras usa la app: la API ya responde 403 a todo salvo a su cuenta
    backend.profile = { ...backend.profile, suspended: true };
    await fireEvent.press(screen.getByRole('button', { name: es.tabs.matches }));

    expect(await screen.findByRole('header', { name: s.title })).toBeTruthy();
    expect(backend.requestsTo('GET', '/me').length).toBeGreaterThanOrEqual(2);
  });

  it('una cuenta activa no ve la pantalla de cuenta suspendida', async () => {
    await openApp({ profile: me() });

    expect(await screen.findByRole('button', { name: es.tabs.explore })).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('header', { name: s.title })).toBeNull();
  });

  it.each(THEME_NAMES)('en el tema %s usa los tokens del tema', async (theme) => {
    await openApp({ theme });

    const title = await screen.findByRole('header', { name: s.title });
    expect(styleOf(title).color).toBe(themes[theme].color.text);
    expect(styleOf(screen.getByText(s.reason)).color).toBe(themes[theme].color.textMuted);
  });
});
