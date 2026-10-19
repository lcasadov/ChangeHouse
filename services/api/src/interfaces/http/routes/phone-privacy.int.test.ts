import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  emulatorAvailable,
  type EmulatorUser,
  signUp,
  uniqueEmail,
} from '../../../../test/auth-emulator.js';
import { FixedHomeOwnership } from '../../../../test/fakes.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';

interface RequestTemplate {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  payload?: () => object;
}

/**
 * Una petición válida por operación implementada. Cada change que añade una operación añade aquí su
 * petición: sin ella la guarda falla, de modo que ninguna operación nueva queda sin revisar.
 */
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
      displayName: 'Beto',
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
    }),
  },
  listMyConsents: { method: 'GET', url: '/v1/me/consents' },
  acceptConsent: {
    method: 'POST',
    url: '/v1/me/consents',
    payload: () => ({ type: 'analytics', version: '2026-10' }),
  },
};

const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';
const HOMES_REQUESTS: Record<string, RequestTemplate> = {
  listMyHomes: { method: 'GET', url: '/v1/me/homes' },
  createHome: {
    method: 'POST',
    url: '/v1/homes',
    payload: () => ({
      type: 'piso',
      address: {
        placeId: 'fixture-malasana',
        formatted: 'Calle del Pez, 12, 28004 Madrid, España',
      },
    }),
  },
  getHome: { method: 'GET', url: `/v1/homes/${MISSING_ID}` },
  updateHome: { method: 'PATCH', url: `/v1/homes/${MISSING_ID}`, payload: () => ({ bedrooms: 2 }) },
  submitHome: { method: 'POST', url: `/v1/homes/${MISSING_ID}/submit` },
};
Object.assign(REQUESTS, HOMES_REQUESTS);

const PHONE = '+34699888777';
const legal = { acceptedTermsVersion: TERMS_VERSION, acceptedPrivacyVersion: PRIVACY_VERSION };

const sql = openSql();
let api: ReturnType<typeof createApi>;

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

beforeAll(async () => {
  await sql`TRUNCATE users CASCADE`;
  api = createApi(testConfig(), { homeOwnership: new FixedHomeOwnership() });
  await api.app.ready();
});

afterAll(async () => {
  await api.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('privacidad del teléfono (RF-03, RC-11)', () => {
  it('Scenario: El teléfono no se expone - el propio usuario ve su teléfono', async () => {
    const ana = await signUp();
    await api.app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: bearer(ana),
      payload: { displayName: 'Ana', phone: PHONE, ...legal },
    });

    const response = await api.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(ana) });

    expect(response.json()).toMatchObject({ phone: PHONE });
  });

  it('Scenario: El teléfono no se expone - toda operación implementada tiene su petición en la guarda', () => {
    expect([...api.app.operations].filter((id) => !(id in REQUESTS))).toEqual([]);
  });

  it('Scenario: El teléfono no se expone - ninguna operación para otro usuario devuelve el teléfono ajeno', async () => {
    const ana = await signUp();
    const beto = await signUp();
    const created = await api.app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: bearer(ana),
      payload: { displayName: 'Ana', phone: PHONE, ...legal },
    });
    expect(created.statusCode).toBe(201);
    await api.app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: bearer(beto),
      payload: { displayName: 'Beto', ...legal },
    });

    for (const operationId of api.app.operations) {
      const template = REQUESTS[operationId];
      if (!template) continue;
      const response = await api.app.inject({
        method: template.method,
        url: template.url,
        headers: bearer(beto),
        ...(template.payload ? { payload: template.payload() } : {}),
      });

      expect(response.body, operationId).not.toContain(PHONE);
      expect(response.body, operationId).not.toContain('34699888777');
    }
  });
});
