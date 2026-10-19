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
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';

const POINTS = {
  getafe: { lat: 40.3056, lng: -3.7321 },
  leganes: { lat: 40.3272, lng: -3.7635 },
  madrid: { lat: 40.4168, lng: -3.7038 },
} satisfies Record<string, GeoPoint>;

/** Lo que busco desde mi vivienda de Getafe: Leganés, pagando hasta 30.000 €. */
const SEARCH_LEGANES = {
  municipalities: ['Leganés'],
  maxToPayCents: euros(30_000),
  minToReceiveCents: 0,
};
/** Lo que busca el dueño de la vivienda de Leganés: Getafe, recibiendo desde 0 €. */
const SEARCH_GETAFE = { municipalities: ['Getafe'], maxToPayCents: 0, minToReceiveCents: 0 };

const sql = openSql();
const config = testConfig();
let app: FastifyInstance;
let close: () => Promise<void>;
let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let published = 0;

interface Person extends EmulatorUser {
  id: string;
}

interface Card {
  id: string;
  address?: unknown;
  compensation: { kind: string; amountCents: number } | null;
}

interface Page {
  items: Card[];
  nextCursor: string | null;
}

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

function call(
  user: EmulatorUser,
  method: 'GET' | 'PUT' | 'PATCH' | 'POST',
  url: string,
  payload?: object,
) {
  return app.inject({ method, url, headers: bearer(user), ...(payload ? { payload } : {}) });
}

async function registered(assignedRole?: 'agency' | 'admin'): Promise<Person> {
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
  if (assignedRole) {
    await sql`UPDATE users SET assigned_role = ${assignedRole} WHERE firebase_uid = ${user.uid}`;
  }
  const [row] = await sql<{ id: string }[]>`SELECT id FROM users WHERE firebase_uid = ${user.uid}`;
  return { ...user, id: row?.id ?? '' };
}

/** Una vivienda publicada con un valor fijo en euros; cada una se publica después de la anterior. */
async function publishedHome(
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
    publishedAt: new Date(Date.UTC(2026, 9, 1, 9, published)),
    ...changes,
  });
  return id;
}

async function search(user: EmulatorUser, preferences: object): Promise<void> {
  const response = await call(user, 'PUT', '/v1/me/search-preferences', preferences);
  expect(response.statusCode, response.body).toBe(200);
}

