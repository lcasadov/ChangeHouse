import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  emulatorAvailable,
  type EmulatorUser,
  signUp,
  uniqueEmail,
} from '../../../../test/auth-emulator.js';
import { FixedHomeOwnership } from '../../../../test/fakes.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';
import { newDraft } from '../../../domain/home/home.js';
import { AddressCipher } from '../../../infrastructure/crypto/address-cipher.js';
import { createDatabase } from '../../../infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeRepository } from '../../../infrastructure/persistence/drizzle/drizzle-home-repository.js';

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
  pauseHome: { method: 'POST', url: `/v1/homes/${MISSING_ID}/pause` },
  resumeHome: { method: 'POST', url: `/v1/homes/${MISSING_ID}/resume` },
  createHomePhotoUpload: {
    method: 'POST',
    url: `/v1/homes/${MISSING_ID}/photos`,
    payload: () => ({ contentType: 'image/jpeg' }),
  },
  completeHomePhotoUpload: {
    method: 'POST',
    url: `/v1/homes/${MISSING_ID}/photos/${MISSING_ID}/complete`,
  },
  deleteHomePhoto: { method: 'DELETE', url: `/v1/homes/${MISSING_ID}/photos/${MISSING_ID}` },
  getMySearchPreferences: { method: 'GET', url: '/v1/me/search-preferences' },
  putMySearchPreferences: {
    method: 'PUT',
    url: '/v1/me/search-preferences',
    payload: () => ({ municipalities: ['Madrid'], maxToPayCents: 0, minToReceiveCents: 0 }),
  },
  getHomeSearchPreferences: { method: 'GET', url: `/v1/homes/${MISSING_ID}/search-preferences` },
  putHomeSearchPreferences: {
    method: 'PUT',
    url: `/v1/homes/${MISSING_ID}/search-preferences`,
    payload: () => ({ municipalities: ['Madrid'], maxToPayCents: 0, minToReceiveCents: 0 }),
  },
  deleteHomeSearchPreferences: {
    method: 'DELETE',
    url: `/v1/homes/${MISSING_ID}/search-preferences`,
  },
  discoverHomes: { method: 'GET', url: `/v1/discover?homeId=${MISSING_ID}` },
  likeHome: {
    method: 'POST',
    url: '/v1/me/likes',
    payload: () => ({ fromHomeId: MISSING_ID, targetHomeId: MISSING_ID }),
  },
  dismissHome: {
    method: 'POST',
    url: '/v1/me/dismissals',
    payload: () => ({ fromHomeId: MISSING_ID, targetHomeId: MISSING_ID }),
  },
  undoLastAction: { method: 'DELETE', url: `/v1/me/last-action?homeId=${MISSING_ID}` },
  listMyMatches: { method: 'GET', url: '/v1/matches' },
  getMatch: { method: 'GET', url: `/v1/matches/${MISSING_ID}` },
  confirmMatch: { method: 'POST', url: `/v1/matches/${MISSING_ID}/confirm` },
  withdrawFromMatch: { method: 'POST', url: `/v1/matches/${MISSING_ID}/withdraw` },
  setPhoneSharing: {
    method: 'PUT',
    url: `/v1/matches/${MISSING_ID}/phone-sharing`,
    payload: () => ({ share: true }),
  },
  adminListHomes: { method: 'GET', url: '/v1/admin/homes?status=in_review' },
  adminModerateHome: {
    method: 'POST',
    url: `/v1/admin/homes/${MISSING_ID}/moderation`,
    payload: () => ({ decision: 'approve' }),
  },
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

  /**
   * El teléfono ya no está vedado en toda la API: aparece, y solo en `getMatch`, para los
   * participantes de un match cuyo titular lo autorizó en ese match (RF-53, RC-11). La guarda se
   * adapta a esa regla: con la autorización, ninguna otra operación lo devuelve; sin ella,
   * tampoco `getMatch`; y un tercero no lo ve en ninguna.
   */
  describe('teléfono compartido en un match (RF-53)', () => {
    const config = testConfig();

    async function registered(name: string, phone?: string) {
      const user = await signUp();
      const response = await api.app.inject({
        method: 'PUT',
        url: '/v1/me',
        headers: bearer(user),
        payload: { displayName: name, ...(phone ? { phone } : {}), ...legal },
      });
      expect(response.statusCode).toBe(201);
      const [row] = await sql<
        { id: string }[]
      >`SELECT id FROM users WHERE firebase_uid = ${user.uid}`;
      return { ...user, id: row?.id ?? '' };
    }

    async function matchBetween(ana: { id: string }, beto: { id: string }, anaShares: boolean) {
      const connection = createDatabase(inject('databaseUrl'));
      const homes = new DrizzleHomeRepository(
        connection.db,
        AddressCipher.fromBase64(config.addressEncryptionKey),
      );
      const homeIds: string[] = [];
      for (const owner of [ana, beto]) {
        const id = crypto.randomUUID();
        homeIds.push(id);
        await homes.insert({
          ...newDraft({
            id,
            ownerId: owner.id,
            now: new Date('2026-10-01T09:00:00.000Z'),
            type: 'piso',
            address: 'Calle Mayor, 1, Getafe',
            location: {
              exact: { lat: 40.3056, lng: -3.7321 },
              areaName: 'Getafe Centro',
              areaCenter: { lat: 40.306, lng: -3.7325 },
            },
          }),
          status: 'published',
        });
      }
      await connection.close();
      const [anaHome, betoHome] = homeIds;
      const matchId = crypto.randomUUID();
      await sql`INSERT INTO matches (id, type, status, cycle_key)
                VALUES (${matchId}, 2, 'open', ${[...homeIds].sort().join(':')})`;
      await sql`INSERT INTO match_participants
                  (match_id, home_id, user_id, gives_home_id, receives_home_id, compensation_cents, shares_phone)
                VALUES
                  (${matchId}, ${anaHome ?? ''}, ${ana.id}, ${anaHome ?? ''}, ${betoHome ?? ''}, 0, ${anaShares}),
                  (${matchId}, ${betoHome ?? ''}, ${beto.id}, ${betoHome ?? ''}, ${anaHome ?? ''}, 0, false)`;
      return matchId;
    }

    async function everyOtherOperationBodies(viewer: Pick<EmulatorUser, 'idToken'>) {
      const bodies: string[] = [];
      for (const operationId of api.app.operations) {
        const template = REQUESTS[operationId];
        if (!template || operationId === 'getMatch') continue;
        const response = await api.app.inject({
          method: template.method,
          url: template.url,
          headers: bearer(viewer),
          ...(template.payload ? { payload: template.payload() } : {}),
        });
        bodies.push(response.body);
      }
      return bodies;
    }

    it('Scenario: El teléfono no se expone - con autorización solo getMatch lo muestra, y solo a los participantes', async () => {
      const ana = await registered('Ana', PHONE);
      const beto = await registered('Beto');
      const stranger = await registered('Carla');
      const matchId = await matchBetween(ana, beto, true);
      const detail = (viewer: Pick<EmulatorUser, 'idToken'>) =>
        api.app.inject({ method: 'GET', url: `/v1/matches/${matchId}`, headers: bearer(viewer) });

      const asBeto = await detail(beto);
      const asStranger = await detail(stranger);

      expect(asBeto.statusCode).toBe(200);
      expect(asBeto.body).toContain(PHONE);
      expect(asStranger.statusCode).toBe(404);
      expect(asStranger.body).not.toContain('34699888777');
      for (const viewer of [beto, stranger]) {
        for (const body of await everyOtherOperationBodies(viewer)) {
          expect(body).not.toContain('34699888777');
        }
      }
    });

    it('Scenario: Sin autorización - sin la autorización del titular ni getMatch muestra el teléfono', async () => {
      const ana = await registered('Ana', PHONE);
      const beto = await registered('Beto');
      const matchId = await matchBetween(ana, beto, false);

      const asBeto = await api.app.inject({
        method: 'GET',
        url: `/v1/matches/${matchId}`,
        headers: bearer(beto),
      });

      expect(asBeto.statusCode).toBe(200);
      expect(asBeto.body).not.toContain('34699888777');
    });
  });
});
