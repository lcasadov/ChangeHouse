import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';
import { type GeoPoint, newDraft } from '../../../domain/home/home.js';
import { AddressCipher } from '../../../infrastructure/crypto/address-cipher.js';
import {
  createDatabase,
  type DatabaseConnection,
} from '../../../infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeRepository } from '../../../infrastructure/persistence/drizzle/drizzle-home-repository.js';

const EUR = 100;
const euros = (amount: number) => amount * EUR;
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';
const REASON = 'Fraude reiterado';

const POINTS = {
  getafe: { lat: 40.3056, lng: -3.7321 },
  leganes: { lat: 40.3272, lng: -3.7635 },
} satisfies Record<string, GeoPoint>;
const SEARCH_LEGANES = {
  municipalities: ['Leganés'],
  maxToPayCents: euros(30_000),
  minToReceiveCents: 0,
};
const SEARCH_GETAFE = { municipalities: ['Getafe'], maxToPayCents: 0, minToReceiveCents: 0 };

interface Person extends EmulatorUser {
  id: string;
}

interface Problem {
  status: number;
  code?: string;
}

const sql = openSql();
const config = testConfig();
let api: ReturnType<typeof createApi>;
let app: FastifyInstance;
let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let published = 0;

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

function call(
  user: EmulatorUser,
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  url: string,
  payload?: object,
) {
  return app.inject({ method, url, headers: bearer(user), ...(payload ? { payload } : {}) });
}

async function registered(displayName: string, assignedRole?: 'admin'): Promise<Person> {
  const user = await signUp();
  const response = await app.inject({
    method: 'PUT',
    url: '/v1/me',
    headers: bearer(user),
    payload: {
      displayName,
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
    },
  });
  expect(response.statusCode).toBe(201);
  if (assignedRole) {
    await sql`UPDATE users SET assigned_role = ${assignedRole} WHERE firebase_uid = ${user.uid}`;
  }
  const [row] = await sql<{ id: string }[]>`SELECT id FROM users WHERE firebase_uid = ${user.uid}`;
  return { ...user, id: row?.id ?? '' };
}

/** Una vivienda publicada del propietario, con valor fijo. */
async function home(
  owner: Person,
  municipality: string,
  point: GeoPoint,
  valueEuros: number,
): Promise<string> {
  published += 1;
  const id = crypto.randomUUID();
  const draft = newDraft({
    id,
    ownerId: owner.id,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: `Calle Mayor, ${String(published)}, ${municipality}`,
    location: {
      exact: point,
      areaName: `${municipality} Centro`,
      areaCenter: { lat: point.lat + 0.001, lng: point.lng + 0.001 },
      municipality,
    },
    details: {
      usefulM2: 80,
      builtM2: 95,
      bedrooms: 3,
      bathrooms: 2,
      hasLift: true,
      garage: false,
      storageRoom: false,
      isPrimaryResidence: true,
      valueMinCents: euros(valueEuros),
      valueMaxCents: euros(valueEuros),
    },
  });
  await homes.insert({
    ...draft,
    status: 'published',
    publishedAt: new Date('2026-10-02T09:00:00.000Z'),
  });
  return id;
}

async function owner(
  name: string,
  municipality: 'Getafe' | 'Leganés',
): Promise<{ person: Person; home: string }> {
  const person = await registered(name);
  const getafe = municipality === 'Getafe';
  const theirs = await home(
    person,
    municipality,
    getafe ? POINTS.getafe : POINTS.leganes,
    getafe ? 200_000 : 212_000,
  );
  const preferences = await call(
    person,
    'PUT',
    '/v1/me/search-preferences',
    getafe ? SEARCH_LEGANES : SEARCH_GETAFE,
  );
  expect(preferences.statusCode, preferences.body).toBe(200);
  return { person, home: theirs };
}

const like = (user: EmulatorUser, fromHomeId: string, targetHomeId: string) =>
  call(user, 'POST', '/v1/me/likes', { fromHomeId, targetHomeId });

const setSuspension = (admin: EmulatorUser, userId: string, payload: object) =>
  call(admin, 'PUT', `/v1/admin/users/${userId}/suspension`, payload);

