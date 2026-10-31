import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import { encodeCursor } from '../../../application/moderation/cursor.js';
import { ReportNotFoundError } from '../../../application/moderation/report-errors.js';
import type { ReportView } from '../../../application/moderation/report-operations.js';
import type { Role } from '../../../domain/account/role.js';
import { ReportNotOpenError } from '../../../domain/moderation/errors.js';
import { buildApp } from '../app.js';
import type { AdminReportRouteOptions } from './admin-reports.js';

const REPORT_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const AUTH = { authorization: 'Bearer token-de-prueba' };
const NOW = new Date('2026-10-30T10:00:00.000Z');
const VIEW: ReportView = {
  id: REPORT_ID,
  targetType: 'message',
  targetId: 'msg-1',
  reason: 'Insultos',
  status: 'resolved',
  resolution: 'Hecho',
  evidence: { text: 'Texto', senderId: 'beto', sentAt: NOW.toISOString() },
  createdAt: NOW.toISOString(),
};

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role | undefined; failWith?: Error } = {}) {
  const calls: { list: unknown[][]; resolve: unknown[][] } = { list: [], resolve: [] };
  const adminReports: AdminReportRouteOptions = {
    adminListReports: (...args) => {
      calls.list.push(args);
      return Promise.resolve({ items: [VIEW], nextCursor: 'siguiente' });
    },
    adminResolveReport: (...args) => {
      calls.resolve.push(args);
      return options.failWith ? Promise.reject(options.failWith) : Promise.resolve(VIEW);
    },
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role, 'admin-1')) },
    adminReports,
  });
  opened.push(app);
  return { app, calls };
}

describe('GET /admin/reports', () => {
  it('devuelve la página con el límite por defecto y sin estado (el caso de uso elige las abiertas)', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await app.inject({ method: 'GET', url: '/v1/admin/reports', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [VIEW], nextCursor: 'siguiente' });
    expect(calls.list).toEqual([[{ limit: 20 }]]);
  });

  it('entiende estado, límite y cursor', async () => {
    const { app, calls } = setup({ role: 'admin' });
    const cursor = encodeCursor({ at: NOW, id: REPORT_ID });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/reports?status=dismissed&limit=5&cursor=${cursor}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(calls.list).toEqual([
      [{ status: 'dismissed', limit: 5, cursor: { at: NOW, id: REPORT_ID } }],
    ]);
  });

  it.each(['status=cerrada', 'limit=0', 'limit=51', 'cursor=basura'])(
    '%s es un 400',
    async (query) => {
      const { app, calls } = setup({ role: 'admin' });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/admin/reports?${query}`,
        headers: AUTH,
      });

      expect(response.statusCode).toBe(400);
      expect(calls.list).toEqual([]);
    },
  );

  it.each(['seeker', 'owner', 'agency'] as const)('el rol %s recibe 403', async (role) => {
    const { app } = setup({ role });

    const response = await app.inject({ method: 'GET', url: '/v1/admin/reports', headers: AUTH });

    expect(response.statusCode).toBe(403);
  });
});

describe('PATCH /admin/reports/:reportId', () => {
  const resolve = (app: FastifyInstance, id: string, payload: object) =>
    app.inject({ method: 'PATCH', url: `/v1/admin/reports/${id}`, headers: AUTH, payload });

  it('Scenario: Resolver una denuncia - devuelve la denuncia resuelta', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await resolve(app, REPORT_ID, { status: 'resolved', resolution: ' Hecho ' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VIEW);
    expect(calls.resolve).toEqual([
      ['admin-1', REPORT_ID, { status: 'resolved', resolution: 'Hecho' }],
    ]);
  });

  it.each([
    { status: 'resolved' },
    { status: 'resolved', resolution: '  ' },
    { status: 'open', resolution: 'x' },
    { status: 'resolved', resolution: 'x', extra: 1 },
  ])('la nota es obligatoria y el cuerpo estricto: %j es un 400', async (payload) => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await resolve(app, REPORT_ID, payload);

    expect(response.statusCode).toBe(400);
    expect(calls.resolve).toEqual([]);
  });

  it('un id que no es UUID es un 404 sin llamar al caso de uso', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await resolve(app, 'no-uuid', { status: 'resolved', resolution: 'x' });

    expect(response.statusCode).toBe(404);
    expect(calls.resolve).toEqual([]);
  });

  it('una denuncia inexistente es un 404 y una ya cerrada, un 409', async () => {
    const missing = setup({ role: 'admin', failWith: new ReportNotFoundError() });
    const closed = setup({ role: 'admin', failWith: new ReportNotOpenError() });
    const body = { status: 'dismissed', resolution: 'x' };

    expect((await resolve(missing.app, REPORT_ID, body)).statusCode).toBe(404);
    expect((await resolve(closed.app, REPORT_ID, body)).statusCode).toBe(409);
  });

  it.each(['seeker', 'owner', 'agency'] as const)('el rol %s recibe 403', async (role) => {
    const { app } = setup({ role });

    const response = await resolve(app, REPORT_ID, { status: 'resolved', resolution: 'x' });

    expect(response.statusCode).toBe(403);
  });
});
