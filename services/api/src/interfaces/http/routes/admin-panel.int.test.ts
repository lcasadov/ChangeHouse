import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openSql, testConfig } from '../../../../test/fixtures.js';
import { principalOf } from '../../../../test/http.js';
import { adminOperations } from '../../../application/admin/admin-operations.js';
import {
  createDatabase,
  type DatabaseConnection,
} from '../../../infrastructure/persistence/drizzle/database.js';
import {
  DrizzleAuditReader,
  DrizzleMetricsReader,
  DrizzleUserDirectory,
  DrizzleWaitlistReader,
} from '../../../infrastructure/persistence/drizzle/drizzle-admin-readers.js';
import { buildApp } from '../app.js';

const sql = openSql();
const config = testConfig();
const AUTH = { authorization: 'Bearer token-de-prueba' };
let connection: DatabaseConnection;
let app: FastifyInstance;
let role: 'admin' | 'owner' = 'admin';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
interface UserJson {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  suspended: boolean;
}

beforeAll(async () => {
  connection = createDatabase(config.databaseUrl);
  const { db } = connection;
  app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(role, 'admin-1')) },
    adminPanel: adminOperations({
      metrics: new DrizzleMetricsReader(db),
      users: new DrizzleUserDirectory(db),
      audit: new DrizzleAuditReader(db),
      waitlist: new DrizzleWaitlistReader(db),
    }),
  });
  await app.ready();
});

beforeEach(async () => {
  role = 'admin';
  await sql`TRUNCATE matches, users, waitlist CASCADE`;
});

afterAll(async () => {
  await app.close();
  await connection.close();
  await sql.end();
});

const get = (url: string, headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url, headers: { ...AUTH, ...headers } });

async function addUser(
  name: string,
  email: string,
  changes: { createdAt?: string; suspended?: boolean; admin?: boolean; deleted?: boolean } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await sql`INSERT INTO users (id, firebase_uid, email, display_name, assigned_role, created_at,
                              suspended_at, suspension_reason, deleted_at)
            VALUES (${id}, ${`uid-${id}`}, ${email}, ${name},
                    ${changes.admin ? 'admin' : null},
                    ${changes.createdAt ?? '2026-10-10T10:00:00Z'},
                    ${changes.suspended ? '2026-10-11T10:00:00Z' : null},
                    ${changes.suspended ? 'Fraude' : null},
                    ${changes.deleted ? '2026-10-12T10:00:00Z' : null})`;
  return id;
}

