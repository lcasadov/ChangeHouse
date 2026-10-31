import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type {
  AdminPanelOperations,
  WaitlistEntryView,
} from '../../../application/admin/admin-operations.js';
import { encodeCursor } from '../../../application/moderation/cursor.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';

const AUTH = { authorization: 'Bearer token-de-prueba' };
const AT = new Date('2026-10-20T10:00:00.000Z');
const USER_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const METRICS = {
  signups: 4,
  publishedHomesByZone: [{ zone: 'Getafe', count: 2 }],
  likes: 7,
  matches: { direct: 2, chain: 1 },
  operations: 1,
};
const ENTRY: WaitlistEntryView = {
  email: 'ana@example.com',
  municipality: 'Getafe',
  homeType: 'piso',
  lookingFor: 'Un ático',
  consentAt: AT.toISOString(),
};

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role | undefined; exported?: WaitlistEntryView[] } = {}) {
  const calls: Record<string, unknown[]> = {
    metrics: [],
    users: [],
    audit: [],
    waitlist: [],
    export: [],
  };
  const adminPanel: AdminPanelOperations = {
    adminGetMetrics: (...args) => {
      calls['metrics']?.push(args);
      return Promise.resolve(METRICS);
    },
    adminListUsers: (...args) => {
      calls['users']?.push(args);
      return Promise.resolve({ items: [], nextCursor: 'siguiente' });
    },
    adminListAuditLog: (...args) => {
      calls['audit']?.push(args);
      return Promise.resolve({ items: [], nextCursor: null });
    },
    adminListWaitlist: (...args) => {
      calls['waitlist']?.push(args);
      return Promise.resolve({ items: [ENTRY], nextCursor: null });
    },
    adminExportWaitlist: (...args) => {
      calls['export']?.push(args);
      return Promise.resolve(options.exported ?? [ENTRY]);
    },
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role, 'admin-1')) },
    adminPanel,
  });
  opened.push(app);
  return { app, calls };
}

const get = (app: FastifyInstance, url: string, headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url, headers: { ...AUTH, ...headers } });

describe('GET /admin/metrics', () => {
  it('Scenario: Métricas de un mes - devuelve los totales y consulta el periodo en días de Madrid', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await get(app, '/v1/admin/metrics?from=2026-10-01&to=2026-10-31');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(METRICS);
    expect(calls['metrics']).toEqual([
      [
        {
          from: '2026-10-01',
          to: '2026-10-31',
          start: new Date('2026-09-30T22:00:00.000Z'),
          end: new Date('2026-10-31T23:00:00.000Z'),
        },
      ],
    ]);
  });

  it('Scenario: Periodo invertido - responde 400 señalando la fecha final y no consulta nada', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await get(app, '/v1/admin/metrics?from=2026-10-31&to=2026-10-01');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ field: 'to' }] });
    expect(calls['metrics']).toEqual([]);
  });

  it('un periodo de más de 366 días es un 400 y uno de 366, un 200', async () => {
    const { app } = setup({ role: 'admin' });

    const long = await get(app, '/v1/admin/metrics?from=2026-01-01&to=2027-01-02');
    const max = await get(app, '/v1/admin/metrics?from=2026-01-01&to=2027-01-01');

    expect(long.statusCode).toBe(400);
    expect(long.json()).toMatchObject({ errors: [{ field: 'to' }] });
    expect(max.statusCode).toBe(200);
  });

  it.each(['', '?from=2026-10-01', '?from=hoy&to=2026-10-31'])(
    'las fechas son obligatorias y válidas: "%s" es un 400',
    async (query) => {
      const { app } = setup({ role: 'admin' });

      const response = await get(app, `/v1/admin/metrics${query}`);

      expect(response.statusCode).toBe(400);
    },
  );

  it.each(['seeker', 'owner', 'agency'] as const)('el rol %s recibe 403', async (role) => {
    const { app } = setup({ role });

    const response = await get(app, '/v1/admin/metrics?from=2026-10-01&to=2026-10-31');

    expect(response.statusCode).toBe(403);
  });
});

describe('GET /admin/users', () => {
  it('devuelve la página; el texto se recorta y el límite por defecto es 20', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await get(app, '/v1/admin/users?q=%20ana%40%20');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: 'siguiente' });
    expect(calls['users']).toEqual([[{ q: 'ana@', limit: 20 }]]);
  });

  it('un texto vacío equivale a no buscar; entiende cursor y límite', async () => {
    const { app, calls } = setup({ role: 'admin' });
    const cursor = encodeCursor({ at: AT, id: USER_ID });

    await get(app, `/v1/admin/users?q=&limit=5&cursor=${cursor}`);

    expect(calls['users']).toEqual([[{ cursor: { at: AT, id: USER_ID }, limit: 5 }]]);
  });

  it.each([`q=${'a'.repeat(201)}`, 'limit=0', 'limit=51', 'cursor=basura'])(
    '%s es un 400',
    async (query) => {
      const { app, calls } = setup({ role: 'admin' });

      const response = await get(app, `/v1/admin/users?${query}`);

      expect(response.statusCode).toBe(400);
      expect(calls['users']).toEqual([]);
    },
  );

  it.each(['seeker', 'owner', 'agency'] as const)('el rol %s recibe 403', async (role) => {
    const { app } = setup({ role });

    expect((await get(app, '/v1/admin/users')).statusCode).toBe(403);
  });
});

