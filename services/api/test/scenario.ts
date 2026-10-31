import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import type postgres from 'postgres';
import { expect } from 'vitest';

import { type GeoPoint, type Home, newDraft } from '../src/domain/home/home.js';
import type { DrizzleHomeRepository } from '../src/infrastructure/persistence/drizzle/drizzle-home-repository.js';
import { type EmulatorUser, signUp } from './auth-emulator.js';

const EUR = 100;
export const euros = (amount: number) => amount * EUR;

export const POINTS = {
  getafe: { lat: 40.3056, lng: -3.7321 },
  leganes: { lat: 40.3272, lng: -3.7635 },
} satisfies Record<string, GeoPoint>;

export const SEARCH_LEGANES = {
  municipalities: ['Leganés'],
  maxToPayCents: euros(30_000),
  minToReceiveCents: 0,
};
export const SEARCH_GETAFE = { municipalities: ['Getafe'], maxToPayCents: 0, minToReceiveCents: 0 };

export interface Person extends EmulatorUser {
  id: string;
}

type Sql = ReturnType<typeof postgres>;

/** Personas, viviendas publicadas y decisiones reales sobre la API, para las pruebas de integración de la cuenta. */
export function createScenario(context: {
  app: FastifyInstance;
  sql: Sql;
  homes: DrizzleHomeRepository;
}) {
  const { app, sql, homes } = context;
  let created = 0;

  const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
    authorization: `Bearer ${user.idToken}`,
  });

  function call(
    user: Pick<EmulatorUser, 'idToken'>,
    method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) {
    return app.inject({ method, url, headers: bearer(user), ...(payload ? { payload } : {}) });
  }

  async function registered(displayName: string, email?: string): Promise<Person> {
    const user = await signUp(email);
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
    const [row] = await sql<
      { id: string }[]
    >`SELECT id FROM users WHERE firebase_uid = ${user.uid}`;
    return { ...user, id: row?.id ?? '' };
  }

  /** Una vivienda ya publicada del propietario, con dirección única `Calle Mayor, N, <municipio>`. */
  async function publishedHome(
    owner: Person,
    municipality: string,
    point: GeoPoint,
    valueEuros: number,
    changes: Partial<Home> = {},
  ): Promise<string> {
    created += 1;
    const id = crypto.randomUUID();
    const draft = newDraft({
      id,
      ownerId: owner.id,
      now: new Date('2026-10-01T09:00:00.000Z'),
      type: 'piso',
      address: `Calle Mayor, ${String(created)}, ${municipality}`,
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

  async function search(user: Pick<EmulatorUser, 'idToken'>, preferences: object): Promise<void> {
    const response = await call(user, 'PUT', '/v1/me/search-preferences', preferences);
    expect(response.statusCode, response.body).toBe(200);
  }

  const like = (user: Pick<EmulatorUser, 'idToken'>, fromHomeId: string, targetHomeId: string) =>
    call(user, 'POST', '/v1/me/likes', { fromHomeId, targetHomeId });

  /** Ana (Getafe) y Beto (Leganés) con un match abierto entre sus viviendas. */
  async function pair(names: { ana: string; beto: string } = { ana: 'Ana', beto: 'Beto' }) {
    const ana = await registered(names.ana);
    const anaHome = await publishedHome(ana, 'Getafe', POINTS.getafe, 200_000);
    await search(ana, SEARCH_LEGANES);
    const beto = await registered(names.beto);
    const betoHome = await publishedHome(beto, 'Leganés', POINTS.leganes, 212_000);
    await search(beto, SEARCH_GETAFE);
    await like(beto, betoHome, anaHome);
    const matched = await like(ana, anaHome, betoHome);
    expect(matched.statusCode, matched.body).toBe(201);
    const matchId = matched.json<{ match: { id: string } }>().match.id;
    return { ana, anaHome, beto, betoHome, matchId };
  }

  return { bearer, call, registered, publishedHome, search, like, pair };
}
