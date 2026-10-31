import { createApiClient } from '../../api/client';
import { auditEntry, metrics, waitlistEntry } from '../../test-support/fake-admin-panel';
import { adminUser, FakeBackend, me } from '../../test-support/fake-backend';
import { AdminApiError } from './admin-api';
import { createHttpAdminApi } from './http-admin-api';

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

async function failureOf(action: Promise<unknown>): Promise<AdminApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof AdminApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

const queryOf = (backend: FakeBackend) => new URLSearchParams(backend.requests[0]?.search);

describe('getMetrics', () => {
  it('pide las métricas del periodo (GET /admin/metrics?from&to)', async () => {
    const backend = new FakeBackend({ profile: ADMIN });
    backend.adminPanel.metrics = metrics({ signups: 5 });

    const result = await setup(backend).getMetrics({ from: '2026-10-01', to: '2026-10-31' });

    expect(result.signups).toBe(5);
    expect(backend.requests).toMatchObject([{ method: 'GET', path: '/admin/metrics' }]);
    expect(queryOf(backend).get('from')).toBe('2026-10-01');
    expect(queryOf(backend).get('to')).toBe('2026-10-31');
  });

  it('un periodo invertido (400) se traduce a «invalid»', async () => {
    const backend = new FakeBackend({ profile: ADMIN });

    const error = await failureOf(
      setup(backend).getMetrics({ from: '2026-10-31', to: '2026-10-01' }),
    );

    expect(error).toMatchObject({ kind: 'invalid' });
  });

  it('sin el rol admin (403) se traduce a «forbidden»', async () => {
    const backend = new FakeBackend({ profile: me() });

    expect(await failureOf(setup(backend).getMetrics({ from: 'a', to: 'b' }))).toMatchObject({
      kind: 'forbidden',
    });
  });

  it('sin respuesta se traduce a «network»', async () => {
    const api = createHttpAdminApi(
      createApiClient({
        baseUrl: 'https://api.test',
        getToken: () => Promise.resolve('token'),
        fetch: () => Promise.reject(new Error('caído')),
      }),
    );

    expect(await failureOf(api.getMetrics({ from: 'a', to: 'b' }))).toMatchObject({
      kind: 'network',
    });
  });
});

describe('listUsers', () => {
  const ana = adminUser({ id: '0198f3a0-0000-7000-8000-0000000000a1', email: 'ana@example.com' });
  const beto = adminUser();

  it('busca por texto (GET /admin/users?q=…) y lista el estado', async () => {
    const backend = new FakeBackend({ profile: ADMIN, users: [ana, beto] });

    const page = await setup(backend).listUsers({ q: 'ana@' });

    expect(page.items.map((user) => user.email)).toEqual(['ana@example.com']);
    expect(page.nextCursor).toBeNull();
    expect(queryOf(backend).get('q')).toBe('ana@');
  });

  it('sin búsqueda no envía «q» y pagina por cursor', async () => {
    const users = Array.from({ length: 12 }, (_, index) =>
      adminUser({
        id: `0198f3a0-0000-7000-8000-${String(index).padStart(12, '0')}`,
        email: `u${String(index)}@example.com`,
      }),
    );
    const backend = new FakeBackend({ profile: ADMIN, users });
    const api = setup(backend);

    const first = await api.listUsers({});
    const second = await api.listUsers({ cursor: first.nextCursor ?? undefined });

    expect(queryOf(backend).has('q')).toBe(false);
    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });
});

describe('listAuditLog', () => {
  it('lista la auditoría del más reciente al más antiguo', async () => {
    const backend = new FakeBackend({ profile: ADMIN });
    const older = auditEntry({ at: '2026-10-01T10:00:00.000Z' });
    const newer = auditEntry({ at: '2026-10-09T10:00:00.000Z' });
    backend.adminPanel.audit.push(older, newer);

    const page = await setup(backend).listAuditLog();

    expect(page.items.map((entry) => entry.id)).toEqual([newer.id, older.id]);
    expect(backend.requests).toMatchObject([{ method: 'GET', path: '/admin/audit-log' }]);
  });
});

describe('listWaitlist y exportWaitlist', () => {
  it('filtra por municipio (GET /admin/waitlist?municipality=…)', async () => {
    const backend = new FakeBackend({ profile: ADMIN });
    backend.adminPanel.waitlist.push(
      waitlistEntry({ municipality: 'Madrid' }),
      waitlistEntry({ municipality: 'Getafe' }),
    );

    const page = await setup(backend).listWaitlist({ municipality: 'Getafe' });

    expect(page.items.map((entry) => entry.municipality)).toEqual(['Getafe']);
    expect(queryOf(backend).get('municipality')).toBe('Getafe');
  });

  it('exporta el CSV pidiéndolo con «Accept: text/csv»', async () => {
    const backend = new FakeBackend({ profile: ADMIN });
    backend.adminPanel.waitlist.push(waitlistEntry({ email: 'a@example.com' }));

    const csv = await setup(backend).exportWaitlist();

    expect(csv).toContain('a@example.com');
    expect(backend.requests).toMatchObject([
      { method: 'GET', path: '/admin/waitlist', accept: 'text/csv' },
    ]);
  });

  it('exporta solo el municipio filtrado', async () => {
    const backend = new FakeBackend({ profile: ADMIN });
    backend.adminPanel.waitlist.push(
      waitlistEntry({ email: 'm@example.com', municipality: 'Madrid' }),
      waitlistEntry({ email: 'g@example.com', municipality: 'Getafe' }),
    );

    const csv = await setup(backend).exportWaitlist('Getafe');

    expect(csv).toContain('g@example.com');
    expect(csv).not.toContain('m@example.com');
    expect(queryOf(backend).get('municipality')).toBe('Getafe');
  });

  it('sin el rol admin (403) la exportación falla con «forbidden»', async () => {
    const backend = new FakeBackend({ profile: me({ roles: ['owner'] }) });

    expect(await failureOf(setup(backend).exportWaitlist())).toMatchObject({ kind: 'forbidden' });
  });
});
