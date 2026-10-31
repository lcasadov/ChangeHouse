import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type { Me } from '../../../application/account/me.js';
import type { UpsertMeCommand } from '../../../application/account/upsert-me.js';
import type { Principal } from '../../../application/auth/principal.js';
import { type Consent, LegalAcceptanceRequiredError } from '../../../domain/account/consent.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';
import { type AccountRouteOptions } from './accounts.js';

const ME: Me = {
  id: 'user-1',
  email: 'ana@example.com',
  displayName: 'Ana',
  municipality: null,
  phone: null,
  meetsVppRequirements: false,
  isOver65: false,
  roles: ['seeker'],
  hasPublishedHome: false,
  suspended: false,
};
const ACCEPTED_AT = new Date('2026-10-19T10:00:00.000Z');
const PRIVACY: Consent = { type: 'privacy', version: '2026-10', acceptedAt: ACCEPTED_AT };

interface Calls {
  getMe: string[];
  upsertMe: UpsertMeCommand[];
  listMyConsents: string[];
  acceptConsent: { userId: string; type: string; version: string }[];
}

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role | undefined; created?: boolean; upsertError?: Error } = {}) {
  const calls: Calls = { getMe: [], upsertMe: [], listMyConsents: [], acceptConsent: [] };
  const accounts: AccountRouteOptions = {
    getMe: (userId) => {
      calls.getMe.push(userId);
      return Promise.resolve(ME);
    },
    upsertMe: (command) => {
      calls.upsertMe.push(command);
      if (options.upsertError) return Promise.reject(options.upsertError);
      return Promise.resolve({ created: options.created ?? false, me: ME });
    },
    listMyConsents: (userId) => {
      calls.listMyConsents.push(userId);
      return Promise.resolve([PRIVACY]);
    },
    acceptConsent: (userId, input) => {
      calls.acceptConsent.push({ userId, ...input });
      return Promise.resolve({ ...input, acceptedAt: ACCEPTED_AT });
    },
  };
  const principal: Principal = principalOf(options.role);
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principal) },
    accounts,
  });
  opened.push(app);
  return { app, calls };
}

const AUTH = { authorization: 'Bearer token-de-prueba' };

describe('GET /me', () => {
  it('Scenario: Consultar la propia cuenta - devuelve la cuenta del usuario autenticado', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({ method: 'GET', url: '/v1/me', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ME);
    expect(calls.getMe).toEqual(['user-1']);
  });

  it('sin cuenta en ChangeHouse responde 404 sin ejecutar el caso de uso', async () => {
    const { app, calls } = setup();

    const response = await app.inject({ method: 'GET', url: '/v1/me', headers: AUTH });

    expect(response.statusCode).toBe(404);
    expect(calls.getMe).toEqual([]);
  });

  it('sin token responde 401', async () => {
    const { app } = setup({ role: 'seeker' });

    expect((await app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401);
  });
});

describe('PUT /me', () => {
  const body = {
    displayName: ' Ana ',
    acceptedTermsVersion: '2026-10',
    acceptedPrivacyVersion: '2026-10',
  };

  it('Scenario: Primer acceso completo - 201 con la cuenta, pasando la identidad verificada y los datos validados', async () => {
    const { app, calls } = setup({ created: true });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: AUTH,
      payload: body,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(ME);
    expect(calls.upsertMe).toEqual([
      {
        identity: principalOf().identity,
        input: { ...body, displayName: 'Ana' },
      },
    ]);
  });

  it('Scenario: Alta repetida - 200 cuando el usuario ya existía', async () => {
    const { app } = setup({ role: 'seeker', created: false });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: AUTH,
      payload: body,
    });

    expect(response.statusCode).toBe(200);
  });

  it('Scenario: El cliente no fija roles - un campo de rol o de estado da 400 señalándolo y no se ejecuta nada', async () => {
    const { app, calls } = setup();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: AUTH,
      payload: { ...body, roles: ['admin'], assignedRole: 'admin', status: 'suspended' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual([
      'roles',
      'assignedRole',
      'status',
    ]);
    expect(calls.upsertMe).toEqual([]);
  });

  it('un nombre vacío da 400 y no se ejecuta nada', async () => {
    const { app, calls } = setup();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: AUTH,
      payload: { displayName: '  ' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: unknown[] }>().errors).toEqual([
      { field: 'displayName', message: 'required' },
    ]);
    expect(calls.upsertMe).toEqual([]);
  });

  it('Scenario: Sin aceptar los textos legales - 422 con código estable y los campos que faltan', async () => {
    const { app } = setup({
      upsertError: new LegalAcceptanceRequiredError(['acceptedPrivacyVersion']),
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: AUTH,
      payload: { displayName: 'Ana', acceptedTermsVersion: '2026-10' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      status: 422,
      code: 'LEGAL_ACCEPTANCE_REQUIRED',
      errors: [{ field: 'acceptedPrivacyVersion', message: 'required' }],
    });
  });

  it('sin token responde 401 aunque el cuerpo no sea válido', async () => {
    const { app } = setup();

    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me',
      payload: { roles: ['admin'] },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /me/consents y POST /me/consents', () => {
  it('lista los consentimientos con su fecha en ISO 8601', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await app.inject({ method: 'GET', url: '/v1/me/consents', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { type: 'privacy', version: '2026-10', acceptedAt: '2026-10-19T10:00:00.000Z' },
    ]);
    expect(calls.listMyConsents).toEqual(['user-1']);
  });

  it('Scenario: Aceptar una nueva versión de la privacidad - 201 con el consentimiento registrado', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/consents',
      headers: AUTH,
      payload: { type: 'privacy', version: '2026-10' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      type: 'privacy',
      version: '2026-10',
      acceptedAt: '2026-10-19T10:00:00.000Z',
    });
    expect(calls.acceptConsent).toEqual([
      { userId: 'user-1', type: 'privacy', version: '2026-10' },
    ]);
  });

  it('un tipo desconocido, una versión vacía o un campo de más dan 400', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    for (const payload of [
      { type: 'cookies', version: '1' },
      { type: 'terms', version: '' },
      { type: 'terms', version: '1', userId: 'otro-usuario' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/me/consents',
        headers: AUTH,
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    expect(calls.acceptConsent).toEqual([]);
  });

  it('sin cuenta en ChangeHouse ambas operaciones responden 404', async () => {
    const { app } = setup();

    const list = await app.inject({ method: 'GET', url: '/v1/me/consents', headers: AUTH });
    const accept = await app.inject({
      method: 'POST',
      url: '/v1/me/consents',
      headers: AUTH,
      payload: { type: 'terms', version: '2026-10' },
    });

    expect([list.statusCode, accept.statusCode]).toEqual([404, 404]);
  });
});
