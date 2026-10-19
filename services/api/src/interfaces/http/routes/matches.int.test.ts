import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';
import { type GeoPoint, type Home, newDraft } from '../../../domain/home/home.js';
import { AddressCipher } from '../../../infrastructure/crypto/address-cipher.js';
import {
  createDatabase,
  type DatabaseConnection,
} from '../../../infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeRepository } from '../../../infrastructure/persistence/drizzle/drizzle-home-repository.js';

const EUR = 100;
const euros = (amount: number) => amount * EUR;
const SIMULTANEOUS_ROUNDS = 10;
/** 12:00 en Madrid; cada lectura del reloj avanza un segundo para que los matches tengan orden. */
const NOON_MADRID = Date.parse('2026-10-19T10:00:00.000Z');

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

interface Participant {
  homeId: string;
  displayName: string;
  givesHomeId: string;
  receivesHomeId: string;
  compensationCents: number;
  status: string;
}

interface MatchBody {
  id: string;
  type: number;
  status: string;
  createdAt: string;
  participants: Participant[];
}

interface Person extends EmulatorUser {
  id: string;
}

const sql = openSql();
const config = testConfig();
let ticks = 0;
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

async function registered(displayName: string): Promise<Person> {
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
  const [row] = await sql<{ id: string }[]>`SELECT id FROM users WHERE firebase_uid = ${user.uid}`;
  return { ...user, id: row?.id ?? '' };
}

async function home(
  owner: Person,
  municipality: string,
  point: GeoPoint,
  valueEuros: number,
  changes: Partial<Home> = {},
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
    ...changes,
  });
  return id;
}

async function search(user: EmulatorUser, preferences: object): Promise<void> {
  const response = await call(user, 'PUT', '/v1/me/search-preferences', preferences);
  expect(response.statusCode, response.body).toBe(200);
}

/** Ana, con su vivienda de Getafe de 200.000 € publicada, que puede pagar hasta 30.000 €. */
async function ana(): Promise<{ person: Person; home: string }> {
  const person = await registered('Ana');
  const mine = await home(person, 'Getafe', POINTS.getafe, 200_000);
  await search(person, SEARCH_LEGANES);
  return { person, home: mine };
}

/** Otro propietario con una vivienda en Leganés, que no paga nada y acepta recibir desde 0 €. */
async function leganesOwner(name: string, valueEuros = 212_000) {
  const person = await registered(name);
  const theirs = await home(person, 'Leganés', POINTS.leganes, valueEuros);
  await search(person, SEARCH_GETAFE);
  return { person, home: theirs };
}

const like = (user: EmulatorUser, fromHomeId: string, targetHomeId: string) =>
  call(user, 'POST', '/v1/me/likes', { fromHomeId, targetHomeId });

const matchCount = async () => (await sql`SELECT 1 FROM matches`).length;

