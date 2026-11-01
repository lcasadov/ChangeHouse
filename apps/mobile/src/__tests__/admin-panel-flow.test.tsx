import { themes } from '@changehouse/ui';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { formatDate } from '../features/admin/format-date';
import es from '../i18n/locales/es-ES.json';
import {
  auditEntry,
  metrics,
  type WaitlistEntry,
  waitlistEntry,
} from '../test-support/fake-admin-panel';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { type AdminUser, adminUser, FakeBackend, me } from '../test-support/fake-backend';
import { FakeDataExporter } from '../test-support/fake-data-exporter';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const { tabs, metrics: mt, userList: ul, audit: au, waitlist: wl } = es.admin;
const ADMIN = me({ roles: ['admin'] });
const ANA = adminUser({
  id: '0198f3a0-0000-7000-8000-0000000000a1',
  email: 'ana@example.com',
  displayName: 'Ana Pérez',
});
const BETO = adminUser({ suspended: true });

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{{${key}}}`, String(value)),
    template,
  );
const manage = (user: AdminUser) =>
  fill(ul.manageLabel, { name: user.displayName, email: user.email });
const tab = (name: string) => screen.getByRole('tab', { name });
const button = (name: string) => screen.getByRole('button', { name });

interface TreeNode {
  props: Record<string, unknown>;
  children: unknown[];
}

/** Los nodos con `horizontal` (desplazamiento horizontal) bajo un nodo del árbol renderizado. */
function horizontalNodes(node: unknown): TreeNode[] {
  if (typeof node !== 'object' || node === null || !('props' in node)) return [];
  const current = node as TreeNode;
  const own = current.props['horizontal'] === true ? [current] : [];
  return [...own, ...current.children.flatMap(horizontalNodes)];
}

function setWidth(width: number) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
}

afterEach(() => {
  jest.restoreAllMocks();
});

interface Options {
  users?: AdminUser[];
  audit?: ReturnType<typeof auditEntry>[];
  waitlist?: WaitlistEntry[];
  theme?: 'light' | 'dark';
  exporter?: FakeDataExporter;
  section?: keyof typeof tabs;
}

async function openPanel({ section, ...options }: Options = {}) {
  const backend = new FakeBackend({
    registered: true,
    profile: ADMIN,
    users: options.users ?? [ANA, BETO],
  });
  backend.adminPanel.audit.push(...(options.audit ?? []));
  backend.adminPanel.waitlist.push(...(options.waitlist ?? []));
  await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    ...(options.theme ? { theme: options.theme } : {}),
    ...(options.exporter ? { dataExporter: options.exporter } : {}),
  });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.admin }));
  if (section) await fireEvent.press(await screen.findByRole('tab', { name: tabs[section] }));
  return backend;
}

describe('«Administración» con pestañas', () => {
  it('ofrece las seis secciones y Moderación es la activa', async () => {
    await openPanel();

    expect(await screen.findByLabelText(tabs.label)).toBeTruthy();
    for (const name of [
      tabs.moderation,
      tabs.reports,
      tabs.users,
      tabs.metrics,
      tabs.audit,
      tabs.waitlist,
    ]) {
      expect(tab(name)).toBeTruthy();
    }
    expect(tab(tabs.moderation).props.accessibilityState).toMatchObject({ selected: true });
    expect(tab(tabs.audit).props.accessibilityState).toMatchObject({ selected: false });
  });

  it('cambiar de pestaña muestra su sección y la marca como activa', async () => {
    await openPanel({ section: 'audit' });

    expect(await screen.findByRole('header', { name: au.title })).toBeTruthy();
    expect(tab(tabs.audit).props.accessibilityState).toMatchObject({ selected: true });
    expect(tab(tabs.moderation).props.accessibilityState).toMatchObject({ selected: false });
  });

  it.each(THEME_NAMES)('en el tema %s la pestaña activa usa los tokens del tema', async (theme) => {
    await openPanel({ theme });

    const active = await screen.findByRole('tab', { name: tabs.moderation });
    expect(styleOf(active).backgroundColor).toBe(themes[theme].color.primary);
  });
});

describe('Métricas del producto', () => {
  it('Scenario: Métricas de un mes - muestra los totales y las viviendas por zona', async () => {
    const backend = await openPanel({ section: 'metrics' });
    backend.adminPanel.metrics = metrics({
      signups: 42,
      likes: 120,
      matches: { direct: 9, chain: 4 },
      operations: 2,
    });

    await fireEvent.changeText(screen.getByLabelText(mt.from), '2026-10-01');
    await fireEvent.changeText(screen.getByLabelText(mt.to), '2026-10-31');
    await fireEvent.press(button(mt.submit));

    expect(
      await screen.findByLabelText(fill(mt.totalLabel, { label: mt.totals.signups, value: 42 })),
    ).toBeTruthy();
    for (const [label, value] of [
      [mt.totals.likes, 120],
      [mt.totals.direct, 9],
      [mt.totals.chain, 4],
      [mt.totals.operations, 2],
    ] as const) {
      expect(screen.getByLabelText(fill(mt.totalLabel, { label, value }))).toBeTruthy();
    }
    expect(screen.getByRole('header', { name: mt.zones.title })).toBeTruthy();
    expect(screen.getByText('Malasaña')).toBeTruthy();
    expect(screen.getByText('Chamberí')).toBeTruthy();
    const last = backend.requestsTo('GET', '/admin/metrics').at(-1);
    const query = new URLSearchParams(last?.search);
    expect(query.get('from')).toBe('2026-10-01');
    expect(query.get('to')).toBe('2026-10-31');
  });

  it('al abrirla pide el periodo por defecto (del día 1 del mes a hoy)', async () => {
    const backend = await openPanel({ section: 'metrics' });

    expect(await screen.findByRole('header', { name: mt.zones.title })).toBeTruthy();
    const query = new URLSearchParams(backend.requestsTo('GET', '/admin/metrics')[0]?.search);
    expect(query.get('from')).toMatch(/^\d{4}-\d{2}-01$/);
    expect(query.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Scenario: Periodo invertido - la API responde 400 y la app señala las fechas', async () => {
    const backend = await openPanel({ section: 'metrics' });
    await screen.findByRole('header', { name: mt.zones.title });

    await fireEvent.changeText(screen.getByLabelText(mt.from), '2026-10-31');
    await fireEvent.changeText(screen.getByLabelText(mt.to), '2026-10-01');
    await fireEvent.press(button(mt.submit));

    expect(await screen.findAllByText(mt.errors.range)).toHaveLength(2);
    expect(screen.queryByRole('header', { name: mt.zones.title })).toBeNull();
    expect(backend.requestsTo('GET', '/admin/metrics').length).toBeGreaterThan(1);
  });

  it('una fecha mal escrita se señala sin pedir nada al servidor', async () => {
    const backend = await openPanel({ section: 'metrics' });
    await screen.findByRole('header', { name: mt.zones.title });
    const before = backend.requestsTo('GET', '/admin/metrics').length;

    await fireEvent.changeText(screen.getByLabelText(mt.from), 'ayer');
    await fireEvent.press(button(mt.submit));

    expect(await screen.findByText(mt.errors.format)).toBeTruthy();
    expect(backend.requestsTo('GET', '/admin/metrics')).toHaveLength(before);
  });

  it('si no cargan lo explica y «Reintentar» las vuelve a pedir', async () => {
    const backend = new FakeBackend({ registered: true, profile: ADMIN });
    await renderSessionApp({
      auth: new FakeAuthService({ initialUser: authUser() }),
      backend,
    });
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.admin }));
    backend.failNext = 'server';
    await fireEvent.press(await screen.findByRole('tab', { name: tabs.metrics }));

    expect(await screen.findByText(mt.errors.loadFailed)).toBeTruthy();
    await fireEvent.press(button(mt.retry));

    expect(await screen.findByRole('header', { name: mt.zones.title })).toBeTruthy();
  });

  it('sin viviendas publicadas en el periodo lo dice', async () => {
    const backend = await openPanel();
    backend.adminPanel.metrics = metrics({ publishedHomesByZone: [] });
    await fireEvent.press(await screen.findByRole('tab', { name: tabs.metrics }));

    expect(await screen.findByText(mt.zones.empty)).toBeTruthy();
  });
});

describe('Gestión de usuarios', () => {
  it('Scenario: Buscar un usuario - aparece con su estado', async () => {
    const backend = await openPanel({ section: 'users' });
    await screen.findByLabelText(manage(ANA));

    await fireEvent.changeText(screen.getByLabelText(ul.searchLabel), 'ana@');
    await fireEvent.press(button(ul.search));

    expect(await screen.findByLabelText(manage(ANA))).toBeTruthy();
    expect(screen.queryByLabelText(manage(BETO))).toBeNull();
    expect(within(screen.getByTestId('data-row')).getByText(ul.status.active)).toBeTruthy();
    const last = backend.requestsTo('GET', '/admin/users').at(-1);
    expect(new URLSearchParams(last?.search).get('q')).toBe('ana@');
  });

  it('muestra el estado suspendido con texto, no solo con color', async () => {
    await openPanel({ section: 'users' });

    await screen.findByLabelText(manage(BETO));
    expect(screen.getByText(ul.status.suspended)).toBeTruthy();
    expect(screen.getByText(ul.status.active)).toBeTruthy();
  });

  it('una búsqueda sin coincidencias lo explica', async () => {
    await openPanel({ section: 'users' });
    await screen.findByLabelText(manage(ANA));

    await fireEvent.changeText(screen.getByLabelText(ul.searchLabel), 'nadie');
    await fireEvent.press(button(ul.search));

    expect(await screen.findByRole('header', { name: ul.empty.title })).toBeTruthy();
  });

  it('pagina: «Cargar más» añade la página siguiente', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      adminUser({
        id: `0198f3a0-0000-7000-8000-${String(index).padStart(12, '0')}`,
        email: `u${String(index).padStart(2, '0')}@example.com`,
        displayName: `Usuario ${String(index).padStart(2, '0')}`,
      }),
    );
    await openPanel({ section: 'users', users: many });
    await screen.findByLabelText(manage(many[0] as AdminUser));
    expect(screen.getAllByTestId('data-row')).toHaveLength(10);

    await fireEvent.press(button(ul.loadMore));

    expect(await screen.findByLabelText(manage(many[11] as AdminUser))).toBeTruthy();
    expect(screen.getAllByTestId('data-row')).toHaveLength(12);
    expect(screen.queryByRole('button', { name: ul.loadMore })).toBeNull();
  });

  it('el acceso a suspender lleva al usuario elegido y la lista refleja el cambio', async () => {
    const backend = await openPanel({ section: 'users' });
    await fireEvent.press(await screen.findByLabelText(manage(ANA)));

    const userId = await screen.findByLabelText(es.admin.users.userIdLabel);
    expect(userId.props.value).toBe(ANA.id);
    await fireEvent.changeText(screen.getByLabelText(es.admin.users.reasonLabel), 'Fraude');
    await fireEvent.press(button(es.admin.users.suspend));
    await fireEvent.press(button(es.admin.users.confirm.confirm));
    await screen.findByText(
      fill(es.admin.users.outcome.suspended, { name: ANA.displayName, email: ANA.email }),
    );
    await fireEvent.press(tab(tabs.users));

    expect(backend.users.get(ANA.id)?.suspended).toBe(true);
    expect(await screen.findAllByText(ul.status.suspended)).toHaveLength(2);
  });
});

describe('Consulta de la auditoría', () => {
  const entries = [
    auditEntry({ at: '2026-10-01T10:00:00.000Z', action: 'home.approved', entity: 'home' }),
    auditEntry({ at: '2026-10-09T10:00:00.000Z', action: 'user.suspended', entity: 'user' }),
  ];

  it('Scenario: Ver la auditoría - cada acción con autor, entidad y fecha, sin edición', async () => {
    await openPanel({ section: 'audit', audit: entries });

    const rows = await screen.findAllByTestId('data-row');
    expect(within(rows[0] as never).getByText('user.suspended')).toBeTruthy();
    expect(within(rows[0] as never).getByText('user')).toBeTruthy();
    expect(within(rows[0] as never).getByText(entries[1]?.actorId as string)).toBeTruthy();
    expect(within(rows[0] as never).getByText(formatDate('2026-10-09T10:00:00.000Z'))).toBeTruthy();
    expect(within(rows[1] as never).getByText('home.approved')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /editar|eliminar|borrar|modificar/i })).toBeNull();
  });

  it('una acción del sistema (sin autor, como la purga de retención) se muestra como «Sistema»', async () => {
    await openPanel({
      section: 'audit',
      audit: [auditEntry({ actorId: null, action: 'retention.purge', entity: 'chat' })],
    });

    const [row] = await screen.findAllByTestId('data-row');
    expect(within(row as never).getByText(au.systemActor)).toBeTruthy();
    expect(within(row as never).getByText('retention.purge')).toBeTruthy();
  });

  it('sin entradas lo dice', async () => {
    await openPanel({ section: 'audit' });

    expect(await screen.findByRole('header', { name: au.empty.title })).toBeTruthy();
  });

  it('pagina con «Cargar más»', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      auditEntry({ at: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z` }),
    );
    await openPanel({ section: 'audit', audit: many });
    await screen.findAllByTestId('data-row');
    expect(screen.getAllByTestId('data-row')).toHaveLength(10);

    await fireEvent.press(button(au.loadMore));

    await waitFor(() => {
      expect(screen.getAllByTestId('data-row')).toHaveLength(12);
    });
  });
});

