import { createApiClient } from '../../api/client';
import { FakeBackend, me } from '../../test-support/fake-backend';
import { createHttpModerationApi } from './http-moderation-api';
import { ModerationApiError } from './moderation-api';

const HOME_ID = '0198f3a0-cccc-7000-8000-000000000001';
const USER_ID = '0198f3a0-0000-7000-8000-0000000000bb';

function setup(backend: FakeBackend) {
  return createHttpModerationApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

async function failureOf(action: Promise<unknown>): Promise<ModerationApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof ModerationApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

describe('report', () => {
  it('envía POST /reports con el objetivo y el motivo', async () => {
    const backend = new FakeBackend({ profile: me() });

    await setup(backend).report({ type: 'home', id: HOME_ID }, 'Anuncio falso');

    expect(backend.requests).toMatchObject([
      {
        method: 'POST',
        path: '/reports',
        authorization: 'Bearer token',
        body: { targetType: 'home', targetId: HOME_ID, reason: 'Anuncio falso' },
      },
    ]);
  });

  it.each([
    [404, 'not-found'],
    [429, 'rate-limited'],
    [400, 'invalid'],
    [401, 'unauthorized'],
    [500, 'server'],
  ] as const)('traduce el estado %s a «%s»', async (status, kind) => {
    const backend = new FakeBackend({ profile: me() });
    if (status === 404) backend.reports.missing.add(HOME_ID);
    if (status === 429) backend.reports.rateLimited = true;
    if (status === 400) backend.failNext = 'invalid';
    if (status === 401) backend.failNext = 'unauthorized';
    if (status === 500) backend.failNext = 'server';

    const failure = await failureOf(setup(backend).report({ type: 'home', id: HOME_ID }, 'Motivo'));

    expect(failure).toMatchObject({ kind });
  });

  it('normaliza la caída de red', async () => {
    const backend = new FakeBackend({ profile: me() });
    backend.failNext = 'network';

    expect(
      await failureOf(setup(backend).report({ type: 'user', id: USER_ID }, 'Motivo')),
    ).toMatchObject({
      kind: 'network',
    });
  });
});

describe('block', () => {
  it('envía POST /me/blocked-users con el usuario y resuelve con 204', async () => {
    const backend = new FakeBackend({ profile: me() });

    await setup(backend).block(USER_ID);

    expect(backend.requests).toMatchObject([
      { method: 'POST', path: '/me/blocked-users', body: { userId: USER_ID } },
    ]);
    expect(backend.reports.blocked).toEqual([USER_ID]);
  });

  it('traduce un usuario inexistente a «not-found»', async () => {
    const backend = new FakeBackend({ profile: me() });
    backend.reports.missing.add(USER_ID);

    expect(await failureOf(setup(backend).block(USER_ID))).toMatchObject({ kind: 'not-found' });
  });
});