async function myMatches(user: EmulatorUser, query = ''): Promise<MatchBody[]> {
  const response = await call(user, 'GET', `/v1/matches${query}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<{ items: MatchBody[] }>().items;
}

beforeAll(() => {
  api = createApi(config, { clock: { now: () => new Date(NOON_MADRID + 1000 * ++ticks) } });
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

describe.skipIf(!emulatorAvailable())('match directo con tokens reales y PostgreSQL', () => {
  describe('likeHome', () => {
    it('Scenario: Me gusta recíproco compatible - responde 201 con el match directo abierto y sus dos participantes', async () => {
      const mine = await ana();
      const other = await leganesOwner('Beto');
      expect((await like(other.person, other.home, mine.home)).json()).toEqual({
        liked: true,
        match: null,
      });

      const response = await like(mine.person, mine.home, other.home);

      expect(response.statusCode, response.body).toBe(201);
      const { match } = response.json<{ match: MatchBody }>();
      expect(match).toMatchObject({ type: 2, status: 'open' });
      expect(match).not.toHaveProperty('chatId');
      expect(match.participants).toHaveLength(2);
      expect(match.participants).toEqual(
        expect.arrayContaining([
          {
            homeId: mine.home,
            displayName: 'Ana',
            givesHomeId: mine.home,
            receivesHomeId: other.home,
            compensationCents: euros(12_000),
            status: 'pending',
          },
          {
            homeId: other.home,
            displayName: 'Beto',
            givesHomeId: other.home,
            receivesHomeId: mine.home,
            compensationCents: -euros(12_000),
            status: 'pending',
          },
        ]),
      );
      // Nada de la dirección exacta ni del teléfono en el match
      expect(response.body).not.toContain('Calle Mayor');
      expect(match.participants[0]).not.toHaveProperty('phone');
      expect(await matchCount()).toBe(1);
    });

    it('Scenario: Me gusta recíproco incompatible - se registra el me gusta y no se crea ningún match', async () => {
      const mine = await ana();
      // Ana tendría que pagar 50.000 € y su máximo es 30.000 €
      const other = await leganesOwner('Beto', 250_000);
      await like(other.person, other.home, mine.home);

      const response = await like(mine.person, mine.home, other.home);

      expect(response.statusCode, response.body).toBe(201);
      expect(response.json()).toEqual({ liked: true, match: null });
      expect(await sql`SELECT 1 FROM likes`).toHaveLength(2);
      expect(await matchCount()).toBe(0);
    });

    it('Scenario: Vivienda ya no publicada - B dio me gusta a A y se pausó: el me gusta de A a B no forma match', async () => {
      const mine = await ana();
      const other = await leganesOwner('Beto');
      await like(other.person, other.home, mine.home);
      await sql`UPDATE homes SET status = 'paused' WHERE id = ${other.home}`;

      const response = await like(mine.person, mine.home, other.home);

      expect(response.statusCode).toBe(404);
      expect(await matchCount()).toBe(0);
    });

    it(`Scenario: Me gusta simultáneos - ${String(SIMULTANEOUS_ROUNDS)} veces: exactamente un match y las dos peticiones responden 201`, async () => {
      for (let round = 0; round < SIMULTANEOUS_ROUNDS; round += 1) {
        const mine = await ana();
        const other = await leganesOwner('Beto');

        const responses = await Promise.all([
          like(mine.person, mine.home, other.home),
          like(other.person, other.home, mine.home),
        ]);

        const label = `ronda ${String(round)}`;
        expect(
          responses.map((response) => response.statusCode),
          label,
        ).toEqual([201, 201]);
        const stored = await sql<{ id: string }[]>`
          SELECT DISTINCT m.id FROM matches m
          JOIN match_participants p ON p.match_id = m.id
          WHERE p.home_id = ${mine.home}`;
        expect(stored, label).toHaveLength(1);
        const returned = responses
          .map((response) => response.json<{ match: MatchBody | null }>().match?.id)
          .filter((id) => id !== undefined);
        expect(returned, label).toEqual([stored[0]?.id]);
      }
    });
  });

  describe('listMyMatches', () => {
    it('Scenario: Ver mis matches - un usuario con dos matches los ve, el más reciente primero, con su compensación', async () => {
      const mine = await ana();
      const first = await leganesOwner('Beto', 212_000);
      const second = await leganesOwner('Carla', 205_000);
      for (const other of [first, second]) {
        await like(other.person, other.home, mine.home);
        expect((await like(mine.person, mine.home, other.home)).statusCode).toBe(201);
      }

      const items = await myMatches(mine.person);

      expect(items.map((match) => match.participants.map((p) => p.homeId).sort())).toEqual([
        [mine.home, second.home].sort(),
        [mine.home, first.home].sort(),
      ]);
      const myCompensation = (match: MatchBody | undefined) =>
        match?.participants.find((p) => p.homeId === mine.home)?.compensationCents;
      expect(items.map(myCompensation)).toEqual([euros(5_000), euros(12_000)]);
      expect(Date.parse(items[0]?.createdAt ?? '')).toBeGreaterThan(
        Date.parse(items[1]?.createdAt ?? ''),
      );
    });

    it('solo los propios: un tercero no ve el match ajeno y cada participante ve el suyo', async () => {
      const mine = await ana();
      const other = await leganesOwner('Beto');
      const stranger = await ana();
      await like(other.person, other.home, mine.home);
      await like(mine.person, mine.home, other.home);

      expect(await myMatches(stranger.person)).toEqual([]);
      expect(await myMatches(other.person)).toHaveLength(1);
    });

    it('Scenario: Sin matches - un owner y un seeker sin matches reciben una lista vacía', async () => {
      const owner = await ana();
      const seeker = await registered('Dani');

      const response = await call(owner.person, 'GET', '/v1/matches');

      expect(response.json()).toEqual({ items: [], nextCursor: null });
      expect(await myMatches(seeker)).toEqual([]);
    });

    it('pagina con el cursor y filtra por estado', async () => {
      const mine = await ana();
      for (const name of ['Beto', 'Carla', 'Eva']) {
        const other = await leganesOwner(name);
        await like(other.person, other.home, mine.home);
        await like(mine.person, mine.home, other.home);
      }
      const all = await myMatches(mine.person);
      await sql`UPDATE matches SET status = 'closed' WHERE id = ${all[2]?.id ?? ''}`;

      const first = await call(mine.person, 'GET', '/v1/matches?limit=2');
      const { nextCursor } = first.json<{ nextCursor: string }>();
      const second = await myMatches(mine.person, `?limit=2&cursor=${nextCursor}`);
      const closed = await myMatches(mine.person, '?status=closed');
      const invalid = await call(mine.person, 'GET', '/v1/matches?status=cerrado');

      expect(first.json<{ items: MatchBody[] }>().items.map((m) => m.id)).toEqual([
        all[0]?.id,
        all[1]?.id,
      ]);
      expect(second.map((m) => m.id)).toEqual([all[2]?.id]);
      expect(closed.map((m) => m.id)).toEqual([all[2]?.id]);
      expect(invalid.statusCode).toBe(400);
    });
  });

  describe('undoLastAction con matches reales', () => {
    it('Scenario: No se deshace un match - el me gusta que formó el match responde 409 LIKE_IN_MATCH y se mantiene', async () => {
      const mine = await ana();
      const other = await leganesOwner('Beto');
      await like(other.person, other.home, mine.home);
      await like(mine.person, mine.home, other.home);

      const mineUndo = await call(mine.person, 'DELETE', `/v1/me/last-action?homeId=${mine.home}`);
      const theirUndo = await call(
        other.person,
        'DELETE',
        `/v1/me/last-action?homeId=${other.home}`,
      );

      expect(mineUndo.statusCode).toBe(409);
      expect(mineUndo.json()).toMatchObject({ code: 'LIKE_IN_MATCH' });
      expect(theirUndo.statusCode).toBe(409);
      expect(await sql`SELECT 1 FROM likes`).toHaveLength(2);
    });

    it('un me gusta sin match se sigue pudiendo deshacer', async () => {
      const mine = await ana();
      const other = await leganesOwner('Beto', 250_000);
      await like(other.person, other.home, mine.home);
      await like(mine.person, mine.home, other.home);

      const response = await call(mine.person, 'DELETE', `/v1/me/last-action?homeId=${mine.home}`);

      expect(response.statusCode).toBe(204);
    });
  });
});