async function addHome(
  ownerId: string,
  options: {
    status?: string;
    municipality: string | null;
    area: string;
    publishedAt: string | null;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await sql`INSERT INTO homes (id, owner_id, type, status, exact_address, exact_location,
                               approx_location, area_name, municipality, published_at)
            VALUES (${id}, ${ownerId}, 'piso', ${options.status ?? 'published'}, decode('00', 'hex'),
                    ST_MakePoint(-3.7, 40.4)::geography, ST_MakePoint(-3.7, 40.4)::geography,
                    ${options.area}, ${options.municipality}, ${options.publishedAt})`;
  return id;
}

const addLike = (from: string, to: string, at: string) =>
  sql`INSERT INTO likes (from_home_id, to_home_id, created_at) VALUES (${from}, ${to}, ${at})`;

const addMatch = (type: 2 | 3, status: string, at: string) =>
  sql`INSERT INTO matches (id, type, status, cycle_key, created_at)
      VALUES (${crypto.randomUUID()}, ${type}, ${status}, ${crypto.randomUUID()}, ${at})`;

describe('GET /admin/metrics con PostgreSQL', () => {
  async function seedOctober(): Promise<void> {
    // Día 1 a las 00:00 de Madrid (UTC+2) dentro; un segundo antes, fuera; 31 a las 23:59 dentro y
    // el 1 de noviembre a las 00:00 de Madrid (UTC+1), fuera
    const ana = await addUser('Ana', 'ana@example.com', { createdAt: '2026-09-30T22:00:00Z' });
    await addUser('Beto', 'beto@example.com', { createdAt: '2026-09-30T21:59:59Z' });
    const carla = await addUser('Carla', 'carla@example.com', {
      createdAt: '2026-10-31T22:59:59Z',
    });
    await addUser('Dani', 'dani@example.com', { createdAt: '2026-10-31T23:00:00Z' });

    const getafe1 = await addHome(ana, {
      municipality: 'Getafe',
      area: 'Centro',
      publishedAt: '2026-10-05T10:00:00Z',
    });
    const getafe2 = await addHome(ana, {
      municipality: 'Getafe',
      area: 'Sector 3',
      publishedAt: '2026-10-20T10:00:00Z',
    });
    const leganes = await addHome(carla, {
      municipality: 'Leganés',
      area: 'Zarzaquemada',
      publishedAt: '2026-10-10T10:00:00Z',
    });
    const sinMunicipio = await addHome(carla, {
      municipality: null,
      area: 'Malasaña',
      publishedAt: '2026-10-12T10:00:00Z',
    });
    await addHome(carla, {
      municipality: 'Madrid',
      area: 'Centro',
      publishedAt: '2026-09-15T10:00:00Z',
    });
    await addHome(carla, {
      status: 'draft',
      municipality: 'Madrid',
      area: 'Centro',
      publishedAt: null,
    });

    await addLike(getafe1, leganes, '2026-10-06T10:00:00Z');
    await addLike(leganes, getafe1, '2026-10-07T10:00:00Z');
    await addLike(sinMunicipio, getafe1, '2026-10-08T10:00:00Z');
    await addLike(getafe2, leganes, '2026-11-02T10:00:00Z');

    await addMatch(2, 'open', '2026-10-07T10:00:00Z');
    await addMatch(2, 'in_operation', '2026-10-08T10:00:00Z');
    await addMatch(3, 'confirmed', '2026-10-09T10:00:00Z');
    await addMatch(3, 'open', '2026-11-02T10:00:00Z');
  }

  it('Scenario: Métricas de un mes - totales del periodo y viviendas por zona; directos y en cadena por separado', async () => {
    await seedOctober();

    const response = await get('/v1/admin/metrics?from=2026-10-01&to=2026-10-31');

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      signups: 2,
      // Por municipio, o por barrio o zona si falta; de más a menos y, a igualdad, por nombre
      publishedHomesByZone: [
        { zone: 'Getafe', count: 2 },
        { zone: 'Leganés', count: 1 },
        { zone: 'Malasaña', count: 1 },
      ],
      likes: 3,
      matches: { direct: 2, chain: 1 },
      operations: 1,
    });
  });

  it('un periodo sin actividad devuelve ceros y ninguna zona', async () => {
    await seedOctober();

    const response = await get('/v1/admin/metrics?from=2025-01-01&to=2025-01-31');

    expect(response.json()).toEqual({
      signups: 0,
      publishedHomesByZone: [],
      likes: 0,
      matches: { direct: 0, chain: 0 },
      operations: 0,
    });
  });

  it('Scenario: Periodo invertido - 400 con el campo', async () => {
    const response = await get('/v1/admin/metrics?from=2026-10-31&to=2026-10-01');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ field: 'to' }] });
  });

  it('un periodo de más de 366 días es un 400', async () => {
    const response = await get('/v1/admin/metrics?from=2025-01-01&to=2026-06-01');

    expect(response.statusCode).toBe(400);
  });
});

