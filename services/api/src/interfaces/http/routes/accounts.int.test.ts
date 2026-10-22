import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  emulatorAvailable,
  type EmulatorUser,
  expiredToken,
  signUp,
} from '../../../../test/auth-emulator.js';
import { FixedHomeOwnership } from '../../../../test/fakes.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';

const sql = openSql();
const ownership = new FixedHomeOwnership();
let app: FastifyInstance;
let close: () => Promise<void>;

const legal = { acceptedTermsVersion: TERMS_VERSION, acceptedPrivacyVersion: PRIVACY_VERSION };

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

function put(user: EmulatorUser, payload: object) {
  return app.inject({ method: 'PUT', url: '/v1/me', headers: bearer(user), payload });
}

function get(user: EmulatorUser, url: string) {
  return app.inject({ method: 'GET', url, headers: bearer(user) });
}

function post(user: EmulatorUser, payload: object) {
  return app.inject({ method: 'POST', url: '/v1/me/consents', headers: bearer(user), payload });
}

/** Una persona con cuenta en Firebase y ya dada de alta en ChangeHouse. */
async function registered(displayName = 'Ana'): Promise<EmulatorUser> {
  const user = await signUp();
  const response = await put(user, { displayName, ...legal });
  expect(response.statusCode).toBe(201);
  return user;
}

