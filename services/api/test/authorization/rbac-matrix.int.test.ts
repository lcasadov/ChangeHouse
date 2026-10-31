import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApi } from '../../src/bootstrap.js';
import { emulatorAvailable, signUp, uniqueEmail } from '../auth-emulator.js';
import { FixedHomeOwnership } from '../fakes.js';
import { openSql, testConfig } from '../fixtures.js';
import { jpeg } from '../images.js';
import { loadMatrix, type MatrixActor, matrixGaps, type MatrixRow } from './matrix.js';

/** Viviendas que la matriz necesita: una propia del actor (borrador completo) y una publicada ajena. */
interface HomeContext {
  ownHomeId: string;
  /** Una vivienda propia ya publicada, desde la que se decide (me gusta, descarte, deshacer). */
  ownPublishedHomeId: string;
  /** Una foto propia ya subida y sin confirmar (`pending`). */
  ownPhotoId: string;
  publishedHomeId: string;
  /** Una vivienda ajena en revisión, solo para el admin (moderarla cambia su estado). */
  reviewHomeId: string;
}

interface RequestTemplate {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string | ((context: HomeContext) => string);
  payload?: (context: HomeContext) => object;
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

const PREFERENCES = { municipalities: ['Madrid'], maxToPayCents: 30_000_00, minToReceiveCents: 0 };

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
  createHomePhotoUpload: {
    method: 'POST',
    url: (context) => `/v1/homes/${context.ownHomeId}/photos`,
    payload: () => ({ contentType: 'image/jpeg' }),
  },
  completeHomePhotoUpload: {
    method: 'POST',
    url: (context) => `/v1/homes/${context.ownHomeId}/photos/${context.ownPhotoId}/complete`,
  },
  deleteHomePhoto: {
    method: 'DELETE',
    url: (context) => `/v1/homes/${context.ownHomeId}/photos/${context.ownPhotoId}`,
  },
  getMySearchPreferences: { method: 'GET', url: '/v1/me/search-preferences' },
  putMySearchPreferences: {
    method: 'PUT',
    url: '/v1/me/search-preferences',
    payload: () => PREFERENCES,
  },
  getHomeSearchPreferences: {
    method: 'GET',
    url: (context) => `/v1/homes/${context.ownHomeId}/search-preferences`,
  },
  putHomeSearchPreferences: {
    method: 'PUT',
    url: (context) => `/v1/homes/${context.ownHomeId}/search-preferences`,
    payload: () => PREFERENCES,
  },
  deleteHomeSearchPreferences: {
    method: 'DELETE',
    url: (context) => `/v1/homes/${context.ownHomeId}/search-preferences`,
  },
  // Sin homeId: tanto el owner de la matriz (sin vivienda publicada real) como el seeker buscan con
  // sus preferencias por defecto, que la preparación del actor deja guardadas
  discoverHomes: { method: 'GET', url: '/v1/discover' },
  likeHome: {
    method: 'POST',
    url: '/v1/me/likes',
    payload: (context) => ({
      fromHomeId: context.ownPublishedHomeId,
      targetHomeId: context.publishedHomeId,
    }),
  },
  dismissHome: {
    method: 'POST',
    url: '/v1/me/dismissals',
    payload: (context) => ({
      fromHomeId: context.ownPublishedHomeId,
      targetHomeId: context.publishedHomeId,
    }),
  },
  // Sin nada que deshacer: la matriz mide el acceso, y un 404 de «no hay acción» prueba que se llegó
  undoLastAction: {
    method: 'DELETE',
    url: (context) => `/v1/me/last-action?homeId=${context.ownPublishedHomeId}`,
  },
  // Sin matches: la lista vacía (200) prueba que se llegó; solo ve los propios
  listMyMatches: { method: 'GET', url: '/v1/matches' },
  // Sin match al que pertenecer: el 404 de quien tiene acceso a la operación prueba que se llegó al
  // caso de uso (la pertenencia se prueba con matches reales en `matches.int.test.ts`)
  getMatch: { method: 'GET', url: `/v1/matches/${MISSING_HOME}` },
  confirmMatch: { method: 'POST', url: `/v1/matches/${MISSING_HOME}/confirm` },
  withdrawFromMatch: { method: 'POST', url: `/v1/matches/${MISSING_HOME}/withdraw` },
  setPhoneSharing: {
    method: 'PUT',
    url: `/v1/matches/${MISSING_HOME}/phone-sharing`,
    payload: () => ({ share: true }),
  },
  // Chat: sin match al que pertenecer, el 404 de quien tiene acceso prueba que se llegó al caso de uso
  getChatImageUrl: {
    method: 'GET',
    url: `/v1/matches/${MISSING_HOME}/chat/images/${MISSING_HOME}`,
  },
  createChatImageUpload: {
    method: 'POST',
    url: `/v1/matches/${MISSING_HOME}/chat/image-uploads`,
    payload: () => ({ contentType: 'image/jpeg' }),
  },
  sendMatchMessage: {
    method: 'POST',
    url: `/v1/matches/${MISSING_HOME}/messages`,
    payload: () => ({ text: 'Hola' }),
  },
  adminListHomes: { method: 'GET', url: '/v1/admin/homes?status=in_review' },
  adminModerateHome: {
    method: 'POST',
    url: (context) => `/v1/admin/homes/${context.reviewHomeId}/moderation`,
    payload: () => ({ decision: 'approve' }),
  },
  registerDevice: {
    method: 'PUT',
    url: '/v1/me/devices',
    payload: () => ({ fcmToken: 'token-de-la-matriz', platform: 'android' }),
  },
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

/** Una vivienda ajena enviada a revisión, nueva en cada caso: moderarla la cambia. */
async function homeInReview(): Promise<string> {
  const landlord = await signUp();
  const landlordId = crypto.randomUUID();
  await sql`INSERT INTO users (id, firebase_uid, email, display_name)
            VALUES (${landlordId}, ${landlord.uid}, ${landlord.email}, 'Propietario en revisión')`;
  const created = await api.app.inject({
    method: 'POST',
    url: '/v1/homes',
    headers: { authorization: `Bearer ${landlord.idToken}` },
    payload: COMPLETE_HOME,
  });
  const homeId = created.json<{ id: string }>().id;
  await addReadyPhotos(homeId);
  await sql`UPDATE homes SET status = 'in_review', submitted_at = now() WHERE id = ${homeId}`;
  return homeId;
}

/** Tres fotos ya procesadas: con ellas la vivienda propia puede enviarse a revisión (RF-11). */
async function addReadyPhotos(homeId: string): Promise<void> {
  for (let position = 1; position <= 3; position += 1) {
    const id = crypto.randomUUID();
    await sql`INSERT INTO home_photos (id, home_id, status, storage_path, position)
              VALUES (${id}, ${homeId}, 'ready', ${`homes/${homeId}/${id}.webp`}, ${position})`;
  }
}

/** Una foto propia con el original ya subido por la URL firmada, pendiente de confirmar. */
async function uploadedPhoto(headers: Record<string, string>, homeId: string): Promise<string> {
  const created = await api.app.inject({
    method: 'POST',
    url: `/v1/homes/${homeId}/photos`,
    headers,
    payload: { contentType: 'image/jpeg' },
  });
  const { photoId, uploadUrl } = created.json<{ photoId: string; uploadUrl: string }>();
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg' },
    body: new Uint8Array(await jpeg()),
  });
  return photoId;
}

