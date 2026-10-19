import { describe, expect, it } from 'vitest';

import { GooglePlaceResolver } from './google-place-resolver.js';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const DETAILS = {
  location: { latitude: 40.4254, longitude: -3.7058 },
  addressComponents: [
    { longText: '12', types: ['street_number'] },
    { longText: 'Universidad', types: ['sublocality_level_1', 'sublocality', 'political'] },
    { longText: 'Madrid', types: ['locality', 'political'] },
  ],
};
const SEARCH = { places: [{ location: { latitude: 40.4265, longitude: -3.7038 } }] };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** `fetch` de prueba: responde en orden y anota qué se pidió. */
function fakeFetch(...responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchFn: typeof fetch = (input, init) => {
    calls.push({
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });
    const next = queue.shift();
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next ?? new Response('{}', { status: 500 }));
  };
  return {
    calls,
    resolver: new GooglePlaceResolver({ apiKey: 'clave-de-servidor', fetch: fetchFn }),
  };
}

describe('GooglePlaceResolver', () => {
  it('Scenario: Ubicación por zona por defecto - resuelve el punto exacto, el barrio y su centro con la clave de servidor', async () => {
    const { calls, resolver } = fakeFetch(json(DETAILS), json(SEARCH));

    const location = await resolver.resolve('ChIJ-abc');

    expect(location).toEqual({
      exact: { lat: 40.4254, lng: -3.7058 },
      areaName: 'Universidad',
      areaCenter: { lat: 40.4265, lng: -3.7038 },
    });
    expect(calls[0]).toMatchObject({
      url: 'https://places.googleapis.com/v1/places/ChIJ-abc',
      method: 'GET',
      headers: { 'X-Goog-Api-Key': 'clave-de-servidor' },
    });
    expect(calls[1]).toMatchObject({
      url: 'https://places.googleapis.com/v1/places:searchText',
      method: 'POST',
      headers: { 'X-Goog-Api-Key': 'clave-de-servidor' },
    });
    expect(calls[1]?.body).toMatchObject({
      textQuery: 'Universidad, Madrid',
      maxResultCount: 1,
      locationBias: { circle: { center: { latitude: 40.4254, longitude: -3.7058 } } },
    });
  });

  it('codifica el identificador en la URL', async () => {
    const { calls, resolver } = fakeFetch(json(DETAILS), json(SEARCH));

    await resolver.resolve('a/b c');

    expect(calls[0]?.url).toBe('https://places.googleapis.com/v1/places/a%2Fb%20c');
  });

  it('usa el barrio si no hay subdivisión de distrito y la localidad si no hay barrio', async () => {
    const neighborhood = {
      ...DETAILS,
      addressComponents: [
        { longText: 'Las Letras', types: ['neighborhood'] },
        { longText: 'Madrid', types: ['locality'] },
      ],
    };
    const onlyLocality = {
      ...DETAILS,
      addressComponents: [{ longText: 'Getafe', types: ['locality', 'political'] }],
    };

    const first = await fakeFetch(json(neighborhood), json(SEARCH)).resolver.resolve('a');
    const second = await fakeFetch(json(onlyLocality), json(SEARCH)).resolver.resolve('b');

    expect(first?.areaName).toBe('Las Letras');
    expect(second?.areaName).toBe('Getafe');
  });

  it('Scenario: Dirección no reconocida - un lugar inexistente o mal formado no se resuelve', async () => {
    await expect(fakeFetch(json({}, 404)).resolver.resolve('x')).resolves.toBeNull();
    await expect(
      fakeFetch(json({ error: { message: 'Invalid place ID' } }, 400)).resolver.resolve('x'),
    ).resolves.toBeNull();
  });

  it('un 400 por una clave inválida es una avería, no una dirección no reconocida', async () => {
    const failure = fakeFetch(json({ error: { message: 'API key not valid.' } }, 400));

    await expect(failure.resolver.resolve('x')).rejects.toThrow('HTTP 400');
  });

  it('no se resuelve un lugar sin coordenadas o sin barrio ni localidad', async () => {
    const noLocation = { addressComponents: DETAILS.addressComponents };
    const noArea = {
      ...DETAILS,
      addressComponents: [{ longText: '12', types: ['street_number'] }],
    };

    await expect(fakeFetch(json(noLocation)).resolver.resolve('x')).resolves.toBeNull();
    await expect(fakeFetch(json(noArea)).resolver.resolve('x')).resolves.toBeNull();
  });

  it('sin centro del barrio no se cae al punto exacto: no se resuelve', async () => {
    await expect(fakeFetch(json(DETAILS), json({})).resolver.resolve('x')).resolves.toBeNull();
    await expect(
      fakeFetch(json(DETAILS), json({ places: [{}] })).resolver.resolve('x'),
    ).resolves.toBeNull();
  });

  it('un fallo del servicio es un error técnico, no una dirección no reconocida, y no revela la clave', async () => {
    const failing = fakeFetch(json({ error: 'cuota' }, 429));
    const failure = await failing.resolver.resolve('x').catch((error: unknown) => error);
    const searchFails = fakeFetch(json(DETAILS), json({}, 503));
    const searchFailure = await searchFails.resolver.resolve('x').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('429');
    expect((failure as Error).message).not.toContain('clave-de-servidor');
    expect((searchFailure as Error).message).toContain('503');
    await expect(fakeFetch(new Error('red caída')).resolver.resolve('x')).rejects.toThrow(
      'red caída',
    );
  });

  it('exige una clave', () => {
    expect(() => new GooglePlaceResolver({ apiKey: '' })).toThrow(/clave/);
  });
});
