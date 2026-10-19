import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApi } from '../../src/bootstrap.js';
import { emulatorAvailable, signUp, uniqueEmail } from '../auth-emulator.js';
import { FixedHomeOwnership } from '../fakes.js';
import { openSql, testConfig } from '../fixtures.js';
import { loadMatrix, type MatrixActor, matrixGaps, type MatrixRow } from './matrix.js';

interface RequestTemplate {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  payload?: () => object;
}

/** Una petición válida por operación implementada: la matriz mide la autorización, no la validación. */
const REQUESTS: Record<string, RequestTemplate> = {
  joinWaitlist: {
    method: 'POST',
    url: '/waitlist',
    payload: () => ({
      email: uniqueEmail('espera'),
      municipality: 'Madrid',
      homeType: 'piso',
      lookingFor: 'Un ático con terraza',
      consent: true,
    }),
  },
  getMe: { method: 'GET', url: '/me' },
  upsertMe: {
    method: 'PUT',
    url: '/me',
    payload: () => ({
      displayName: 'Ana',
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
    }),
  },
  listMyConsents: { method: 'GET', url: '/me/consents' },
  acceptConsent: {
    method: 'POST',
    url: '/me/consents',
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

/** Prepara un actor nuevo en cada caso: ninguna fila depende de lo que dejó otra. */
async function authorizationFor(actor: MatrixActor): Promise<Record<string, string>> {
  if (actor === 'anon') return {};
  const { uid, email, idToken } = await signUp();
  if (actor !== 'unregistered') {
    const assigned = actor === 'agency' || actor === 'admin' ? actor : null;
    const id = crypto.randomUUID();
    await sql`INSERT INTO users (id, firebase_uid, email, display_name, assigned_role)
              VALUES (${id}, ${uid}, ${email}, 'Actor de prueba', ${assigned})`;
    if (actor === 'owner') ownership.owners.add(id);
  }
  return { authorization: `Bearer ${idToken}` };
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
        const headers = await authorizationFor(row.actor);

        const response = await api.app.inject({
          method: template.method,
          url: template.url,
          headers,
          ...(template.payload ? { payload: template.payload() } : {}),
        });

        expect(response.statusCode, `${row.operationId} como ${row.actor}`).toBe(row.expected);
      });
    },
  );
});