async function discover(user: EmulatorUser, query = ''): Promise<Page> {
  const response = await call(user, 'GET', `/v1/discover${query}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<Page>();
}

const idsOf = (page: Page) => page.items.map((card) => card.id);

/** Yo, con mi vivienda de Getafe de 200.000 € publicada, buscando en Leganés. */
async function me(): Promise<{ person: Person; home: string }> {
  const person = await registered();
  const home = await publishedHome(person, 'Getafe', POINTS.getafe, 200_000);
  await search(person, SEARCH_LEGANES);
  return { person, home };
}

/** Otro propietario con una vivienda en Leganés del valor indicado, que busca en Getafe. */
async function leganesOwner(valueEuros: number, preferences: object = SEARCH_GETAFE) {
  const person = await registered();
  const home = await publishedHome(person, 'Leganés', POINTS.leganes, valueEuros);
  await search(person, preferences);
  return { person, home };
}

beforeAll(() => {
  ({ app, close } = createApi(config));
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    AddressCipher.fromBase64(config.addressEncryptionKey),
  );
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
});

afterAll(async () => {
  await close();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('discoverHomes con tokens reales y PostgreSQL', () => {
  describe('compatibles en los dos sentidos', () => {
    it('Scenario: Compatibles en ambos sentidos - la vivienda de Leganés de 220.000 € aparece en mis tarjetas', async () => {
      const { person } = await me();
      const other = await leganesOwner(220_000);

      const page = await discover(person);

      expect(idsOf(page)).toEqual([other.home]);
      expect(page.items[0]).toMatchObject({
        type: 'piso',
        location: { visibility: 'area', areaName: 'Leganés Centro' },
        photos: [],
        compensation: { kind: 'pay', amountCents: euros(20_000) },
      });
      expect(page.items[0]).not.toHaveProperty('address');
      expect(page.items[0]).not.toHaveProperty('status');
      expect(JSON.stringify(page)).not.toContain('Calle Mayor');
      expect(page.nextCursor).toBeNull();
    });

    it('Scenario: Su dueño no busca en mi zona - una vivienda que me encaja cuyo dueño solo busca en Valencia no aparece', async () => {
      const { person } = await me();
      await leganesOwner(220_000, { ...SEARCH_GETAFE, municipalities: ['Valencia'] });
      const compatible = await leganesOwner(210_000);

      const page = await discover(person);

      expect(idsOf(page)).toEqual([compatible.home]);
    });

    it('Scenario: Compensación fuera de mis límites - una candidata que vale 60.000 € más que la mía no aparece', async () => {
      const { person } = await me();
      await leganesOwner(260_000);

      const page = await discover(person);

      expect(page.items).toEqual([]);
    });

    it('Scenario: Paginación - con más compatibles que el tamaño de página, el cursor da las siguientes sin repetir', async () => {
      const { person } = await me();
      const expected: string[] = [];
      for (let index = 0; index < 5; index += 1) {
        expected.unshift((await leganesOwner(205_000 + index * 1_000)).home);
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const query: string = cursor === null ? '?limit=2' : `?limit=2&cursor=${cursor}`;
        const page = await discover(person, query);
        seen.push(...idsOf(page));
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor !== null && pages < 10);

      expect(seen).toEqual(expected);
      expect(new Set(seen).size).toBe(5);
      expect(pages).toBe(3);
    });
  });

  describe('compensación en cada tarjeta', () => {
    it('Scenario: El usuario paga - mi vivienda de 200.000 € frente a una de 212.000 €: «Tú pagas 12.000 €»', async () => {
      const { person } = await me();
      await leganesOwner(212_000);

      const page = await discover(person);

      expect(page.items[0]?.compensation).toEqual({ kind: 'pay', amountCents: euros(12_000) });
    });

    it('Scenario: Cambio justo - una diferencia que no supera el 1 % del mayor valor es «Cambio justo»', async () => {
      const { person } = await me();
      await leganesOwner(201_000);

      const page = await discover(person);

      expect(page.items[0]?.compensation).toEqual({ kind: 'fair', amountCents: euros(1_000) });
    });
  });

  describe('exclusiones', () => {
    it('Scenario: Vivienda en operación - una vivienda compatible que pasa a in_operation ya no aparece', async () => {
      const { person } = await me();
      const other = await leganesOwner(220_000);
      expect(idsOf(await discover(person))).toEqual([other.home]);

      await sql`UPDATE homes SET status = 'in_operation' WHERE id = ${other.home}`;

      expect(idsOf(await discover(person))).toEqual([]);
    });

    it('Scenario: Descarte y cambio relevante - una vivienda descartada vuelve a aparecer cuando su dueño cambia el rango de valor', async () => {
      const mine = await me();
      const other = await leganesOwner(220_000);
      const admin = await registered('admin');
      await sql`INSERT INTO dismissals (home_id, dismissed_home_id, created_at)
                VALUES (${mine.home}, ${other.home}, '2026-01-01T00:00:00Z')`;
      expect(idsOf(await discover(mine.person))).toEqual([]);

      const edited = await call(other.person, 'PATCH', `/v1/homes/${other.home}`, {
        valueMinCents: euros(210_000),
        valueMaxCents: euros(230_000),
      });
      expect(edited.statusCode, edited.body).toBe(200);
      // El cambio relevante la devuelve a revisión: mientras tanto no está publicada
      expect(idsOf(await discover(mine.person))).toEqual([]);
      const approved = await call(admin, 'POST', `/v1/admin/homes/${other.home}/moderation`, {
        decision: 'approve',
      });
      expect(approved.statusCode, approved.body).toBe(200);

      const page = await discover(mine.person);

      expect(idsOf(page)).toEqual([other.home]);
      expect(page.items[0]?.compensation).toEqual({ kind: 'pay', amountCents: euros(20_000) });
    });

    it('Scenario: VPP sin requisitos - una VPP compatible no aparece a quien no declara cumplir los requisitos', async () => {
      const { person } = await me();
      const owner = await registered();
      const vpp = await publishedHome(owner, 'Leganés', POINTS.leganes, 210_000, {
        regime: 'VPPB',
        vppQualificationDate: '2005-03-01',
      });
      await search(owner, SEARCH_GETAFE);

      const without = await discover(person);
      const declared = await call(person, 'PUT', '/v1/me', {
        displayName: 'Ana',
        meetsVppRequirements: true,
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
      });
      expect(declared.statusCode, declared.body).toBe(200);
      const withRequirements = await discover(person);

      expect(idsOf(without)).toEqual([]);
      expect(idsOf(withRequirements)).toEqual([vpp]);
    });
  });

  describe('sin vivienda publicada', () => {
    it('Scenario: Buscador mirando - un seeker con preferencias en Madrid ve viviendas de Madrid sin compensación', async () => {
      const seeker = await registered();
      await search(seeker, { municipalities: ['Madrid'], maxToPayCents: 0, minToReceiveCents: 0 });
      const owner = await registered();
      const madrid = await publishedHome(owner, 'Madrid', POINTS.madrid, 900_000);
      await publishedHome(owner, 'Getafe', POINTS.getafe, 200_000);

      const page = await discover(seeker);

      expect(page.items.map((card) => [card.id, card.compensation])).toEqual([[madrid, null]]);
    });
  });

  describe('vivienda desde la que se busca y errores', () => {
    it('sin preferencias de búsqueda es un 422 con su código', async () => {
      const seeker = await registered();

      const response = await call(seeker, 'GET', '/v1/discover');

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'SEARCH_PREFERENCES_REQUIRED' });
    });

    it('un owner con dos viviendas publicadas debe elegir: sin homeId es un 400 y con cada una se recalcula la compensación', async () => {
      const { person, home } = await me();
      const second = await publishedHome(person, 'Getafe', POINTS.getafe, 215_000);
      await leganesOwner(220_000);

      const ambiguous = await call(person, 'GET', '/v1/discover');
      const fromFirst = await discover(person, `?homeId=${home}`);
      const fromSecond = await discover(person, `?homeId=${second}`);

      expect(ambiguous.statusCode).toBe(400);
      expect(ambiguous.json()).toMatchObject({
        code: 'HOME_ID_REQUIRED',
        errors: [{ field: 'homeId', message: 'required' }],
      });
      expect(fromFirst.items[0]?.compensation).toEqual({ kind: 'pay', amountCents: euros(20_000) });
      expect(fromSecond.items[0]?.compensation).toEqual({ kind: 'pay', amountCents: euros(5_000) });
    });

    it('una vivienda ajena, una propia no publicada y una inexistente dan el mismo 404', async () => {
      const { person } = await me();
      const other = await leganesOwner(220_000);
      const paused = await publishedHome(person, 'Getafe', POINTS.getafe, 200_000, {
        status: 'paused',
      });

      const responses = await Promise.all(
        [other.home, paused, MISSING_ID].map((id) =>
          call(person, 'GET', `/v1/discover?homeId=${id}`),
        ),
      );

      expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404]);
      const bodies = responses.map((response) => {
        const body = response.json<Record<string, unknown>>();
        delete body['correlationId'];
        return JSON.stringify(body);
      });
      expect(new Set(bodies).size).toBe(1);
    });

    it.each(['agency', 'admin'] as const)('una cuenta %s recibe 403', async (role) => {
      const user = await registered(role);

      const response = await call(user, 'GET', '/v1/discover');

      expect(response.statusCode).toBe(403);
    });

    it('sin token es un 401', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/discover' });

      expect(response.statusCode).toBe(401);
    });
  });
});
