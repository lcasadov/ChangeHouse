import { createApiClient } from '../../api/client';
import { FakeBackend, me } from '../../test-support/fake-backend';
import { discoveryCard } from '../../test-support/fake-discovery';
import { completeHome } from '../../test-support/fake-homes';
import { DecisionApiError } from './discovery-api';
import { createHttpDiscoveryApi } from './http-discovery-api';

function setup(backend: FakeBackend) {
  return createHttpDiscoveryApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

async function failureOf(action: Promise<unknown>): Promise<DecisionApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof DecisionApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

const published = () => completeHome({ status: 'published' });

function ownerBackend() {
  const home = published();
  const card = discoveryCard();
  const backend = new FakeBackend({
    profile: me({ roles: ['owner'] }),
    homes: [home],
    discoveryCards: [card],
  });
  return { backend, home, card };
}

describe('like', () => {
  it('registra el me gusta desde la vivienda propia (POST /me/likes) y devuelve el resultado', async () => {
    const { backend, home, card } = ownerBackend();

    const result = await setup(backend).like({ fromHomeId: home.id, targetHomeId: card.id });

    expect(result).toEqual({ liked: true, match: null });
    expect(backend.requestsTo('POST', '/me/likes')).toMatchObject([
      { authorization: 'Bearer token', body: { fromHomeId: home.id, targetHomeId: card.id } },
    ]);
    expect(backend.decisions.actions).toEqual([
      { kind: 'like', fromHomeId: home.id, targetHomeId: card.id },
    ]);
  });

  it.each([
    [{ status: 403, extra: {} }, 'forbidden'],
    [{ status: 404, extra: {} }, 'not-found'],
    [{ status: 409, extra: { code: 'HOME_NOT_PUBLISHED' } }, 'home-not-published'],
    [{ status: 409, extra: { code: 'LIKE_EXISTS' } }, 'already-liked'],
    [{ status: 409, extra: { code: 'OTRO' } }, 'server'],
    [{ status: 400, extra: {} }, 'invalid'],
    [{ status: 401, extra: {} }, 'unauthorized'],
    [{ status: 500, extra: {} }, 'server'],
  ] as const)('traduce la respuesta %j a %s', async (rejection, kind) => {
    const { backend, home, card } = ownerBackend();
    backend.decisions.rejectNext('like', rejection.status, rejection.extra);

    expect(
      await failureOf(setup(backend).like({ fromHomeId: home.id, targetHomeId: card.id })),
    ).toMatchObject({ kind });
  });

  it('el límite diario (429) trae los segundos hasta que vuelve el cupo (Retry-After)', async () => {
    const { backend, home, card } = ownerBackend();
    backend.decisions.rejectNext(
      'like',
      429,
      { code: 'DAILY_LIKE_LIMIT' },
      { 'retry-after': '7200' },
    );

    expect(
      await failureOf(setup(backend).like({ fromHomeId: home.id, targetHomeId: card.id })),
    ).toMatchObject({ kind: 'daily-limit', retryAfterSeconds: 7200 });
  });

  it('un 429 sin una cabecera Retry-After válida sigue siendo el límite diario, sin segundos', async () => {
    const { backend, home, card } = ownerBackend();
    backend.decisions.rejectNext('like', 429, {}, { 'retry-after': 'pronto' });

    const failure = await failureOf(
      setup(backend).like({ fromHomeId: home.id, targetHomeId: card.id }),
    );

    expect(failure).toMatchObject({ kind: 'daily-limit', retryAfterSeconds: undefined });
  });

  it('un fallo de red es network', async () => {
    const { backend, home, card } = ownerBackend();
    backend.failNext = 'network';

    expect(
      await failureOf(setup(backend).like({ fromHomeId: home.id, targetHomeId: card.id })),
    ).toMatchObject({ kind: 'network' });
  });
});

describe('dismiss', () => {
  it('un propietario descarta desde su vivienda (POST /me/dismissals con fromHomeId)', async () => {
    const { backend, home, card } = ownerBackend();

    await setup(backend).dismiss({ fromHomeId: home.id, targetHomeId: card.id });

    expect(backend.requestsTo('POST', '/me/dismissals')[0]?.body).toEqual({
      fromHomeId: home.id,
      targetHomeId: card.id,
    });
  });

  it('un buscador descarta desde su cuenta: la petición no lleva fromHomeId', async () => {
    const card = discoveryCard();
    const backend = new FakeBackend({ discoveryCards: [card] });

    await setup(backend).dismiss({ targetHomeId: card.id });

    expect(backend.requestsTo('POST', '/me/dismissals')[0]?.body).toEqual({
      targetHomeId: card.id,
    });
    expect(backend.decisions.actions).toEqual([
      { kind: 'dismiss', fromHomeId: null, targetHomeId: card.id },
    ]);
  });

  it.each([
    [{ status: 400, extra: { code: 'HOME_ID_REQUIRED' } }, 'invalid'],
    [{ status: 403, extra: {} }, 'forbidden'],
    [{ status: 404, extra: {} }, 'not-found'],
    [{ status: 500, extra: {} }, 'server'],
  ] as const)('traduce la respuesta %j a %s', async (rejection, kind) => {
    const backend = new FakeBackend();
    backend.decisions.rejectNext('dismiss', rejection.status, rejection.extra);

    expect(await failureOf(setup(backend).dismiss({ targetHomeId: 'x' }))).toMatchObject({
      kind,
    });
  });

  it('un fallo de red es network', async () => {
    const backend = new FakeBackend();
    backend.failNext = 'network';

    expect(await failureOf(setup(backend).dismiss({ targetHomeId: 'x' }))).toMatchObject({
      kind: 'network',
    });
  });
});

describe('undo', () => {
  it('deshace la última acción de la vivienda (DELETE /me/last-action?homeId=…)', async () => {
    const { backend, home, card } = ownerBackend();
    const api = setup(backend);
    await api.dismiss({ fromHomeId: home.id, targetHomeId: card.id });

    await api.undo({ homeId: home.id });

    expect(backend.requestsTo('DELETE', '/me/last-action')[0]?.search).toBe(`?homeId=${home.id}`);
    expect(backend.decisions.actions).toEqual([]);
  });

  it('un buscador deshace desde su cuenta: sin parámetros', async () => {
    const card = discoveryCard();
    const backend = new FakeBackend({ discoveryCards: [card] });
    const api = setup(backend);
    await api.dismiss({ targetHomeId: card.id });

    await api.undo({});

    expect(backend.requestsTo('DELETE', '/me/last-action')[0]?.search).toBeUndefined();
  });

  it.each([
    [{ status: 404, extra: {} }, 'not-found'],
    [{ status: 409, extra: { code: 'LIKE_IN_MATCH' } }, 'like-in-match'],
    [{ status: 409, extra: { code: 'OTRO' } }, 'server'],
    [{ status: 400, extra: { code: 'HOME_ID_REQUIRED' } }, 'invalid'],
    [{ status: 500, extra: {} }, 'server'],
  ] as const)('traduce la respuesta %j a %s', async (rejection, kind) => {
    const backend = new FakeBackend();
    backend.decisions.rejectNext('undo', rejection.status, rejection.extra);

    expect(await failureOf(setup(backend).undo({}))).toMatchObject({ kind });
  });

  it('un fallo de red es network', async () => {
    const backend = new FakeBackend();
    backend.failNext = 'network';

    expect(await failureOf(setup(backend).undo({}))).toMatchObject({ kind: 'network' });
  });
});