/** Prepara un actor nuevo en cada caso: ninguna fila depende de lo que dejó otra. */
async function authorizationFor(
  actor: MatrixActor,
): Promise<{ headers: Record<string, string>; context: HomeContext }> {
  const context: HomeContext = {
    ownHomeId: MISSING_HOME,
    ownPublishedHomeId: MISSING_HOME,
    ownPhotoId: MISSING_HOME,
    publishedHomeId: await publishedHome(),
    reviewHomeId: MISSING_HOME,
  };
  if (actor === 'anon') return { headers: {}, context };
  const { uid, email, idToken } = await signUp();
  const headers = { authorization: `Bearer ${idToken}` };
  if (actor === 'unregistered') return { headers, context };

  const assigned = actor === 'agency' || actor === 'admin' ? actor : null;
  if (actor === 'admin') context.reviewHomeId = await homeInReview();
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
    await addReadyPhotos(context.ownHomeId);
    context.ownPhotoId = await uploadedPhoto(headers, context.ownHomeId);
    const published = await api.app.inject({
      method: 'POST',
      url: '/v1/homes',
      headers,
      payload: COMPLETE_HOME,
    });
    context.ownPublishedHomeId = published.json<{ id: string }>().id;
    await sql`UPDATE homes SET status = 'published', published_at = now()
              WHERE id = ${context.ownPublishedHomeId}`;
    // Con preferencias propias y de la vivienda, las lecturas y el borrado de la matriz tienen algo que devolver
    for (const url of [
      '/v1/me/search-preferences',
      `/v1/homes/${context.ownHomeId}/search-preferences`,
    ]) {
      await api.app.inject({ method: 'PUT', url, headers, payload: PREFERENCES });
    }
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
          ...(template.payload ? { payload: template.payload(context) } : {}),
        });

        expect(response.statusCode, `${row.operationId} como ${row.actor}`).toBe(row.expected);
      });
    },
  );
});