describe('Lista de espera para el equipo', () => {
  const waiting = [
    waitlistEntry({ email: 'madrid@example.com', municipality: 'Madrid' }),
    waitlistEntry({ email: 'getafe@example.com', municipality: 'Getafe', homeType: 'chalet' }),
  ];

  it('lista las inscripciones y filtra por municipio', async () => {
    const backend = await openPanel({ section: 'waitlist', waitlist: waiting });
    expect(await screen.findByText('madrid@example.com')).toBeTruthy();
    expect(screen.getByText('getafe@example.com')).toBeTruthy();
    expect(screen.getByText(es.homes.type.chalet)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText(wl.municipalityLabel), 'Getafe');
    await fireEvent.press(button(wl.filter));

    await screen.findByText('getafe@example.com');
    expect(screen.queryByText('madrid@example.com')).toBeNull();
    const last = backend.requestsTo('GET', '/admin/waitlist').at(-1);
    expect(new URLSearchParams(last?.search).get('municipality')).toBe('Getafe');
  });

  it('Scenario: Exportar la lista de espera - pide el CSV y entrega el fichero', async () => {
    const exporter = new FakeDataExporter();
    const backend = await openPanel({ section: 'waitlist', waitlist: waiting, exporter });
    await screen.findByText('madrid@example.com');

    await fireEvent.press(button(wl.export));

    expect(await screen.findByText(fill(wl.exportDone, { filename: wl.filename }))).toBeTruthy();
    expect(backend.requestsTo('GET', '/admin/waitlist').at(-1)).toMatchObject({
      accept: 'text/csv',
    });
    expect(exporter.delivered).toHaveLength(1);
    expect(exporter.delivered[0]).toMatchObject({ filename: wl.filename, mimeType: 'text/csv' });
    expect(exporter.delivered[0]?.content).toContain('madrid@example.com');
    expect(exporter.delivered[0]?.content.split('\n')[0]).toBe(
      'email,municipality,homeType,lookingFor,consentAt',
    );
  });

  it('exporta solo el municipio filtrado', async () => {
    const exporter = new FakeDataExporter();
    await openPanel({ section: 'waitlist', waitlist: waiting, exporter });
    await screen.findByText('madrid@example.com');
    await fireEvent.changeText(screen.getByLabelText(wl.municipalityLabel), 'Getafe');
    await fireEvent.press(button(wl.filter));
    await screen.findByText('getafe@example.com');

    await fireEvent.press(button(wl.export));

    await screen.findByText(fill(wl.exportDone, { filename: wl.filename }));
    expect(exporter.delivered[0]?.content).toContain('getafe@example.com');
    expect(exporter.delivered[0]?.content).not.toContain('madrid@example.com');
  });

  it('si la entrega falla lo explica', async () => {
    const exporter = new FakeDataExporter();
    exporter.failNext = true;
    await openPanel({ section: 'waitlist', waitlist: waiting, exporter });
    await screen.findByText('madrid@example.com');

    await fireEvent.press(button(wl.export));

    expect(await screen.findByText(wl.exportFailed)).toBeTruthy();
  });

  it('sin inscripciones lo dice', async () => {
    await openPanel({ section: 'waitlist' });

    expect(await screen.findByRole('header', { name: wl.empty.title })).toBeTruthy();
  });
});

