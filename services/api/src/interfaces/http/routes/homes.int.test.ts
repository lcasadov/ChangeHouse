import { FIXTURE_PLACES, PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';

const MALASANA = FIXTURE_PLACES[0]!;
const CHAMBERI = FIXTURE_PLACES[1]!;
const ADDRESS = { placeId: MALASANA.placeId, formatted: MALASANA.formatted };
const COMPLETE = {
  usefulM2: 80,
  builtM2: 95,
  bedrooms: 3,
  bathrooms: 2,
  hasLift: true,
  garage: false,
  storageRoom: false,
  valueMinCents: 250_000_00,
  valueMaxCents: 280_000_00,
  isPrimaryResidence: true,
};
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';

const sql = openSql();
let app: FastifyInstance;
let close: () => Promise<void>;

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

type Json = Record<string, unknown>;

function call(user: EmulatorUser, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: { ...bearer(user), 'x-correlation-id': 'corr-fijo' },
    ...(payload ? { payload } : {}),
  });
}

/** Persona con cuenta en Firebase y dada de alta en ChangeHouse. */
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

async function createHome(user: EmulatorUser, extra: object = {}): Promise<Json> {
  const response = await call(user, 'POST', '/v1/homes', {
    type: 'piso',
    address: ADDRESS,
    ...extra,
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<Json>();
}

/** Fotos ya procesadas de la vivienda, insertadas directamente: el envío a revisión exige al menos 3 (RF-11). */
async function addReadyPhotos(homeId: unknown, count = 3): Promise<void> {
  for (let position = 1; position <= count; position += 1) {
    const id = crypto.randomUUID();
    await sql`INSERT INTO home_photos (id, home_id, status, storage_path, position)
              VALUES (${id}, ${String(homeId)}, 'ready', ${`homes/${String(homeId)}/${id}.webp`}, ${position})`;
  }
}

async function setStatus(homeId: unknown, status: string): Promise<void> {
  await sql`UPDATE homes SET status = ${status}::home_status WHERE id = ${String(homeId)}`;
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

describe.skipIf(!emulatorAvailable())('viviendas con tokens reales', () => {
  describe('createHome', () => {
    it('Scenario: Alta de vivienda en borrador - nace en draft, con el barrio y el centro como ubicación y sin ids ajenos', async () => {
      const user = await registered();

      const response = await call(user, 'POST', '/v1/homes', { type: 'atico', address: ADDRESS });

      expect(response.statusCode).toBe(201);
      const home = response.json<Json>();
      expect(home).toMatchObject({
        status: 'draft',
        type: 'atico',
        regime: 'libre',
        address: MALASANA.formatted,
        location: { visibility: 'area', point: MALASANA.areaCenter, areaName: 'Malasaña' },
        photos: [],
      });
      expect(response.headers['location']).toBe(`/v1/homes/${String(home['id'])}`);
      const [row] = await sql<{ owner: string; status: string }[]>`
        SELECT u.firebase_uid AS owner, h.status FROM homes h JOIN users u ON u.id = h.owner_id`;
      expect(row).toEqual({ owner: user.uid, status: 'draft' });
    });

    it('Scenario: Ubicación y dirección privada - la dirección se guarda cifrada, nunca en claro', async () => {
      const user = await registered();
      await createHome(user);

      const [row] = await sql<{ raw: string; version: number; exact: string }[]>`
        SELECT encode(exact_address, 'escape') AS raw,
               get_byte(exact_address, 0) AS version,
               ST_AsText(exact_location::geometry) AS exact
        FROM homes`;

      expect(row?.raw).not.toContain('Calle del Pez');
      expect(row?.version).toBe(1);
      expect(row?.exact).toBe(`POINT(${String(MALASANA.exact.lng)} ${String(MALASANA.exact.lat)})`);
    });

    it('Scenario: Rango de valor incoherente - un mínimo mayor que el máximo da 422 y no guarda la vivienda', async () => {
      const user = await registered();

      const response = await call(user, 'POST', '/v1/homes', {
        type: 'piso',
        address: ADDRESS,
        valueMinCents: 300_000_00,
        valueMaxCents: 200_000_00,
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        code: 'INVALID_VALUE_RANGE',
        errors: [{ field: 'valueMinCents' }, { field: 'valueMaxCents' }],
      });
      expect(await sql`SELECT 1 FROM homes`).toHaveLength(0);
    });

    it.each(['agency', 'admin'] as const)(
      'Scenario: Cuentas de gestoría o administración - una cuenta %s recibe 403 y no se crea nada',
      async (role) => {
        const user = await registered(role);

        const response = await call(user, 'POST', '/v1/homes', { type: 'piso', address: ADDRESS });

        expect(response.statusCode).toBe(403);
        expect(await sql`SELECT 1 FROM homes`).toHaveLength(0);
      },
    );

    it('Scenario: Dirección no reconocida - 422 señalando address y sin guardar nada', async () => {
      const user = await registered();

      const response = await call(user, 'POST', '/v1/homes', {
        type: 'piso',
        address: { placeId: 'fixture-desconocido', formatted: 'Calle Inventada, 1' },
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        code: 'ADDRESS_NOT_RESOLVED',
        errors: [{ field: 'address' }],
      });
      expect(await sql`SELECT 1 FROM homes`).toHaveLength(0);
    });

    it('un estado o un propietario enviados por el cliente dan 400 (RC-17)', async () => {
      const user = await registered();

      const response = await call(user, 'POST', '/v1/homes', {
        type: 'piso',
        address: ADDRESS,
        status: 'published',
        ownerId: 'otro',
      });

      expect(response.statusCode).toBe(400);
      expect(await sql`SELECT 1 FROM homes`).toHaveLength(0);
    });
  });

  describe('updateHome', () => {
    it('Scenario: Asistente que guarda el avance - cada paso se guarda y el borrador conserva los datos al volver a «Mis casas»', async () => {
      const user = await registered();
      const { id } = await createHome(user);

      const step = await call(user, 'PATCH', `/v1/homes/${String(id)}`, {
        usefulM2: 80,
        builtM2: 95,
        features: { terrace: true },
      });
      const back = await call(user, 'GET', '/v1/me/homes');

      expect(step.statusCode).toBe(200);
      expect(back.json<Json[]>()).toMatchObject([
        { id, status: 'draft', usefulM2: 80, builtM2: 95, features: { terrace: true } },
      ]);
    });

    it('cambiar la dirección la vuelve a resolver en el servidor', async () => {
      const user = await registered();
      const { id } = await createHome(user);

      const response = await call(user, 'PATCH', `/v1/homes/${String(id)}`, {
        address: { placeId: CHAMBERI.placeId, formatted: CHAMBERI.formatted },
      });

      expect(response.json()).toMatchObject({
        address: CHAMBERI.formatted,
        location: { point: CHAMBERI.areaCenter, areaName: 'Chamberí' },
      });
    });

    it('Scenario: Rango de valor incoherente - un máximo por debajo del mínimo guardado da 422 y no cambia nada', async () => {
      const user = await registered();
      const { id } = await createHome(user, {
        valueMinCents: 300_000_00,
        valueMaxCents: 400_000_00,
      });

      const response = await call(user, 'PATCH', `/v1/homes/${String(id)}`, {
        valueMaxCents: 100_000_00,
      });
      const stored = await call(user, 'GET', `/v1/homes/${String(id)}`);

      expect(response.statusCode).toBe(422);
      expect(stored.json()).toMatchObject({ valueMaxCents: 400_000_00 });
    });

    it('Scenario: Vivienda ajena no publicada - modificar la de otro es un 404 y no cambia nada', async () => {
      const owner = await registered();
      const other = await registered();
      const { id } = await createHome(owner);

      const response = await call(other, 'PATCH', `/v1/homes/${String(id)}`, { bedrooms: 9 });

      expect(response.statusCode).toBe(404);
      const [row] = await sql<{ bedrooms: number | null }[]>`SELECT bedrooms FROM homes`;
      expect(row?.bedrooms).toBeNull();
    });

    it.each(['in_operation', 'closed'])(
      'Scenario: Edición de una vivienda en operación - en %s responde 409 y no cambia nada',
      async (status) => {
        const user = await registered();
        const { id } = await createHome(user);
        await setStatus(id, status);

        const response = await call(user, 'PATCH', `/v1/homes/${String(id)}`, { bedrooms: 9 });

        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject({ code: 'HOME_NOT_EDITABLE' });
        const [row] = await sql<{ bedrooms: number | null }[]>`SELECT bedrooms FROM homes`;
        expect(row?.bedrooms).toBeNull();
      },
    );

    it('una vivienda publicada que cambia un dato relevante vuelve a in_review y anota el cambio', async () => {
      const user = await registered();
      const { id } = await createHome(user, COMPLETE);
      await setStatus(id, 'published');

      const response = await call(user, 'PATCH', `/v1/homes/${String(id)}`, { usefulM2: 90 });

      expect(response.json()).toMatchObject({ status: 'in_review', usefulM2: 90 });
      const [row] = await sql<
        { changed: Date | null }[]
      >`SELECT relevant_changed_at AS changed FROM homes`;
      expect(row?.changed).toBeInstanceOf(Date);
    });
  });

  describe('listMyHomes', () => {
    it('Scenario: Segunda vivienda - lista las dos con su estado y ninguna ajena', async () => {
      const user = await registered();
      const stranger = await registered();
      const first = await createHome(user, COMPLETE);
      await setStatus(first['id'], 'published');
      const second = await createHome(user, { type: 'casa' });
      await createHome(stranger);

      const response = await call(user, 'GET', '/v1/me/homes');

      expect(response.statusCode).toBe(200);
      expect(response.json<Json[]>().map((home) => [home['id'], home['status']])).toEqual([
        [first['id'], 'published'],
        [second['id'], 'draft'],
      ]);
    });

    it('sin viviendas devuelve una lista vacía', async () => {
      const user = await registered();

      const response = await call(user, 'GET', '/v1/me/homes');

      expect(response.json()).toEqual([]);
    });
  });

  describe('getHome', () => {
    it('Scenario: El propietario ve su borrador - todos sus datos, incluida la dirección', async () => {
      const user = await registered();
      const { id } = await createHome(user);

      const response = await call(user, 'GET', `/v1/homes/${String(id)}`);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: 'draft', address: MALASANA.formatted });
    });

    it('Scenario: Ubicación por zona por defecto - otro usuario ve el barrio y su centro, nunca el punto exacto ni la dirección', async () => {
      const owner = await registered();
      const viewer = await registered();
      const { id } = await createHome(owner, COMPLETE);
      await setStatus(id, 'published');

      const response = await call(viewer, 'GET', `/v1/homes/${String(id)}`);

      expect(response.statusCode).toBe(200);
      const home = response.json<Json>();
      expect(home).toMatchObject({
        location: { visibility: 'area', point: MALASANA.areaCenter, areaName: 'Malasaña' },
      });
      expect(home).not.toHaveProperty('address');
      expect(home).not.toHaveProperty('status');
      expect(response.body).not.toContain(String(MALASANA.exact.lat));
      expect(response.body).not.toContain('Calle del Pez');
    });

    it('Scenario: Ubicación exacta elegida - otro usuario ve el punto exacto en el mapa pero no la dirección', async () => {
      const owner = await registered();
      const viewer = await registered();
      const { id } = await createHome(owner, { ...COMPLETE, locationVisibility: 'exact' });
      await setStatus(id, 'published');

      const response = await call(viewer, 'GET', `/v1/homes/${String(id)}`);

      expect(response.json()).toMatchObject({
        location: { visibility: 'exact', point: MALASANA.exact },
      });
      expect(response.body).not.toContain('Calle del Pez');
    });

    it('un administrador ve la forma pública de una vivienda publicada ajena', async () => {
      const owner = await registered();
      const admin = await registered('admin');
      const { id } = await createHome(owner, COMPLETE);
      await setStatus(id, 'published');

      const response = await call(admin, 'GET', `/v1/homes/${String(id)}`);

      expect(response.statusCode).toBe(200);
      expect(response.json()).not.toHaveProperty('address');
    });

    it('Scenario: Vivienda ajena no publicada - 404 idéntico al de un identificador inexistente', async () => {
      const owner = await registered();
      const viewer = await registered();
      const { id } = await createHome(owner);

      const foreign = await call(viewer, 'GET', `/v1/homes/${String(id)}`);
      const missing = await call(viewer, 'GET', `/v1/homes/${MISSING_ID}`);
      const malformed = await call(viewer, 'GET', '/v1/homes/no-es-uuid');

      expect(foreign.statusCode).toBe(404);
      expect(foreign.body).toBe(missing.body);
      expect(malformed.statusCode).toBe(404);
      expect(malformed.body).toBe(missing.body);
    });

    it.each(['in_review', 'paused', 'in_operation', 'closed'])(
      'una vivienda ajena en %s tampoco se ve (RC-07)',
      async (status) => {
        const owner = await registered();
        const viewer = await registered();
        const { id } = await createHome(owner);
        await setStatus(id, status);

        const response = await call(viewer, 'GET', `/v1/homes/${String(id)}`);

        expect(response.statusCode).toBe(404);
      },
    );
  });

  describe('submitHome', () => {
    it('Scenario: Envío de una ficha completa - pasa a in_review y «Mis casas» lo refleja', async () => {
      const user = await registered();
      const { id } = await createHome(user, COMPLETE);
      await addReadyPhotos(id);

      const response = await call(user, 'POST', `/v1/homes/${String(id)}/submit`);
      const list = await call(user, 'GET', '/v1/me/homes');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: 'in_review' });
      expect(list.json<Json[]>()).toMatchObject([{ id, status: 'in_review' }]);
    });

    it('Scenario: Envío de una ficha incompleta - 422 con los campos que faltan y sigue en draft', async () => {
      const user = await registered();
      const { id } = await createHome(user, {
        ...COMPLETE,
        valueMinCents: undefined,
        valueMaxCents: undefined,
      });
      await addReadyPhotos(id);

      const response = await call(user, 'POST', `/v1/homes/${String(id)}/submit`);

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        code: 'HOME_INCOMPLETE',
        errors: [{ field: 'valueMinCents' }, { field: 'valueMaxCents' }],
      });
      const [row] = await sql<{ status: string }[]>`SELECT status FROM homes`;
      expect(row?.status).toBe('draft');
    });

    it('enviar una vivienda que ya está en revisión da 409', async () => {
      const user = await registered();
      const { id } = await createHome(user, COMPLETE);
      await addReadyPhotos(id);
      await call(user, 'POST', `/v1/homes/${String(id)}/submit`);

      const again = await call(user, 'POST', `/v1/homes/${String(id)}/submit`);

      expect(again.statusCode).toBe(409);
    });

    it('enviar la vivienda de otro es un 404', async () => {
      const owner = await registered();
      const other = await registered();
      const { id } = await createHome(owner, COMPLETE);

      const response = await call(other, 'POST', `/v1/homes/${String(id)}/submit`);

      expect(response.statusCode).toBe(404);
      const [row] = await sql<{ status: string }[]>`SELECT status FROM homes`;
      expect(row?.status).toBe('draft');
    });
  });

  describe('régimen de protección (RF-14, RN-06)', () => {
    it('Scenario: VPP sin fecha de calificación - el borrador VPPL sin fecha se guarda, pero enviarlo da 400 señalando vppQualificationDate y sigue en draft', async () => {
      const user = await registered();
      const { id } = await createHome(user, { ...COMPLETE, regime: 'VPPL' });
      await addReadyPhotos(id);

      const response = await call(user, 'POST', `/v1/homes/${String(id)}/submit`);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'VPP_QUALIFICATION_DATE_REQUIRED',
        errors: [{ field: 'vppQualificationDate' }],
      });
      const [row] = await sql<{ status: string }[]>`SELECT status FROM homes`;
      expect(row?.status).toBe('draft');
    });

    it('Scenario: VPP sin fecha de calificación - con la fecha de calificación la VPPL se envía a revisión', async () => {
      const user = await registered();
      const { id } = await createHome(user, { ...COMPLETE, regime: 'VPPL' });
      await addReadyPhotos(id);
      const patched = await call(user, 'PATCH', `/v1/homes/${String(id)}`, {
        vppQualificationDate: '2015-03-10',
      });

      const response = await call(user, 'POST', `/v1/homes/${String(id)}/submit`);

      expect(patched.statusCode).toBe(200);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'in_review',
        regime: 'VPPL',
        vppQualificationDate: '2015-03-10',
      });
    });

    it('Scenario: Vivienda libre - se guarda y se envía sin datos de protección', async () => {
      const user = await registered();
      const { id } = await createHome(user, { ...COMPLETE, regime: 'libre' });
      await addReadyPhotos(id);

      const response = await call(user, 'POST', `/v1/homes/${String(id)}/submit`);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'in_review',
        regime: 'libre',
        vppQualificationDate: null,
        vppProtectionEnd: null,
        vppMaxLegalPriceCents: null,
      });
    });

    it('Scenario: Valor por encima del máximo legal - una VPO con máximo legal de 180.000 € y valor máximo de 200.000 € da 422 señalando valueMaxCents y no se guarda', async () => {
      const user = await registered();

      const response = await call(user, 'POST', '/v1/homes', {
        type: 'piso',
        address: ADDRESS,
        regime: 'VPO',
        vppQualificationDate: '2010-01-01',
        vppMaxLegalPriceCents: 180_000_00,
        valueMinCents: 150_000_00,
        valueMaxCents: 200_000_00,
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        code: 'VALUE_ABOVE_VPP_MAX_LEGAL_PRICE',
        errors: [{ field: 'valueMaxCents' }],
      });
      expect(await sql`SELECT 1 FROM homes`).toHaveLength(0);
    });

    it('Scenario: Valor por encima del máximo legal - subir el valor máximo por encima del máximo legal guardado da 422 y no cambia nada', async () => {
      const user = await registered();
      const { id } = await createHome(user, {
        regime: 'VPO',
        vppMaxLegalPriceCents: 180_000_00,
        valueMinCents: 150_000_00,
        valueMaxCents: 170_000_00,
      });

      const response = await call(user, 'PATCH', `/v1/homes/${String(id)}`, {
        valueMaxCents: 200_000_00,
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'VALUE_ABOVE_VPP_MAX_LEGAL_PRICE' });
      const [row] = await sql<{ value_max_cents: string }[]>`SELECT value_max_cents FROM homes`;
      expect(Number(row?.value_max_cents)).toBe(170_000_00);
    });

    it('Scenario: Detalle de una VPPL - otro usuario ve en la forma pública el régimen y el precio máximo legal, pero no las fechas de protección', async () => {
      const owner = await registered();
      const viewer = await registered();
      const { id } = await createHome(owner, {
        ...COMPLETE,
        regime: 'VPPL',
        vppQualificationDate: '2015-03-10',
        vppProtectionEnd: '2045-03-10',
        vppMaxLegalPriceCents: 300_000_00,
      });
      await setStatus(id, 'published');

      const response = await call(viewer, 'GET', `/v1/homes/${String(id)}`);

      expect(response.statusCode).toBe(200);
      const home = response.json<Json>();
      expect(home).toMatchObject({ regime: 'VPPL', vppMaxLegalPriceCents: 300_000_00 });
      expect(home).not.toHaveProperty('vppQualificationDate');
      expect(home).not.toHaveProperty('vppProtectionEnd');
    });
  });

  describe('rol derivado de las viviendas (GET /me)', () => {
    async function me(user: EmulatorUser) {
      const response = await call(user, 'GET', '/v1/me');
      return response.json<{ roles: string[]; hasPublishedHome: boolean }>();
    }

    it('Scenario: Sin vivienda publicada - con una única vivienda en in_review su rol es seeker', async () => {
      const user = await registered();
      const { id } = await createHome(user, COMPLETE);
      await addReadyPhotos(id);
      await call(user, 'POST', `/v1/homes/${String(id)}/submit`);

      expect(await me(user)).toMatchObject({ roles: ['seeker'], hasPublishedHome: false });
    });

    it('una vivienda que pasa a published convierte a su propietario en owner sin que nadie le asigne el rol', async () => {
      const user = await registered();
      const { id } = await createHome(user, COMPLETE);
      expect(await me(user)).toMatchObject({ roles: ['seeker'] });

      await setStatus(id, 'published');

      expect(await me(user)).toMatchObject({ roles: ['owner'], hasPublishedHome: true });
    });

    it.each(['paused', 'in_operation'])(
      'con una vivienda en %s también es owner',
      async (status) => {
        const user = await registered();
        const { id } = await createHome(user, COMPLETE);
        await setStatus(id, status);

        expect(await me(user)).toMatchObject({ roles: ['owner'], hasPublishedHome: true });
      },
    );

    it('la vivienda publicada de otro no hace owner a nadie más', async () => {
      const owner = await registered();
      const other = await registered();
      const { id } = await createHome(owner, COMPLETE);
      await setStatus(id, 'published');

      expect(await me(other)).toMatchObject({ roles: ['seeker'], hasPublishedHome: false });
    });
  });
});
