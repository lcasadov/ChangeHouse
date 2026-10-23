import { fireEvent, screen } from '@testing-library/react-native';

import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import { renderSessionApp } from '../test-support/render-session-app';
import { THEME_NAMES } from '../test-utils';

const { profile } = es;

const button = (name: string) => screen.getByRole('button', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const field = (label: string) => screen.getByLabelText(label);

const SAVED_PROFILE = me({
  displayName: 'Ana',
  municipality: 'Madrid',
  phone: '+34600111222',
  meetsVppRequirements: false,
  isOver65: false,
});

/** Una persona dada de alta que abre la pestaña «Perfil». */
async function openProfile(
  options: { backend?: FakeBackend; auth?: FakeAuthService; theme?: 'light' | 'dark' } = {},
) {
  const auth = options.auth ?? new FakeAuthService({ initialUser: authUser() });
  const backend = options.backend ?? new FakeBackend({ registered: true, profile: SAVED_PROFILE });
  const view = await renderSessionApp({
    auth,
    backend,
    ...(options.theme ? { theme: options.theme } : {}),
  });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.profile }));
  await screen.findByRole('header', { name: profile.title });
  return { auth, backend, view };
}

describe('Edición del perfil', () => {
  it('muestra la ficha con los datos guardados y avisa de que el teléfono es privado', async () => {
    await openProfile({
      backend: new FakeBackend({
        registered: true,
        profile: me({ ...SAVED_PROFILE, meetsVppRequirements: true }),
      }),
    });

    expect(field(profile.form.displayName).props.value).toBe('Ana');
    expect(field(profile.form.municipality).props.value).toBe('Madrid');
    expect(field(profile.form.phone).props.value).toBe('+34600111222');
    expect(checkbox(profile.form.meetsVppRequirements).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(checkbox(profile.form.isOver65).props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(screen.getByText(profile.email.replace('{{email}}', 'ana@example.com'))).toBeTruthy();
    expect(screen.getByText(profile.form.phoneHint)).toBeTruthy();
  });

  it('Scenario: Detalle de una VPPL - la declaración de cumplir los requisitos de vivienda protegida se explica junto a la casilla', async () => {
    await openProfile();

    expect(screen.getByText(profile.form.meetsVppRequirementsHint)).toBeTruthy();
  });

  it('un perfil sin municipio ni teléfono muestra los campos vacíos', async () => {
    await openProfile({
      backend: new FakeBackend({ registered: true, profile: me({ displayName: 'Beto' }) }),
    });

    expect(field(profile.form.municipality).props.value).toBe('');
    expect(field(profile.form.phone).props.value).toBe('');
  });

  it('Scenario: Guardar cambios del perfil', async () => {
    const { auth, backend } = await openProfile();

    await fireEvent.changeText(field(profile.form.municipality), '  Getafe ');
    await fireEvent.press(checkbox(profile.form.meetsVppRequirements));
    await fireEvent.press(button(profile.form.submit));

    // Se anuncia la confirmación
    const confirmation = await screen.findByText(profile.saved);
    expect(confirmation).toBeTruthy();
    expect(screen.getByRole('alert', { name: profile.saved })).toBeTruthy();
    const [put, ...others] = backend.requestsTo('PUT', '/me');
    expect(others).toEqual([]);
    expect(put).toMatchObject({
      authorization: 'Bearer token-de-prueba',
      body: {
        displayName: 'Ana',
        municipality: 'Getafe',
        phone: '+34600111222',
        meetsVppRequirements: true,
        isOver65: false,
      },
    });
    // Al volver a abrir el perfil (otra apertura de la app) aparecen los nuevos valores
    await screen.unmount();
    await renderSessionApp({ auth, backend });
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.profile }));
    await screen.findByRole('header', { name: profile.title });
    expect(field(profile.form.municipality).props.value).toBe('Getafe');
    expect(checkbox(profile.form.meetsVppRequirements).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('un municipio en blanco se envía en blanco para borrarlo y un teléfono en blanco se omite', async () => {
    const { backend } = await openProfile({
      backend: new FakeBackend({ registered: true, profile: me({ displayName: 'Ana' }) }),
    });

    await fireEvent.changeText(field(profile.form.municipality), '   ');
    await fireEvent.changeText(field(profile.form.phone), '  ');
    await fireEvent.press(checkbox(profile.form.isOver65));
    await fireEvent.press(button(profile.form.submit));

    await screen.findByText(profile.saved);
    expect(backend.requestsTo('PUT', '/me')[0]?.body).toEqual({
      displayName: 'Ana',
      municipality: '',
      meetsVppRequirements: false,
      isOver65: true,
    });
  });

  it('la confirmación desaparece en cuanto se vuelve a editar', async () => {
    await openProfile();
    await fireEvent.press(button(profile.form.submit));
    await screen.findByText(profile.saved);

    await fireEvent.changeText(field(profile.form.municipality), 'Leganés');

    expect(screen.queryByText(profile.saved)).toBeNull();
  });

  it('Scenario: Nombre visible vacío - el error sale junto al campo y no se guarda nada', async () => {
    const { backend } = await openProfile();

    await fireEvent.changeText(field(profile.form.displayName), '   ');
    await fireEvent.press(button(profile.form.submit));

    expect(await screen.findByText(profile.errors.displayNameRequired)).toBeTruthy();
    expect(screen.queryByText(profile.saved)).toBeNull();
    expect(backend.requestsTo('PUT', '/me')).toEqual([]);
  });

  it('Scenario: Nombre visible vacío - más de 60 caracteres también se rechaza', async () => {
    const { backend } = await openProfile();

    await fireEvent.changeText(field(profile.form.displayName), 'a'.repeat(61));
    await fireEvent.press(button(profile.form.submit));

    expect(await screen.findByText(profile.errors.displayNameTooLong)).toBeTruthy();
    expect(screen.queryByText(profile.errors.displayNameRequired)).toBeNull();
    expect(backend.requestsTo('PUT', '/me')).toEqual([]);
  });

  it('el error del nombre se muestra al salir del campo, sin esperar al envío, y se quita al corregirlo', async () => {
    await openProfile();

    await fireEvent.changeText(field(profile.form.displayName), '');
    expect(screen.queryByText(profile.errors.displayNameRequired)).toBeNull();
    await fireEvent(field(profile.form.displayName), 'blur');
    expect(await screen.findByText(profile.errors.displayNameRequired)).toBeTruthy();

    await fireEvent.changeText(field(profile.form.displayName), 'Ana');

    expect(screen.queryByText(profile.errors.displayNameRequired)).toBeNull();
  });

  it.each(['612345678', '+0612345678', '+34612abc678', '0034612345678'])(
    'Scenario: Teléfono con formato no válido - %s muestra el error con un ejemplo y no se guarda',
    async (phone) => {
      const { backend } = await openProfile();

      await fireEvent.changeText(field(profile.form.phone), phone);
      await fireEvent.press(button(profile.form.submit));

      const error = await screen.findByText(profile.errors.phoneInvalid);
      expect(error).toBeTruthy();
      expect(profile.errors.phoneInvalid).toContain('+34612345678');
      expect(field(profile.form.phone).props.accessibilityHint).toBe(profile.errors.phoneInvalid);
      expect(backend.requestsTo('PUT', '/me')).toEqual([]);
    },
  );

  it('un teléfono escrito con espacios o guiones se envía en formato internacional', async () => {
    const { backend } = await openProfile();

    await fireEvent.changeText(field(profile.form.phone), '+34 612-345 678');
    await fireEvent.press(button(profile.form.submit));

    await screen.findByText(profile.saved);
    expect(backend.requestsTo('PUT', '/me')[0]?.body).toMatchObject({ phone: '+34612345678' });
  });

  it('señala a la vez todos los campos erróneos', async () => {
    await openProfile();

    await fireEvent.changeText(field(profile.form.displayName), '');
    await fireEvent.changeText(field(profile.form.municipality), 'm'.repeat(121));
    await fireEvent.changeText(field(profile.form.phone), 'abc');
    await fireEvent.press(button(profile.form.submit));

    expect(await screen.findByText(profile.errors.displayNameRequired)).toBeTruthy();
    expect(screen.getByText(profile.errors.municipalityTooLong)).toBeTruthy();
    expect(screen.getByText(profile.errors.phoneInvalid)).toBeTruthy();
  });

  it('bloquea el reenvío mientras se guarda: una sola petición aunque se pulse dos veces', async () => {
    const { backend } = await openProfile();
    await fireEvent.changeText(field(profile.form.municipality), 'Getafe');

    const release = backend.hold();
    await fireEvent.press(button(profile.form.submit));
    await fireEvent.press(button(profile.form.submit));
    expect(button(profile.form.submit).props.accessibilityState).toMatchObject({ busy: true });
    release();

    await screen.findByText(profile.saved);
    expect(backend.requestsTo('PUT', '/me')).toHaveLength(1);
  });

  it('un fallo de red se explica, conserva lo escrito y permite reintentar', async () => {
    const { backend } = await openProfile();
    await fireEvent.changeText(field(profile.form.municipality), 'Getafe');

    backend.failNext = 'network';
    await fireEvent.press(button(profile.form.submit));
    expect(await screen.findByText(profile.errors.network)).toBeTruthy();
    expect(field(profile.form.municipality).props.value).toBe('Getafe');
    expect(screen.queryByText(profile.saved)).toBeNull();

    await fireEvent.press(button(profile.form.submit));
    expect(await screen.findByText(profile.saved)).toBeTruthy();
    expect(screen.queryByText(profile.errors.network)).toBeNull();
  });

  it.each([
    ['server', profile.errors.unknown],
    ['invalid', profile.errors.invalid],
  ] as const)(
    'un fallo %s del servidor se explica sin detalles internos',
    async (failure, message) => {
      const { backend } = await openProfile();

      backend.failNext = failure;
      await fireEvent.press(button(profile.form.submit));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.queryByText(/500|corr-1|displayName/)).toBeNull();
    },
  );

  describe('cerrar sesión', () => {
    it('Scenario: Cerrar sesión desde el perfil', async () => {
      const { auth } = await openProfile();

      await fireEvent.press(button(es.auth.signOut));
      // Pide confirmación antes de cerrar
      expect(await screen.findByText(profile.signOut.title)).toBeTruthy();
      expect(screen.getByText(profile.signOut.description)).toBeTruthy();
      expect(auth.user).not.toBeNull();
      await fireEvent.press(button(profile.signOut.confirm));

      // Vuelve a la bienvenida y las pestañas dejan de ser accesibles
      expect(await screen.findByText(es.auth.welcome.title)).toBeTruthy();
      expect(auth.user).toBeNull();
      expect(screen.queryByRole('button', { name: es.tabs.profile })).toBeNull();
    });

    it('Scenario: Cerrar sesión desde el perfil - cancelar la confirmación mantiene la sesión', async () => {
      const { auth } = await openProfile();

      await fireEvent.press(button(es.auth.signOut));
      await fireEvent.press(await screen.findByRole('button', { name: profile.signOut.cancel }));

      expect(screen.queryByText(profile.signOut.title)).toBeNull();
      expect(auth.user).not.toBeNull();
      expect(auth.signOutCalls).toBe(0);
      expect(screen.getByRole('header', { name: profile.title })).toBeTruthy();
    });
  });

  describe.each(THEME_NAMES)('tema %s', (theme) => {
    it('muestra el formulario y la confirmación de cierre de sesión', async () => {
      await openProfile({ theme });

      expect(field(profile.form.displayName)).toBeTruthy();
      await fireEvent.press(button(es.auth.signOut));
      expect(await screen.findByText(profile.signOut.title)).toBeTruthy();
    });
  });
});