async function count(table: 'users' | 'consents'): Promise<number> {
  const [row] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM ${sql(table)}`;
  return row?.total ?? -1;
}

beforeAll(() => {
  ({ app, close } = createApi(testConfig(), { homeOwnership: ownership }));
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
  ownership.owners.clear();
});

afterAll(async () => {
  await close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('cuenta y consentimientos con tokens reales', () => {
  describe('PUT /me', () => {
    it('Scenario: Primer acceso completo - da de alta al usuario y registra los dos consentimientos con su versión y fecha', async () => {
      const user = await signUp();
      const before = Date.now();

      const response = await put(user, {
        displayName: ' Ana ',
        municipality: 'Madrid',
        ...legal,
      });

      expect(response.statusCode).toBe(201);
      const me = response.json<Record<string, unknown>>();
      expect(me).toMatchObject({
        email: user.email,
        displayName: 'Ana',
        municipality: 'Madrid',
        phone: null,
        meetsVppRequirements: false,
        isOver65: false,
        roles: ['seeker'],
        hasPublishedHome: false,
      });
      expect(Object.keys(me).sort()).toEqual([
        'displayName',
        'email',
        'hasPublishedHome',
        'id',
        'isOver65',
        'meetsVppRequirements',
        'municipality',
        'phone',
        'roles',
      ]);
      const rows = await sql<
        { type: string; version: string; accepted_at: Date; user_id: string }[]
      >`
        SELECT user_id, type, version, accepted_at FROM consents ORDER BY type`;
      expect(rows.map((row) => [row.type, row.version, row.user_id])).toEqual([
        ['terms', TERMS_VERSION, me['id']],
        ['privacy', PRIVACY_VERSION, me['id']],
      ]);
      for (const row of rows) {
        expect(row.accepted_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
        expect(row.accepted_at.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      }
      const [stored] = await sql<{ firebase_uid: string; assigned_role: string | null }[]>`
        SELECT firebase_uid, assigned_role FROM users`;
      expect(stored).toEqual({ firebase_uid: user.uid, assigned_role: null });
    });

    it.each([
      ['sin ninguna versión', {}],
      ['sin la privacidad', { acceptedTermsVersion: TERMS_VERSION }],
      ['con una versión que no es la vigente', { ...legal, acceptedTermsVersion: '2020-01' }],
    ])(
      'Scenario: Sin aceptar los textos legales - %s da 422 y no se da de alta a nadie',
      async (_label, accepted) => {
        const user = await signUp();

        const response = await put(user, { displayName: 'Ana', ...accepted });

        expect(response.statusCode).toBe(422);
        expect(response.json()).toMatchObject({ code: 'LEGAL_ACCEPTANCE_REQUIRED' });
        expect(await count('users')).toBe(0);
        expect(await count('consents')).toBe(0);
        expect((await get(user, '/v1/me')).statusCode).toBe(404);
      },
    );

    it('Scenario: Alta repetida - responde 200, sigue habiendo un solo usuario y se actualizan solo los datos enviados', async () => {
      const user = await signUp();
      const first = await put(user, { displayName: 'Ana', municipality: 'Madrid', ...legal });

      const second = await put(user, { displayName: 'Ana María', isOver65: true });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      expect(second.json()).toMatchObject({
        id: first.json<{ id: string }>().id,
        displayName: 'Ana María',
        municipality: 'Madrid',
        isOver65: true,
      });
      expect(await count('users')).toBe(1);
      expect(await count('consents')).toBe(2);
    });

    it('Scenario: Alta repetida - primeros accesos simultáneos de la misma persona crean un solo usuario', async () => {
      const user = await signUp();

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => put(user, { displayName: 'Ana', ...legal })),
      );

      expect(responses.map((response) => response.statusCode).sort()).toEqual([
        200, 200, 200, 200, 201,
      ]);
      expect(await count('users')).toBe(1);
      expect(await count('consents')).toBe(2);
    });

    it('un email que ya pertenece a otra identidad da 422 sin tocar al usuario existente', async () => {
      const user = await signUp();
      await sql`INSERT INTO users (id, firebase_uid, email, display_name)
                VALUES (${crypto.randomUUID()}, 'otra-identidad', ${user.email.toUpperCase()}, 'Otra')`;

      const response = await put(user, { displayName: 'Ana', ...legal });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
      expect(await count('users')).toBe(1);
      expect(await count('consents')).toBe(0);
    });

    it.each([
      ['roles', { roles: ['admin'] }],
      ['assignedRole', { assignedRole: 'admin' }],
      ['status', { status: 'suspended' }],
      ['ownerId', { ownerId: 'otro' }],
    ])(
      'Scenario: El cliente no fija roles - el campo %s da 400 y el rol no cambia',
      async (field, extra) => {
        const user = await registered();

        const response = await put(user, { displayName: 'Ana', ...extra });

        expect(response.statusCode).toBe(400);
        expect(response.json<{ errors: { field: string }[] }>().errors).toEqual([
          { field, message: 'invalid' },
        ]);
        const [stored] = await sql<
          { assigned_role: string | null }[]
        >`SELECT assigned_role FROM users`;
        expect(stored?.assigned_role).toBeNull();
        expect((await get(user, '/v1/me')).json()).toMatchObject({ roles: ['seeker'] });
      },
    );

    it('el alta de una persona sin cuenta previa no puede hacerse con el token de otra', async () => {
      const owner = await registered('Ana');
      const other = await signUp();

      await put(other, { displayName: 'Beto', ...legal });

      expect((await get(owner, '/v1/me')).json()).toMatchObject({ displayName: 'Ana' });
      expect((await get(other, '/v1/me')).json()).toMatchObject({ displayName: 'Beto' });
      expect(await count('users')).toBe(2);
    });
  });

  describe('PUT /me - edición del perfil', () => {
    const profile = {
      displayName: 'Ana García',
      municipality: 'Getafe',
      phone: '+34612345678',
      meetsVppRequirements: true,
      isOver65: true,
    };

    async function storedProfile() {
      const [row] = await sql<
        {
          display_name: string;
          municipality: string | null;
          phone: string | null;
          meets_vpp_requirements: boolean;
          is_over_65: boolean;
        }[]
      >`SELECT display_name, municipality, phone, meets_vpp_requirements, is_over_65 FROM users`;
      return row;
    }

    it('Scenario: Guardar cambios del perfil - GET /me devuelve los nuevos valores', async () => {
      const user = await registered('Ana');

      const response = await put(user, profile);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject(profile);
      expect((await get(user, '/v1/me')).json()).toMatchObject(profile);
    });

    it('Scenario: Guardar cambios del perfil - un campo omitido no se toca', async () => {
      const user = await registered('Ana');
      await put(user, profile);

      await put(user, { displayName: 'Ana García', isOver65: false });

      expect((await get(user, '/v1/me')).json()).toMatchObject({
        ...profile,
        isOver65: false,
      });
    });

    it('Scenario: Guardar cambios del perfil - un municipio en blanco lo borra', async () => {
      const user = await registered('Ana');
      await put(user, profile);

      const response = await put(user, { displayName: 'Ana García', municipality: '   ' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ municipality: null });
      expect((await storedProfile())?.municipality).toBeNull();
    });

    it.each([
      ['vacío', '', 'required'],
      ['solo espacios', '   ', 'required'],
      ['de más de 60 caracteres', 'x'.repeat(61), 'too_long'],
    ])(
      'Scenario: Nombre visible vacío - un nombre %s da 400 con displayName señalado y no se guarda nada',
      async (_label, displayName, message) => {
        const user = await registered('Ana');

        const response = await put(user, { ...profile, displayName });

        expect(response.statusCode).toBe(400);
        expect(response.json<{ errors: unknown[] }>().errors).toEqual([
          { field: 'displayName', message },
        ]);
        expect(await storedProfile()).toMatchObject({
          display_name: 'Ana',
          municipality: null,
          phone: null,
          meets_vpp_requirements: false,
          is_over_65: false,
        });
      },
    );

    it.each(['612345678', '+34 612 345 678', '+0612345678', '+34612'])(
      'Scenario: Teléfono con formato no válido - %s da 400 con phone señalado y no se guarda nada',
      async (phone) => {
        const user = await registered('Ana');

        const response = await put(user, { ...profile, phone });

        expect(response.statusCode).toBe(400);
        expect(response.json<{ errors: unknown[] }>().errors).toEqual([
          { field: 'phone', message: 'invalid' },
        ]);
        expect(await storedProfile()).toMatchObject({ phone: null, municipality: null });
      },
    );
  });

  describe('GET /me', () => {
    it('Scenario: Consultar la propia cuenta - un usuario sin viviendas recibe su nombre, su email, el rol seeker y hasPublishedHome en falso', async () => {
      const user = await registered('Ana');

      const response = await get(user, '/v1/me');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        email: user.email,
        displayName: 'Ana',
        roles: ['seeker'],
        hasPublishedHome: false,
      });
    });

    it('un usuario con vivienda publicada es owner', async () => {
      const user = await registered();
      const { id } = (await get(user, '/v1/me')).json<{ id: string }>();
      ownership.owners.add(id);

      expect((await get(user, '/v1/me')).json()).toMatchObject({
        roles: ['owner'],
        hasPublishedHome: true,
      });
    });

    it('un rol asignado en la base de datos se refleja y prevalece sobre las viviendas', async () => {
      const user = await registered();
      const { id } = (await get(user, '/v1/me')).json<{ id: string }>();
      ownership.owners.add(id);
      await sql`UPDATE users SET assigned_role = 'admin'`;

      expect((await get(user, '/v1/me')).json()).toMatchObject({
        roles: ['admin'],
        hasPublishedHome: false,
      });
    });

    it('quien aún no está dado de alta recibe 404, igual que una ruta inexistente', async () => {
      const user = await signUp();

      const response = await get(user, '/v1/me');
      const missing = await get(user, '/no-existe');

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        status: 404,
        title: missing.json<{ title: string }>().title,
      });
    });

    it('Scenario: Token caducado o manipulado - un token caducado da 401', async () => {
      const user = await registered();

      const response = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${expiredToken(user.idToken)}` },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /me/consents y POST /me/consents', () => {
    it('lista los consentimientos del alta con su versión y fecha', async () => {
      const user = await registered();

      const response = await get(user, '/v1/me/consents');

      expect(response.statusCode).toBe(200);
      const list = response.json<{ type: string; version: string; acceptedAt: string }[]>();
      expect(list.map((consent) => [consent.type, consent.version]).sort()).toEqual([
        ['privacy', PRIVACY_VERSION],
        ['terms', TERMS_VERSION],
      ]);
      for (const consent of list) expect(Number.isNaN(Date.parse(consent.acceptedAt))).toBe(false);
    });

    it('Scenario: Aceptar una nueva versión de la privacidad - la lista conserva la anterior y añade la nueva con su fecha', async () => {
      const user = await registered();

      const created = await post(user, { type: 'privacy', version: '2027-01' });
      const list = (await get(user, '/v1/me/consents')).json<{ type: string; version: string }[]>();

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ type: 'privacy', version: '2027-01' });
      expect(list.filter((consent) => consent.type === 'privacy').map((c) => c.version)).toEqual([
        PRIVACY_VERSION,
        '2027-01',
      ]);
      expect(list).toHaveLength(3);
    });

    it('aceptar dos veces la misma versión responde 201 y no duplica el registro ni cambia su fecha', async () => {
      const user = await registered();

      const first = await post(user, { type: 'analytics', version: '1' });
      const second = await post(user, { type: 'analytics', version: '1' });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(second.json()).toEqual(first.json());
      expect(await count('consents')).toBe(3);
    });

    it('cada usuario ve solo sus consentimientos', async () => {
      const ana = await registered('Ana');
      const beto = await registered('Beto');
      await post(ana, { type: 'marketing', version: '1' });

      const list = (await get(beto, '/v1/me/consents')).json<{ type: string }[]>();

      expect(list.map((consent) => consent.type)).not.toContain('marketing');
      expect(list).toHaveLength(2);
    });

    it('quien aún no está dado de alta recibe 404 al listar y al aceptar', async () => {
      const user = await signUp();

      expect((await get(user, '/v1/me/consents')).statusCode).toBe(404);
      expect((await post(user, { type: 'terms', version: TERMS_VERSION })).statusCode).toBe(404);
      expect(await count('consents')).toBe(0);
    });

    it('un cuerpo no válido da 400 y no registra nada', async () => {
      const user = await registered();

      const response = await post(user, { type: 'terms', version: '' });

      expect(response.statusCode).toBe(400);
      expect(await count('consents')).toBe(2);
    });
  });
});
