import { createApiClient } from '../../api/client';
import { FakeBackend } from '../../test-support/fake-backend';
import { completeHome } from '../../test-support/fake-homes';
import { createHttpSearchPreferencesApi } from './http-search-preferences-api';
import { type SearchPreferences, SearchPreferencesApiError } from './search-preferences-api';

function setup(backend: FakeBackend) {
  return createHttpSearchPreferencesApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

const MADRID: SearchPreferences = {
  municipalities: ['Madrid'],
  maxToPayCents: 3_000_000,
  minToReceiveCents: 0,
  valueReferencePct: 50,
};

async function failureOf(action: Promise<unknown>): Promise<SearchPreferencesApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof SearchPreferencesApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

describe('getMine', () => {
  it('devuelve las preferencias guardadas (GET /me/search-preferences)', async () => {
    const backend = new FakeBackend({ searchPreferences: { ...MADRID, valueReferencePct: 50 } });

    expect(await setup(backend).getMine()).toMatchObject(MADRID);
    expect(backend.requests).toMatchObject([
      { method: 'GET', path: '/me/search-preferences', authorization: 'Bearer token' },
    ]);
  });

  it('devuelve null si aún no hay ninguna (404)', async () => {
    expect(await setup(new FakeBackend({ searchPreferences: null })).getMine()).toBeNull();
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend();
    backend.failNext = failure;

    expect(await failureOf(setup(backend).getMine())).toMatchObject({ kind });
  });
});

describe('putMine', () => {
  it('guarda el documento entero (PUT /me/search-preferences) y devuelve lo guardado', async () => {
    const backend = new FakeBackend({ searchPreferences: null });

    const sent = { ...MADRID, valueReferencePct: 70 };

    const saved = await setup(backend).putMine(sent);

    expect(saved).toMatchObject(sent);
    expect(backend.requestsTo('PUT', '/me/search-preferences')[0]?.body).toMatchObject(sent);
    expect(backend.searchPreferences.mine).toMatchObject(sent);
  });

  it('sin zona responde 422 SEARCH_PREFERENCES_INCOMPLETE: «incomplete» con el campo de la zona', async () => {
    const backend = new FakeBackend({ searchPreferences: null });
    backend.searchPreferences.rejectNextPut(422, {
      code: 'SEARCH_PREFERENCES_INCOMPLETE',
      errors: [{ field: 'municipalities', message: 'required' }],
    });

    expect(await failureOf(setup(backend).putMine(MADRID))).toMatchObject({
      kind: 'incomplete',
      fields: ['municipalities'],
    });
  });

  it('un 400 conserva los campos señalados', async () => {
    const backend = new FakeBackend();
    backend.searchPreferences.rejectNextPut(400, {
      errors: [{ field: 'valueReferencePct', message: 'invalid' }],
    });

    expect(await failureOf(setup(backend).putMine(MADRID))).toMatchObject({
      kind: 'invalid',
      fields: ['valueReferencePct'],
    });
  });

  it.each([
    [401, 'unauthorized'],
    [404, 'not-found'],
    [500, 'server'],
  ] as const)('un %s es «%s»', async (status, kind) => {
    const backend = new FakeBackend();
    backend.searchPreferences.rejectNextPut(status);

    expect(await failureOf(setup(backend).putMine(MADRID))).toMatchObject({ kind });
  });

  it('un 422 con otro código es «invalid»', async () => {
    const backend = new FakeBackend();
    backend.searchPreferences.rejectNextPut(422, { code: 'OTRO' });

    expect(await failureOf(setup(backend).putMine(MADRID))).toMatchObject({ kind: 'invalid' });
  });
});

describe('preferencias de una vivienda', () => {
  const home = completeHome();

  it('getForHome devuelve null si la vivienda no tiene propias (404)', async () => {
    const backend = new FakeBackend({ homes: [home] });

    expect(await setup(backend).getForHome(home.id)).toBeNull();
    expect(backend.requests[0]?.path).toBe(`/homes/${home.id}/search-preferences`);
  });

  it('putForHome las define y getForHome las devuelve', async () => {
    const backend = new FakeBackend({ homes: [home] });
    const api = setup(backend);

    await api.putForHome(home.id, { ...MADRID, municipalities: ['Valencia'] });

    expect(await api.getForHome(home.id)).toMatchObject({ municipalities: ['Valencia'] });
    expect(backend.searchPreferences.mine).toMatchObject({ municipalities: ['Getafe'] });
  });

  it('putForHome de una vivienda ajena es «not-found»', async () => {
    expect(await failureOf(setup(new FakeBackend()).putForHome('otra', MADRID))).toMatchObject({
      kind: 'not-found',
    });
  });

  it('deleteForHome las elimina (DELETE) y es inocuo si no había propias', async () => {
    const backend = new FakeBackend({ homes: [home] });
    const api = setup(backend);
    await api.putForHome(home.id, MADRID);

    await api.deleteForHome(home.id);
    await api.deleteForHome(home.id);

    expect(await api.getForHome(home.id)).toBeNull();
    expect(backend.requestsTo('DELETE', `/homes/${home.id}/search-preferences`)).toHaveLength(2);
  });

  it('deleteForHome propaga un fallo del servidor', async () => {
    const backend = new FakeBackend({ homes: [home] });
    backend.failNext = 'server';

    expect(await failureOf(setup(backend).deleteForHome(home.id))).toMatchObject({
      kind: 'server',
    });
  });
});
