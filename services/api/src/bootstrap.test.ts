import { describe, expect, it } from 'vitest';

import { createApi } from './bootstrap.js';
import type { ApiConfig } from './config.js';

const config: ApiConfig = {
  port: 0,
  // La conexión es perezosa: estas pruebas no llegan a abrirla
  databaseUrl: 'postgres://u:p@127.0.0.1:1/db',
  landingOrigin: 'https://landing.test',
  appOrigins: ['https://app.test'],
  trustProxyHops: 0,
  waitlistRateLimit: { max: 5, windowSeconds: 600 },
  firebase: { projectId: 'demo-changehouse', authEmulatorHost: undefined },
  addressEncryptionKey: Buffer.alloc(32, 7).toString('base64'),
  places: { serverKey: undefined },
  storage: {
    privateBucket: 'privado',
    publicBucket: 'publico',
    publicBaseUrl: 'http://localhost:4443/publico',
    emulatorHost: 'localhost:4443',
  },
  logger: false,
};

describe('createApi', () => {
  it('compone la API con la ruta de la lista de espera y la cierra sin haber usado la base de datos', async () => {
    const { app, close } = createApi(config);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/waitlist',
      payload: { email: 'x' },
    });

    expect(response.statusCode).toBe(400);
    await close();
  });

  it('las operaciones de la cuenta están protegidas: sin token responden 401 sin tocar la base de datos', async () => {
    const { app, close } = createApi(config);

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/v1/me' }),
      app.inject({ method: 'PUT', url: '/v1/me', payload: {} }),
      app.inject({ method: 'GET', url: '/v1/me/consents' }),
      app.inject({ method: 'POST', url: '/v1/me/consents', payload: {} }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401, 401]);
    expect([...app.operations].sort()).toEqual([
      'acceptConsent',
      'completeHomePhotoUpload',
      'createHome',
      'createHomePhotoUpload',
      'deleteHomePhoto',
      'getHome',
      'getMe',
      'joinWaitlist',
      'listMyConsents',
      'listMyHomes',
      'submitHome',
      'updateHome',
      'upsertMe',
    ]);
    await close();
  });
});

describe('prefijo /v1 (docs/api/openapi.yaml: servers)', () => {
  it('las operaciones responden bajo /v1 y las rutas sin prefijo dan 404 en formato Problem', async () => {
    const { app, close } = createApi(config);

    const versioned = await app.inject({ method: 'GET', url: '/v1/me' });
    const waitlist = await app.inject({
      method: 'POST',
      url: '/v1/waitlist',
      payload: { email: 'x' },
    });
    const legacy = await Promise.all([
      app.inject({ method: 'GET', url: '/me' }),
      app.inject({ method: 'GET', url: '/me/consents' }),
      app.inject({ method: 'POST', url: '/waitlist', payload: { email: 'x' } }),
    ]);

    expect(versioned.statusCode).toBe(401);
    expect(waitlist.statusCode).toBe(400);
    for (const response of legacy) {
      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.json()).toMatchObject({ status: 404 });
    }
    await close();
  });
});
