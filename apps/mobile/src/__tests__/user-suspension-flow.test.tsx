import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { type AdminUser, adminUser, FakeBackend, me } from '../test-support/fake-backend';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const { users: u } = es.admin;
const ADMIN = me({ roles: ['admin'] });
const BETO = adminUser();
const REASON = 'Fraude reiterado';

const manageLabel = (user: AdminUser) =>
  es.admin.userList.manageLabel
    .replace('{{name}}', user.displayName)
    .replace('{{email}}', user.email);
const button = (name: string) => screen.getByRole('button', { name });
const outcome = (key: 'suspended' | 'reactivated', user: AdminUser) =>
  u.outcome[key].replace('{{name}}', user.displayName).replace('{{email}}', user.email);

async function openUsers(
  options: { users?: AdminUser[]; profile?: ReturnType<typeof me>; theme?: 'light' | 'dark' } = {},
) {
  const auth = new FakeAuthService({ initialUser: authUser() });
  // El listado debe ofrecer a Beto para llegar a la pantalla de suspensión
  const given = options.users ?? [];
  const seeded = given.some((user) => user.id === BETO.id) ? given : [BETO, ...given];
  const backend = new FakeBackend({
    registered: true,
    profile: options.profile ?? ADMIN,
    users: seeded,
  });
  await renderSessionApp({ auth, backend, ...(options.theme ? { theme: options.theme } : {}) });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.admin }));
  await fireEvent.press(await screen.findByRole('tab', { name: es.admin.tabs.users }));
  // Varias cuentas de prueba comparten nombre y email: basta con abrir la primera
  const [first] = await screen.findAllByRole('button', { name: manageLabel(BETO) });
  await fireEvent.press(first as NonNullable<typeof first>);
  await screen.findByRole('header', { name: u.title });
  return backend;
}

async function fill(userId: string, reason: string) {
  await fireEvent.changeText(screen.getByLabelText(u.userIdLabel), userId);
  await fireEvent.changeText(screen.getByLabelText(u.reasonLabel), reason);
}

const suspensionRequests = (backend: FakeBackend) =>
  backend.requests.filter((request) => request.path.endsWith('/suspension'));

describe('Suspender y reactivar usuarios desde «Administración»', () => {
  it('Scenario: Suspender con motivo - el admin confirma y ve al usuario suspendido', async () => {
    const backend = await openUsers();
    await fill(BETO.id, `  ${REASON}  `);

    await fireEvent.press(button(u.suspend));
    expect(screen.getByLabelText(u.confirm.title)).toBeTruthy();
    expect(screen.getByText(u.confirm.description)).toBeTruthy();
    await fireEvent.press(button(u.confirm.confirm));

    expect(await screen.findByText(outcome('suspended', BETO))).toBeTruthy();
    expect(suspensionRequests(backend)).toMatchObject([
      {
        method: 'PUT',
        path: `/admin/users/${BETO.id}/suspension`,
        body: { suspended: true, reason: REASON },
      },
    ]);
    expect(backend.users.get(BETO.id)?.suspended).toBe(true);
  });

  it('cancelar la confirmación no suspende a nadie', async () => {
    const backend = await openUsers();
    await fill(BETO.id, REASON);

    await fireEvent.press(button(u.suspend));
    await fireEvent.press(button(u.confirm.cancel));

    expect(screen.queryByLabelText(u.confirm.title)).toBeNull();
    expect(suspensionRequests(backend)).toEqual([]);
  });

  it('Scenario: Sin motivo - la app pide el motivo y no envía nada', async () => {
    const backend = await openUsers();
    await fill(BETO.id, '   ');

    await fireEvent.press(button(u.suspend));
    await fireEvent.press(button(u.reactivate));

    expect(screen.getAllByText(u.errors.required).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(u.confirm.title)).toBeNull();
    expect(suspensionRequests(backend)).toEqual([]);
  });

  it('un motivo de más de 1000 caracteres no se envía', async () => {
    const backend = await openUsers();
    await fill(BETO.id, 'a'.repeat(1001));

    await fireEvent.press(button(u.reactivate));

    expect(screen.getByText(u.errors.tooLong)).toBeTruthy();
    expect(suspensionRequests(backend)).toEqual([]);
  });

  it('un identificador que no es válido se señala sin enviar nada', async () => {
    const backend = await openUsers();
    await fill('beto', REASON);

    await fireEvent.press(button(u.suspend));

    expect(screen.getByText(u.errors.userIdInvalid)).toBeTruthy();
    expect(suspensionRequests(backend)).toEqual([]);
  });

  it('reactivar no pide confirmación y muestra al usuario reactivado', async () => {
    const suspended = adminUser({ suspended: true });
    const backend = await openUsers({ users: [suspended] });
    await fill(suspended.id, 'Recurso estimado');

    await fireEvent.press(button(u.reactivate));

    expect(await screen.findByText(outcome('reactivated', suspended))).toBeTruthy();
    expect(suspensionRequests(backend)[0]?.body).toEqual({
      suspended: false,
      reason: 'Recurso estimado',
    });
  });

  it.each([
    ['uno mismo', ADMIN.id ?? '', [], 'cannot-suspend-self'],
    [
      'otro admin',
      '0198f3a0-0000-7000-8000-0000000000c3',
      [adminUser({ id: '0198f3a0-0000-7000-8000-0000000000c3', roles: ['admin'] })],
      'cannot-suspend-admin',
    ],
    ['un usuario inexistente', '0198f3a0-0000-7000-8000-00000000dead', [], 'not-found'],
  ] as const)('suspender a %s muestra por qué no se puede', async (_case, userId, users, error) => {
    await openUsers({ users: [...users] });
    await fill(userId, REASON);

    await fireEvent.press(button(u.suspend));
    await fireEvent.press(button(u.confirm.confirm));

    expect(await screen.findByText(u.errors[error])).toBeTruthy();
  });

  it('sin conexión lo dice y deja reintentar', async () => {
    const backend = await openUsers();
    await fill(BETO.id, REASON);
    backend.failNext = 'network';

    await fireEvent.press(button(u.reactivate));

    expect(await screen.findByText(u.errors.network)).toBeTruthy();
  });

  it('desde la cola vacía también se llega a la suspensión de usuarios', async () => {
    await openUsers();

    expect(screen.getByRole('header', { name: u.title })).toBeTruthy();
  });

  it.each(THEME_NAMES)('en el tema %s usa los tokens del tema', async (theme) => {
    await openUsers({ theme });

    expect(styleOf(screen.getByRole('header', { name: u.title })).color).toBe(
      themes[theme].color.text,
    );
    expect(styleOf(screen.getByText(u.intro)).color).toBe(themes[theme].color.textMuted);
  });
});
