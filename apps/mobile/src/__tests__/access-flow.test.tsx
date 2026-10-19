import { themes } from '@changehouse/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService, fakeSocialSignIn } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

const { access, errors, forgot, verify, welcome } = es.auth;

const EMAIL = 'ana@example.com';
const PASSWORD = 'una-clave-larga';

const button = (name: string) => screen.getByRole('button', { name });

async function openAccess(label: string) {
  await fireEvent.press(await screen.findByRole('button', { name: label }));
  return screen.findByLabelText(access.email);
}

async function fillCredentials(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText(access.email), email);
  await fireEvent.changeText(screen.getByLabelText(access.password), password);
}

describe('Registro e inicio de sesión', () => {
  it('Scenario: Registro con email y contraseña', async () => {
    const auth = new FakeAuthService();
    const backend = new FakeBackend({ registered: false });
    await renderSessionApp({ auth, backend });

    await openAccess(welcome.signUp);
    await fillCredentials(EMAIL, PASSWORD);
    await fireEvent.press(button(access.signUpSubmit));

    // Cuenta creada, sesión iniciada y paso al alta en ChangeHouse
    expect(await screen.findByRole('header', { name: es.account.onboarding.title })).toBeTruthy();
    expect(auth.accounts.has(EMAIL)).toBe(true);
    expect(auth.user?.email).toBe(EMAIL);
    // Se envía el enlace de verificación al registrarse
    expect(auth.verificationEmailsSent).toBe(1);
  });

  it('Scenario: Contraseña demasiado corta', async () => {
    const auth = new FakeAuthService();
    await renderSessionApp({ auth, backend: new FakeBackend() });

    await openAccess(welcome.signUp);
    await fillCredentials(EMAIL, '1234567');
    await fireEvent.press(button(access.signUpSubmit));

    // El error aparece junto al campo y no se crea ninguna cuenta
    expect(await screen.findByText(errors.passwordTooShort)).toBeTruthy();
    expect(screen.getByLabelText(access.password).props['aria-invalid']).toBe(true);
    expect(auth.accounts.size).toBe(0);
    expect(auth.user).toBeNull();
  });

  it('Scenario: Credenciales incorrectas', async () => {
    const auth = new FakeAuthService();
    auth.addAccount(EMAIL, PASSWORD);
    await renderSessionApp({ auth, backend: new FakeBackend() });

    await openAccess(welcome.signIn);
    await fillCredentials(EMAIL, 'otra-clave-distinta');
    await fireEvent.press(button(access.signInSubmit));
    const withExistingEmail = await screen.findByText(errors.invalidCredentials);

    // Con un email que no existe el mensaje es exactamente el mismo: no revela quién tiene cuenta
    await fillCredentials('nadie@example.com', 'otra-clave-distinta');
    await fireEvent.press(button(access.signInSubmit));
    await waitFor(() => {
      expect(screen.getAllByText(errors.invalidCredentials)).toHaveLength(1);
    });
    expect(withExistingEmail).toBeTruthy();
    expect(screen.queryByText(/no existe|no está registrad/i)).toBeNull();
    expect(auth.user).toBeNull();
    // Puede reintentar o recuperar la contraseña
    expect(button(access.signInSubmit)).toBeTruthy();
    expect(screen.getByRole('link', { name: access.forgotPassword })).toBeTruthy();
  });

  it('un fallo de red al entrar se explica y deja reintentar', async () => {
    const auth = new FakeAuthService();
    auth.addAccount(EMAIL, PASSWORD);
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });

    await openAccess(welcome.signIn);
    await fillCredentials(EMAIL, PASSWORD);
    auth.failNextWith = 'network';
    await fireEvent.press(button(access.signInSubmit));
    expect(await screen.findByText(errors.network)).toBeTruthy();

    await fireEvent.press(button(access.signInSubmit));
    expect(await screen.findByText(es.explore.empty.title)).toBeTruthy();
  });

  it('Scenario: Acceso con Google o Apple', async () => {
    const google = fakeSocialSignIn('google');
    const apple = fakeSocialSignIn('apple');
    const auth = new FakeAuthService();
    await renderSessionApp({ auth, backend: new FakeBackend(), social: [google, apple] });

    await openAccess(welcome.signUp);
    expect(button(access.apple)).toBeTruthy();
    await fireEvent.press(button(access.google));

    // Primer acceso: sesión iniciada y paso al alta
    expect(await screen.findByRole('header', { name: es.account.onboarding.title })).toBeTruthy();
    expect(google.started).toBe(1);
    expect(apple.started).toBe(0);
    expect(auth.user?.uid).toBe('uid-google');
  });

  it('Scenario: Acceso con Google o Apple - si ya estaba dado de alta entra directamente a las pestañas', async () => {
    const auth = new FakeAuthService();
    await renderSessionApp({
      auth,
      backend: new FakeBackend({ registered: true }),
      social: [fakeSocialSignIn('apple')],
    });

    await openAccess(welcome.signIn);
    await fireEvent.press(button(access.apple));

    expect(await screen.findByText(es.explore.empty.title)).toBeTruthy();
  });

  it('solo se ofrecen los proveedores configurados', async () => {
    await renderSessionApp({
      auth: new FakeAuthService(),
      backend: new FakeBackend(),
      social: [fakeSocialSignIn('google')],
    });

    await openAccess(welcome.signUp);

    expect(button(access.google)).toBeTruthy();
    expect(screen.queryByRole('button', { name: access.apple })).toBeNull();
  });

  it('sin proveedores configurados solo queda el acceso con email', async () => {
    await renderSessionApp({ auth: new FakeAuthService(), backend: new FakeBackend() });

    await openAccess(welcome.signUp);

    expect(screen.queryByRole('button', { name: access.google })).toBeNull();
    expect(screen.queryByRole('button', { name: access.apple })).toBeNull();
    expect(screen.getByLabelText(access.email)).toBeTruthy();
  });

  it('si la persona cancela el proveedor se queda en el acceso, sin error', async () => {
    const auth = new FakeAuthService();
    await renderSessionApp({
      auth,
      backend: new FakeBackend(),
      social: [fakeSocialSignIn('google', null)],
    });

    await openAccess(welcome.signUp);
    await fireEvent.press(button(access.google));

    await waitFor(() => {
      expect(button(access.google).props.accessibilityState).toMatchObject({ busy: false });
    });
    expect(auth.user).toBeNull();
    expect(screen.queryByText(errors.socialFailed)).toBeNull();
  });

  it('si el proveedor falla se explica y se puede usar el email', async () => {
    const auth = new FakeAuthService();
    await renderSessionApp({
      auth,
      backend: new FakeBackend(),
      social: [fakeSocialSignIn('google')],
    });

    await openAccess(welcome.signUp);
    auth.failNextWith = 'unknown';
    await fireEvent.press(button(access.google));

    expect(await screen.findByText(errors.socialFailed)).toBeTruthy();
    expect(screen.getByLabelText(access.email)).toBeTruthy();
  });

  it('Scenario: Sesión recordada', async () => {
    const auth = new FakeAuthService({ initialUser: authUser() });
    const backend = new FakeBackend({ registered: true });
    await renderSessionApp({ auth, backend });

    // Entra directamente a las pestañas, sin pasar por la bienvenida
    expect(await screen.findByText(es.explore.empty.title)).toBeTruthy();
    expect(screen.queryByText(welcome.title)).toBeNull();
    // La petición lleva el token de la sesión recordada
    expect(backend.requestsTo('GET', '/me')[0]?.authorization).toBe('Bearer token-de-prueba');
  });

  it('mientras se restaura la sesión no parpadea la bienvenida y se anuncia la carga', async () => {
    const auth = new FakeAuthService({ initialUser: authUser(), restored: false });
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });

    expect(screen.getByLabelText(es.session.loading)).toBeTruthy();
    expect(screen.queryByText(welcome.title)).toBeNull();

    await act(() => {
      auth.finishRestore();
    });
    expect(await screen.findByText(es.explore.empty.title)).toBeTruthy();
  });

  it('Scenario: Cerrar sesión', async () => {
    const auth = new FakeAuthService({ initialUser: authUser() });
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });

    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.profile }));
    await fireEvent.press(await screen.findByRole('button', { name: es.auth.signOut }));

    // Vuelve a la bienvenida y las pestañas dejan de ser accesibles
    expect(await screen.findByText(welcome.title)).toBeTruthy();
    expect(auth.user).toBeNull();
    expect(screen.queryByRole('button', { name: es.tabs.explore })).toBeNull();
    expect(screen.queryByRole('button', { name: es.tabs.profile })).toBeNull();
  });

  it('una pestaña protegida sin sesión lleva a la bienvenida', async () => {
    const view = await renderSessionApp({
      auth: new FakeAuthService(),
      backend: new FakeBackend(),
      url: '/matches',
    });

    expect(await screen.findByText(welcome.title)).toBeTruthy();
    expect(screen.queryByText(es.matches.empty.title)).toBeNull();
    expect(view.getPathname()).toBe('/welcome');
  });

  it('sin sesión se puede volver de la pantalla de acceso a la bienvenida', async () => {
    await renderSessionApp({ auth: new FakeAuthService(), backend: new FakeBackend() });
    await openAccess(welcome.signUp);

    await fireEvent.press(button(access.back));

    expect(await screen.findByText(welcome.title)).toBeTruthy();
  });

  it('se puede alternar entre crear cuenta y entrar sin salir de la pantalla', async () => {
    await renderSessionApp({ auth: new FakeAuthService(), backend: new FakeBackend() });
    await openAccess(welcome.signUp);
    expect(screen.getByRole('header', { name: access.signUpTitle })).toBeTruthy();

    await fireEvent.press(button(access.switchToSignIn));
    expect(screen.getByRole('header', { name: access.signInTitle })).toBeTruthy();
    expect(button(access.signInSubmit)).toBeTruthy();

    await fireEvent.press(button(access.switchToSignUp));
    expect(screen.getByRole('header', { name: access.signUpTitle })).toBeTruthy();
  });

  it('los errores de campo se muestran al salir del campo y se quitan al corregir', async () => {
    await renderSessionApp({ auth: new FakeAuthService(), backend: new FakeBackend() });
    await openAccess(welcome.signUp);

    await fireEvent.changeText(screen.getByLabelText(access.email), 'no-es-un-email');
    await fireEvent(screen.getByLabelText(access.email), 'blur');
    expect(await screen.findByText(errors.emailInvalid)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText(access.email), EMAIL);
    expect(screen.queryByText(errors.emailInvalid)).toBeNull();
  });

  it('un email ya registrado al crear la cuenta se explica sin culpar a la persona', async () => {
    const auth = new FakeAuthService();
    auth.addAccount(EMAIL, PASSWORD);
    await renderSessionApp({ auth, backend: new FakeBackend() });

    await openAccess(welcome.signUp);
    await fillCredentials(EMAIL, PASSWORD);
    await fireEvent.press(button(access.signUpSubmit));

    expect(await screen.findByText(errors.emailInUse)).toBeTruthy();
  });

  it('bloquea la doble pulsación mientras se envía', async () => {
    const auth = new FakeAuthService();
    auth.addAccount(EMAIL, PASSWORD);
    // Una petición que no termina: el botón debe quedar ocupado y no repetir el envío
    const signIn = jest
      .spyOn(auth, 'signInWithEmail')
      .mockImplementation(() => new Promise(() => {}));
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });

    await openAccess(welcome.signIn);
    await fillCredentials(EMAIL, PASSWORD);
    await fireEvent.press(button(access.signInSubmit));
    await fireEvent.press(button(access.signInSubmit));

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(button(access.signInSubmit).props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe('Verificación del email y recuperación de la contraseña', () => {
  const unverified = () =>
    new FakeAuthService({ initialUser: authUser({ emailVerified: false, hasPassword: true }) });

  it('Scenario: Aviso de email sin verificar', async () => {
    const auth = unverified();
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });

    expect(await screen.findByText(verify.banner)).toBeTruthy();
    await fireEvent.press(button(verify.resend));

    expect(await screen.findByText(verify.resent)).toBeTruthy();
    expect(auth.verificationEmailsSent).toBe(1);
  });

  it('el aviso desaparece cuando la persona confirma el email y lo comprueba', async () => {
    const auth = unverified();
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });
    await screen.findByText(verify.banner);

    // Aún no ha abierto el enlace: se le dice, y el aviso sigue
    await fireEvent.press(button(verify.refresh));
    expect(await screen.findByText(verify.stillPending)).toBeTruthy();

    auth.verifyEmailRemotely();
    await fireEvent.press(button(verify.refresh));

    await waitFor(() => {
      expect(screen.queryByText(verify.banner)).toBeNull();
    });
  });

  it('un fallo al reenviar el enlace se explica', async () => {
    const auth = unverified();
    await renderSessionApp({ auth, backend: new FakeBackend({ registered: true }) });
    await screen.findByText(verify.banner);

    auth.failNextWith = 'too-many-requests';
    await fireEvent.press(button(verify.resend));

    expect(await screen.findByText(verify.failed)).toBeTruthy();
  });

  it('no hay aviso si el email ya está verificado ni para quien entra con Google o Apple', async () => {
    const verified = new FakeAuthService({ initialUser: authUser({ emailVerified: true }) });
    await renderSessionApp({ auth: verified, backend: new FakeBackend({ registered: true }) });
    await screen.findByText(es.explore.empty.title);
    expect(screen.queryByText(verify.banner)).toBeNull();
  });

  it('no pide verificar a quien entra con un proveedor externo', async () => {
    const social = new FakeAuthService({
      initialUser: authUser({ emailVerified: false, hasPassword: false }),
    });
    await renderSessionApp({ auth: social, backend: new FakeBackend({ registered: true }) });

    await screen.findByText(es.explore.empty.title);
    expect(screen.queryByText(verify.banner)).toBeNull();
  });

  it('Scenario: Recuperar la contraseña', async () => {
    const auth = new FakeAuthService();
    auth.addAccount(EMAIL, PASSWORD);
    await renderSessionApp({ auth, backend: new FakeBackend() });
    await openAccess(welcome.signIn);

    // Con una cuenta que existe...
    await fireEvent.press(screen.getByRole('link', { name: access.forgotPassword }));
    await fireEvent.changeText(await screen.findByLabelText(access.email), EMAIL);
    await fireEvent.press(button(forgot.submit));
    const existing = await screen.findByText(forgot.sent);
    expect(existing).toBeTruthy();

    // ...y con una que no existe, el mensaje es exactamente el mismo
    await fireEvent.changeText(screen.getByLabelText(access.email), 'nadie@example.com');
    await fireEvent.press(button(forgot.submit));
    await waitFor(() => {
      expect(auth.passwordResets).toEqual([EMAIL, 'nadie@example.com']);
    });
    await waitFor(() => {
      expect(screen.getAllByText(forgot.sent)).toHaveLength(1);
    });
  });

  it('recuperar la contraseña con un email mal escrito lo indica y no envía nada', async () => {
    const auth = new FakeAuthService();
    await renderSessionApp({ auth, backend: new FakeBackend() });
    await openAccess(welcome.signIn);
    await fireEvent.press(screen.getByRole('link', { name: access.forgotPassword }));

    await fireEvent.changeText(await screen.findByLabelText(access.email), 'sin-arroba');
    await fireEvent.press(button(forgot.submit));

    expect(await screen.findByText(errors.emailInvalid)).toBeTruthy();
    expect(auth.passwordResets).toEqual([]);
    expect(screen.queryByText(forgot.sent)).toBeNull();
  });

  it('un fallo de red al recuperar la contraseña se explica y no se confirma el envío', async () => {
    const auth = new FakeAuthService();
    await renderSessionApp({ auth, backend: new FakeBackend() });
    await openAccess(welcome.signIn);
    await fireEvent.press(screen.getByRole('link', { name: access.forgotPassword }));

    await fireEvent.changeText(await screen.findByLabelText(access.email), EMAIL);
    auth.failNextWith = 'network';
    await fireEvent.press(button(forgot.submit));

    expect(await screen.findByText(errors.network)).toBeTruthy();
    expect(screen.queryByText(forgot.sent)).toBeNull();
  });

  it('desde la recuperación se vuelve al acceso', async () => {
    const view = await renderSessionApp({
      auth: new FakeAuthService(),
      backend: new FakeBackend(),
    });
    await openAccess(welcome.signIn);
    await fireEvent.press(screen.getByRole('link', { name: access.forgotPassword }));

    expect(view.getPathname()).toBe('/forgot-password');
    await fireEvent.press(await screen.findByRole('button', { name: forgot.backToSignIn }));

    await waitFor(() => {
      expect(view.getPathname()).toBe('/access');
    });
  });
});

