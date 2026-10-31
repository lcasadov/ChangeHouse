import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import { UserToModerateNotFoundError } from '../../../application/moderation/errors.js';
import type { AdminUserView } from '../../../application/moderation/user-suspension.js';
import { CannotSuspendAdminError, CannotSuspendSelfError } from '../../../domain/account/errors.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';
import type { AdminUserRouteOptions } from './admin-users.js';

const USER_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const AUTH = { authorization: 'Bearer token-de-prueba' };
const VIEW: AdminUserView = {
  id: USER_ID,
  email: 'beto@example.com',
  displayName: 'Beto',
  roles: ['owner'],
  suspended: true,
  createdAt: '2026-10-01T09:00:00.000Z',
};

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role; failWith?: Error } = {}) {
  const calls: unknown[][] = [];
  const routes: AdminUserRouteOptions = {
    adminSetUserSuspension: (...args) => {
      calls.push(args);
      return options.failWith ? Promise.reject(options.failWith) : Promise.resolve(VIEW);
    },
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role, 'admin-1')) },
    adminUsers: routes,
  });
  opened.push(app);
  return { app, calls };
}

const put = (app: FastifyInstance, userId: string, payload: unknown) =>
  app.inject({
    method: 'PUT',
    url: `/v1/admin/users/${userId}/suspension`,
    headers: AUTH,
    payload: payload as object,
  });

describe('PUT /admin/users/:userId/suspension', () => {
  it('Scenario: Suspender con motivo - el admin recibe el usuario actualizado', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await put(app, USER_ID, { suspended: true, reason: ' Fraude reiterado ' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VIEW);
    expect(calls).toEqual([['admin-1', USER_ID, { suspended: true, reason: 'Fraude reiterado' }]]);
  });

  it('Scenario: Sin motivo - responde 400 señalando el motivo y no invoca el caso de uso', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await put(app, USER_ID, { suspended: true });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ field: 'reason' }] });
    expect(calls).toEqual([]);
  });

  it('un identificador que no es un UUID responde 404 sin invocar el caso de uso', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await put(app, 'no-es-un-uuid', { suspended: true, reason: 'Fraude' });

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each([
    [new CannotSuspendSelfError(), 409, 'CANNOT_SUSPEND_SELF'],
    [new CannotSuspendAdminError(), 409, 'CANNOT_SUSPEND_ADMIN'],
  ])('traduce %s a %i con su código', async (error, status, code) => {
    const { app } = setup({ role: 'admin', failWith: error });

    const response = await put(app, USER_ID, { suspended: true, reason: 'Fraude' });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ code });
  });

  it('un usuario inexistente responde 404 sin código', async () => {
    const { app } = setup({ role: 'admin', failWith: new UserToModerateNotFoundError() });

    const response = await put(app, USER_ID, { suspended: true, reason: 'Fraude' });

    expect(response.statusCode).toBe(404);
    expect(response.json<object>()).not.toHaveProperty('code');
  });

  it.each(['seeker', 'owner', 'agency'] as const)(
    'un %s recibe 403 y no se invoca el caso de uso',
    async (role) => {
      const { app, calls } = setup({ role });

      const response = await put(app, USER_ID, { suspended: true, reason: 'Fraude' });

      expect(response.statusCode).toBe(403);
      expect(calls).toEqual([]);
    },
  );
});