async function discoveredFrom(user: EmulatorUser, homeId: string): Promise<string[]> {
  const response = await call(user, 'GET', `/v1/discover?homeId=${homeId}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<{ items: { id: string }[] }>().items.map((card) => card.id);
}

const suspensionOf = async (userId: string) =>
  (
    await sql<{ suspended_at: Date | null; suspension_reason: string | null }[]>`
      SELECT suspended_at, suspension_reason FROM users WHERE id = ${userId}`
  )[0];

const auditOf = (entityId: string) =>
  sql<{ actor_id: string; action: string; entity: string }[]>`
    SELECT actor_id, action, entity FROM audit_log WHERE entity_id = ${entityId} ORDER BY id`;

beforeAll(() => {
  api = createApi(config);
  app = api.app;
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    AddressCipher.fromBase64(config.addressEncryptionKey),
  );
});

beforeEach(async () => {
  await sql`TRUNCATE matches, users CASCADE`;
});

afterAll(async () => {
  await api.close();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())(
  'suspensión de usuarios con tokens reales y PostgreSQL',
  () => {
    describe('adminSetUserSuspension', () => {
      it('Scenario: Suspender con motivo - el usuario queda suspendido y existe la entrada de auditoría', async () => {
        const admin = await registered('Admin', 'admin');
        const beto = await registered('Beto');

        const response = await setSuspension(admin, beto.id, { suspended: true, reason: REASON });

        expect(response.statusCode, response.body).toBe(200);
        expect(response.json()).toEqual({
          id: beto.id,
          email: beto.email,
          displayName: 'Beto',
          roles: ['seeker'],
          suspended: true,
          createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown,
        });
        expect(await suspensionOf(beto.id)).toMatchObject({ suspension_reason: REASON });
        expect((await suspensionOf(beto.id))?.suspended_at).toBeInstanceOf(Date);
        expect(await auditOf(beto.id)).toEqual([
          { actor_id: admin.id, action: 'user.suspend', entity: 'user' },
        ]);
      });

      it('Scenario: Sin motivo - la API responde 400 y el usuario no cambia', async () => {
        const admin = await registered('Admin', 'admin');
        const beto = await registered('Beto');

        const withoutReason = await setSuspension(admin, beto.id, { suspended: true });
        const blankReason = await setSuspension(admin, beto.id, { suspended: true, reason: '   ' });

        expect(withoutReason.statusCode).toBe(400);
        expect(withoutReason.json()).toMatchObject({ errors: [{ field: 'reason' }] });
        expect(blankReason.statusCode).toBe(400);
        expect(await suspensionOf(beto.id)).toEqual({
          suspended_at: null,
          suspension_reason: null,
        });
        expect(await auditOf(beto.id)).toEqual([]);
      });

      it('un admin no puede suspenderse a sí mismo ni suspender a otro admin (409)', async () => {
        const admin = await registered('Admin', 'admin');
        const other = await registered('Otra admin', 'admin');

        const self = await setSuspension(admin, admin.id, { suspended: true, reason: REASON });
        const otherAdmin = await setSuspension(admin, other.id, {
          suspended: true,
          reason: REASON,
        });

        expect([self.statusCode, self.json<Problem>().code]).toEqual([409, 'CANNOT_SUSPEND_SELF']);
        expect([otherAdmin.statusCode, otherAdmin.json<Problem>().code]).toEqual([
          409,
          'CANNOT_SUSPEND_ADMIN',
        ]);
        expect(await auditOf(admin.id)).toEqual([]);
        expect(await auditOf(other.id)).toEqual([]);
      });

      it('un usuario inexistente responde 404', async () => {
        const admin = await registered('Admin', 'admin');

        const response = await setSuspension(admin, MISSING_ID, {
          suspended: true,
          reason: REASON,
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('efecto de la suspensión', () => {
      it('Scenario: Usuario suspendido usa la app - recibe 403 ACCOUNT_SUSPENDED salvo al consultar su cuenta, que indica la suspensión', async () => {
        const admin = await registered('Admin', 'admin');
        const beto = await owner('Beto', 'Leganés');
        const ana = await owner('Ana', 'Getafe');
        await setSuspension(admin, beto.person.id, { suspended: true, reason: REASON });

        const me = await call(beto.person, 'GET', '/v1/me');
        const denied = await Promise.all([
          like(beto.person, beto.home, ana.home),
          call(beto.person, 'GET', '/v1/me/homes'),
          call(beto.person, 'GET', '/v1/matches'),
          call(beto.person, 'PUT', '/v1/me', { displayName: 'Beto' }),
          call(beto.person, 'GET', '/v1/me/consents'),
        ]);

        expect(me.statusCode).toBe(200);
        expect(me.json()).toMatchObject({ id: beto.person.id, suspended: true });
        expect(me.body).not.toContain(REASON);
        for (const response of denied) {
          expect(response.statusCode, response.body).toBe(403);
          expect(response.json()).toMatchObject({ status: 403, code: 'ACCOUNT_SUSPENDED' });
          expect(response.body).not.toContain(REASON);
        }
      });

      it('Scenario: Sus viviendas desaparecen - su vivienda sale del descubrimiento y su match abierto se cierra para todos', async () => {
        const admin = await registered('Admin', 'admin');
        const ana = await owner('Ana', 'Getafe');
        const beto = await owner('Beto', 'Leganés');
        const carla = await owner('Carla', 'Getafe');
        expect((await like(beto.person, beto.home, ana.home)).statusCode).toBe(201);
        const formed = await like(ana.person, ana.home, beto.home);
        const matchId = formed.json<{ match: { id: string } }>().match.id;
        expect(await discoveredFrom(carla.person, carla.home)).toContain(beto.home);

        await setSuspension(admin, beto.person.id, { suspended: true, reason: REASON });

        expect(await discoveredFrom(carla.person, carla.home)).not.toContain(beto.home);
        const detail = await call(ana.person, 'GET', `/v1/matches/${matchId}`);
        expect(detail.statusCode).toBe(200);
        const body = detail.json<{
          status: string;
          participants: { homeId: string; status: string }[];
        }>();
        expect(body.status).toBe('closed');
        expect(body.participants.find((p) => p.homeId === beto.home)?.status).toBe('withdrawn');
        expect(body.participants.find((p) => p.homeId === ana.home)?.status).toBe('pending');
        expect(await auditOf(matchId)).toEqual([
          { actor_id: admin.id, action: 'match.close', entity: 'match' },
        ]);
      });

      it('Scenario: Sus viviendas desaparecen - sus me gusta previos no forman matches nuevos', async () => {
        const admin = await registered('Admin', 'admin');
        const beto = await owner('Beto', 'Leganés');
        const carla = await owner('Carla', 'Getafe');
        expect((await like(beto.person, beto.home, carla.home)).statusCode).toBe(201);
        await setSuspension(admin, beto.person.id, { suspended: true, reason: REASON });

        const response = await like(carla.person, carla.home, beto.home);

        expect(response.json()).toMatchObject({ match: null });
        expect((await sql`SELECT 1 FROM matches`).length).toBe(0);
      });

      it('al reactivarlo recupera el acceso y su vivienda vuelve a aparecer, pero el match sigue cerrado', async () => {
        const admin = await registered('Admin', 'admin');
        const ana = await owner('Ana', 'Getafe');
        const beto = await owner('Beto', 'Leganés');
        const carla = await owner('Carla', 'Getafe');
        await like(beto.person, beto.home, ana.home);
        const formed = await like(ana.person, ana.home, beto.home);
        const matchId = formed.json<{ match: { id: string } }>().match.id;
        await setSuspension(admin, beto.person.id, { suspended: true, reason: REASON });

        const reactivated = await setSuspension(admin, beto.person.id, {
          suspended: false,
          reason: 'Recurso estimado',
        });

        expect(reactivated.statusCode).toBe(200);
        expect(reactivated.json()).toMatchObject({ suspended: false, roles: ['owner'] });
        expect((await call(beto.person, 'GET', '/v1/me')).json()).toMatchObject({
          suspended: false,
        });
        expect((await call(beto.person, 'GET', '/v1/me/homes')).statusCode).toBe(200);
        expect(await discoveredFrom(carla.person, carla.home)).toContain(beto.home);
        const detail = await call(beto.person, 'GET', `/v1/matches/${matchId}`);
        expect(detail.json()).toMatchObject({ status: 'closed' });
        expect((await auditOf(beto.person.id)).map((entry) => entry.action)).toEqual([
          'user.suspend',
          'user.reactivate',
        ]);
      });
    });
  },
);