describe('Tablas y tarjetas según el ancho', () => {
  const horizontalScrolls = () => horizontalNodes(screen.root);

  it('Scenario: Pantalla de 375 px - la tabla de usuarios se presenta como tarjetas', async () => {
    setWidth(375);
    await openPanel({ section: 'users' });

    expect(await screen.findAllByTestId('data-card')).toHaveLength(2);
    expect(screen.queryByTestId('data-table')).toBeNull();
    expect(horizontalScrolls()).toHaveLength(0);
    const card = screen.getAllByTestId('data-card')[0] as never;
    expect(within(card).getByText(ANA.email)).toBeTruthy();
    expect(within(card).getByText(ul.status.active)).toBeTruthy();
  });

  it('en pantalla ancha los usuarios se presentan como tabla con cabeceras', async () => {
    setWidth(1280);
    await openPanel({ section: 'users' });

    expect(await screen.findByTestId('data-table')).toBeTruthy();
    expect(screen.queryByTestId('data-card')).toBeNull();
    expect(screen.getByText(ul.columns.email)).toBeTruthy();
    expect(screen.getAllByTestId('data-row')).toHaveLength(2);
  });

  it('la auditoría y la lista de espera también pasan a tarjetas a 375 px', async () => {
    setWidth(375);
    await openPanel({
      section: 'audit',
      audit: [auditEntry()],
      waitlist: [waitlistEntry()],
    });
    expect(await screen.findAllByTestId('data-card')).toHaveLength(1);
    expect(horizontalScrolls()).toHaveLength(0);

    await fireEvent.press(tab(tabs.waitlist));

    expect(await screen.findAllByTestId('data-card')).toHaveLength(1);
    expect(screen.queryByTestId('data-table')).toBeNull();
    expect(horizontalScrolls()).toHaveLength(0);
  });

  it.each(THEME_NAMES)('en el tema %s las tarjetas usan los tokens del tema', async (theme) => {
    setWidth(375);
    await openPanel({ section: 'users', theme });

    const card = (await screen.findAllByTestId('data-card'))[0] as never;
    expect(styleOf(card).backgroundColor).toBe(themes[theme].color.surface);
    expect(styleOf(card).borderColor).toBe(themes[theme].color.border);
  });
});
