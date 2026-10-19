import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type { MatchView } from '../../../application/matching/match-views.js';
import { encodeCursor } from '../../../application/moderation/cursor.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';
import type { MatchRouteOptions } from './matches.js';

const MATCH_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const MATCH = { id: MATCH_ID, type: 2, status: 'open' } as unknown as MatchView;
const AUTH = { authorization: 'Bearer token-de-prueba' };
const NOW = new Date('2026-10-19T10:00:00.000Z');

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(role: Role | undefined = 'owner') {
  const calls: unknown[][] = [];
  const matches: MatchRouteOptions = {
    listMyMatches: (...args) => {
      calls.push(args);
      return Promise.resolve({ items: [MATCH], nextCursor: null });
    },
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(role, 'user-1')) },
    matches,
  });
  opened.push(app);
  return { app, calls };
}

const errorFields = (body: { errors?: { field: string }[] }) =>
  (body.errors ?? []).map((error) => error.field);

describe('GET /matches', () => {
  it('devuelve la página de matches del usuario con el límite por defecto', async () => {
    const { app, calls } = setup();

    const response = await app.inject({ method: 'GET', url: '/v1/matches', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [MATCH], nextCursor: null });
    expect(calls).toEqual([['user-1', { limit: 20 }]]);
  });

  it('entiende status, cursor y limit', async () => {
    const { app, calls } = setup('seeker');
    const cursor = encodeCursor({ at: NOW, id: MATCH_ID });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/matches?status=closed&limit=5&cursor=${cursor}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      ['user-1', { status: 'closed', after: { at: NOW, id: MATCH_ID }, limit: 5 }],
    ]);
  });

  it('un estado, un cursor o un límite no válidos son un 400 con cada campo señalado', async () => {
    const { app, calls } = setup();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/matches?status=abierto&limit=0&cursor=no-es-un-cursor',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(400);
    expect(errorFields(response.json()).sort()).toEqual(['cursor', 'limit', 'status']);
    expect(calls).toEqual([]);
  });

  it('agency y admin reciben 403 y sin token es 401', async () => {
    for (const role of ['agency', 'admin'] as const) {
      const { app } = setup(role);
      const response = await app.inject({ method: 'GET', url: '/v1/matches', headers: AUTH });
      expect(response.statusCode, role).toBe(403);
    }
    const { app } = setup();
    const anonymous = await app.inject({ method: 'GET', url: '/v1/matches' });
    expect(anonymous.statusCode).toBe(401);
  });
});
