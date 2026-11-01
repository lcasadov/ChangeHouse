import { createApiClient } from '../../api/client';
import { FakeBackend, me } from '../../test-support/fake-backend';
import { completeHome } from '../../test-support/fake-homes';
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

const THEIR_HOME = '0198f3a0-dddd-7000-8000-000000000001';

/** Un backend donde el usuario participa en un match con la vivienda de otra persona. */
function withMatch(overrides: Partial<Parameters<typeof fakeMatch>[0]> = {}) {
  const home = completeHome({ status: 'published' });
  const match = fakeMatch({ mineHomeId: home.id, theirHomeId: THEIR_HOME, ...overrides });
  const backend = new FakeBackend({ profile: owner, homes: [home], matches: [match] });
  return { backend, api: setup(backend), match, home };
}

describe('get', () => {
  it('pide el detalle con el token y devuelve el match con sus viviendas y direcciones', async () => {
    const { backend, api, match } = withMatch();

    const detail = await api.get(match.id);

    expect(detail.id).toBe(match.id);
    expect(detail.participants.every((participant) => participant.exactAddress)).toBe(true);
    expect(backend.requestsTo('GET', `/matches/${match.id}`)).toMatchObject([
      { authorization: 'Bearer token' },
    ]);
  });

  it('un match ajeno o inexistente es not-found', async () => {
    const { api } = withMatch();

    expect(await failureOf(api.get('0198f3a0-eeee-7000-8000-000000000009'))).toMatchObject({
      kind: 'not-found',
    });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [500, 'server'],
  ] as const)('traduce el estado %d a %s', async (status, kind) => {
    const { backend, api, match } = withMatch();
    backend.matches.rejectNextAction(status);

    expect(await failureOf(api.get(match.id))).toMatchObject({ kind });
  });

  it('un fallo de red se normaliza a network', async () => {
    const { backend, api, match } = withMatch();
    backend.failNext = 'network';

    expect(await failureOf(api.get(match.id))).toMatchObject({ kind: 'network' });
  });
});

describe('confirm', () => {
  it('confirma y devuelve el match con mi estado confirmado', async () => {
    const { backend, api, match, home } = withMatch();

    const updated = await api.confirm(match.id);

    expect(updated.status).toBe('open');
    expect(updated.participants.find((p) => p.homeId === home.id)?.status).toBe('confirmed');
    expect(backend.requestsTo('POST', `/matches/${match.id}/confirm`)).toHaveLength(1);
  });

  it('con el otro ya confirmado el match pasa a confirmed', async () => {
    const { api, match } = withMatch({ theirStatus: 'confirmed' });

    expect((await api.confirm(match.id)).status).toBe('confirmed');
  });

  it('un match cerrado responde not-open (409 MATCH_NOT_OPEN)', async () => {
    const { api, match } = withMatch({ status: 'closed' });

    expect(await failureOf(api.confirm(match.id))).toMatchObject({ kind: 'not-open' });
  });

  it('un 409 sin el código del contrato se trata como un fallo del servidor', async () => {
    const { backend, api, match } = withMatch();
    backend.matches.rejectNextAction(409);

    expect(await failureOf(api.confirm(match.id))).toMatchObject({ kind: 'server' });
  });

  it('un match inexistente es not-found', async () => {
    const { api } = withMatch();

    expect(await failureOf(api.confirm('0198f3a0-eeee-7000-8000-000000000009'))).toMatchObject({
      kind: 'not-found',
    });
  });

  it('un fallo de red se normaliza a network', async () => {
    const { backend, api, match } = withMatch();
    backend.failNext = 'network';

    expect(await failureOf(api.confirm(match.id))).toMatchObject({ kind: 'network' });
  });
});

describe('withdraw', () => {
  it('cierra el match para todos y deja mi estado en withdrawn', async () => {
    const { backend, api, match, home } = withMatch();

    const closed = await api.withdraw(match.id);

    expect(closed.status).toBe('closed');
    expect(closed.participants.find((p) => p.homeId === home.id)?.status).toBe('withdrawn');
    expect(backend.requestsTo('POST', `/matches/${match.id}/withdraw`)).toHaveLength(1);
  });

  it('un match ya cerrado responde not-open', async () => {
    const { api, match } = withMatch({ status: 'closed' });

    expect(await failureOf(api.withdraw(match.id))).toMatchObject({ kind: 'not-open' });
  });

  it('un fallo de red se normaliza a network', async () => {
    const { backend, api, match } = withMatch();
    backend.failNext = 'network';

    expect(await failureOf(api.withdraw(match.id))).toMatchObject({ kind: 'network' });
  });
});

describe('setPhoneSharing', () => {
  it('envía la preferencia en el cuerpo y no devuelve nada', async () => {
    const { backend, api, match } = withMatch();

    await expect(api.setPhoneSharing(match.id, true)).resolves.toBeUndefined();

    expect(backend.requestsTo('PUT', `/matches/${match.id}/phone-sharing`)).toMatchObject([
      { body: { share: true } },
    ]);
  });

  it('autorizar en un match cerrado responde not-open (409 MATCH_NOT_OPEN)', async () => {
    const { api, match } = withMatch({ status: 'closed' });

    expect(await failureOf(api.setPhoneSharing(match.id, true))).toMatchObject({
      kind: 'not-open',
    });
  });

  it('Scenario: Revocar en un match cerrado - la API acepta retirar la autorización en cualquier estado', async () => {
    const { api, match } = withMatch({ status: 'closed' });

    await expect(api.setPhoneSharing(match.id, false)).resolves.toBeUndefined();
  });

  it('un cuerpo no válido es invalid', async () => {
    const { backend, api, match } = withMatch();
    backend.matches.rejectNextAction(400);

    expect(await failureOf(api.setPhoneSharing(match.id, true))).toMatchObject({
      kind: 'invalid',
    });
  });

  it('un fallo de red se normaliza a network', async () => {
    const { backend, api, match } = withMatch();
    backend.failNext = 'network';

    expect(await failureOf(api.setPhoneSharing(match.id, true))).toMatchObject({
      kind: 'network',
    });
  });
});