describe('GET /admin/audit-log', () => {
  it('devuelve la página y entiende un cursor con id numérico', async () => {
    const { app, calls } = setup({ role: 'admin' });
    const cursor = encodeCursor({ at: AT, id: '42' });

    const response = await get(app, `/v1/admin/audit-log?limit=10&cursor=${cursor}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: null });
    expect(calls['audit']).toEqual([[{ cursor: { at: AT, id: '42' }, limit: 10 }]]);
  });

  it.each([`cursor=${encodeCursor({ at: AT, id: USER_ID })}`, 'cursor=basura', 'limit=99'])(
    '%s es un 400',
    async (query) => {
      const { app } = setup({ role: 'admin' });

      expect((await get(app, `/v1/admin/audit-log?${query}`)).statusCode).toBe(400);
    },
  );

  it('Scenario: Ver la auditoría - es de solo lectura: ningún método de escritura existe', async () => {
    const { app } = setup({ role: 'admin' });

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const response = await app.inject({ method, url: '/v1/admin/audit-log', headers: AUTH });
      expect(response.statusCode, method).toBe(404);
    }
  });

  it.each(['seeker', 'owner', 'agency'] as const)('el rol %s recibe 403', async (role) => {
    const { app } = setup({ role });

    expect((await get(app, '/v1/admin/audit-log')).statusCode).toBe(403);
  });
});

describe('GET /admin/waitlist', () => {
  it('devuelve JSON paginado y filtra por municipio', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await get(app, '/v1/admin/waitlist?municipality=Getafe&limit=5');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ items: [ENTRY], nextCursor: null });
    expect(calls['waitlist']).toEqual([[{ municipality: 'Getafe', limit: 5 }]]);
    expect(calls['export']).toEqual([]);
  });

  it('Scenario: Exportar la lista de espera - con Accept text/csv devuelve las cinco columnas', async () => {
    const { app, calls } = setup({ role: 'admin' });

    const response = await get(app, '/v1/admin/waitlist?municipality=Getafe', {
      accept: 'text/csv',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body).toBe(
      'email,municipio,tipo de vivienda,qué busca,fecha de consentimiento\r\n' +
        `ana@example.com,Getafe,piso,Un ático,${AT.toISOString()}\r\n`,
    );
    expect(calls['export']).toEqual([[{ municipality: 'Getafe' }]]);
    expect(calls['waitlist']).toEqual([]);
  });

  it('escapa las fórmulas (= + - @) y entrecomilla comas, comillas y saltos de línea', async () => {
    const dangerous = (lookingFor: string, email = 'x@example.com'): WaitlistEntryView => ({
      ...ENTRY,
      email,
      lookingFor,
    });
    const { app } = setup({
      role: 'admin',
      exported: [
        dangerous('=HYPERLINK("http://x","y")'),
        dangerous('+1', '-a@example.com'),
        dangerous('-2'),
        dangerous('@SUMA(A1)'),
        dangerous('uno, dos'),
        dangerous('linea1\nlinea2'),
        dangerous('di "hola"'),
      ],
    });

    const response = await get(app, '/v1/admin/waitlist', { accept: 'text/csv' });

    const lines = response.body.split('\r\n');
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(lines[2]).toMatch(/^'-a@example\.com,Getafe,piso,'\+1,/);
    expect(lines[3]).toContain(",'-2,");
    expect(lines[4]).toContain(",'@SUMA(A1),");
    expect(lines[5]).toContain(',"uno, dos",');
    expect(response.body).toContain('"linea1\nlinea2"');
    expect(response.body).toContain('"di ""hola"""');
  });

  it('sin entradas, el CSV solo lleva la cabecera', async () => {
    const { app } = setup({ role: 'admin', exported: [] });

    const response = await get(app, '/v1/admin/waitlist', { accept: 'text/csv' });

    expect(response.body).toBe(
      'email,municipio,tipo de vivienda,qué busca,fecha de consentimiento\r\n',
    );
  });

  it.each(['municipality=' + 'a'.repeat(121), 'limit=0', 'cursor=basura'])(
    '%s es un 400',
    async (query) => {
      const { app } = setup({ role: 'admin' });

      expect((await get(app, `/v1/admin/waitlist?${query}`)).statusCode).toBe(400);
    },
  );

  it.each(['seeker', 'owner', 'agency'] as const)(
    'Scenario: Sin rol de administración - %s recibe 403, también para el CSV',
    async (role) => {
      const { app, calls } = setup({ role });

      const json = await get(app, '/v1/admin/waitlist');
      const csv = await get(app, '/v1/admin/waitlist', { accept: 'text/csv' });

      expect(json.statusCode).toBe(403);
      expect(csv.statusCode).toBe(403);
      expect(calls['export']).toEqual([]);
    },
  );
});
