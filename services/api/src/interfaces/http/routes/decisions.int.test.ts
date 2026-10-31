import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { FakeMatchLookup } from '../../../../test/fakes.js';
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
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';
const DAILY_LIMIT = 10;
const SECONDS_PER_HOUR = 3_600;
/** 12:00 en Madrid (CEST): quedan 12 horas hasta la medianoche. */
const NOON_MADRID = new Date('2026-10-19T10:00:00.000Z');
/** 00:30 en Madrid del día en que se adelanta el reloj: el día dura 23 horas. */
const SPRING_FORWARD = new Date('2026-03-28T23:30:00.000Z');

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

const sql = openSql();
const config = testConfig();
let api: ReturnType<typeof createApi>;
let app: FastifyInstance;
let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let published = 0;

interface Person extends EmulatorUser {
  id: string;
}

interface Page {
  items: { id: string }[];
}

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

function call(
  user: EmulatorUser,
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  url: string,
  payload?: object,
  instance: FastifyInstance = app,
) {
  return instance.inject({ method, url, headers: bearer(user), ...(payload ? { payload } : {}) });
}

async function registered(): Promise<Person> {
  const user = await signUp();
  const response = await app.inject({
    method: 'PUT',
    url: '/v1/me',
    headers: bearer(user),
    payload: {
      displayName: 'Ana',
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
    publishedAt: new Date(Date.UTC(2026, 9, 1, 9, published % 60, Math.floor(published / 60))),
    ...changes,
  });
  return id;
}

async function search(user: EmulatorUser, preferences: object): Promise<void> {
  const response = await call(user, 'PUT', '/v1/me/search-preferences', preferences);
  expect(response.statusCode, response.body).toBe(200);
}

/** Yo, con mi vivienda de Getafe de 200.000 € publicada, buscando en Leganés. */
async function me(): Promise<{ person: Person; home: string }> {
  const person = await registered();
  const mine = await home(person, 'Getafe', POINTS.getafe, 200_000);
  await search(person, SEARCH_LEGANES);
  return { person, home: mine };
}

/** Otro propietario con una vivienda en Leganés, que busca en Getafe. */
async function leganesOwner(valueEuros = 220_000) {
  const person = await registered();
  const theirs = await home(person, 'Leganés', POINTS.leganes, valueEuros);
  await search(person, SEARCH_GETAFE);
  return { person, home: theirs };
}

async function discover(user: EmulatorUser, query = ''): Promise<string[]> {
  const response = await call(user, 'GET', `/v1/discover${query}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<Page>().items.map((card) => card.id);
}

const like = (user: EmulatorUser, fromHomeId: string, targetHomeId: string, instance = app) =>
  call(user, 'POST', '/v1/me/likes', { fromHomeId, targetHomeId }, instance);

const likesCount = async () => (await sql`SELECT 1 FROM likes`).length;

beforeAll(() => {
  api = createApi(config, { clock: { now: () => NOON_MADRID } });
  app = api.app;
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    AddressCipher.fromBase64(config.addressEncryptionKey),
  );
});

beforeEach(async () => {
  // Un despacho lanzado por la petición anterior no puede seguir en curso al vaciar las tablas
  await api.outbox.idle();
  await sql`TRUNCATE users CASCADE`;
});

afterAll(async () => {
  await api.close();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('decisiones con tokens reales y PostgreSQL', () => {
  describe('likeHome', () => {
    it('Scenario: Me gusta válido - responde 201 y la vivienda deja de aparecer en discoverHomes', async () => {
      const mine = await me();
      const other = await leganesOwner();
      expect(await discover(mine.person)).toEqual([other.home]);

      const response = await like(mine.person, mine.home, other.home);

      expect(response.statusCode, response.body).toBe(201);
      expect(response.json()).toEqual({ liked: true, match: null });
      expect(await likesCount()).toBe(1);
      expect(await discover(mine.person)).toEqual([]);
    });

    it('un me gusta desde una vivienda no oculta la vivienda a las otras viviendas del mismo usuario', async () => {
      const mine = await me();
      const second = await home(mine.person, 'Getafe', POINTS.getafe, 200_000);
      const other = await leganesOwner();

      await like(mine.person, mine.home, other.home);

      expect(await discover(mine.person, `?homeId=${mine.home}`)).toEqual([]);
      expect(await discover(mine.person, `?homeId=${second}`)).toEqual([other.home]);
    });

    it('Scenario: Usuario sin vivienda publicada - un seeker recibe 403 y no se registra nada', async () => {
      const seeker = await registered();
      const other = await leganesOwner();

      const response = await like(seeker, MISSING_ID, other.home);

      expect(response.statusCode).toBe(403);
      expect(await likesCount()).toBe(0);
    });

    it('Scenario: Desde una vivienda que no es suya o no está publicada - 404 si es ajena y 409 si es propia en borrador', async () => {
      const mine = await me();
      const other = await leganesOwner();
      const draft = await home(mine.person, 'Getafe', POINTS.getafe, 200_000, {
        status: 'draft',
        publishedAt: null,
      });

      const foreign = await like(mine.person, other.home, other.home);
      const missing = await like(mine.person, MISSING_ID, other.home);
      const unpublished = await like(mine.person, draft, other.home);

      expect(foreign.statusCode).toBe(404);
      expect(missing.statusCode).toBe(404);
      expect(unpublished.statusCode).toBe(409);
      expect(unpublished.json()).toMatchObject({ code: 'HOME_NOT_PUBLISHED' });
      expect(await likesCount()).toBe(0);
    });

    it('un destino propio, no publicado o inexistente es 404', async () => {
      const mine = await me();
      const ownOther = await home(mine.person, 'Getafe', POINTS.getafe, 200_000);
      const stranger = await registered();
      const draft = await home(stranger, 'Leganés', POINTS.leganes, 210_000, {
        status: 'draft',
        publishedAt: null,
      });

      for (const target of [ownOther, draft, MISSING_ID]) {
        const response = await like(mine.person, mine.home, target);
        expect(response.statusCode, target).toBe(404);
      }
    });

    it('ids que no son UUID o campos de más son un 400', async () => {
      const mine = await me();

      const invalid = await call(mine.person, 'POST', '/v1/me/likes', {
        fromHomeId: 'x',
        targetHomeId: mine.home,
      });
      const extra = await call(mine.person, 'POST', '/v1/me/likes', {
        fromHomeId: mine.home,
        targetHomeId: MISSING_ID,
        extra: true,
      });

      expect(invalid.statusCode).toBe(400);
      expect(extra.statusCode).toBe(400);
    });

    it('Scenario: Me gusta repetido - responde 409 LIKE_EXISTS y sigue habiendo una sola arista', async () => {
      const mine = await me();
      const other = await leganesOwner();
      await like(mine.person, mine.home, other.home);

      const repeated = await like(mine.person, mine.home, other.home);

      expect(repeated.statusCode).toBe(409);
      expect(repeated.json()).toMatchObject({ code: 'LIKE_EXISTS' });
      expect(await likesCount()).toBe(1);
    });
  });

  describe('límite diario', () => {
    async function ownerWithTargets(count: number) {
      const mine = await me();
      const other = await registered();
      const targets: string[] = [];
      for (let index = 0; index < count; index += 1) {
        targets.push(await home(other, 'Leganés', POINTS.leganes, 205_000));
      }
      return { mine, targets };
    }

    it('Scenario: Undécimo me gusta del día - responde 429 con Retry-After hasta la medianoche de Madrid', async () => {
      const { mine, targets } = await ownerWithTargets(DAILY_LIMIT + 1);
      for (const target of targets.slice(0, DAILY_LIMIT)) {
        const response = await like(mine.person, mine.home, target);
        expect(response.statusCode, response.body).toBe(201);
      }

      const eleventh = await like(mine.person, mine.home, targets[DAILY_LIMIT] ?? '');

      expect(eleventh.statusCode).toBe(429);
      expect(eleventh.headers['retry-after']).toBe(String(12 * SECONDS_PER_HOUR));
      expect(eleventh.json()).toMatchObject({ code: 'DAILY_LIKE_LIMIT', status: 429 });
      expect(await likesCount()).toBe(DAILY_LIMIT);
    });

    it('el límite suma todas las viviendas del usuario', async () => {
      const { mine, targets } = await ownerWithTargets(DAILY_LIMIT + 1);
      const second = await home(mine.person, 'Getafe', POINTS.getafe, 200_000);
      for (const [index, target] of targets.slice(0, DAILY_LIMIT).entries()) {
        const from = index % 2 === 0 ? mine.home : second;
        expect((await like(mine.person, from, target)).statusCode).toBe(201);
      }

      const eleventh = await like(mine.person, second, targets[DAILY_LIMIT] ?? '');

      expect(eleventh.statusCode).toBe(429);
    });

    it('doce peticiones simultáneas dan exactamente diez me gusta y dos 429', async () => {
      const { mine, targets } = await ownerWithTargets(DAILY_LIMIT + 2);

      const responses = await Promise.all(
        targets.map((target) => like(mine.person, mine.home, target)),
      );

      const statuses = responses.map((response) => response.statusCode).sort();
      expect(statuses.filter((status) => status === 201)).toHaveLength(DAILY_LIMIT);
      expect(statuses.filter((status) => status === 429)).toHaveLength(2);
      expect(await likesCount()).toBe(DAILY_LIMIT);
    });

    it('deshacer un me gusta devuelve el cupo y los de ayer no cuentan', async () => {
      const { mine, targets } = await ownerWithTargets(DAILY_LIMIT + 1);
      // Diez de ayer en hora de Madrid (21:59 UTC del día 18 son las 23:59 del día 18)
      for (const target of targets.slice(0, DAILY_LIMIT)) {
        await sql`INSERT INTO likes (from_home_id, to_home_id, created_at)
                  VALUES (${mine.home}, ${target}, '2026-10-18T21:59:59Z')`;
      }
      const today = await like(mine.person, mine.home, targets[DAILY_LIMIT] ?? '');
      expect(today.statusCode).toBe(201);

      const undone = await call(mine.person, 'DELETE', `/v1/me/last-action?homeId=${mine.home}`);
      const again = await like(mine.person, mine.home, targets[DAILY_LIMIT] ?? '');

      expect(undone.statusCode).toBe(204);
      expect(again.statusCode).toBe(201);
    });

    it('el día del cambio de hora la espera se calcula con la medianoche real de Madrid', async () => {
      const shifted = createApi(testConfig({ likesPerDay: 1 }), {
        clock: { now: () => SPRING_FORWARD },
      });
      await shifted.app.ready();
      try {
        const { mine, targets } = await ownerWithTargets(2);
        await like(mine.person, mine.home, targets[0] ?? '', shifted.app);

        const second = await like(mine.person, mine.home, targets[1] ?? '', shifted.app);

        expect(second.statusCode).toBe(429);
        // De las 00:30 a la medianoche del 29 (23 horas de día): 22,5 horas
        expect(second.headers['retry-after']).toBe(String(22.5 * SECONDS_PER_HOUR));
      } finally {
        await shifted.close();
      }
    });
  });

  describe('dismissHome', () => {
    it('Scenario: Descartar - la vivienda desaparece de las tarjetas y repetirlo es idempotente', async () => {
      const mine = await me();
      const other = await leganesOwner();
      expect(await discover(mine.person)).toEqual([other.home]);

      const first = await call(mine.person, 'POST', '/v1/me/dismissals', {
        fromHomeId: mine.home,
        targetHomeId: other.home,
      });
      const repeated = await call(mine.person, 'POST', '/v1/me/dismissals', {
        fromHomeId: mine.home,
        targetHomeId: other.home,
      });

      expect(first.statusCode, first.body).toBe(204);
      expect(repeated.statusCode).toBe(204);
      expect(await discover(mine.person)).toEqual([]);
      expect(await sql`SELECT 1 FROM dismissals`).toHaveLength(1);
    });

    it('un owner sin fromHomeId recibe 400 sobre fromHomeId', async () => {
      const mine = await me();
      const other = await leganesOwner();

      const response = await call(mine.person, 'POST', '/v1/me/dismissals', {
        targetHomeId: other.home,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ errors: [{ field: 'fromHomeId' }] });
    });

    it('una vivienda origen ajena o un destino que no se puede ver es 404', async () => {
      const mine = await me();
      const other = await leganesOwner();

      const foreign = await call(mine.person, 'POST', '/v1/me/dismissals', {
        fromHomeId: other.home,
        targetHomeId: other.home,
      });
      const missing = await call(mine.person, 'POST', '/v1/me/dismissals', {
        fromHomeId: mine.home,
        targetHomeId: MISSING_ID,
      });

      expect(foreign.statusCode).toBe(404);
      expect(missing.statusCode).toBe(404);
    });

    it('un seeker descarta desde su cuenta y la vivienda deja de aparecerle', async () => {
      const seeker = await registered();
      await search(seeker, { municipalities: ['Leganés'], maxToPayCents: 0, minToReceiveCents: 0 });
      const other = await leganesOwner();
      expect(await discover(seeker)).toEqual([other.home]);

      const response = await call(seeker, 'POST', '/v1/me/dismissals', {
        targetHomeId: other.home,
      });

      expect(response.statusCode, response.body).toBe(204);
      expect(await discover(seeker)).toEqual([]);
      expect(await sql`SELECT 1 FROM account_dismissals`).toHaveLength(1);
    });

    it('un descarte de cuenta deja de aplicarse si la vivienda cambia algo relevante después', async () => {
      const seeker = await registered();
      await search(seeker, { municipalities: ['Leganés'], maxToPayCents: 0, minToReceiveCents: 0 });
      const other = await leganesOwner();
      await call(seeker, 'POST', '/v1/me/dismissals', { targetHomeId: other.home });
      expect(await discover(seeker)).toEqual([]);

      await sql`UPDATE homes SET relevant_changed_at = now() + interval '1 minute'
                WHERE id = ${other.home}`;

      expect(await discover(seeker)).toEqual([other.home]);
    });
  });

  describe('undoLastAction', () => {
    it('Scenario: Deshacer un descarte - el descarte deja de existir y la vivienda vuelve a aparecer', async () => {
      const mine = await me();
      const other = await leganesOwner();
      await call(mine.person, 'POST', '/v1/me/dismissals', {
        fromHomeId: mine.home,
        targetHomeId: other.home,
      });
      expect(await discover(mine.person)).toEqual([]);

      const response = await call(mine.person, 'DELETE', `/v1/me/last-action?homeId=${mine.home}`);

      expect(response.statusCode, response.body).toBe(204);
      expect(await sql`SELECT 1 FROM dismissals`).toHaveLength(0);
      expect(await discover(mine.person)).toEqual([other.home]);
    });

    it('deshace un me gusta y la vivienda vuelve a aparecer', async () => {
      const mine = await me();
      const other = await leganesOwner();
      await like(mine.person, mine.home, other.home);

      const response = await call(mine.person, 'DELETE', `/v1/me/last-action?homeId=${mine.home}`);

      expect(response.statusCode).toBe(204);
      expect(await likesCount()).toBe(0);
      expect(await discover(mine.person)).toEqual([other.home]);
    });

    it('un seeker deshace su último descarte de cuenta y la vivienda vuelve', async () => {
      const seeker = await registered();
      await search(seeker, { municipalities: ['Leganés'], maxToPayCents: 0, minToReceiveCents: 0 });
      const other = await leganesOwner();
      await call(seeker, 'POST', '/v1/me/dismissals', { targetHomeId: other.home });

      const response = await call(seeker, 'DELETE', '/v1/me/last-action');

      expect(response.statusCode, response.body).toBe(204);
      expect(await discover(seeker)).toEqual([other.home]);
    });

    it('sin ninguna acción es 404; una vivienda ajena también; un owner sin homeId, 400', async () => {
      const mine = await me();
      const other = await leganesOwner();

      const nothing = await call(mine.person, 'DELETE', `/v1/me/last-action?homeId=${mine.home}`);
      const foreign = await call(mine.person, 'DELETE', `/v1/me/last-action?homeId=${other.home}`);
      const noHome = await call(mine.person, 'DELETE', '/v1/me/last-action');

      expect(nothing.statusCode).toBe(404);
      expect(foreign.statusCode).toBe(404);
      expect(noHome.statusCode).toBe(400);
    });

    it('Scenario: No se deshace un match - con un match formado responde 409 LIKE_IN_MATCH y el me gusta se mantiene', async () => {
      const matches = new FakeMatchLookup();
      const withMatches = createApi(config, {
        clock: { now: () => NOON_MADRID },
        matchLookup: matches,
      });
      await withMatches.app.ready();
      try {
        const mine = await me();
        const other = await leganesOwner();
        await like(mine.person, mine.home, other.home, withMatches.app);
        matches.inMatch.add(`${mine.home}>${other.home}`);

        const response = await call(
          mine.person,
          'DELETE',
          `/v1/me/last-action?homeId=${mine.home}`,
          undefined,
          withMatches.app,
        );

        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject({ code: 'LIKE_IN_MATCH' });
        expect(await likesCount()).toBe(1);
      } finally {
        await withMatches.close();
      }
    });
  });
});
