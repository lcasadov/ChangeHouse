import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { testConfig } from '../../../test/fixtures.js';
import { createApi } from '../../bootstrap.js';

const APP_ORIGIN = 'https://app.test';
const SECOND_APP_ORIGIN = 'https://des.app.test';
const LANDING_ORIGIN = 'https://landing.test';

let app: FastifyInstance;
let close: () => Promise<void>;

beforeAll(() => {
  ({ app, close } = createApi(
    testConfig({ landingOrigin: LANDING_ORIGIN, appOrigins: [APP_ORIGIN, SECOND_APP_ORIGIN] }),
  ));
});

afterAll(async () => {
  await close();
});

function preflight(origin: string, method: string, headers: string) {
  return app.inject({
    method: 'OPTIONS',
    url: '/v1/me',
    headers: {
      origin,
      'access-control-request-method': method,
      'access-control-request-headers': headers,
    },
  });
}

describe('CORS de la app', () => {
  it.each([APP_ORIGIN, SECOND_APP_ORIGIN])(
    'concede a %s los métodos y las cabeceras que usa el cliente tipado',
    async (origin) => {
      const response = await preflight(
        origin,
        'PUT',
        'authorization,content-type,x-correlation-id',
      );

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(response.headers['access-control-allow-methods']).toContain(method);
      }
      expect(String(response.headers['access-control-allow-headers']).toLowerCase()).toEqual(
        expect.stringContaining('authorization'),
      );
    },
  );

  it('expone la cabecera de correlación a la app', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { origin: APP_ORIGIN },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
    expect(response.headers['access-control-expose-headers']).toContain('X-Correlation-Id');
  });

  it('no concede nada a un origen desconocido', async () => {
    const response = await preflight('https://otro.test', 'PUT', 'authorization');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('la landing sigue limitada a POST y sin Authorization', async () => {
    const response = await preflight(LANDING_ORIGIN, 'POST', 'content-type');

    expect(response.headers['access-control-allow-origin']).toBe(LANDING_ORIGIN);
    expect(response.headers['access-control-allow-methods']).toBe('POST, OPTIONS');
    expect(String(response.headers['access-control-allow-headers']).toLowerCase()).not.toContain(
      'authorization',
    );
  });
});
