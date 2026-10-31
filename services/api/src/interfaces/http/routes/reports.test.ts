import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import {
  CannotBlockSelfError,
  ReportTargetNotFoundError,
} from '../../../application/moderation/report-errors.js';
import type { ReportView } from '../../../application/moderation/report-operations.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';
import type { ReportRouteOptions } from './reports.js';

const TARGET = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const AUTH = { authorization: 'Bearer token-de-prueba' };
const VIEW: ReportView = {
  id: 'report-1',
  targetType: 'home',
  targetId: TARGET,
  reason: 'Anuncio falso',
  status: 'open',
  resolution: null,
  evidence: null,
  createdAt: '2026-10-30T10:00:00.000Z',
};

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(
  options: { role?: Role | undefined; failWith?: Error; rateLimit?: { max: number } } = {},
) {
  const calls: { reports: unknown[][]; blocks: unknown[][] } = { reports: [], blocks: [] };
  const reports: ReportRouteOptions = {
    createReport: (...args) => {
      calls.reports.push(args);
      return options.failWith ? Promise.reject(options.failWith) : Promise.resolve(VIEW);
    },
    blockUser: (...args) => {
      calls.blocks.push(args);
      return options.failWith ? Promise.reject(options.failWith) : Promise.resolve();
    },
    ...(options.rateLimit
      ? { reportRateLimit: { ...options.rateLimit, windowSeconds: 3600 } }
      : {}),
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role, 'user-1')) },
    reports,
  });
  opened.push(app);
  return { app, calls };
}

const report = (app: FastifyInstance, payload: object) =>
  app.inject({ method: 'POST', url: '/v1/reports', headers: AUTH, payload });

describe('POST /reports', () => {
  it('Scenario: Denunciar una vivienda - responde 201 con la denuncia', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await report(app, {
      targetType: 'home',
      targetId: TARGET,
      reason: '  Anuncio falso ',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(VIEW);
    expect(calls.reports).toEqual([
      ['user-1', { targetType: 'home', targetId: TARGET, reason: 'Anuncio falso' }],
    ]);
  });

  it.each([
    { targetType: 'home', targetId: 'no-uuid', reason: 'x' },
    { targetType: 'home', targetId: TARGET, reason: '' },
    { targetType: 'planeta', targetId: TARGET, reason: 'x' },
    { targetType: 'home', targetId: TARGET, reason: 'x', extra: 1 },
  ])('un cuerpo no válido (%j) es un 400 y no llama al caso de uso', async (payload) => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await report(app, payload);

    expect(response.statusCode).toBe(400);
    expect(calls.reports).toEqual([]);
  });

  it('un objetivo que el caso de uso no encuentra es un 404', async () => {
    const { app } = setup({ role: 'owner', failWith: new ReportTargetNotFoundError() });

    const response = await report(app, { targetType: 'home', targetId: TARGET, reason: 'x' });

    expect(response.statusCode).toBe(404);
  });

  it('Scenario: límite - la denuncia número 11 en una hora es un 429, por usuario', async () => {
    const { app } = setup({ role: 'owner', rateLimit: { max: 2 } });
    const body = { targetType: 'home', targetId: TARGET, reason: 'x' };

    const statuses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      statuses.push((await report(app, body)).statusCode);
    }

    expect(statuses).toEqual([201, 201, 429]);
  });

  it('por defecto el límite son 10 denuncias por hora', async () => {
    const { app } = setup({ role: 'owner' });
    const body = { targetType: 'home', targetId: TARGET, reason: 'x' };

    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      statuses.push((await report(app, body)).statusCode);
    }

    expect(statuses.slice(0, 10).every((status) => status === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('sin token es un 401', async () => {
    const { app } = setup({ role: 'owner' });

    const response = await app.inject({ method: 'POST', url: '/v1/reports', payload: {} });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /me/blocked-users', () => {
  const block = (app: FastifyInstance, payload: object) =>
    app.inject({ method: 'POST', url: '/v1/me/blocked-users', headers: AUTH, payload });

  it('Scenario: Efecto del bloqueo - responde 204 sin cuerpo', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await block(app, { userId: TARGET });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(calls.blocks).toEqual([['user-1', TARGET]]);
  });

  it.each([{}, { userId: 'x' }, { userId: TARGET, extra: true }])(
    'un cuerpo no válido (%j) es un 400',
    async (payload) => {
      const { app, calls } = setup({ role: 'owner' });

      const response = await block(app, payload);

      expect(response.statusCode).toBe(400);
      expect(calls.blocks).toEqual([]);
    },
  );

  it('bloquearse a uno mismo es un 400', async () => {
    const { app } = setup({ role: 'owner', failWith: new CannotBlockSelfError() });

    const response = await block(app, { userId: TARGET });

    expect(response.statusCode).toBe(400);
  });

  it.each(['agency', 'admin'] as const)('el rol %s recibe 403', async (role) => {
    const { app } = setup({ role });

    const response = await block(app, { userId: TARGET });

    expect(response.statusCode).toBe(403);
  });
});
