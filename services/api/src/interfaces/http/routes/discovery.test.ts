import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type { DiscoveryCardView } from '../../../application/discovery/discovery-operations.js';
import { HomeIdRequiredError } from '../../../application/discovery/errors.js';
import { encodeCursor } from '../../../application/moderation/cursor.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';
import type { DiscoveryRouteOptions } from './discovery.js';

const HOME_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const CARD = {
  id: HOME_ID,
  compensation: { kind: 'pay', amountCents: 1_200_000 },
} as unknown as DiscoveryCardView;
const AUTH = { authorization: 'Bearer token-de-prueba' };
const NOW = new Date('2026-10-19T10:00:00.000Z');

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role | undefined; failWith?: Error } = {}) {
  const calls: unknown[][] = [];
  const discovery: DiscoveryRouteOptions = {
    discoverHomes: (...args) => {
      calls.push(args);
      return options.failWith
        ? Promise.reject(options.failWith)
        : Promise.resolve({ items: [CARD], nextCursor: 'siguiente' });
    },
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role, 'user-1')) },
    discovery,
  });
  opened.push(app);
  return { app, calls };
}

const errorFields = (body: { errors?: { field: string }[] }) =>
  (body.errors ?? []).map((error) => error.field);

describe('GET /discover', () => {
  it('devuelve la página de tarjetas con el límite por defecto y sin vivienda indicada', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({ method: 'GET', url: '/v1/discover', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [CARD], nextCursor: 'siguiente' });
    expect(calls).toEqual([['user-1', { limit: 20 }]]);
  });

  it('entiende homeId, el límite y el cursor', async () => {
    const { app, calls } = setup({ role: 'owner' });
    const cursor = encodeCursor({ at: NOW, id: HOME_ID });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/discover?homeId=${HOME_ID}&limit=50&cursor=${cursor}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      ['user-1', { homeId: HOME_ID, limit: 50, after: { at: NOW, id: HOME_ID } }],
    ]);
  });

  it.each(['0', '51', 'diez', '2.5'])('un límite %s es un 400 sobre limit', async (limit) => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/discover?limit=${limit}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(400);
    expect(errorFields(response.json())).toEqual(['limit']);
    expect(calls).toHaveLength(0);
  });

  it('un cursor que no emitió la API es un 400 sobre cursor', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/discover?cursor=inventado',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(400);
    expect(errorFields(response.json())).toEqual(['cursor']);
    expect(calls).toHaveLength(0);
  });

  it('un homeId que no es un UUID responde como una vivienda inexistente (404) sin consultar nada', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/discover?homeId=no-es-un-uuid',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('un owner con varias viviendas sin homeId recibe 400 con el campo homeId', async () => {
    const { app } = setup({ role: 'owner', failWith: new HomeIdRequiredError() });

    const response = await app.inject({ method: 'GET', url: '/v1/discover', headers: AUTH });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'HOME_ID_REQUIRED',
      errors: [{ field: 'homeId', message: 'required' }],
    });
  });

  it.each(['agency', 'admin'] as const)('una cuenta %s recibe 403', async (role) => {
    const { app, calls } = setup({ role });

    const response = await app.inject({ method: 'GET', url: '/v1/discover', headers: AUTH });

    expect(response.statusCode).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('sin token es un 401', async () => {
    const { app } = setup({ role: 'owner' });

    const response = await app.inject({ method: 'GET', url: '/v1/discover' });

    expect(response.statusCode).toBe(401);
  });
});
