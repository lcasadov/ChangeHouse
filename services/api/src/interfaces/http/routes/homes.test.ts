import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import { AddressNotResolvedError, HomeNotFoundError } from '../../../application/home/errors.js';
import type { HomeView } from '../../../application/home/home-views.js';
import type { Role } from '../../../domain/account/role.js';
import {
  HomeIncompleteError,
  HomeNotEditableError,
  HomeNotPausableError,
} from '../../../domain/home/errors.js';
import { buildApp } from '../app.js';
import type { HomeRouteOptions } from './homes.js';

const HOME_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const VIEW = { id: HOME_ID, status: 'draft', type: 'piso' } as unknown as HomeView;
const ADDRESS = { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12' };
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
  const homes: HomeRouteOptions = {
    createHome: respond('createHome', VIEW),
    updateHome: respond('updateHome', VIEW),
    listMyHomes: respond('listMyHomes', [VIEW]),
    getHome: respond('getHome', VIEW),
    submitHome: respond('submitHome', VIEW),
    pauseHome: respond('pauseHome', VIEW),
    resumeHome: respond('resumeHome', VIEW),
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role)) },
    homes,
  });
  opened.push(app);
  return { app, calls };
}

describe('POST /homes', () => {
  it('Scenario: Alta de vivienda en borrador - responde 201 con la ficha y su ubicación, y delega en el caso de uso', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/homes',
      headers: AUTH,
      payload: { type: 'piso', address: ADDRESS },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['location']).toBe(`/v1/homes/${HOME_ID}`);
    expect(response.json()).toEqual(VIEW);
    expect(calls).toEqual([
      { operation: 'createHome', args: ['user-1', { type: 'piso', address: ADDRESS }] },
    ]);
  });

  it('un cuerpo que no cumple el esquema es un 400 que señala los campos, sin ejecutar el caso de uso', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/homes',
      headers: AUTH,
      payload: { type: 'castillo', address: ADDRESS, status: 'published' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual([
      'type',
      'status',
    ]);
    expect(calls).toEqual([]);
  });

  it.each(['agency', 'admin'] as const)(
    'Scenario: Cuentas de gestoría o administración - %s recibe 403 y no se ejecuta nada',
    async (role) => {
      const { app, calls } = setup({ role });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/homes',
        headers: AUTH,
        payload: { type: 'piso', address: ADDRESS },
      });

      expect(response.statusCode).toBe(403);
      expect(calls).toEqual([]);
    },
  );

  it('Scenario: Dirección no reconocida - responde 422 con el código y el campo address', async () => {
    const { app } = setup({ role: 'seeker', failWith: new AddressNotResolvedError() });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/homes',
      headers: AUTH,
      payload: { type: 'piso', address: ADDRESS },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'ADDRESS_NOT_RESOLVED',
      errors: [{ field: 'address' }],
    });
  });

  it('sin token responde 401', async () => {
    const { app } = setup({ role: 'seeker' });

    const response = await app.inject({ method: 'POST', url: '/v1/homes', payload: {} });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /me/homes', () => {
  it('lista las viviendas del usuario autenticado', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({ method: 'GET', url: '/v1/me/homes', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([VIEW]);
    expect(calls).toEqual([{ operation: 'listMyHomes', args: ['user-1'] }]);
  });
});

describe('GET /homes/{homeId}', () => {
  it('delega con el usuario autenticado y responde 200', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/homes/${HOME_ID}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{ operation: 'getHome', args: ['user-1', HOME_ID] }]);
  });

  it('Scenario: Vivienda ajena no publicada - 404 en formato Problem', async () => {
    const { app } = setup({ role: 'seeker', failWith: new HomeNotFoundError() });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/homes/${HOME_ID}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 404, title: 'Recurso no encontrado' });
  });

  it('un identificador que no es un UUID es un 404 idéntico, sin consultar nada', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/homes/no-es-uuid',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it('una gestoría recibe 403', async () => {
    const { app } = setup({ role: 'agency' });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/homes/${HOME_ID}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('PATCH /homes/{homeId}', () => {
  it('Scenario: Asistente que guarda el avance - aplica el cambio y responde 200', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/homes/${HOME_ID}`,
      headers: AUTH,
      payload: { bedrooms: 2 },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      { operation: 'updateHome', args: ['user-1', HOME_ID, { bedrooms: 2 }] },
    ]);
  });

  it('un cuerpo vacío o con campos de estado es un 400', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const empty = await app.inject({
      method: 'PATCH',
      url: `/v1/homes/${HOME_ID}`,
      headers: AUTH,
      payload: {},
    });
    const status = await app.inject({
      method: 'PATCH',
      url: `/v1/homes/${HOME_ID}`,
      headers: AUTH,
      payload: { status: 'published' },
    });

    expect([empty.statusCode, status.statusCode]).toEqual([400, 400]);
    expect(calls).toEqual([]);
  });

  it('Scenario: Edición de una vivienda en operación - responde 409 con su código', async () => {
    const { app } = setup({ role: 'owner', failWith: new HomeNotEditableError() });

    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/homes/${HOME_ID}`,
      headers: AUTH,
      payload: { bedrooms: 2 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      status: 409,
      code: 'HOME_NOT_EDITABLE',
      title: 'Conflicto con el estado actual',
    });
  });

  it('el id que no es un UUID es un 404 antes de validar el cuerpo', async () => {
    const { app } = setup({ role: 'seeker' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/homes/xx',
      headers: AUTH,
      payload: { bedrooms: 2 },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /homes/{homeId}/submit', () => {
  it('Scenario: Envío de una ficha completa - responde 200', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/homes/${HOME_ID}/submit`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{ operation: 'submitHome', args: ['user-1', HOME_ID] }]);
  });

  it('Scenario: Envío de una ficha incompleta - 422 con los campos que faltan', async () => {
    const { app } = setup({
      role: 'owner',
      failWith: new HomeIncompleteError(['valueMinCents', 'valueMaxCents']),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/homes/${HOME_ID}/submit`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'HOME_INCOMPLETE',
      errors: [{ field: 'valueMinCents' }, { field: 'valueMaxCents' }],
    });
  });
});

