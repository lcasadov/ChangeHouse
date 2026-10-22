import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type { MatchDetailView, MatchView } from '../../../application/matching/match-views.js';
import { encodeCursor } from '../../../application/moderation/cursor.js';
import type { Role } from '../../../domain/account/role.js';
import { MatchNotFoundError, MatchNotOpenError } from '../../../domain/matching/errors.js';
import { buildApp } from '../app.js';
import type { MatchRouteOptions } from './matches.js';

const MATCH_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const MATCH = { id: MATCH_ID, type: 2, status: 'open' } as unknown as MatchView;
const DETAIL = { ...MATCH, homes: [] } as unknown as MatchDetailView;
const AUTH = { authorization: 'Bearer token-de-prueba' };
const NOW = new Date('2026-10-19T10:00:00.000Z');

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(role: Role | undefined = 'owner', overrides: Partial<MatchRouteOptions> = {}) {
  const calls: unknown[][] = [];
  const matches: MatchRouteOptions = {
    listMyMatches: (...args) => {
      calls.push(args);
      return Promise.resolve({ items: [MATCH], nextCursor: null });
    },
    getMatch: (...args) => {
      calls.push(args);
      return Promise.resolve(DETAIL);
    },
    confirmMatch: (...args) => {
      calls.push(args);
      return Promise.resolve(MATCH);
    },
    withdrawFromMatch: (...args) => {
      calls.push(args);
      return Promise.resolve(MATCH);
    },
    setPhoneSharing: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
    ...overrides,
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

describe('GET /matches/:matchId', () => {
  const url = `/v1/matches/${MATCH_ID}`;

  it('devuelve el detalle con la cuenta y el rol de quien consulta', async () => {
    const { app, calls } = setup('owner');

    const response = await app.inject({ method: 'GET', url, headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DETAIL);
    expect(calls).toEqual([[{ userId: 'user-1', role: 'owner' }, MATCH_ID]]);
  });

  it('el admin y el seeker llegan al caso de uso; agency y sin token no', async () => {
    for (const role of ['admin', 'seeker'] as const) {
      const { app, calls } = setup(role);
      const response = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(response.statusCode, role).toBe(200);
      expect(calls, role).toHaveLength(1);
    }
    const { app, calls } = setup('agency');
    const denied = await app.inject({ method: 'GET', url, headers: AUTH });
    const anonymous = await app.inject({ method: 'GET', url });
    expect([denied.statusCode, anonymous.statusCode]).toEqual([403, 401]);
    expect(calls).toEqual([]);
  });

  it('un identificador que no es UUID responde 404 sin consultar nada', async () => {
    const { app, calls } = setup();

    const response = await app.inject({ method: 'GET', url: '/v1/matches/xyz', headers: AUTH });

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it('un match ajeno o inexistente es un 404 sin código', async () => {
    const { app } = setup('owner', { getMatch: () => Promise.reject(new MatchNotFoundError()) });

    const response = await app.inject({ method: 'GET', url, headers: AUTH });

    expect(response.statusCode).toBe(404);
    expect(response.json()).not.toHaveProperty('code');
  });
});

describe('POST /matches/:matchId/confirm y /withdraw', () => {
  const post = (app: FastifyInstance, action: string, headers: Record<string, string> = AUTH) =>
    app.inject({ method: 'POST', url: `/v1/matches/${MATCH_ID}/${action}`, headers });

  it('Scenario: Primera confirmación - confirmMatch responde 200 con el match', async () => {
    const { app, calls } = setup('seeker');

    const response = await post(app, 'confirm');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(MATCH);
    expect(calls).toEqual([['user-1', MATCH_ID]]);
  });

  it('Scenario: Retirarse - withdrawFromMatch responde 200 con el match', async () => {
    const { app, calls } = setup();

    const response = await post(app, 'withdraw');

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([['user-1', MATCH_ID]]);
  });

  it('Scenario: Match cerrado - un match que no admite la acción responde 409 con MATCH_NOT_OPEN', async () => {
    const reject = () => Promise.reject(new MatchNotOpenError());
    const { app } = setup('owner', { confirmMatch: reject, withdrawFromMatch: reject });

    for (const action of ['confirm', 'withdraw']) {
      const response = await post(app, action);
      expect(response.statusCode, action).toBe(409);
      expect(response.json(), action).toMatchObject({ code: 'MATCH_NOT_OPEN' });
    }
  });

  it('admin y agency reciben 403, sin token 401 y un id que no es UUID 404', async () => {
    for (const role of ['admin', 'agency'] as const) {
      const { app, calls } = setup(role);
      for (const action of ['confirm', 'withdraw']) {
        expect((await post(app, action)).statusCode, `${role} ${action}`).toBe(403);
      }
      expect(calls).toEqual([]);
    }
    const { app } = setup();
    const anonymous = await post(app, 'confirm', {});
    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/matches/xyz/withdraw',
      headers: AUTH,
    });
    expect([anonymous.statusCode, malformed.statusCode]).toEqual([401, 404]);
  });
});

describe('PUT /matches/:matchId/phone-sharing', () => {
  const put = (
    app: FastifyInstance,
    payload: unknown,
    url = `/v1/matches/${MATCH_ID}/phone-sharing`,
  ) => app.inject({ method: 'PUT', url, headers: AUTH, payload: payload as object });

  it('Scenario: Autorizar y revocar - guarda la preferencia propia y responde 204', async () => {
    const { app, calls } = setup();

    const authorize = await put(app, { share: true });
    const revoke = await put(app, { share: false });

    expect([authorize.statusCode, revoke.statusCode]).toEqual([204, 204]);
    expect(authorize.body).toBe('');
    expect(calls).toEqual([
      ['user-1', MATCH_ID, true],
      ['user-1', MATCH_ID, false],
    ]);
  });

  it('un cuerpo sin share booleano o con campos de más es un 400 con el campo señalado', async () => {
    const { app, calls } = setup();

    const missing = await put(app, {});
    const text = await put(app, { share: 'si' });
    const extra = await put(app, { share: true, userId: 'otro' });
    const notAnObject = await put(app, [true]);

    expect([missing, text, extra, notAnObject].map((r) => r.statusCode)).toEqual([
      400, 400, 400, 400,
    ]);
    expect(errorFields(missing.json())).toEqual(['share']);
    expect(errorFields(text.json())).toEqual(['share']);
    expect(errorFields(extra.json())).toEqual(['userId']);
    expect(calls).toEqual([]);
  });

  it('un match cerrado responde 409, un id que no es UUID 404 y admin 403', async () => {
    const closed = await put(
      setup('owner', { setPhoneSharing: () => Promise.reject(new MatchNotOpenError()) }).app,
      { share: true },
    );
    const { app } = setup();
    const malformed = await put(app, { share: true }, '/v1/matches/xyz/phone-sharing');
    const admin = await put(setup('admin').app, { share: true });

    expect([closed.statusCode, malformed.statusCode, admin.statusCode]).toEqual([409, 404, 403]);
  });
});
