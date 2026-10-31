import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type { AccountExport } from '../../../application/account/account-export.js';
import type { Role } from '../../../domain/account/role.js';
import { HomeInOperationError } from '../../../domain/home/errors.js';
import { buildApp } from '../app.js';
import type { AccountDataRouteOptions } from './account-data.js';

const AUTH = { authorization: 'Bearer token-de-prueba' };
const EXPORT: AccountExport = {
  exportedAt: '2026-10-30T10:00:00.000Z',
  account: {
    id: 'user-1',
    email: 'ana@example.com',
    displayName: 'Ana',
    phone: null,
    municipality: null,
    meetsVppRequirements: false,
    isOver65: false,
    createdAt: '2026-10-01T09:00:00.000Z',
  },
  homes: [],
  searchPreferences: { default: null, byHome: [] },
  likes: [],
  dismissals: [],
  matches: [],
  consents: [],
};

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(
  options: { role?: Role | undefined; deleteError?: Error; limit?: { max: number } } = {},
) {
  const calls = { deleteMe: [] as string[], exportMyData: [] as string[] };
  const accountData: AccountDataRouteOptions = {
    deleteMe: (userId) => {
      calls.deleteMe.push(userId);
      return options.deleteError ? Promise.reject(options.deleteError) : Promise.resolve();
    },
    exportMyData: (userId) => {
      calls.exportMyData.push(userId);
      return Promise.resolve(EXPORT);
    },
    ...(options.limit ? { exportRateLimit: { max: options.limit.max, windowSeconds: 3600 } } : {}),
  };
  const principal = principalOf(options.role);
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principal) },
    accountData,
  });
  opened.push(app);
  return { app, calls };
}

describe('DELETE /v1/me (deleteMe)', () => {
  it('Scenario: Eliminación completa - responde 204 sin cuerpo y elimina la cuenta propia', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({ method: 'DELETE', url: '/v1/me', headers: AUTH });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(calls.deleteMe).toEqual(['user-1']);
  });

  it('un conflicto de negocio se responde como 409 con su código', async () => {
    const { app } = setup({ role: 'owner', deleteError: new HomeInOperationError() });

    const response = await app.inject({ method: 'DELETE', url: '/v1/me', headers: AUTH });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ status: 409 });
  });

  it.each([
    ['seeker', 204],
    ['owner', 204],
    ['agency', 403],
    ['admin', 403],
    [undefined, 403],
  ] as const)('el rol %s recibe %i', async (role, expected) => {
    const { app, calls } = setup({ role });

    const response = await app.inject({ method: 'DELETE', url: '/v1/me', headers: AUTH });

    expect(response.statusCode).toBe(expected);
    expect(calls.deleteMe).toHaveLength(expected === 204 ? 1 : 0);
  });

  it('sin token responde 401', async () => {
    const app = buildApp({
      logger: false,
      accountData: {
        deleteMe: () => Promise.resolve(),
        exportMyData: () => Promise.resolve(EXPORT),
      },
    });
    opened.push(app);

    expect((await app.inject({ method: 'DELETE', url: '/v1/me' })).statusCode).toBe(401);
  });
});

describe('GET /v1/me/export (exportMyData)', () => {
  it('Scenario: Exportación - responde 200 con el JSON como adjunto', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({ method: 'GET', url: '/v1/me/export', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="changehouse-mis-datos.json"',
    );
    expect(response.json()).toEqual(EXPORT);
    expect(calls.exportMyData).toEqual(['user-1']);
  });

  it.each([
    ['seeker', 200],
    ['owner', 200],
    ['agency', 200],
    ['admin', 403],
    [undefined, 403],
  ] as const)('el rol %s recibe %i', async (role, expected) => {
    const { app } = setup({ role });

    const response = await app.inject({ method: 'GET', url: '/v1/me/export', headers: AUTH });

    expect(response.statusCode).toBe(expected);
  });

  it('por defecto admite 5 exportaciones por hora y la sexta recibe 429 con Retry-After', async () => {
    const { app } = setup({ role: 'owner' });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push(
        (await app.inject({ method: 'GET', url: '/v1/me/export', headers: AUTH })).statusCode,
      );
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('el límite configurado se aplica por usuario y no a la operación de eliminar', async () => {
    const { app } = setup({ role: 'owner', limit: { max: 1 } });

    const first = await app.inject({ method: 'GET', url: '/v1/me/export', headers: AUTH });
    const second = await app.inject({ method: 'GET', url: '/v1/me/export', headers: AUTH });
    const removal = await app.inject({ method: 'DELETE', url: '/v1/me', headers: AUTH });

    expect([first.statusCode, second.statusCode, removal.statusCode]).toEqual([200, 429, 204]);
    expect(Number(second.headers['retry-after'])).toBeGreaterThan(0);
  });
});
