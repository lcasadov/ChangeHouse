import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import { HomeNotFoundError } from '../../../application/home/errors.js';
import { SearchPreferencesNotFoundError } from '../../../application/search-preferences/errors.js';
import type { SearchPreferencesView } from '../../../application/search-preferences/search-preferences-views.js';
import type { Role } from '../../../domain/account/role.js';
import { SearchPreferencesIncompleteError } from '../../../domain/search-preferences/errors.js';
import { buildApp } from '../app.js';
import type { SearchPreferencesRouteOptions } from './search-preferences.js';

const HOME_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const BODY = { municipalities: ['Getafe'], maxToPayCents: 30_000_00, minToReceiveCents: 0 };
const VIEW = { ...BODY, filters: {}, valueReferencePct: 50 } as unknown as SearchPreferencesView;
const AUTH = { authorization: 'Bearer token-de-prueba' };

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role | undefined; failWith?: Error } = {}) {
  const calls: { operation: string; args: unknown[] }[] = [];
  const respond = <T>(operation: string, value: T) => {
    return (...args: unknown[]): Promise<T> => {
      calls.push({ operation, args });
      return options.failWith ? Promise.reject(options.failWith) : Promise.resolve(value);
    };
  };
  const searchPreferences: SearchPreferencesRouteOptions = {
    getMySearchPreferences: respond('getMySearchPreferences', VIEW),
    putMySearchPreferences: respond('putMySearchPreferences', VIEW),
    getHomeSearchPreferences: respond('getHomeSearchPreferences', VIEW),
    putHomeSearchPreferences: respond('putHomeSearchPreferences', VIEW),
    deleteHomeSearchPreferences: respond('deleteHomeSearchPreferences', undefined),
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role)) },
    searchPreferences,
  });
  opened.push(app);
  return { app, calls };
}

describe('GET y PUT /me/search-preferences', () => {
  it('Scenario: Guardar preferencias - el PUT delega con el punto de referencia 50 por defecto y responde 200', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me/search-preferences',
      headers: AUTH,
      payload: BODY,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VIEW);
    expect(calls).toEqual([
      { operation: 'putMySearchPreferences', args: ['user-1', { ...BODY, valueReferencePct: 50 }] },
    ]);
  });

  it('Scenario: Punto de referencia fuera de rango - 400 que señala el campo, sin ejecutar el caso de uso', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me/search-preferences',
      headers: AUTH,
      payload: { ...BODY, valueReferencePct: 120 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual([
      'valueReferencePct',
    ]);
    expect(calls).toEqual([]);
  });

  it('un centro sin radio es un 400 que señala radiusKm', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me/search-preferences',
      headers: AUTH,
      payload: { ...BODY, center: { lat: 40.4, lng: -3.7 } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual([
      'radiusKm',
    ]);
    expect(calls).toEqual([]);
  });

  it('Scenario: Sin zona - la regla de negocio responde 422 con su código', async () => {
    const { app } = setup({ role: 'seeker', failWith: new SearchPreferencesIncompleteError() });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me/search-preferences',
      headers: AUTH,
      payload: { maxToPayCents: 0, minToReceiveCents: 0 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'SEARCH_PREFERENCES_INCOMPLETE',
      errors: [{ field: 'municipalities' }],
    });
  });

  it('el GET devuelve las preferencias del usuario autenticado', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/search-preferences',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VIEW);
    expect(calls).toEqual([{ operation: 'getMySearchPreferences', args: ['user-1'] }]);
  });

  it('sin preferencias el GET es un 404 en formato Problem', async () => {
    const { app } = setup({ role: 'seeker', failWith: new SearchPreferencesNotFoundError() });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/search-preferences',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it.each(['agency', 'admin'] as const)('%s recibe 403 y no se ejecuta nada', async (role) => {
    const { app, calls } = setup({ role });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me/search-preferences',
      headers: AUTH,
      payload: BODY,
    });

    expect(response.statusCode).toBe(403);
    expect(calls).toEqual([]);
  });

  it('sin token responde 401', async () => {
    const { app } = setup({ role: 'seeker' });

    const response = await app.inject({ method: 'GET', url: '/v1/me/search-preferences' });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET, PUT y DELETE /homes/{homeId}/search-preferences', () => {
  const url = `/v1/homes/${HOME_ID}/search-preferences`;

  it('el GET delega con el usuario y la vivienda', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({ method: 'GET', url, headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{ operation: 'getHomeSearchPreferences', args: ['user-1', HOME_ID] }]);
  });

  it('el PUT valida el cuerpo y delega', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({ method: 'PUT', url, headers: AUTH, payload: BODY });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        operation: 'putHomeSearchPreferences',
        args: ['user-1', HOME_ID, { ...BODY, valueReferencePct: 50 }],
      },
    ]);
  });

  it('un PUT con el cuerpo no válido es un 400 y no ejecuta nada', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'PUT',
      url,
      headers: AUTH,
      payload: { ...BODY, valueReferencePct: 101 },
    });

    expect(response.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it('el DELETE responde 204 sin cuerpo', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({ method: 'DELETE', url, headers: AUTH });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(calls).toEqual([
      { operation: 'deleteHomeSearchPreferences', args: ['user-1', HOME_ID] },
    ]);
  });

  it('Scenario: Vivienda ajena - 404 en formato Problem en las tres operaciones', async () => {
    const { app } = setup({ role: 'seeker', failWith: new HomeNotFoundError() });

    const responses = await Promise.all([
      app.inject({ method: 'GET', url, headers: AUTH }),
      app.inject({ method: 'PUT', url, headers: AUTH, payload: BODY }),
      app.inject({ method: 'DELETE', url, headers: AUTH }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404]);
    for (const response of responses) {
      expect(response.headers['content-type']).toContain('application/problem+json');
    }
  });

  it('un identificador que no es un UUID es un 404 sin consultar nada', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/homes/no-es-uuid/search-preferences',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each(['agency', 'admin'] as const)('%s recibe 403 en las tres operaciones', async (role) => {
    const { app, calls } = setup({ role });

    const responses = await Promise.all([
      app.inject({ method: 'GET', url, headers: AUTH }),
      app.inject({ method: 'PUT', url, headers: AUTH, payload: BODY }),
      app.inject({ method: 'DELETE', url, headers: AUTH }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([403, 403, 403]);
    expect(calls).toEqual([]);
  });
});