describe('POST /homes/{homeId}/pause y /resume', () => {
  it('Scenario: Pausar - el owner pausa su vivienda: 200 con la ficha y delega en el caso de uso', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/homes/${HOME_ID}/pause`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VIEW);
    expect(calls).toEqual([{ operation: 'pauseHome', args: ['user-1', HOME_ID] }]);
  });

  it('Scenario: Reactivar - 200 con la ficha y delega en el caso de uso, también para un seeker', async () => {
    for (const role of ['owner', 'seeker'] as const) {
      const { app, calls } = setup({ role });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/homes/${HOME_ID}/resume`,
        headers: AUTH,
      });

      expect(response.statusCode).toBe(200);
      expect(calls).toEqual([{ operation: 'resumeHome', args: ['user-1', HOME_ID] }]);
    }
  });

  it('Scenario: Pausar un borrador - el conflicto del dominio es un 409 con su código', async () => {
    const { app } = setup({ role: 'owner', failWith: new HomeNotPausableError() });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/homes/${HOME_ID}/pause`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'HOME_NOT_PAUSABLE' });
  });

  it('Scenario: Pausar un borrador - un seeker (solo tiene borradores) llega al caso de uso, que decide el 409', async () => {
    const { app, calls } = setup({ role: 'seeker', failWith: new HomeNotPausableError() });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/homes/${HOME_ID}/pause`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(409);
    expect(calls).toEqual([{ operation: 'pauseHome', args: ['user-1', HOME_ID] }]);
  });

  it('agency y admin no gestionan viviendas: 403 sin llegar al caso de uso', async () => {
    for (const role of ['agency', 'admin'] as const) {
      const { app, calls } = setup({ role });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/homes/${HOME_ID}/pause`,
        headers: AUTH,
      });

      expect(response.statusCode).toBe(403);
      expect(calls).toEqual([]);
    }
  });

  it('un identificador que no es un UUID es un 404 sin llegar al caso de uso', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const responses = await Promise.all(
      ['pause', 'resume'].map((action) =>
        app.inject({ method: 'POST', url: `/v1/homes/no-es-uuid/${action}`, headers: AUTH }),
      ),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404]);
    expect(calls).toEqual([]);
  });
});