describe('GET /admin/users con PostgreSQL', () => {
  it('Scenario: Buscar un usuario - por prefijo de email, con su estado', async () => {
    await addUser('Ana López', 'ana@example.com');
    await addUser('Beto', 'beto@example.com', { suspended: true });

    const found = await get('/v1/admin/users?q=ana@');
    const suspended = await get('/v1/admin/users?q=beto');

    expect(found.json<Page<UserJson>>().items).toEqual([
      expect.objectContaining({
        email: 'ana@example.com',
        displayName: 'Ana López',
        roles: ['seeker'],
        suspended: false,
      }),
    ]);
    expect(suspended.json<Page<UserJson>>().items).toEqual([
      expect.objectContaining({ email: 'beto@example.com', suspended: true }),
    ]);
  });

  it.each([
    ['ANA', 'Ana López'],
    ['alvaro', 'Álvaro Pérez'],
    ['ÁLV', 'Álvaro Pérez'],
    ['alvaro@EXAMPLE', 'Álvaro Pérez'],
    ['nuñ', 'Núñez'],
  ])('busca "%s" sin distinguir mayúsculas ni tildes', async (q, name) => {
    await addUser('Ana López', 'ana@example.com');
    await addUser('Álvaro Pérez', 'alvaro@example.com');
    await addUser('Núñez', 'otro@example.com');

    const response = await get(`/v1/admin/users?q=${encodeURIComponent(q)}`);

    expect(response.json<Page<UserJson>>().items.map((item) => item.displayName)).toEqual([name]);
  });

  it('es búsqueda por prefijo y los comodines de SQL no se interpretan', async () => {
    await addUser('Ana López', 'ana@example.com');

    const middle = await get('/v1/admin/users?q=lopez');
    const wildcard = await get('/v1/admin/users?q=%25');
    const underscore = await get('/v1/admin/users?q=_na');

    expect(middle.json<Page<UserJson>>().items).toEqual([]);
    expect(wildcard.json<Page<UserJson>>().items).toEqual([]);
    expect(underscore.json<Page<UserJson>>().items).toEqual([]);
  });

  it('muestra el rol (asignado o derivado) y omite las cuentas borradas', async () => {
    const owner = await addUser('Dueña', 'duena@example.com');
    await addHome(owner, {
      municipality: 'Getafe',
      area: 'Centro',
      publishedAt: '2026-10-05T10:00:00Z',
    });
    await addUser('Admin', 'admin@example.com', { admin: true });
    await addUser('Borrada', 'borrada@example.com', { deleted: true });

    const response = await get('/v1/admin/users');

    const roles = Object.fromEntries(
      response.json<Page<UserJson>>().items.map((item) => [item.displayName, item.roles]),
    );
    expect(roles).toEqual({ Dueña: ['owner'], Admin: ['admin'] });
  });

  it('pagina con cursor de la más reciente a la más antigua, sin repetir ni saltar usuarios', async () => {
    for (let day = 1; day <= 5; day += 1) {
      await addUser(`Usuario ${String(day)}`, `u${String(day)}@example.com`, {
        createdAt: `2026-10-0${String(day)}T10:00:00Z`,
      });
    }

    const first = (await get('/v1/admin/users?limit=2')).json<Page<UserJson>>();
    const second = (await get(`/v1/admin/users?limit=2&cursor=${first.nextCursor ?? ''}`)).json<
      Page<UserJson>
    >();
    const third = (await get(`/v1/admin/users?limit=2&cursor=${second.nextCursor ?? ''}`)).json<
      Page<UserJson>
    >();

    expect(first.items.map((item) => item.displayName)).toEqual(['Usuario 5', 'Usuario 4']);
    expect(second.items.map((item) => item.displayName)).toEqual(['Usuario 3', 'Usuario 2']);
    expect(third.items.map((item) => item.displayName)).toEqual(['Usuario 1']);
    expect(third.nextCursor).toBeNull();
  });
});

