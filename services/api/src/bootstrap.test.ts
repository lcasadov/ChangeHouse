import { describe, expect, it } from 'vitest';

import { createApi } from './bootstrap.js';
import type { ApiConfig } from './config.js';

const config: ApiConfig = {
  port: 0,
  // La conexión es perezosa: estas pruebas no llegan a abrirla
  databaseUrl: 'postgres://u:p@127.0.0.1:1/db',
  landingOrigin: 'https://landing.test',
  trustProxyHops: 0,
  waitlistRateLimit: { max: 5, windowSeconds: 600 },
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
});
