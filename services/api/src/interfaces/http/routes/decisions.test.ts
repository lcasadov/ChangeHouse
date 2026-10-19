import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import {
  DailyLikeLimitError,
  LikeExistsError,
  LikeInMatchError,
} from '../../../application/decision/errors.js';
import { HomeNotFoundError } from '../../../application/home/errors.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';
import type { DecisionRouteOptions } from './decisions.js';

const FROM = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const TARGET = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9b';
const AUTH = { authorization: 'Bearer token-de-prueba' };

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role | undefined; failWith?: Error } = {}) {
  const calls: { operation: string; args: unknown[] }[] = [];
  const outcome = <T>(operation: string, args: unknown[], value: T): Promise<T> => {
    calls.push({ operation, args });
    return options.failWith ? Promise.reject(options.failWith) : Promise.resolve(value);
  };
  const decisions: DecisionRouteOptions = {
    likeHome: (...args) => outcome('likeHome', args, { liked: true as const, match: null }),
    dismissHome: (...args) => outcome('dismissHome', args, undefined),
    undoLastAction: (...args) => outcome('undoLastAction', args, undefined),
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role, 'user-1')) },
    decisions,
  });
  opened.push(app);
  return { app, calls };
}

const errorFields = (body: { errors?: { field: string }[] }) =>
  (body.errors ?? []).map((error) => error.field);

describe('POST /me/likes', () => {
  it('Scenario: Me gusta válido - responde 201 con LikeResult y pasa los dos identificadores', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/likes',
      headers: AUTH,
      payload: { fromHomeId: FROM, targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ liked: true, match: null });
    expect(calls).toEqual([
      { operation: 'likeHome', args: ['user-1', { fromHomeId: FROM, targetHomeId: TARGET }] },
    ]);
  });

  it('Scenario: Usuario sin vivienda publicada - un seeker recibe 403 y no se ejecuta nada', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/likes',
      headers: AUTH,
      payload: { fromHomeId: FROM, targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(403);
    expect(calls).toEqual([]);
  });

  it.each(['agency', 'admin'] as const)('un %s recibe 403', async (role) => {
    const { app, calls } = setup({ role });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/likes',
      headers: AUTH,
      payload: { fromHomeId: FROM, targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(403);
    expect(calls).toEqual([]);
  });

  it('sin token responde 401', async () => {
    const { app } = setup({ role: 'owner' });

    const response = await app.inject({ method: 'POST', url: '/v1/me/likes', payload: {} });

    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['sin cuerpo', undefined, ['fromHomeId', 'targetHomeId']],
    ['sin destino', { fromHomeId: FROM }, ['targetHomeId']],
    [
      'con identificadores que no son UUID',
      { fromHomeId: 'x', targetHomeId: 'y' },
      ['fromHomeId', 'targetHomeId'],
    ],
    ['con campos de más', { fromHomeId: FROM, targetHomeId: TARGET, extra: 1 }, ['extra']],
    ['con un cuerpo que no es un objeto', [FROM, TARGET], ['fromHomeId', 'targetHomeId']],
  ])('un cuerpo %s es un 400 sobre los campos erróneos', async (_name, payload, fields) => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/likes',
      headers: AUTH,
      ...(payload === undefined ? {} : { payload }),
    });

    expect(response.statusCode).toBe(400);
    expect(errorFields(response.json())).toEqual(fields);
    expect(calls).toEqual([]);
  });

  it('Scenario: Me gusta repetido - un conflicto del dominio es un 409 con su código', async () => {
    const { app } = setup({ role: 'owner', failWith: new LikeExistsError() });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/likes',
      headers: AUTH,
      payload: { fromHomeId: FROM, targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'LIKE_EXISTS' });
  });

  it('Scenario: Undécimo me gusta del día - responde 429 con Retry-After', async () => {
    const { app } = setup({ role: 'owner', failWith: new DailyLikeLimitError(3600) });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/likes',
      headers: AUTH,
      payload: { fromHomeId: FROM, targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('3600');
    expect(response.json()).toMatchObject({ code: 'DAILY_LIKE_LIMIT' });
  });

  it('una vivienda que no se puede ver es un 404 sin código', async () => {
    const { app } = setup({ role: 'owner', failWith: new HomeNotFoundError() });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/likes',
      headers: AUTH,
      payload: { fromHomeId: FROM, targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).not.toHaveProperty('code');
  });
});

describe('POST /me/dismissals', () => {
  it.each(['owner', 'seeker'] as const)(
    'Scenario: Descartar - un %s recibe 204 sin cuerpo',
    async (role) => {
      const { app, calls } = setup({ role });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/me/dismissals',
        headers: AUTH,
        payload: { fromHomeId: FROM, targetHomeId: TARGET },
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(calls).toEqual([
        { operation: 'dismissHome', args: ['user-1', { fromHomeId: FROM, targetHomeId: TARGET }] },
      ]);
    },
  );

  it('sin fromHomeId (un seeker) solo pasa el destino', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/dismissals',
      headers: AUTH,
      payload: { targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(204);
    expect(calls).toEqual([
      { operation: 'dismissHome', args: ['user-1', { targetHomeId: TARGET }] },
    ]);
  });

  it.each(['agency', 'admin'] as const)('un %s recibe 403', async (role) => {
    const { app } = setup({ role });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/dismissals',
      headers: AUTH,
      payload: { targetHomeId: TARGET },
    });

    expect(response.statusCode).toBe(403);
  });

  it.each([
    ['sin destino', {}, ['targetHomeId']],
    ['con un origen que no es UUID', { fromHomeId: 'x', targetHomeId: TARGET }, ['fromHomeId']],
    ['con campos de más', { targetHomeId: TARGET, extra: true }, ['extra']],
  ])('un cuerpo %s es un 400', async (_name, payload, fields) => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/dismissals',
      headers: AUTH,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(errorFields(response.json())).toEqual(fields);
    expect(calls).toEqual([]);
  });
});

describe('DELETE /me/last-action', () => {
  it('Scenario: Deshacer un descarte - con homeId responde 204 y pasa la vivienda', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/me/last-action?homeId=${FROM}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(204);
    expect(calls).toEqual([{ operation: 'undoLastAction', args: ['user-1', FROM] }]);
  });

  it('sin homeId (un seeker) deshace desde la cuenta', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/me/last-action',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(204);
    expect(calls).toEqual([{ operation: 'undoLastAction', args: ['user-1', undefined] }]);
  });

  it('un homeId que no es un UUID responde 404 como una vivienda inexistente', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/me/last-action?homeId=no-es-uuid',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each(['agency', 'admin'] as const)('un %s recibe 403', async (role) => {
    const { app } = setup({ role });

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/me/last-action',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(403);
  });

  it('Scenario: No se deshace un match - LIKE_IN_MATCH es un 409', async () => {
    const { app } = setup({ role: 'owner', failWith: new LikeInMatchError() });

    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/me/last-action?homeId=${FROM}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'LIKE_IN_MATCH' });
  });
});
