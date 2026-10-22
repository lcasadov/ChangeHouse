import { describe, expect, it, vi } from 'vitest';

import { submitWaitlist, type WaitlistValues } from './waitlist-api';

const values: WaitlistValues = {
  email: 'juan@example.com',
  municipality: 'Madrid',
  homeType: 'piso',
  lookingFor: 'Un ático con terraza',
  consent: true,
};

const API = 'https://api.test';

function respondWith(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers }),
    ),
  );
}

describe('submitWaitlist', () => {
  it('envía el alta como JSON a POST /waitlist de la API', async () => {
    const fetcher = respondWith(202);

    await submitWaitlist(values, { apiUrl: API, fetch: fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.test/waitlist');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(init?.body as string)).toEqual(values);
  });

  it('no duplica la barra si la URL base termina en /', async () => {
    const fetcher = respondWith(202);

    await submitWaitlist(values, { apiUrl: `${API}/`, fetch: fetcher });

    expect(fetcher.mock.calls[0]![0]).toBe('https://api.test/waitlist');
  });

  it('Scenario: Envío correcto - un 202 es un alta aceptada', async () => {
    const result = await submitWaitlist(values, { apiUrl: API, fetch: respondWith(202) });

    expect(result).toEqual({ kind: 'accepted' });
  });

  it('Scenario: Fallo de red o límite superado - un 429 es límite superado', async () => {
    const result = await submitWaitlist(values, {
      apiUrl: API,
      fetch: respondWith(429, { status: 429 }, { 'Retry-After': '120' }),
    });

    expect(result).toEqual({ kind: 'rate-limited' });
  });

  it('Scenario: Error de validación en un campo - un 400 devuelve los campos erróneos de la API', async () => {
    const result = await submitWaitlist(values, {
      apiUrl: API,
      fetch: respondWith(400, {
        status: 400,
        errors: [
          { field: 'email', message: 'invalid' },
          { field: 'municipality', message: 'required' },
          { field: 'lookingFor', message: 'algo-desconocido' },
        ],
      }),
    });

    expect(result).toEqual({
      kind: 'rejected',
      errors: [
        { field: 'email', code: 'invalid' },
        { field: 'municipality', code: 'required' },
        { field: 'lookingFor', code: 'invalid' },
      ],
    });
  });

  it('un 400 sin lista de errores no es un fallo de campo', async () => {
    const result = await submitWaitlist(values, { apiUrl: API, fetch: respondWith(400, {}) });

    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('Scenario: Fallo de red o límite superado - un error del servidor es servicio no disponible', async () => {
    const result = await submitWaitlist(values, { apiUrl: API, fetch: respondWith(500, {}) });

    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('Scenario: Fallo de red o límite superado - si la API no responde es servicio no disponible', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch')));

    const result = await submitWaitlist(values, { apiUrl: API, fetch: fetcher });

    expect(result).toEqual({ kind: 'unavailable' });
  });
});
