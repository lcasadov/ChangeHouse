import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import {
  emulatorAvailable,
  type EmulatorUser,
  signUp,
  verifyEmail,
} from '../../../../test/auth-emulator.js';
import { firestoreAvailable } from '../../../../test/firestore-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import type {
  EmailNotification,
  EmailNotifier,
  PushNotification,
  PushNotifier,
} from '../../../application/notifications/notifier.js';
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
const START = Date.now();
const POINTS = {
  getafe: { lat: 40.3056, lng: -3.7321 },
  leganes: { lat: 40.3272, lng: -3.7635 },
} satisfies Record<string, GeoPoint>;
const SEARCH_LEGANES = {
  municipalities: ['Leganés'],
  maxToPayCents: euros(30_000),
  minToReceiveCents: 0,
};
const SEARCH_GETAFE = { municipalities: ['Getafe'], maxToPayCents: 0, minToReceiveCents: 0 };
const PRIVATE_MESSAGE = 'Vivo en Calle Mayor 5, mi teléfono es +34600111222 y pido 1.200.000 euros';

interface Person extends EmulatorUser {
  id: string;
}

/** FCM de pruebas: anota los envíos; `invalid` simula tokens que ya no están registrados. */
class RecordingPush implements PushNotifier {
  readonly sent: { tokens: readonly string[]; notification: PushNotification }[] = [];
  invalid: string[] = [];
  failures = 0;

  send(tokens: readonly string[], notification: PushNotification) {
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error('FCM no disponible'));
    }
    this.sent.push({ tokens, notification });
    return Promise.resolve({
      invalidTokens: tokens.filter((token) => this.invalid.includes(token)),
    });
  }
}

/** Correo de pruebas: anota cada envío. */
class RecordingEmail implements EmailNotifier {
  readonly sent: EmailNotification[] = [];

  send(email: EmailNotification) {
    this.sent.push(email);
    return Promise.resolve();
  }
}

const sql = openSql();
const config = testConfig();
const push = new RecordingPush();
const email = new RecordingEmail();
let ticks = 0;
let published = 0;
let api: ReturnType<typeof createApi>;
let app: FastifyInstance;
let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

function call(
  user: EmulatorUser,
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
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

async function home(owner: Person, municipality: string, point: GeoPoint, valueEuros: number) {
  published += 1;
  const id = crypto.randomUUID();
  const draft = newDraft({
    id,
    ownerId: owner.id,
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
    publishedAt: new Date('2026-10-02T09:00:00.000Z'),
  });
  return id;
}

async function search(user: EmulatorUser, preferences: object): Promise<void> {
  const response = await call(user, 'PUT', '/v1/me/search-preferences', preferences);
  expect(response.statusCode, response.body).toBe(200);
}

const registerDevice = (user: EmulatorUser, fcmToken: string) =>
  call(user, 'PUT', '/v1/me/devices', { fcmToken, platform: 'android' });

async function settleOutbox(): Promise<void> {
  await api.outbox.idle();
  await api.outbox.dispatch();
}

/** Ana y Beto con un match abierto, cada uno con un dispositivo registrado, y los avisos del alta ya despachados. */
async function pair() {
  const ana = await registered('Ana');
  const anaHome = await home(ana, 'Getafe', POINTS.getafe, 200_000);
  await search(ana, SEARCH_LEGANES);
  const beto = await registered('Beto');
  const betoHome = await home(beto, 'Leganés', POINTS.leganes, 212_000);
  await search(beto, SEARCH_GETAFE);
  expect((await registerDevice(ana, `tok-ana-${ana.id}`)).statusCode).toBe(204);
  expect((await registerDevice(beto, `tok-beto-${beto.id}`)).statusCode).toBe(204);
  await call(beto, 'POST', '/v1/me/likes', { fromHomeId: betoHome, targetHomeId: anaHome });
  const created = await call(ana, 'POST', '/v1/me/likes', {
    fromHomeId: anaHome,
    targetHomeId: betoHome,
  });
  expect(created.statusCode, created.body).toBe(201);
  const matchId = created.json<{ match: { id: string } }>().match.id;
  await settleOutbox();
  return { ana, beto, matchId };
}

beforeAll(() => {
  api = createApi(config, {
    clock: { now: () => new Date(START + 1000 * ++ticks) },
    notifier: { push, email },
  });
  app = api.app;
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    AddressCipher.fromBase64(config.addressEncryptionKey),
  );
});

beforeEach(async () => {
  push.sent.length = 0;
  email.sent.length = 0;
  push.invalid = [];
  push.failures = 0;
  // Un despacho lanzado por la petición anterior no puede seguir en curso al vaciar las tablas
  await api.outbox.idle();
  await sql`TRUNCATE matches, outbox, users CASCADE`;
});

