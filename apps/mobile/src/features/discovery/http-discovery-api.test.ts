import { createApiClient } from '../../api/client';
import { FakeBackend } from '../../test-support/fake-backend';
import { discoveryCard } from '../../test-support/fake-discovery';
import { completeHome } from '../../test-support/fake-homes';
import { DiscoveryApiError } from './discovery-api';
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

async function failureOf(action: Promise<unknown>): Promise<DiscoveryApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof DiscoveryApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

const published = (overrides = {}) => completeHome({ status: 'published', ...overrides });

describe('list', () => {
  it('pide la página con la vivienda y el cursor (GET /discover) y devuelve las tarjetas', async () => {
    const home = published();
    const cards = [discoveryCard(), discoveryCard(), discoveryCard()];
    const backend = new FakeBackend({ homes: [home], discoveryCards: cards });
    backend.discovery.pageSize = 2;
    const api = setup(backend);

    const first = await api.list({ homeId: home.id });
    const second = await api.list({ homeId: home.id, cursor: first.nextCursor ?? '' });

    expect(first.items.map((card) => card.id)).toEqual([cards[0]?.id, cards[1]?.id]);
    expect(second).toMatchObject({ items: [{ id: cards[2]?.id }], nextCursor: null });
    expect(backend.requestsTo('GET', '/discover')).toMatchObject([
      { authorization: 'Bearer token', search: `?homeId=${home.id}` },
      { search: `?homeId=${home.id}&cursor=${first.nextCursor ?? ''}` },
    ]);
  });

  it('sin vivienda ni cursor no envía parámetros', async () => {
    const backend = new FakeBackend({ discoveryCards: [discoveryCard()] });

    await setup(backend).list({});

    expect(backend.requestsTo('GET', '/discover')[0]?.search).toBeUndefined();
  });

  it.each([
    [{ status: 400, extra: { code: 'HOME_ID_REQUIRED' } }, 'home-required'],
    [{ status: 400, extra: {} }, 'invalid'],
    [{ status: 404, extra: {} }, 'not-found'],
    [{ status: 422, extra: { code: 'SEARCH_PREFERENCES_REQUIRED' } }, 'preferences-required'],
    [{ status: 422, extra: { code: 'OTRO' } }, 'server'],
    [{ status: 500, extra: {} }, 'server'],
  ] as const)('traduce la respuesta %j a %s', async (rejection, kind) => {
    const backend = new FakeBackend();
    backend.discovery.rejectNext(rejection.status, rejection.extra);

    expect(await failureOf(setup(backend).list({}))).toMatchObject({ kind });
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend();
    backend.failNext = failure;

    expect(await failureOf(setup(backend).list({}))).toMatchObject({ kind });
  });
});

describe('getPublicHome', () => {
  it('lee la forma pública de una vivienda ajena (GET /homes/{homeId})', async () => {
    const card = discoveryCard();
    const backend = new FakeBackend({ discoveryCards: [card] });

    const home = await setup(backend).getPublicHome(card.id);

    expect(home).toMatchObject({ id: card.id, location: { areaName: 'Lavapiés' } });
    expect(home).not.toHaveProperty('compensation');
  });

  it('nunca expone una dirección postal aunque el servidor la envíe', async () => {
    const card = discoveryCard();
    const backend = new FakeBackend({ discoveryCards: [card] });
    backend.discovery.leakAddressInDetail('Calle Secreta 1, 28012 Madrid');

    expect(await setup(backend).getPublicHome(card.id)).not.toHaveProperty('address');
  });

  it('una vivienda que no existe o no está publicada es not-found (404)', async () => {
    const backend = new FakeBackend();

    expect(await failureOf(setup(backend).getPublicHome('no-existe'))).toMatchObject({
      kind: 'not-found',
    });
  });

  it('traduce los fallos de red', async () => {
    const backend = new FakeBackend();
    backend.failNext = 'network';

    expect(await failureOf(setup(backend).getPublicHome('x'))).toMatchObject({ kind: 'network' });
  });
});
