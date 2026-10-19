import { createApiClient } from '../../api/client';
import { FakeBackend } from '../../test-support/fake-backend';
import { completeHome, draftHome } from '../../test-support/fake-homes';
import { type Home, HomesApiError } from './homes-api';
import { createHttpHomesApi } from './http-homes-api';

function setup(backend: FakeBackend) {
  return createHttpHomesApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

const ADDRESS = { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12' };

async function failureOf(action: Promise<unknown>): Promise<HomesApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof HomesApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

describe('listMine', () => {
  it('devuelve las viviendas propias (GET /me/homes)', async () => {
    const backend = new FakeBackend({ homes: [draftHome(), completeHome()] });

    const homes = await setup(backend).listMine();

    expect(homes).toHaveLength(2);
    expect(backend.requests).toMatchObject([
      { method: 'GET', path: '/me/homes', authorization: 'Bearer token' },
    ]);
  });

  it('devuelve una lista vacía si no hay viviendas', async () => {
    expect(await setup(new FakeBackend()).listMine()).toEqual([]);
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend();
    backend.failNext = failure;

    expect(await failureOf(setup(backend).listMine())).toMatchObject({ kind });
  });
});

describe('get', () => {
  it('devuelve la ficha completa de una vivienda propia (GET /homes/{id})', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });

    expect(await setup(backend).get(home.id)).toMatchObject({ id: home.id, status: 'draft' });
    expect(backend.requests).toMatchObject([{ method: 'GET', path: `/homes/${home.id}` }]);
  });

  it('una vivienda que no existe es not-found (404)', async () => {
    expect(await failureOf(setup(new FakeBackend()).get('no-existe'))).toMatchObject({
      kind: 'not-found',
    });
  });

  it('la forma pública de una vivienda ajena no es una ficha propia: not-found', async () => {
    const publicForm: Partial<Home> = completeHome();
    delete publicForm.status;
    delete publicForm.address;
    const api = createHttpHomesApi(
      createApiClient({
        baseUrl: 'https://api.test',
        getToken: () => Promise.resolve('token'),
        fetch: () =>
          Promise.resolve(
            new Response(JSON.stringify(publicForm), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      }),
    );

    expect(await failureOf(api.get('cualquiera'))).toMatchObject({ kind: 'not-found' });
  });
});

describe('create', () => {
  it('envía POST /homes con tipo y dirección y devuelve el borrador (201)', async () => {
    const backend = new FakeBackend();

    const home = await setup(backend).create({ type: 'piso', address: ADDRESS });

    expect(home).toMatchObject({ status: 'draft', type: 'piso' });
    expect(backend.requestsTo('POST', '/homes')).toMatchObject([
      { body: { type: 'piso', address: ADDRESS } },
    ]);
  });

  it('una dirección que el servidor no resuelve es address-not-resolved (422)', async () => {
    const failure = await failureOf(
      setup(new FakeBackend()).create({
        type: 'piso',
        address: { placeId: 'desconocido', formatted: 'Calle Inventada, 1' },
      }),
    );

    expect(failure).toMatchObject({ kind: 'address-not-resolved' });
  });

  it('un cuerpo rechazado (400) es invalid', async () => {
    const backend = new FakeBackend();
    backend.failNext = 'invalid';

    expect(
      await failureOf(setup(backend).create({ type: 'piso', address: ADDRESS })),
    ).toMatchObject({ kind: 'invalid' });
  });
});

describe('update', () => {
  it('envía PATCH /homes/{id} con el paso y devuelve la vivienda', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });

    const updated = await setup(backend).update(home.id, { bedrooms: 3, hasLift: true });

    expect(updated).toMatchObject({ bedrooms: 3, hasLift: true });
    expect(backend.requestsTo('PATCH', `/homes/${home.id}`)).toMatchObject([
      { body: { bedrooms: 3, hasLift: true } },
    ]);
  });

  it('un rango incoherente es invalid-value-range con los campos señalados (422)', async () => {
    const home = draftHome();

    const failure = await failureOf(
      setup(new FakeBackend({ homes: [home] })).update(home.id, {
        valueMinCents: 30_000_000,
        valueMaxCents: 25_000_000,
      }),
    );

    expect(failure).toMatchObject({
      kind: 'invalid-value-range',
      fields: ['valueMinCents', 'valueMaxCents'],
    });
  });

  it('una vivienda en operación es conflict (409)', async () => {
    const home = draftHome({ status: 'in_operation' });

    expect(
      await failureOf(setup(new FakeBackend({ homes: [home] })).update(home.id, { bedrooms: 1 })),
    ).toMatchObject({ kind: 'conflict' });
  });

  it('una vivienda ajena o inexistente es not-found (404)', async () => {
    expect(
      await failureOf(setup(new FakeBackend()).update('no-existe', { bedrooms: 1 })),
    ).toMatchObject({ kind: 'not-found' });
  });
});

describe('submit', () => {
  it('envía POST /homes/{id}/submit y devuelve la vivienda en revisión', async () => {
    const home = completeHome();
    const backend = new FakeBackend({ homes: [home] });

    const submitted = await setup(backend).submit(home.id);

    expect(submitted.status).toBe('in_review');
    expect(backend.requests).toMatchObject([{ method: 'POST', path: `/homes/${home.id}/submit` }]);
  });

  it('una ficha incompleta es incomplete con los campos que faltan (422)', async () => {
    const home = completeHome({ valueMinCents: null, valueMaxCents: null });

    const failure = await failureOf(setup(new FakeBackend({ homes: [home] })).submit(home.id));

    expect(failure).toMatchObject({
      kind: 'incomplete',
      fields: ['valueMinCents', 'valueMaxCents'],
    });
  });

  it('una vivienda que ya no es borrador es conflict (409)', async () => {
    const home = completeHome({ status: 'in_review' });

    expect(
      await failureOf(setup(new FakeBackend({ homes: [home] })).submit(home.id)),
    ).toMatchObject({
      kind: 'conflict',
    });
  });
});
