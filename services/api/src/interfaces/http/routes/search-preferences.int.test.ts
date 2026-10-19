import { FIXTURE_PLACES, PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';

const MALASANA = FIXTURE_PLACES[0]!;
const ADDRESS = { placeId: MALASANA.placeId, formatted: MALASANA.formatted };
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';
const MADRID = { municipalities: ['Madrid'], maxToPayCents: 20_000_00, minToReceiveCents: 0 };
const VALENCIA = {
  municipalities: ['Valencia'],
  maxToPayCents: 10_000_00,
  minToReceiveCents: 500_00,
};

const sql = openSql();
let app: FastifyInstance;
let close: () => Promise<void>;

type Json = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

function call(user: EmulatorUser, method: Method, url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: bearer(user),
    ...(payload ? { payload } : {}),
  });
}

async function registered(assignedRole?: 'agency' | 'admin'): Promise<EmulatorUser> {
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
  return user;
}

async function createHome(user: EmulatorUser): Promise<string> {
  const response = await call(user, 'POST', '/v1/homes', { type: 'piso', address: ADDRESS });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ id: string }>().id;
}

beforeAll(() => {
  ({ app, close } = createApi(testConfig()));
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
});

afterAll(async () => {
  await close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('preferencias de búsqueda con tokens reales', () => {
  describe('preferencias por defecto del usuario', () => {
    it('Scenario: Guardar preferencias - Getafe, 3 dormitorios, pagar hasta 30.000 € y recibir 0 € se consultan con el punto de referencia 50', async () => {
      const user = await registered();

      const saved = await call(user, 'PUT', '/v1/me/search-preferences', {
        municipalities: ['Getafe'],
        filters: { minBedrooms: 3 },
        maxToPayCents: 30_000_00,
        minToReceiveCents: 0,
      });
      const read = await call(user, 'GET', '/v1/me/search-preferences');

      expect(saved.statusCode).toBe(200);
      expect(read.statusCode).toBe(200);
      expect(read.json()).toEqual({
        municipalities: ['Getafe'],
        filters: { minBedrooms: 3 },
        maxToPayCents: 30_000_00,
        minToReceiveCents: 0,
        valueReferencePct: 50,
      });
      expect(saved.json()).toEqual(read.json());
    });

    it('sin preferencias guardadas el GET es un 404', async () => {
      const user = await registered();

      const response = await call(user, 'GET', '/v1/me/search-preferences');

      expect(response.statusCode).toBe(404);
    });

    it('guarda un punto con radio y lo devuelve; un PUT posterior reemplaza el documento entero', async () => {
      const user = await registered();
      await call(user, 'PUT', '/v1/me/search-preferences', {
        center: { lat: 40.4, lng: -3.7 },
        radiusKm: 15,
        filters: { garage: true },
        maxToPayCents: 1,
        minToReceiveCents: 2,
        valueReferencePct: 80,
      });

      const first = await call(user, 'GET', '/v1/me/search-preferences');
      await call(user, 'PUT', '/v1/me/search-preferences', MADRID);
      const second = await call(user, 'GET', '/v1/me/search-preferences');

      expect(first.json()).toMatchObject({
        center: { lat: 40.4, lng: -3.7 },
        radiusKm: 15,
        valueReferencePct: 80,
      });
      expect(second.json()).toEqual({ ...MADRID, filters: {}, valueReferencePct: 50 });
      const rows = await sql`SELECT 1 FROM search_preferences`;
      expect(rows).toHaveLength(1);
    });

    it('Scenario: Sin zona - 422 con el código y sin guardar nada', async () => {
      const user = await registered();

      const response = await call(user, 'PUT', '/v1/me/search-preferences', {
        maxToPayCents: 30_000_00,
        minToReceiveCents: 0,
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'SEARCH_PREFERENCES_INCOMPLETE' });
      expect(await sql`SELECT 1 FROM search_preferences`).toHaveLength(0);
    });

    it('Scenario: Punto de referencia fuera de rango - 400 que señala el campo y no guarda nada', async () => {
      const user = await registered();

      const response = await call(user, 'PUT', '/v1/me/search-preferences', {
        ...MADRID,
        valueReferencePct: 120,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual([
        'valueReferencePct',
      ]);
      expect(await sql`SELECT 1 FROM search_preferences`).toHaveLength(0);
    });

    it.each([
      [{ center: { lat: 40.4, lng: -3.7 } }, 'radiusKm'],
      [{ radiusKm: 10 }, 'center'],
      [{ center: { lat: 40.4, lng: -3.7 }, radiusKm: 201 }, 'radiusKm'],
    ])(
      'un centro y un radio incompletos o fuera de rango (%j) es un 400 sobre %s',
      async (zone, field) => {
        const user = await registered();

        const response = await call(user, 'PUT', '/v1/me/search-preferences', {
          ...MADRID,
          ...zone,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json<{ errors: { field: string }[] }>().errors[0]?.field).toBe(field);
      },
    );

    it.each(['agency', 'admin'] as const)(
      'una cuenta %s recibe 403 y no guarda nada',
      async (role) => {
        const user = await registered(role);

        const response = await call(user, 'PUT', '/v1/me/search-preferences', MADRID);

        expect(response.statusCode).toBe(403);
        expect(await sql`SELECT 1 FROM search_preferences`).toHaveLength(0);
      },
    );
  });

  describe('preferencias de una vivienda', () => {
    it('Scenario: Preferencias distintas para una segunda vivienda - la segunda usa Valencia y la primera sigue con Madrid', async () => {
      const user = await registered();
      const first = await createHome(user);
      const second = await createHome(user);
      await call(user, 'PUT', '/v1/me/search-preferences', MADRID);

      const saved = await call(user, 'PUT', `/v1/homes/${second}/search-preferences`, VALENCIA);

      expect(saved.statusCode).toBe(200);
      const own = await call(user, 'GET', `/v1/homes/${second}/search-preferences`);
      expect(own.json<Json>()['municipalities']).toEqual(['Valencia']);
      const withoutOwn = await call(user, 'GET', `/v1/homes/${first}/search-preferences`);
      expect(withoutOwn.statusCode).toBe(404);
      const mine = await call(user, 'GET', '/v1/me/search-preferences');
      expect(mine.json<Json>()['municipalities']).toEqual(['Madrid']);
    });

    it('Scenario: Volver a las del usuario - eliminarlas da 204, la consulta pasa a 404 y las del usuario siguen', async () => {
      const user = await registered();
      const home = await createHome(user);
      await call(user, 'PUT', '/v1/me/search-preferences', MADRID);
      await call(user, 'PUT', `/v1/homes/${home}/search-preferences`, VALENCIA);

      const removed = await call(user, 'DELETE', `/v1/homes/${home}/search-preferences`);
      const read = await call(user, 'GET', `/v1/homes/${home}/search-preferences`);
      const again = await call(user, 'DELETE', `/v1/homes/${home}/search-preferences`);

      expect(removed.statusCode).toBe(204);
      expect(read.statusCode).toBe(404);
      expect(again.statusCode).toBe(404);
      const mine = await call(user, 'GET', '/v1/me/search-preferences');
      expect(mine.json<Json>()['municipalities']).toEqual(['Madrid']);
    });

    it('Scenario: Vivienda ajena - leer, cambiar o eliminar es un 404 idéntico al de una inexistente y no cambia nada', async () => {
      const owner = await registered();
      const intruder = await registered();
      const home = await createHome(owner);
      await call(owner, 'PUT', `/v1/homes/${home}/search-preferences`, VALENCIA);

      const responses = await Promise.all([
        call(intruder, 'GET', `/v1/homes/${home}/search-preferences`),
        call(intruder, 'PUT', `/v1/homes/${home}/search-preferences`, MADRID),
        call(intruder, 'DELETE', `/v1/homes/${home}/search-preferences`),
        call(intruder, 'GET', `/v1/homes/${MISSING_ID}/search-preferences`),
      ]);

      expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404, 404]);
      const bodies = responses.map((response) => {
        const body = response.json<Json>();
        delete body['correlationId'];
        return body;
      });
      expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
      const own = await call(owner, 'GET', `/v1/homes/${home}/search-preferences`);
      expect(own.json<Json>()['municipalities']).toEqual(['Valencia']);
    });

    it('Scenario: Sin zona - las de una vivienda también dan 422 sin guardar', async () => {
      const user = await registered();
      const home = await createHome(user);

      const response = await call(user, 'PUT', `/v1/homes/${home}/search-preferences`, {
        maxToPayCents: 0,
        minToReceiveCents: 0,
      });

      expect(response.statusCode).toBe(422);
      expect(await sql`SELECT 1 FROM search_preferences`).toHaveLength(0);
    });

    it('borrar la vivienda no deja sus preferencias huérfanas', async () => {
      const user = await registered();
      const home = await createHome(user);
      await call(user, 'PUT', `/v1/homes/${home}/search-preferences`, VALENCIA);

      await sql`DELETE FROM homes WHERE id = ${home}`;

      expect(await sql`SELECT 1 FROM search_preferences`).toHaveLength(0);
    });

    it.each(['agency', 'admin'] as const)('una cuenta %s recibe 403', async (role) => {
      const user = await registered(role);

      const response = await call(user, 'GET', `/v1/homes/${MISSING_ID}/search-preferences`);

      expect(response.statusCode).toBe(403);
    });
  });
});
