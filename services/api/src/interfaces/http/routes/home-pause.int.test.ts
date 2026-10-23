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

const POINTS = {
  getafe: { lat: 40.3056, lng: -3.7321 },
  leganes: { lat: 40.3272, lng: -3.7635 },
} satisfies Record<string, GeoPoint>;

/** Desde Getafe se busca en Leganés pagando hasta 30.000 €; desde Leganés, en Getafe sin pagar. */
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

interface Owner {
  person: Person;
  home: string;
}

type Json = Record<string, unknown>;

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

/** Una vivienda publicada con un valor fijo en euros, y las preferencias de búsqueda de su dueño. */
async function owner(
  displayName: string,
  municipality: string,
  point: GeoPoint,
  valueEuros: number,
  preferences: object,
): Promise<Owner> {
  const person = await registered(displayName);
  published += 1;
  const id = crypto.randomUUID();
  const draft = newDraft({
    id,
    ownerId: person.id,
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
  });
  const response = await call(person, 'PUT', '/v1/me/search-preferences', preferences);
  expect(response.statusCode, response.body).toBe(200);
  return { person, home: id };
}

/** Ana, en Getafe con 200.000 €, busca en Leganés. */
const ana = () => owner('Ana', 'Getafe', POINTS.getafe, 200_000, SEARCH_LEGANES);
/** Beto, en Leganés con 212.000 €, busca en Getafe: compatible con Ana. */
const beto = () => owner('Beto', 'Leganés', POINTS.leganes, 212_000, SEARCH_GETAFE);

async function discoveredIds(user: EmulatorUser): Promise<string[]> {
  const response = await call(user, 'GET', '/v1/discover');
  expect(response.statusCode, response.body).toBe(200);
  return response.json<{ items: { id: string }[] }>().items.map((card) => card.id);
}

async function statusOf(homeId: string) {
  const [row] = await sql<
    { status: string; submitted_at: Date | null; relevant_changed_at: Date | null }[]
  >`SELECT status, submitted_at, relevant_changed_at FROM homes WHERE id = ${homeId}`;
  return row;
}

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