describe('estado de la cuenta al abrir la app', () => {
  it('si no se puede consultar la cuenta se explica y se puede reintentar', async () => {
    const auth = new FakeAuthService({ initialUser: authUser() });
    const backend = new FakeBackend({ registered: true, profile: me() });
    backend.failNext = 'network';
    await renderSessionApp({ auth, backend });

    expect(await screen.findByRole('header', { name: es.session.error.title })).toBeTruthy();
    expect(screen.queryByText(welcome.title)).toBeNull();

    await fireEvent.press(button(es.session.error.retry));
    expect(await screen.findByText(es.explore.empty.title)).toBeTruthy();
  });

  it('si la API rechaza el token se vuelve a la bienvenida y se cierra la sesión local', async () => {
    const auth = new FakeAuthService({ initialUser: authUser() });
    const backend = new FakeBackend({ registered: true });
    backend.failNext = 'unauthorized';
    await renderSessionApp({ auth, backend });

    expect(await screen.findByText(welcome.title)).toBeTruthy();
    expect(auth.user).toBeNull();
  });
});

describe.each(THEME_NAMES)('tema %s', (name) => {
  it('la bienvenida, el acceso y el alta usan los tokens del tema', async () => {
    const { color } = themes[name];
    const auth = new FakeAuthService();
    await renderSessionApp({ auth, backend: new FakeBackend(), theme: name });

    expect(styleOf(await screen.findByText(welcome.title)).color).toBe(color.text);
    expect(styleOf(button(welcome.signUp)).backgroundColor).toBe(color.primary);

    await openAccess(welcome.signUp);
    expect(styleOf(screen.getByText(access.signUpTitle)).color).toBe(color.text);
    expect(styleOf(screen.getByLabelText(access.email)).borderColor).toBe(color.borderStrong);

    await fillCredentials('1234567@example.com', 'corta');
    await fireEvent.press(button(access.signUpSubmit));
    expect(styleOf(await screen.findByText(errors.passwordTooShort)).color).toBe(color.danger);
  });
});