describe('GET /admin/audit-log con PostgreSQL', () => {
  async function seedAudit(): Promise<{ actor: string; entities: string[] }> {
    const actor = await addUser('Admin', 'admin@example.com', { admin: true });
    const entities: string[] = [];
    for (const [index, action] of ['home.approve', 'user.suspend', 'report.resolve'].entries()) {
      const entityId = crypto.randomUUID();
      entities.push(entityId);
      await sql`INSERT INTO audit_log (actor_id, action, entity, entity_id, at)
                VALUES (${actor}, ${action}, 'user', ${entityId},
                        ${`2026-10-0${String(index + 1)}T10:00:00Z`})`;
    }
    return { actor, entities };
  }

  it('Scenario: Ver la auditoría - del más reciente al más antiguo, con autor, entidad y fecha', async () => {
    const { actor, entities } = await seedAudit();

    const response = await get('/v1/admin/audit-log');

    expect(response.statusCode, response.body).toBe(200);
    const page = response.json<Page<{ id: number }>>();
    expect(page.items).toEqual([
      {
        id: expect.any(Number) as number,
        actorId: actor,
        action: 'report.resolve',
        entity: 'user',
        entityId: entities[2],
        at: '2026-10-03T10:00:00.000Z',
      },
      expect.objectContaining({ action: 'user.suspend', at: '2026-10-02T10:00:00.000Z' }),
      expect.objectContaining({ action: 'home.approve', at: '2026-10-01T10:00:00.000Z' }),
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('pagina con cursor sin repetir entradas', async () => {
    await seedAudit();

    const first = (await get('/v1/admin/audit-log?limit=2')).json<Page<{ action: string }>>();
    const second = (await get(`/v1/admin/audit-log?limit=2&cursor=${first.nextCursor ?? ''}`)).json<
      Page<{ action: string }>
    >();

    expect(first.items.map((item) => item.action)).toEqual(['report.resolve', 'user.suspend']);
    expect(second.items.map((item) => item.action)).toEqual(['home.approve']);
    expect(second.nextCursor).toBeNull();
  });

  it('es de solo lectura: ninguna escritura llega y el registro no cambia', async () => {
    await seedAudit();

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/admin/audit-log',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(404);
    const [row] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM audit_log`;
    expect(row?.total).toBe(3);
  });
});

describe('GET /admin/waitlist con PostgreSQL', () => {
  async function seedWaitlist(): Promise<void> {
    const rows = [
      ['ana@example.com', 'Getafe', 'piso', 'Un ático', '2026-10-01T10:00:00Z'],
      ['beto@example.com', 'Leganés', 'chalet', '=CMD|"/c calc"!A1', '2026-10-02T10:00:00Z'],
      ['carla@example.com', 'Getafe', 'atico', 'Algo, con "luz"', '2026-10-03T10:00:00Z'],
    ];
    for (const [email, municipality, homeType, lookingFor, consentAt] of rows) {
      await sql`INSERT INTO waitlist (id, email, municipality, home_type, looking_for, consent_at)
                VALUES (${crypto.randomUUID()}, ${email ?? ''}, ${municipality ?? ''},
                        ${homeType ?? ''}, ${lookingFor ?? ''}, ${consentAt ?? ''})`;
    }
  }

  it('lista en JSON, de la más reciente a la más antigua, y filtra por municipio', async () => {
    await seedWaitlist();

    const all = (await get('/v1/admin/waitlist')).json<Page<{ email: string }>>();
    const getafe = (await get('/v1/admin/waitlist?municipality=Getafe')).json<
      Page<Record<string, string>>
    >();

    expect(all.items.map((item) => item.email)).toEqual([
      'carla@example.com',
      'beto@example.com',
      'ana@example.com',
    ]);
    expect(getafe.items).toEqual([
      expect.objectContaining({ email: 'carla@example.com', homeType: 'atico' }),
      {
        email: 'ana@example.com',
        municipality: 'Getafe',
        homeType: 'piso',
        lookingFor: 'Un ático',
        consentAt: '2026-10-01T10:00:00.000Z',
      },
    ]);
  });

  it('el filtro por municipio no distingue mayúsculas ni tildes', async () => {
    await seedWaitlist();

    const response = await get(`/v1/admin/waitlist?municipality=${encodeURIComponent('LEGANES')}`);

    expect(response.json<Page<{ email: string }>>().items.map((item) => item.email)).toEqual([
      'beto@example.com',
    ]);
  });

  it('pagina con cursor', async () => {
    await seedWaitlist();

    const first = (await get('/v1/admin/waitlist?limit=2')).json<Page<{ email: string }>>();
    const second = (await get(`/v1/admin/waitlist?limit=2&cursor=${first.nextCursor ?? ''}`)).json<
      Page<{ email: string }>
    >();

    expect(first.items).toHaveLength(2);
    expect(second.items.map((item) => item.email)).toEqual(['ana@example.com']);
    expect(second.nextCursor).toBeNull();
  });

  it('Scenario: Exportar la lista de espera - CSV con las cinco columnas y fórmulas neutralizadas', async () => {
    await seedWaitlist();

    const response = await get('/v1/admin/waitlist?municipality=Leganes', { accept: 'text/csv' });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toBe(
      'email,municipio,tipo de vivienda,qué busca,fecha de consentimiento\r\n' +
        `beto@example.com,Leganés,chalet,"'=CMD|""/c calc""!A1",2026-10-02T10:00:00.000Z\r\n`,
    );
  });

  it('Scenario: Sin rol de administración - un owner recibe 403 en JSON y en CSV', async () => {
    await seedWaitlist();
    role = 'owner';

    const json = await get('/v1/admin/waitlist');
    const csv = await get('/v1/admin/waitlist', { accept: 'text/csv' });

    expect(json.statusCode).toBe(403);
    expect(csv.statusCode).toBe(403);
    expect(csv.body).not.toContain('ana@example.com');
  });
});
