import { createApiClient } from '../../api/client';
import { adminUser, FakeBackend, me } from '../../test-support/fake-backend';
import { completeHome } from '../../test-support/fake-homes';
import { storedReport } from '../../test-support/fake-reports';
import { AdminApiError } from './admin-api';
import { createHttpAdminApi, QUEUE_PAGE_SIZE } from './http-admin-api';

const ADMIN = me({ roles: ['admin'] });

function setup(backend: FakeBackend) {
  return createHttpAdminApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

const inReview = (day: number) =>
  completeHome({
    status: 'in_review',
    createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  });

async function failureOf(action: Promise<unknown>): Promise<AdminApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof AdminApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

describe('listPending', () => {
  it('pide la cola (GET /admin/homes?status=in_review) de la más antigua a la más reciente', async () => {
    const newer = inReview(12);
    const older = inReview(10);
    const backend = new FakeBackend({
      profile: ADMIN,
      homes: [newer, older, completeHome({ status: 'published' })],
    });

    const page = await setup(backend).listPending();

    expect(page.items.map((home) => home.id)).toEqual([older.id, newer.id]);
    expect(page.nextCursor).toBeNull();
    expect(backend.requests).toMatchObject([
      { method: 'GET', path: '/admin/homes', authorization: 'Bearer token' },
    ]);
    expect(new URLSearchParams(backend.requests[0]?.search).get('status')).toBe('in_review');
  });

  it('pagina por cursor: devuelve nextCursor y la página siguiente al pasarlo', async () => {
    const homes = Array.from({ length: 12 }, (_, index) => inReview(index + 1));
    const backend = new FakeBackend({ profile: ADMIN, homes });
    const api = setup(backend);

    const first = await api.listPending();
    const second = await api.listPending(first.nextCursor ?? undefined);

    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).not.toBeNull();
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((home) => home.id)).toEqual(
      homes.map((home) => home.id),
    );
    expect(new URLSearchParams(backend.requests[1]?.search).get('cursor')).toBe(first.nextCursor);
  });

  it('devuelve la cola vacía si no hay nada pendiente', async () => {
    const page = await setup(new FakeBackend({ profile: ADMIN })).listPending();

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend({ profile: ADMIN });
    backend.failNext = failure;

    expect(await failureOf(setup(backend).listPending())).toMatchObject({ kind });
  });

  it('sin rol de administración es forbidden (403)', async () => {
    const backend = new FakeBackend({ profile: me({ roles: ['owner'] }) });

    expect(await failureOf(setup(backend).listPending())).toMatchObject({ kind: 'forbidden' });
  });
});

describe('moderate', () => {
  it('aprobar envía POST /admin/homes/{id}/moderation con la decisión y devuelve la ficha publicada', async () => {
    const home = inReview(10);
    const backend = new FakeBackend({ profile: ADMIN, homes: [home] });

    const moderated = await setup(backend).moderate(home.id, { decision: 'approve' });

    expect(moderated).toMatchObject({ id: home.id, status: 'published' });
    expect(backend.requestsTo('POST', `/admin/homes/${home.id}/moderation`)).toMatchObject([
      { body: { decision: 'approve' } },
    ]);
  });

  it('rechazar envía el motivo y la vivienda vuelve a borrador con él', async () => {
    const home = inReview(10);
    const backend = new FakeBackend({ profile: ADMIN, homes: [home] });

    const moderated = await setup(backend).moderate(home.id, {
      decision: 'reject',
      reason: 'Faltan datos o son incoherentes',
    });

    expect(moderated).toMatchObject({
      status: 'draft',
      moderationNote: 'Faltan datos o son incoherentes',
    });
  });

  it('una vivienda que ya no está en revisión es conflict (409)', async () => {
    const home = completeHome({ status: 'published' });
    const backend = new FakeBackend({ profile: ADMIN, homes: [home] });

    expect(
      await failureOf(setup(backend).moderate(home.id, { decision: 'approve' })),
    ).toMatchObject({ kind: 'conflict' });
  });

  it('un rechazo sin motivo es invalid (400)', async () => {
    const home = inReview(10);
    const backend = new FakeBackend({ profile: ADMIN, homes: [home] });

    expect(
      await failureOf(setup(backend).moderate(home.id, { decision: 'reject', reason: ' ' })),
    ).toMatchObject({ kind: 'invalid' });
  });

  it('una vivienda que no existe es not-found (404)', async () => {
    const backend = new FakeBackend({ profile: ADMIN });

    expect(
      await failureOf(setup(backend).moderate('no-existe', { decision: 'approve' })),
    ).toMatchObject({ kind: 'not-found' });
  });

  it('sin respuesta del servidor es network', async () => {
    const home = inReview(10);
    const backend = new FakeBackend({ profile: ADMIN, homes: [home] });
    backend.failNext = 'network';

    expect(
      await failureOf(setup(backend).moderate(home.id, { decision: 'approve' })),
    ).toMatchObject({ kind: 'network' });
  });
});

