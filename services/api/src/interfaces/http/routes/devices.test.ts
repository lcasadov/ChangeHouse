import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';

const AUTH = { authorization: 'Bearer token-de-prueba' };

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(role?: Role) {
  const calls: { userId: string; fcmToken: string; platform: string }[] = [];
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(role)) },
    devices: {
      registerDevice: (userId, input) => {
        calls.push({ userId, ...input });
        return Promise.resolve();
      },
    },
  });
  opened.push(app);
  return { app, calls };
}

const put = (app: FastifyInstance, payload: unknown) =>
  app.inject({ method: 'PUT', url: '/v1/me/devices', headers: AUTH, payload: payload as object });

describe('PUT /me/devices', () => {
  it('Scenario: Alta - registra el dispositivo de la cuenta autenticada y responde 204 sin cuerpo', async () => {
    const { app, calls } = setup('seeker');

    const response = await put(app, { fcmToken: 'tok-1', platform: 'android' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(calls).toEqual([{ userId: 'user-1', fcmToken: 'tok-1', platform: 'android' }]);
  });

  it('un cuerpo no válido responde 400 y no registra nada', async () => {
    const { app, calls } = setup('owner');

    const missing = await put(app, { platform: 'android' });
    const unknown = await put(app, { fcmToken: 'tok-1', platform: 'symbian' });

    expect(missing.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it('sin token responde 401 y una identidad sin cuenta, 404', async () => {
    const { app, calls } = setup('seeker');
    const anonymous = await app.inject({
      method: 'PUT',
      url: '/v1/me/devices',
      payload: { fcmToken: 'tok-1', platform: 'web' },
    });
    const unregistered = await put(setup(undefined).app, { fcmToken: 'tok-1', platform: 'web' });

    expect(anonymous.statusCode).toBe(401);
    expect(unregistered.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });
});
