import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApi } from '../../src/bootstrap.js';
import { emulatorAvailable, signUp, uniqueEmail } from '../auth-emulator.js';
import { FixedHomeOwnership } from '../fakes.js';
import { openSql, testConfig } from '../fixtures.js';
import { loadMatrix, type MatrixActor, matrixGaps, type MatrixRow } from './matrix.js';

/** Viviendas que la matriz necesita: una propia del actor (borrador completo) y una publicada ajena. */
interface HomeContext {
  ownHomeId: string;
  publishedHomeId: string;
}

interface RequestTemplate {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  url: string | ((context: HomeContext) => string);
  payload?: () => object;
}

const MISSING_HOME = '0199c1a2-0000-7000-8000-000000000000';
const ADDRESS = {
  placeId: 'fixture-malasana',
  formatted: 'Calle del Pez, 12, 28004 Madrid, España',
};
const COMPLETE_HOME = {
  type: 'piso',
  address: ADDRESS,
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

/** Una petición válida por operación implementada: la matriz mide la autorización, no la validación. */
const REQUESTS: Record<string, RequestTemplate> = {
  joinWaitlist: {
    method: 'POST',
    url: '/v1/waitlist',
    payload: () => ({
      email: uniqueEmail('espera'),
      municipality: 'Madrid',
      homeType: 'piso',
      lookingFor: 'Un ático con terraza',
      consent: true,
    }),
  },
  getMe: { method: 'GET', url: '/v1/me' },
  upsertMe: {
    method: 'PUT',
    url: '/v1/me',
    payload: () => ({
      displayName: 'Ana',
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
    }),
  },
  listMyConsents: { method: 'GET', url: '/v1/me/consents' },
  listMyHomes: { method: 'GET', url: '/v1/me/homes' },
  createHome: {
    method: 'POST',
    url: '/v1/homes',
    payload: () => ({ type: 'piso', address: ADDRESS }),
  },
  getHome: { method: 'GET', url: (context) => `/v1/homes/${context.publishedHomeId}` },
  updateHome: {
    method: 'PATCH',
    url: (context) => `/v1/homes/${context.ownHomeId}`,
    payload: () => ({ bedrooms: 2 }),
  },
  submitHome: { method: 'POST', url: (context) => `/v1/homes/${context.ownHomeId}/submit` },
  acceptConsent: {
    method: 'POST',
    url: '/v1/me/consents',
    payload: () => ({ type: 'analytics', version: '2026-10' }),
  },
};

const sql = openSql();
const ownership = new FixedHomeOwnership();
let api: ReturnType<typeof createApi>;
const rows = loadMatrix();

beforeAll(async () => {
  await sql`TRUNCATE users CASCADE`;
  api = createApi(testConfig(), { homeOwnership: ownership });
  await api.app.ready();
});

afterAll(async () => {
  await api.close();
  await sql.end();
});

let publishedHomeId: string | undefined;

/** Una vivienda publicada de un tercero, creada una sola vez para todas las filas. */
async function publishedHome(): Promise<string> {
  if (publishedHomeId) return publishedHomeId;
  const landlord = await signUp();
  const landlordId = crypto.randomUUID();
  await sql`INSERT INTO users (id, firebase_uid, email, display_name)
            VALUES (${landlordId}, ${landlord.uid}, ${landlord.email}, 'Propietario de la matriz')`;
  const created = await api.app.inject({
    method: 'POST',
    url: '/v1/homes',
    headers: { authorization: `Bearer ${landlord.idToken}` },
    payload: COMPLETE_HOME,
  });
  publishedHomeId = created.json<{ id: string }>().id;
  await sql`UPDATE homes SET status = 'published' WHERE id = ${publishedHomeId}`;
  return publishedHomeId;
}

/** Prepara un actor nuevo en cada caso: ninguna fila depende de lo que dejó otra. */
async function authorizationFor(
  actor: MatrixActor,
): Promise<{ headers: Record<string, string>; context: HomeContext }> {
  const context: HomeContext = { ownHomeId: MISSING_HOME, publishedHomeId: await publishedHome() };
  if (actor === 'anon') return { headers: {}, context };
  const { uid, email, idToken } = await signUp();
  const headers = { authorization: `Bearer ${idToken}` };
  if (actor === 'unregistered') return { headers, context };

  const assigned = actor === 'agency' || actor === 'admin' ? actor : null;
  const id = crypto.randomUUID();
  await sql`INSERT INTO users (id, firebase_uid, email, display_name, assigned_role)
            VALUES (${id}, ${uid}, ${email}, 'Actor de prueba', ${assigned})`;
  if (actor === 'owner') ownership.owners.add(id);
  if (assigned === null) {
    const created = await api.app.inject({
      method: 'POST',
      url: '/v1/homes',
      headers,
      payload: COMPLETE_HOME,
    });
    context.ownHomeId = created.json<{ id: string }>().id;
  }
  return { headers, context };
}

describe('matriz de permisos (docs/rbac-matrix.md)', () => {
  it('Scenario: La matriz se cumple entera - cada operación implementada tiene una fila por actor y ninguna fila sobra', () => {
    expect(matrixGaps(api.app.operations, rows)).toEqual([]);
  });

  it('Scenario: La matriz se cumple entera - una operación implementada sin filas hace fallar la prueba y la nombra', () => {
    const gaps = matrixGaps([...api.app.operations, 'operacionSinFilas'], rows);

    expect(gaps).toHaveLength(6);
    expect(gaps.every((gap) => gap.startsWith('operacionSinFilas:'))).toBe(true);
  });

  it('una fila de una operación inexistente o repetida también se detecta', () => {
    const extra: MatrixRow[] = [
      ...rows,
      { operationId: 'fantasma', actor: 'anon', expected: 401 },
      { operationId: 'joinWaitlist', actor: 'anon', expected: 202 },
    ];

    expect(matrixGaps(api.app.operations, extra)).toEqual([
      'joinWaitlist: el actor anon tiene 2 filas',
      'fantasma: hay filas pero la operación no está implementada',
    ]);
  });

  describe.skipIf(!emulatorAvailable())(
    'Scenario: La matriz se cumple entera - celda a celda',
    () => {
      it.each(rows)('$operationId como $actor responde $expected', async (row) => {
        const template = REQUESTS[row.operationId];
        if (!template)
          throw new Error(`Falta la petición de ejemplo de ${row.operationId} en la prueba`);
        const { headers, context } = await authorizationFor(row.actor);

        const response = await api.app.inject({
          method: template.method,
          url: typeof template.url === 'function' ? template.url(context) : template.url,
          headers,
          ...(template.payload ? { payload: template.payload() } : {}),
        });

        expect(response.statusCode, `${row.operationId} como ${row.actor}`).toBe(row.expected);
      });
    },
  );
});
