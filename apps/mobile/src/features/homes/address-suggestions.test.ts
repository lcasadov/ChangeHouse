import { FIXTURE_PLACES } from '@changehouse/shared';

import { createAddressSuggestions } from './create-address-suggestions';
import { createFixtureAddressSuggestions } from './fixture-address-suggestions';
import { createGoogleAddressSuggestions } from './google-address-suggestions';

describe('sugerencias de prueba (sin clave de Google)', () => {
  const suggestions = createFixtureAddressSuggestions();

  it('ofrece los lugares de prueba cuyo texto contiene lo escrito, sin distinguir mayúsculas ni tildes', async () => {
    expect(await suggestions.suggest('calle del pez')).toEqual([
      { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12, 28004 Madrid, España' },
    ]);
    expect(await suggestions.suggest('ALCALA')).toMatchObject([{ placeId: 'fixture-alcala' }]);
    expect(await suggestions.suggest('alcalá')).toMatchObject([{ placeId: 'fixture-alcala' }]);
  });

  it('también encuentra por el nombre del barrio', async () => {
    expect(await suggestions.suggest('lavapiés')).toMatchObject([{ placeId: 'fixture-lavapies' }]);
  });

  it('lo que se parece a varios lugares los devuelve todos', async () => {
    expect((await suggestions.suggest('madrid')).length).toBeGreaterThan(1);
    expect(await suggestions.suggest('Calle')).toHaveLength(FIXTURE_PLACES.length);
  });

  it('sin coincidencias devuelve una lista vacía', async () => {
    expect(await suggestions.suggest('zzzz')).toEqual([]);
  });

  it('cerrar la sesión no hace nada', () => {
    expect(() => {
      suggestions.endSession();
    }).not.toThrow();
  });
});

describe('autocompletado de Google Places', () => {
  const places = {
    suggestions: [
      { placePrediction: { placeId: 'abc', text: { text: 'Calle Mayor, 1, Madrid, España' } } },
      { queryPrediction: { text: { text: 'consulta' } } },
      { placePrediction: { placeId: 'def', text: { text: 'Calle Mayor, 2, Madrid, España' } } },
    ],
  };

  function setup(response: Response | Error = Response.json(places)) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchSpy = jest.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response.clone());
    });
    let tokens = 0;
    const adapter = createGoogleAddressSuggestions({
      apiKey: 'clave-de-prueba',
      fetch: fetchSpy,
      newSessionToken: () => `sesion-${String((tokens += 1))}`,
    });
    return { adapter, calls };
  }

  it('pide el autocompletado con la clave, la sesión y los resultados en español de España', async () => {
    const { adapter, calls } = setup();

    const result = await adapter.suggest('calle mayor');

    expect(result).toEqual([
      { placeId: 'abc', formatted: 'Calle Mayor, 1, Madrid, España' },
      { placeId: 'def', formatted: 'Calle Mayor, 2, Madrid, España' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toMatchObject({ 'X-Goog-Api-Key': 'clave-de-prueba' });
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      input: 'calle mayor',
      sessionToken: 'sesion-1',
      languageCode: 'es',
      includedRegionCodes: ['es'],
    });
  });

  it('mantiene la sesión durante la búsqueda y la renueva al elegir una sugerencia', async () => {
    const { adapter, calls } = setup();

    await adapter.suggest('cal');
    await adapter.suggest('calle');
    adapter.endSession();
    await adapter.suggest('calle mayor');

    const sessions = calls.map(
      (call) => (JSON.parse(call.init.body as string) as { sessionToken: string }).sessionToken,
    );
    expect(sessions).toEqual(['sesion-1', 'sesion-1', 'sesion-2']);
  });

  it('una respuesta sin sugerencias es una lista vacía', async () => {
    const { adapter } = setup(Response.json({}));

    expect(await adapter.suggest('zzzz')).toEqual([]);
  });

  it('una respuesta de error rechaza para que la interfaz lo explique', async () => {
    const { adapter } = setup(new Response('{}', { status: 403 }));

    await expect(adapter.suggest('calle')).rejects.toThrow();
  });

  it('un fallo de red rechaza', async () => {
    const { adapter } = setup(new TypeError('Failed to fetch'));

    await expect(adapter.suggest('calle')).rejects.toThrow();
  });
});

describe('createAddressSuggestions', () => {
  it('sin clave usa los lugares de prueba', async () => {
    const adapter = createAddressSuggestions({});

    expect(await adapter.suggest('malasaña')).toMatchObject([{ placeId: 'fixture-malasana' }]);
  });

  it('una clave en blanco también cuenta como sin clave', async () => {
    const adapter = createAddressSuggestions({ EXPO_PUBLIC_GOOGLE_PLACES_KEY: '  ' });

    expect(await adapter.suggest('malasaña')).toMatchObject([{ placeId: 'fixture-malasana' }]);
  });

  it('con clave usa Google Places', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}));
    const adapter = createAddressSuggestions({ EXPO_PUBLIC_GOOGLE_PLACES_KEY: 'clave' });

    await adapter.suggest('calle');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:autocomplete',
      expect.anything(),
    );
    fetchSpy.mockRestore();
  });
});