describe('setUserSuspension', () => {
  const BETO = adminUser();

  it('Scenario: Suspender con motivo - envía la decisión con su motivo y devuelve el usuario actualizado', async () => {
    const backend = new FakeBackend({ profile: ADMIN, users: [BETO] });

    const user = await setup(backend).setUserSuspension(BETO.id, {
      suspended: true,
      reason: 'Fraude reiterado',
    });

    expect(user).toEqual({ ...BETO, suspended: true });
    expect(backend.requests).toMatchObject([
      {
        method: 'PUT',
        path: `/admin/users/${BETO.id}/suspension`,
        body: { suspended: true, reason: 'Fraude reiterado' },
      },
    ]);
  });

  it.each([
    ['inexistente', '0198f3a0-0000-7000-8000-00000000dead', 'not-found'],
    ['él mismo', ADMIN.id, 'cannot-suspend-self'],
  ] as const)('traduce el rechazo de un usuario %s a %s', async (_case, userId, kind) => {
    const backend = new FakeBackend({ profile: ADMIN, users: [BETO] });

    const failure = await failureOf(
      setup(backend).setUserSuspension(userId, { suspended: true, reason: 'Fraude' }),
    );

    expect(failure).toMatchObject({ kind });
  });

  it('suspender a otro admin se traduce a cannot-suspend-admin', async () => {
    const other = adminUser({ id: '0198f3a0-0000-7000-8000-0000000000c3', roles: ['admin'] });
    const backend = new FakeBackend({ profile: ADMIN, users: [other] });

    const failure = await failureOf(
      setup(backend).setUserSuspension(other.id, { suspended: true, reason: 'Fraude' }),
    );

    expect(failure).toMatchObject({ kind: 'cannot-suspend-admin' });
  });

  it('sin el rol admin es forbidden, y sin red es network', async () => {
    const forbidden = await failureOf(
      setup(new FakeBackend({ profile: me(), users: [BETO] })).setUserSuspension(BETO.id, {
        suspended: true,
        reason: 'Fraude',
      }),
    );
    const offline = new FakeBackend({ profile: ADMIN, users: [BETO] });
    offline.failNext = 'network';
    const network = await failureOf(
      setup(offline).setUserSuspension(BETO.id, { suspended: false, reason: 'Recurso' }),
    );

    expect(forbidden).toMatchObject({ kind: 'forbidden' });
    expect(network).toMatchObject({ kind: 'network' });
  });
});

describe('listReports', () => {
  it('pide las denuncias abiertas (GET /admin/reports?status=open), de la más antigua a la más reciente', async () => {
    const newer = storedReport({ createdAt: '2026-10-12T10:00:00.000Z' });
    const older = storedReport({ createdAt: '2026-10-10T10:00:00.000Z' });
    const done = storedReport({ status: 'resolved' });
    const backend = new FakeBackend({ profile: ADMIN });
    backend.reports.seed(newer, older, done);

    const page = await setup(backend).listReports();

    expect(page.items.map((report) => report.id)).toEqual([older.id, newer.id]);
    expect(page.nextCursor).toBeNull();
    expect(backend.requests).toMatchObject([
      { method: 'GET', path: '/admin/reports', authorization: 'Bearer token' },
    ]);
    expect(new URLSearchParams(backend.requests[0]?.search).get('status')).toBe('open');
  });

  it('pagina por cursor', async () => {
    const backend = new FakeBackend({ profile: ADMIN });
    backend.reports.seed(...Array.from({ length: QUEUE_PAGE_SIZE + 1 }, () => storedReport()));
    const api = setup(backend);

    const first = await api.listReports();
    const second = await api.listReports(first.nextCursor ?? undefined);

    expect(first.items).toHaveLength(QUEUE_PAGE_SIZE);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('traduce un rol insuficiente a «forbidden»', async () => {
    const backend = new FakeBackend({ profile: me({ roles: ['owner'] }) });

    expect(await failureOf(setup(backend).listReports())).toMatchObject({ kind: 'forbidden' });
  });
});

describe('resolveReport', () => {
  it('envía PATCH /admin/reports/{id} con la decisión y la nota', async () => {
    const report = storedReport();
    const backend = new FakeBackend({ profile: ADMIN });
    backend.reports.seed(report);

    const resolved = await setup(backend).resolveReport(report.id, {
      status: 'dismissed',
      resolution: 'Sin indicios',
    });

    expect(resolved).toMatchObject({
      id: report.id,
      status: 'dismissed',
      resolution: 'Sin indicios',
    });
    expect(backend.requests).toMatchObject([
      {
        method: 'PATCH',
        path: `/admin/reports/${report.id}`,
        body: { status: 'dismissed', resolution: 'Sin indicios' },
      },
    ]);
  });

  it('traduce una denuncia inexistente a «not-found»', async () => {
    const backend = new FakeBackend({ profile: ADMIN });

    expect(
      await failureOf(
        setup(backend).resolveReport('no-existe', { status: 'resolved', resolution: 'x' }),
      ),
    ).toMatchObject({ kind: 'not-found' });
  });

  it('traduce una denuncia ya cerrada a «conflict»', async () => {
    const report = storedReport({ status: 'resolved' });
    const backend = new FakeBackend({ profile: ADMIN });
    backend.reports.seed(report);

    expect(
      await failureOf(
        setup(backend).resolveReport(report.id, { status: 'resolved', resolution: 'x' }),
      ),
    ).toMatchObject({ kind: 'conflict' });
  });
});
