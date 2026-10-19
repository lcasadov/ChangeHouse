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
  logger: false,
};

describe('createApi', () => {
  it('compone la API con la ruta de la lista de espera y la cierra sin haber usado la base de datos', async () => {
    const { app, close } = createApi(config);

    const response = await app.inject({
      method: 'POST',
      url: '/waitlist',
      payload: { email: 'x' },
    });

    expect(response.statusCode).toBe(400);
    await close();
  });

  it('las operaciones de la cuenta están protegidas: sin token responden 401 sin tocar la base de datos', async () => {
    const { app, close } = createApi(config);

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/me' }),
      app.inject({ method: 'PUT', url: '/me', payload: {} }),
      app.inject({ method: 'GET', url: '/me/consents' }),
      app.inject({ method: 'POST', url: '/me/consents', payload: {} }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401, 401]);
    expect([...app.operations].sort()).toEqual([
      'acceptConsent',
      'getMe',
      'joinWaitlist',
      'listMyConsents',
      'upsertMe',
    ]);
    await close();
  });
});