afterAll(async () => {
  await api.close();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable() || !firestoreAvailable())(
  'notificaciones con tokens reales, PostgreSQL y el emulador de Firestore',
  () => {
    it('Scenario: Registrar el mismo token dos veces - responde 204 y queda una sola fila actualizada', async () => {
      const ana = await registered('Ana');

      const first = await registerDevice(ana, 'tok-repetido');
      const second = await call(ana, 'PUT', '/v1/me/devices', {
        fcmToken: 'tok-repetido',
        platform: 'ios',
      });
      const rows = await sql<{ platform: string; user_id: string }[]>`
        SELECT platform, user_id FROM user_devices`;

      expect([first.statusCode, second.statusCode]).toEqual([204, 204]);
      expect(rows).toEqual([{ platform: 'ios', user_id: ana.id }]);
    });

    it('un cuerpo no válido responde 400 y sin token 401', async () => {
      const ana = await registered('Ana');

      const invalid = await call(ana, 'PUT', '/v1/me/devices', { fcmToken: '', platform: 'web' });
      const anonymous = await app.inject({
        method: 'PUT',
        url: '/v1/me/devices',
        payload: { fcmToken: 't', platform: 'web' },
      });

      expect(invalid.statusCode).toBe(400);
      expect(anonymous.statusCode).toBe(401);
    });

    it('Scenario: Nuevo match - cada participante recibe «¡Tienes un match!» con el match y el hecho queda procesado', async () => {
      const { ana, beto, matchId } = await pair();

      expect(push.sent).toHaveLength(1);
      expect([...(push.sent[0]?.tokens ?? [])].sort()).toEqual(
        [`tok-ana-${ana.id}`, `tok-beto-${beto.id}`].sort(),
      );
      expect(push.sent[0]?.notification).toMatchObject({
        title: '¡Tienes un match!',
        data: { type: 'match.created', matchId },
      });
      const [event] = await sql<{ processed_at: Date | null }[]>`
        SELECT processed_at FROM outbox WHERE type = 'match.created' AND aggregate_id = ${matchId}`;
      expect(event?.processed_at).not.toBeNull();
    });

    it('Scenario: Nuevo mensaje - solo el otro participante recibe el aviso, con el nombre y sin el contenido', async () => {
      const { ana, beto, matchId } = await pair();
      push.sent.length = 0;

      const response = await call(ana, 'POST', `/v1/matches/${matchId}/messages`, {
        text: PRIVATE_MESSAGE,
      });
      await settleOutbox();

      expect(response.statusCode, response.body).toBe(201);
      expect(push.sent).toHaveLength(1);
      expect(push.sent[0]?.tokens).toEqual([`tok-beto-${beto.id}`]);
      expect(push.sent[0]?.notification).toMatchObject({
        title: 'Nuevo mensaje de Ana',
        data: { type: 'message.sent', matchId },
      });
      expect(JSON.stringify(push.sent)).not.toMatch(/Calle|\+34|1\.200|euros/);
    });

    it('Scenario: Match cerrado - al retirarse, todos los participantes reciben el aviso de cierre', async () => {
      const { ana, matchId } = await pair();
      push.sent.length = 0;

      const response = await call(ana, 'POST', `/v1/matches/${matchId}/withdraw`);
      await settleOutbox();

      expect(response.statusCode, response.body).toBe(200);
      expect(push.sent).toHaveLength(1);
      expect(push.sent[0]?.tokens).toHaveLength(2);
      expect(push.sent[0]?.notification.title).toBe('Tu match se ha cerrado');
    });

    it('Scenario: Match confirmado - cuando confirman todos, los participantes reciben el aviso', async () => {
      const { ana, beto, matchId } = await pair();
      push.sent.length = 0;

      await call(ana, 'POST', `/v1/matches/${matchId}/confirm`);
      await settleOutbox();
      expect(push.sent).toEqual([]);
      const last = await call(beto, 'POST', `/v1/matches/${matchId}/confirm`);
      await settleOutbox();

      expect(last.statusCode, last.body).toBe(200);
      expect(push.sent).toHaveLength(1);
      expect(push.sent[0]?.notification.data).toEqual({ type: 'match.confirmed', matchId });
    });

    it('Scenario: Email de nuevo match - solo el participante con email verificado lo recibe, con el botón al match', async () => {
      const ana = await registered('Ana');
      const anaHome = await home(ana, 'Getafe', POINTS.getafe, 200_000);
      await search(ana, SEARCH_LEGANES);
      const beto = await registered('Beto');
      const betoHome = await home(beto, 'Leganés', POINTS.leganes, 212_000);
      await search(beto, SEARCH_GETAFE);
      await verifyEmail(ana);
      await call(beto, 'POST', '/v1/me/likes', { fromHomeId: betoHome, targetHomeId: anaHome });

      const created = await call(ana, 'POST', '/v1/me/likes', {
        fromHomeId: anaHome,
        targetHomeId: betoHome,
      });
      await settleOutbox();

      const matchId = created.json<{ match: { id: string } }>().match.id;
      expect(email.sent.map((sent) => [sent.to, sent.subject])).toEqual([
        [ana.email, 'Tienes un match en ChangeHouse'],
      ]);
      expect(email.sent[0]?.html).toContain(`<a href="https://app.test/match/${matchId}"`);
      expect(email.sent[0]?.text).toContain(`https://app.test/match/${matchId}`);
    });

    it('Scenario: Email de match cerrado - al retirarse, los participantes verificados reciben el aviso de cierre', async () => {
      const { ana, beto, matchId } = await pair();
      await verifyEmail(beto);
      email.sent.length = 0;

      await call(ana, 'POST', `/v1/matches/${matchId}/withdraw`);
      await settleOutbox();

      expect(email.sent.map((sent) => [sent.to, sent.subject])).toEqual([
        [beto.email, 'Tu match de ChangeHouse se ha cerrado'],
      ]);
    });

    it('el data de cada push lleva exactamente el tipo y el match', async () => {
      const { ana, beto, matchId } = await pair();
      await call(ana, 'POST', `/v1/matches/${matchId}/messages`, { text: 'hola' });
      await call(ana, 'POST', `/v1/matches/${matchId}/confirm`);
      await call(beto, 'POST', `/v1/matches/${matchId}/confirm`);
      await call(beto, 'POST', `/v1/matches/${matchId}/withdraw`);
      await settleOutbox();

      expect(push.sent.map((sent) => sent.notification.data)).toEqual([
        { type: 'match.created', matchId },
        { type: 'message.sent', matchId },
        { type: 'match.confirmed', matchId },
        { type: 'match.closed', matchId },
      ]);
    });

    it('Scenario: Token inválido - el token que FCM rechaza se elimina de user_devices', async () => {
      push.invalid = [];
      const ana = await registered('Ana');
      const anaHome = await home(ana, 'Getafe', POINTS.getafe, 200_000);
      await search(ana, SEARCH_LEGANES);
      const beto = await registered('Beto');
      const betoHome = await home(beto, 'Leganés', POINTS.leganes, 212_000);
      await search(beto, SEARCH_GETAFE);
      await registerDevice(ana, 'tok-viejo');
      await registerDevice(beto, 'tok-beto-valido');
      push.invalid = ['tok-viejo'];
      await call(beto, 'POST', '/v1/me/likes', { fromHomeId: betoHome, targetHomeId: anaHome });

      await call(ana, 'POST', '/v1/me/likes', { fromHomeId: anaHome, targetHomeId: betoHome });
      await settleOutbox();

      const tokens = await sql<{ fcm_token: string }[]>`SELECT fcm_token FROM user_devices`;
      expect(tokens).toEqual([{ fcm_token: 'tok-beto-valido' }]);
    });

    it('Scenario: Fallo del envío - el match existe, el hecho sigue pendiente y el reintento envía el aviso', async () => {
      push.failures = 1;
      const { matchId } = await pairWithoutSettling();

      await api.outbox.idle();
      const [pending] = await sql<{ attempts: number; processed_at: Date | null }[]>`
        SELECT attempts, processed_at FROM outbox WHERE type = 'match.created' AND aggregate_id = ${matchId}`;
      const [match] = await sql<
        { status: string }[]
      >`SELECT status FROM matches WHERE id = ${matchId}`;
      expect(push.sent).toEqual([]);
      await api.outbox.dispatch();
      await api.outbox.dispatch();
      const [done] = await sql<{ processed_at: Date | null }[]>`
        SELECT processed_at FROM outbox WHERE type = 'match.created' AND aggregate_id = ${matchId}`;

      expect(pending).toMatchObject({ attempts: 1, processed_at: null });
      expect(match?.status).toBe('open');
      expect(done?.processed_at).not.toBeNull();
      expect(push.sent).toHaveLength(1);
    });
  },
);

/** Como `pair`, pero sin esperar al despacho: el primer intento (con el fallo programado) lo hace la petición. */
async function pairWithoutSettling() {
  const ana = await registered('Ana');
  const anaHome = await home(ana, 'Getafe', POINTS.getafe, 200_000);
  await search(ana, SEARCH_LEGANES);
  const beto = await registered('Beto');
  const betoHome = await home(beto, 'Leganés', POINTS.leganes, 212_000);
  await search(beto, SEARCH_GETAFE);
  await registerDevice(ana, `tok-ana-${ana.id}`);
  await call(beto, 'POST', '/v1/me/likes', { fromHomeId: betoHome, targetHomeId: anaHome });
  const created = await call(ana, 'POST', '/v1/me/likes', {
    fromHomeId: anaHome,
    targetHomeId: betoHome,
  });
  return { matchId: created.json<{ match: { id: string } }>().match.id };
}
