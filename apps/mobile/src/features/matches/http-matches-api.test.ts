import { createApiClient } from '../../api/client';
import { FakeBackend, me } from '../../test-support/fake-backend';
import { fakeMatch } from '../../test-support/fake-matches';
import { createHttpMatchesApi } from './http-matches-api';
import { MatchesApiError } from './matches-api';

function setup(backend: FakeBackend) {
  return createHttpMatchesApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

async function failureOf(action: Promise<unknown>): Promise<MatchesApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof MatchesApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

const owner = me({ roles: ['owner'] });

describe('list', () => {
  it('pide la primera página con el token y devuelve los matches con el cursor', async () => {
    const seed = [
      fakeMatch({ mineHomeId: 'a', theirHomeId: 'b', createdAt: '2026-10-18T10:00:00.000Z' }),
      fakeMatch({ mineHomeId: 'c', theirHomeId: 'd', createdAt: '2026-10-19T10:00:00.000Z' }),
    ];
    const backend = new FakeBackend({ profile: owner, matches: seed });
    backend.matches.pageSize = 1;

    const page = await setup(backend).list({});

    expect(page.items).toEqual([seed[1]]);
    expect(page.nextCursor).toBe('1');
    expect(backend.requestsTo('GET', '/matches')).toMatchObject([
      { authorization: 'Bearer token' },
    ]);
  });

  it('pide la página siguiente con el cursor y termina con nextCursor nulo', async () => {
    const seed = [
      fakeMatch({ mineHomeId: 'a', theirHomeId: 'b', createdAt: '2026-10-18T10:00:00.000Z' }),
      fakeMatch({ mineHomeId: 'c', theirHomeId: 'd', createdAt: '2026-10-19T10:00:00.000Z' }),
    ];
    const backend = new FakeBackend({ profile: owner, matches: seed });
    backend.matches.pageSize = 1;

    const page = await setup(backend).list({ cursor: '1' });

    expect(page.items).toEqual([seed[0]]);
    expect(page.nextCursor).toBeNull();
    expect(backend.requestsTo('GET', '/matches')[0]?.search).toBe('?cursor=1');
  });

  it('sin matches devuelve la lista vacía', async () => {
    const backend = new FakeBackend({ profile: owner });

    await expect(setup(backend).list({})).resolves.toEqual({ items: [], nextCursor: null });
  });

  it.each([
    [400, 'invalid'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [500, 'server'],
  ] as const)('traduce el estado %d a %s', async (status, kind) => {
    const backend = new FakeBackend({ profile: owner });
    backend.matches.rejectNext(status);

    expect(await failureOf(setup(backend).list({}))).toMatchObject({ kind });
  });

  it('un fallo de red se normaliza a network', async () => {
    const backend = new FakeBackend({ profile: owner });
    backend.failNext = 'network';

    expect(await failureOf(setup(backend).list({}))).toMatchObject({ kind: 'network' });
  });
});