describe.skipIf(!emulatorAvailable())('pausar y reactivar con tokens reales y PostgreSQL', () => {
  it('Scenario: Pausar - deja de aparecer en el descubrimiento, su match sigue abierto, «Mis casas» la muestra pausada y su dueño sigue siendo owner', async () => {
    const mine = await ana();
    const other = await beto();
    expect(await discoveredIds(mine.person)).toEqual([other.home]);
    await call(other.person, 'POST', '/v1/me/likes', {
      fromHomeId: other.home,
      targetHomeId: mine.home,
    });
    const liked = await call(mine.person, 'POST', '/v1/me/likes', {
      fromHomeId: mine.home,
      targetHomeId: other.home,
    });
    const matchId = liked.json<{ match: { id: string } }>().match.id;

    const response = await call(other.person, 'POST', `/v1/homes/${other.home}/pause`);

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<Json>()).toMatchObject({ id: other.home, status: 'paused' });
    expect(await discoveredIds(mine.person)).toEqual([]);
    const match = await call(other.person, 'GET', `/v1/matches/${matchId}`);
    expect(match.statusCode, match.body).toBe(200);
    expect(match.json<Json>()).toMatchObject({ status: 'open' });
    const mineList = await call(other.person, 'GET', '/v1/me/homes');
    expect(mineList.json<Json[]>()).toEqual([
      expect.objectContaining({ id: other.home, status: 'paused' }),
    ]);
    const me = await call(other.person, 'GET', '/v1/me');
    expect(me.json<Json>()).toMatchObject({ roles: ['owner'] });
  });

  it('Scenario: Reactivar - vuelve a published y a aparecer en el descubrimiento', async () => {
    const mine = await ana();
    const other = await beto();
    await call(other.person, 'POST', `/v1/homes/${other.home}/pause`);
    expect(await discoveredIds(mine.person)).toEqual([]);

    const response = await call(other.person, 'POST', `/v1/homes/${other.home}/resume`);

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<Json>()).toMatchObject({ id: other.home, status: 'published' });
    expect(await discoveredIds(mine.person)).toEqual([other.home]);
  });

  it('Scenario: Pausar un borrador - la API responde 409 y sigue en draft', async () => {
    const person = await registered('Ana');
    const created = await call(person, 'POST', '/v1/homes', {
      type: 'piso',
      address: { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12, 28004 Madrid' },
    });
    const draftId = created.json<{ id: string }>().id;

    const response = await call(person, 'POST', `/v1/homes/${draftId}/pause`);

    expect(response.statusCode).toBe(409);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json<Json>()).toMatchObject({ code: 'HOME_NOT_PAUSABLE' });
    expect((await statusOf(draftId))?.status).toBe('draft');
  });

  it('reactivar una vivienda publicada es un 409 y pausarla dos veces también', async () => {
    const mine = await ana();

    const resumed = await call(mine.person, 'POST', `/v1/homes/${mine.home}/resume`);
    await call(mine.person, 'POST', `/v1/homes/${mine.home}/pause`);
    const pausedAgain = await call(mine.person, 'POST', `/v1/homes/${mine.home}/pause`);

    expect(resumed.statusCode).toBe(409);
    expect(resumed.json<Json>()).toMatchObject({ code: 'HOME_NOT_RESUMABLE' });
    expect(pausedAgain.statusCode).toBe(409);
    expect((await statusOf(mine.home))?.status).toBe('paused');
  });

  it('pausar o reactivar una vivienda ajena o inexistente es el mismo 404 y no la cambia', async () => {
    const mine = await ana();
    const other = await beto();

    const foreign = await call(mine.person, 'POST', `/v1/homes/${other.home}/pause`);
    const missing = await call(mine.person, 'POST', `/v1/homes/${MISSING_ID}/resume`);

    expect(foreign.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    const { type, title } = missing.json<Json>();
    expect(foreign.json<Json>()).toMatchObject({ type, title });
    expect((await statusOf(other.home))?.status).toBe('published');
  });
});

describe.skipIf(!emulatorAvailable())('vuelta a revisión tras cambios relevantes', () => {
  it('Scenario: Cambiar el valor de una vivienda publicada - pasa a in_review con las fechas de envío y de cambio relevante, y deja de aparecer', async () => {
    const mine = await ana();
    const other = await beto();

    const response = await call(other.person, 'PATCH', `/v1/homes/${other.home}`, {
      valueMinCents: euros(215_000),
      valueMaxCents: euros(215_000),
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<Json>()).toMatchObject({ status: 'in_review' });
    const row = await statusOf(other.home);
    expect(row?.status).toBe('in_review');
    expect(row?.submitted_at).toBeInstanceOf(Date);
    expect(row?.relevant_changed_at).toEqual(row?.submitted_at);
    expect(await discoveredIds(mine.person)).toEqual([]);
  });

  it('una vivienda pausada que cambia un dato relevante también vuelve a revisión', async () => {
    const mine = await ana();
    await call(mine.person, 'POST', `/v1/homes/${mine.home}/pause`);

    const response = await call(mine.person, 'PATCH', `/v1/homes/${mine.home}`, {
      features: { terrace: true },
    });

    expect(response.json<Json>()).toMatchObject({ status: 'in_review' });
    expect((await statusOf(mine.home))?.submitted_at).toBeInstanceOf(Date);
  });

  it('Scenario: Cambiar solo la visibilidad de la ubicación - de zona a exacta sigue publicada y visible', async () => {
    const mine = await ana();
    const other = await beto();

    const response = await call(other.person, 'PATCH', `/v1/homes/${other.home}`, {
      locationVisibility: 'exact',
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<Json>()).toMatchObject({
      status: 'published',
      location: { visibility: 'exact' },
    });
    expect(await statusOf(other.home)).toMatchObject({
      status: 'published',
      submitted_at: null,
      relevant_changed_at: null,
    });
    expect(await discoveredIds(mine.person)).toEqual([other.home]);
  });
});
