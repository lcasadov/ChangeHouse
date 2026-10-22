import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import { HomeNotFoundError } from '../../../application/home/errors.js';
import type { HomeView } from '../../../application/home/home-views.js';
import { encodeCursor } from '../../../application/moderation/cursor.js';
import type { Role } from '../../../domain/account/role.js';
import { HomeNotInReviewError } from '../../../domain/home/errors.js';
import { buildApp } from '../app.js';
import type { AdminHomeRouteOptions } from './admin-homes.js';

const HOME_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const VIEW = { id: HOME_ID, status: 'in_review' } as unknown as HomeView;
const AUTH = { authorization: 'Bearer token-de-prueba' };
const NOW = new Date('2026-10-19T10:00:00.000Z');

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
  const admin: AdminHomeRouteOptions = {
    adminListHomes: respond('adminListHomes', { items: [VIEW], nextCursor: null }),
    adminModerateHome: respond('adminModerateHome', VIEW),
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role, 'admin-1')) },
    adminHomes: admin,
  });
  opened.push(app);
  return { app, calls };
}

describe('GET /admin/homes', () => {
  it('Scenario: Ver la cola - un admin recibe la página con el estado pedido y el límite por defecto', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/homes?status=in_review',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [VIEW], nextCursor: null });
    expect(calls).toEqual([
      { operation: 'adminListHomes', args: [{ status: 'in_review', limit: 20 }] },
    ]);
  });

  it('sin estado lista todas; entiende el límite y el cursor', async () => {
    const { app, calls } = setup({ role: 'admin' });
    const cursor = encodeCursor({ at: NOW, id: HOME_ID });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/homes?limit=50&cursor=${cursor}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        operation: 'adminListHomes',
        args: [{ limit: 50, cursor: { at: NOW, id: HOME_ID } }],
      },
    ]);
  });

  it.each(['seeker', 'owner', 'agency'] as const)(
    'Scenario: Usuario sin rol de administración - %s recibe 403 y no se ejecuta nada',
    async (role) => {
      const { app, calls } = setup({ role });

      const response = await app.inject({ method: 'GET', url: '/v1/admin/homes', headers: AUTH });

      expect(response.statusCode).toBe(403);
      expect(calls).toEqual([]);
    },
  );

  it('sin token responde 401', async () => {
    const { app } = setup({ role: 'admin' });

    const response = await app.inject({ method: 'GET', url: '/v1/admin/homes' });

    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['status=publicada', 'status'],
    ['limit=0', 'limit'],
    ['limit=51', 'limit'],
    ['limit=abc', 'limit'],
    ['cursor=basura', 'cursor'],
    ['cursor=', 'cursor'],
  ])('la consulta %s es un 400 que señala %s', async (query, field) => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/homes?${query}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual([
      field,
    ]);
    expect(calls).toEqual([]);
  });
});

describe('POST /admin/homes/{homeId}/moderation', () => {
  const url = `/v1/admin/homes/${HOME_ID}/moderation`;

  it('Scenario: Aprobar - delega con el admin autenticado y responde 200 con la ficha', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await app.inject({
      method: 'POST',
      url,
      headers: AUTH,
      payload: { decision: 'approve' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VIEW);
    expect(calls).toEqual([
      { operation: 'adminModerateHome', args: ['admin-1', HOME_ID, { decision: 'approve' }] },
    ]);
  });

  it('Scenario: Rechazar con motivo - pasa el motivo recortado al caso de uso', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await app.inject({
      method: 'POST',
      url,
      headers: AUTH,
      payload: { decision: 'reject', reason: ' Las fotos no corresponden ' },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        operation: 'adminModerateHome',
        args: ['admin-1', HOME_ID, { decision: 'reject', reason: 'Las fotos no corresponden' }],
      },
    ]);
  });

  it.each([{ decision: 'reject' }, { decision: 'reject', reason: '   ' }])(
    'Scenario: Rechazar sin motivo - %j responde 400 señalando reason y no ejecuta nada',
    async (payload) => {
      const { app, calls } = setup({ role: 'admin' });

      const response = await app.inject({ method: 'POST', url, headers: AUTH, payload });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ errors: { field: string }[] }>().errors[0]?.field).toBe('reason');
      expect(calls).toEqual([]);
    },
  );

  it.each(['seeker', 'owner', 'agency'] as const)(
    'Scenario: Usuario sin rol de administración - %s recibe 403 al moderar',
    async (role) => {
      const { app, calls } = setup({ role });

      const response = await app.inject({
        method: 'POST',
        url,
        headers: AUTH,
        payload: { decision: 'approve' },
      });

      expect(response.statusCode).toBe(403);
      expect(calls).toEqual([]);
    },
  );

  it('Scenario: Moderar algo que no está en revisión - el conflicto del dominio es un 409 Problem', async () => {
    const { app } = setup({ role: 'admin', failWith: new HomeNotInReviewError() });

    const response = await app.inject({
      method: 'POST',
      url,
      headers: AUTH,
      payload: { decision: 'approve' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 409, code: 'HOME_NOT_IN_REVIEW' });
  });

  it('una vivienda inexistente o un id que no es UUID es un 404', async () => {
    const missing = setup({ role: 'admin', failWith: new HomeNotFoundError() });
    const malformed = setup({ role: 'admin' });

    const first = await missing.app.inject({
      method: 'POST',
      url,
      headers: AUTH,
      payload: { decision: 'approve' },
    });
    const second = await malformed.app.inject({
      method: 'POST',
      url: '/v1/admin/homes/no-es-uuid/moderation',
      headers: AUTH,
      payload: { decision: 'approve' },
    });

    expect(first.statusCode).toBe(404);
    expect(second.statusCode).toBe(404);
    expect(malformed.calls).toEqual([]);
  });

  it('Scenario: Sin auditoría no hay decisión - un fallo técnico es un 500 Problem sin detalles internos', async () => {
    const { app } = setup({ role: 'admin', failWith: new Error('relation audit_log is locked') });

    const response = await app.inject({
      method: 'POST',
      url,
      headers: AUTH,
      payload: { decision: 'approve' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).not.toContain('audit_log');
  });
});
