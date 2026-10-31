import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { firestoreAvailable } from '../../../../test/firestore-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { jpeg, jpegWithGps } from '../../../../test/images.js';
import type { ChatChannel } from '../../../application/chat/chat-channel.js';
import { createApi } from '../../../bootstrap.js';
import { type GeoPoint, newDraft } from '../../../domain/home/home.js';
import { createFirestoreChatChannel } from '../../../infrastructure/chat/firestore-chat-channel.js';
import { AddressCipher } from '../../../infrastructure/crypto/address-cipher.js';
import {
  createDatabase,
  type DatabaseConnection,
} from '../../../infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeRepository } from '../../../infrastructure/persistence/drizzle/drizzle-home-repository.js';

const EUR = 100;
const euros = (amount: number) => amount * EUR;
/** Hora real (las URL firmadas no admiten fechas pasadas); cada lectura del reloj avanza un segundo para ordenar los mensajes. */
const START = Date.now();
/** El reloj de la prueba va por delante de la hora real en lo que tarde en ejecutarse. */
const START_SKEW_MS = 120_000;
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
const ANA_PHONE = '+34600111222';
const MESSAGE = '¿Te viene bien visitarla el sábado?';

interface Person extends EmulatorUser {
  id: string;
}

interface StoredMessage extends Record<string, unknown> {
  id: string;
}

/** El canal real de Firestore con un interruptor para simular que Firestore está caído. */
class FlakyChannel implements ChatChannel {
  failures = 0;
  createCalls = 0;

  constructor(private readonly real: ChatChannel) {}

  createChat(...args: Parameters<ChatChannel['createChat']>) {
    this.createCalls += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error('Firestore no disponible'));
    }
    return this.real.createChat(...args);
  }

  appendMessage(...args: Parameters<ChatChannel['appendMessage']>) {
    return this.real.appendMessage(...args);
  }

  anonymizeParticipant(...args: Parameters<ChatChannel['anonymizeParticipant']>) {
    return this.real.anonymizeParticipant(...args);
  }
}

const sql = openSql();
const config = testConfig();
let ticks = 0;
let published = 0;
let api: ReturnType<typeof createApi>;
let app: FastifyInstance;
let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let firestore: Firestore;
let flaky: FlakyChannel;
let closeChannel: () => Promise<void>;
let closeInspector: () => Promise<void>;

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

async function home(
  owner: Person,
  municipality: string,
  point: GeoPoint,
  valueEuros: number,
): Promise<string> {
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

const like = (user: EmulatorUser, fromHomeId: string, targetHomeId: string) =>
  call(user, 'POST', '/v1/me/likes', { fromHomeId, targetHomeId });

/** Espera a que termine el despacho que lanzó la petición y lanza uno más, como el reintento periódico. */
async function settleOutbox(): Promise<void> {
  await api.outbox.idle();
  await api.outbox.dispatch();
}

/** Ana y Beto con un match abierto y su chat ya creado; Ana tiene teléfono en su perfil. */
async function pair(options: { settle?: boolean } = {}) {
  const anaPerson = await registered('Ana');
  const anaHome = await home(anaPerson, 'Getafe', POINTS.getafe, 200_000);
  await search(anaPerson, SEARCH_LEGANES);
  const betoPerson = await registered('Beto');
  const betoHome = await home(betoPerson, 'Leganés', POINTS.leganes, 212_000);
  await search(betoPerson, SEARCH_GETAFE);
  await sql`UPDATE users SET phone = ${ANA_PHONE} WHERE id = ${anaPerson.id}`;
  await like(betoPerson, betoHome, anaHome);
  const created = await like(anaPerson, anaHome, betoHome);
  expect(created.statusCode, created.body).toBe(201);
  const matchId = created.json<{ match: { id: string } }>().match.id;
  if (options.settle ?? true) await settleOutbox();
  return { ana: anaPerson, beto: betoPerson, matchId };
}

const messagesOf = async (chatId: string): Promise<StoredMessage[]> => {
  const snapshot = await firestore
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .orderBy('createdAt')
    .get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
};

const send = (user: EmulatorUser, matchId: string, payload: object) =>
  call(user, 'POST', `/v1/matches/${matchId}/messages`, payload);
const requestUpload = (user: EmulatorUser, matchId: string, contentType = 'image/jpeg') =>
  call(user, 'POST', `/v1/matches/${matchId}/chat/image-uploads`, { contentType });

async function upload(user: EmulatorUser, matchId: string, content: Buffer): Promise<string> {
  const created = await requestUpload(user, matchId);
  expect(created.statusCode, created.body).toBe(201);
  const { uploadId, uploadUrl } = created.json<{ uploadId: string; uploadUrl: string }>();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg' },
    body: new Uint8Array(content),
  });
  expect(put.ok, await put.clone().text()).toBe(true);
  return uploadId;
}

beforeAll(() => {
  const channel = createFirestoreChatChannel(config.firebase);
  closeChannel = channel.close;
  flaky = new FlakyChannel(channel.channel);
  api = createApi(config, {
    clock: { now: () => new Date(START + 1000 * ++ticks) },
    chatChannel: flaky,
  });
  app = api.app;
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    AddressCipher.fromBase64(config.addressEncryptionKey),
  );
  const inspector = initializeApp({ projectId: config.firebase.projectId }, 'chat-inspector');
  firestore = getFirestore(inspector);
  closeInspector = () => deleteApp(inspector);
});

beforeEach(async () => {
  flaky.failures = 0;
  // Un despacho lanzado por la petición anterior no puede seguir en curso al vaciar las tablas
  await api.outbox.idle();
  await sql`TRUNCATE matches, outbox, users CASCADE`;
});

afterAll(async () => {
  await api.close();
  await closeChannel();
  await closeInspector();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable() || !firestoreAvailable())(
  'chat de grupo con tokens reales, PostgreSQL y el emulador de Firestore',
  () => {
    describe('creación del chat con el match', () => {
      it('Scenario: Chat creado con el match - los participantes encuentran su chat vacío con un mensaje del sistema que los presenta', async () => {
        const { ana, beto, matchId } = await pair();

        const [row] = await sql<{ chat_id: string | null }[]>`
          SELECT chat_id FROM matches WHERE id = ${matchId}`;
        const [event] = await sql<{ attempts: number; processed_at: Date | null }[]>`
          SELECT attempts, processed_at FROM outbox WHERE aggregate_id = ${matchId}`;
        const chat = await firestore.collection('chats').doc(matchId).get();
        const messages = await messagesOf(matchId);
        const listed = await call(ana, 'GET', '/v1/matches');

        expect(row?.chat_id).toBe(matchId);
        expect(event?.attempts).toBe(0);
        expect(event?.processed_at).not.toBeNull();
        expect(chat.data()?.['matchId']).toBe(matchId);
        expect([...(chat.data()?.['participantUids'] as string[])].sort()).toEqual(
          [ana.uid, beto.uid].sort(),
        );
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({ kind: 'system', event: 'welcome' });
        expect([...(messages[0]?.['participantNames'] as string[])].sort()).toEqual([
          'Ana',
          'Beto',
        ]);
        expect(listed.json<{ items: { id: string; chatId?: string }[] }>().items[0]).toMatchObject({
          id: matchId,
          chatId: matchId,
        });
      });

      it('GIVEN un fallo de Firestore al crear el match WHEN se reintenta el despacho THEN el match existe sin chat y el chat acaba creado una sola vez', async () => {
        flaky.failures = 1;
        const { matchId } = await pair({ settle: false });

        await api.outbox.idle();
        const [pending] = await sql<{ attempts: number; processed_at: Date | null }[]>`
          SELECT attempts, processed_at FROM outbox WHERE aggregate_id = ${matchId}`;
        const [unlinked] = await sql<{ chat_id: string | null }[]>`
          SELECT chat_id FROM matches WHERE id = ${matchId}`;
        const before = await firestore.collection('chats').doc(matchId).get();
        await api.outbox.dispatch();
        await api.outbox.dispatch();
        const [done] = await sql<{ attempts: number; processed_at: Date | null }[]>`
          SELECT attempts, processed_at FROM outbox WHERE aggregate_id = ${matchId}`;
        const [linked] = await sql<{ chat_id: string | null }[]>`
          SELECT chat_id FROM matches WHERE id = ${matchId}`;

        expect(pending).toMatchObject({ attempts: 1, processed_at: null });
        expect(unlinked?.chat_id).toBeNull();
        expect(before.exists).toBe(false);
        expect(done?.attempts).toBe(1);
        expect(done?.processed_at).not.toBeNull();
        expect(linked?.chat_id).toBe(matchId);
        expect(await messagesOf(matchId)).toHaveLength(1);
        expect(flaky.createCalls).toBeGreaterThanOrEqual(2);
      });
    });

    describe('sendMatchMessage', () => {
      it('Scenario: Mensaje en tiempo real - un participante envía un texto y queda en Firestore con su id interno y su nombre, sin email ni teléfono', async () => {
        const { ana, matchId } = await pair();

        const response = await send(ana, matchId, { text: MESSAGE });
        const stored = await messagesOf(matchId);

        expect(response.statusCode, response.body).toBe(201);
        expect(response.json()).toMatchObject({ kind: 'text', text: MESSAGE, imageUrl: null });
        expect(stored).toHaveLength(2);
        expect(stored[1]).toMatchObject({
          id: response.json<{ id: string }>().id,
          kind: 'text',
          senderId: ana.id,
          senderName: 'Ana',
          text: MESSAGE,
        });
        const everything = JSON.stringify(stored);
        expect(everything).not.toContain(ana.email);
        expect(everything).not.toContain(ANA_PHONE);
        expect(response.body).not.toContain(ana.id);
      });

      it('Scenario: Mensaje demasiado largo - 2.001 caracteres responde 400 y un mensaje vacío también; no se escribe nada', async () => {
        const { ana, matchId } = await pair();

        const tooLong = await send(ana, matchId, { text: 'a'.repeat(2001) });
        const exact = await send(ana, matchId, { text: 'a'.repeat(2000) });
        const empty = await send(ana, matchId, { text: '   ' });

        expect(tooLong.statusCode).toBe(400);
        expect(tooLong.json()).toMatchObject({ errors: [{ field: 'text', message: 'too_long' }] });
        expect(exact.statusCode).toBe(201);
        expect(empty.statusCode).toBe(400);
        expect(await messagesOf(matchId)).toHaveLength(2);
      });

      it('Scenario: Usuario ajeno - quien no participa recibe el mismo 404 que ante un match inexistente y no se escribe nada', async () => {
        const { matchId } = await pair();
        const intruder = await registered('Intrusa');

        const foreign = await send(intruder, matchId, { text: 'Hola' });
        const missing = await send(intruder, crypto.randomUUID(), { text: 'Hola' });
        const foreignUpload = await requestUpload(intruder, matchId);

        expect(foreign.statusCode).toBe(404);
        expect(missing.statusCode).toBe(404);
        expect(foreignUpload.statusCode).toBe(404);
        const withoutCorrelation = (problem: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(problem).filter(([key]) => key !== 'correlationId'));
        expect(withoutCorrelation(foreign.json())).toEqual(withoutCorrelation(missing.json()));
        expect(await messagesOf(matchId)).toHaveLength(1);
      });

      it('Scenario: Match cerrado - tras una retirada la API responde 409 MATCH_NOT_OPEN, el historial se conserva y no se emiten subidas', async () => {
        const { ana, beto, matchId } = await pair();
        expect((await send(ana, matchId, { text: 'Antes de cerrar' })).statusCode).toBe(201);
        expect((await call(beto, 'POST', `/v1/matches/${matchId}/withdraw`)).statusCode).toBe(200);

        const attempt = await send(ana, matchId, { text: 'Tarde' });
        const upload409 = await requestUpload(ana, matchId);

        expect(attempt.statusCode).toBe(409);
        expect(attempt.json()).toMatchObject({ code: 'MATCH_NOT_OPEN' });
        expect(upload409.statusCode).toBe(409);
        const history = await messagesOf(matchId);
        expect(history.map((message) => message['text'])).toEqual([undefined, 'Antes de cerrar']);
      });

      it('si el chat aún no se ha creado responde 409 CHAT_NOT_READY', async () => {
        const { ana, matchId } = await pair();
        await sql`UPDATE matches SET chat_id = NULL WHERE id = ${matchId}`;

        const attempt = await send(ana, matchId, { text: 'Hola' });

        expect(attempt.statusCode).toBe(409);
        expect(attempt.json()).toMatchObject({ code: 'CHAT_NOT_READY' });
      });
    });

    describe('imágenes', () => {
      it('Scenario: Imagen - se sube con URL firmada, se publica sin metadatos en un espacio privado y se sirve con URL firmada', async () => {
        const { ana, matchId } = await pair();
        const original = await jpegWithGps();
        expect((await sharp(original).metadata()).exif).toBeDefined();
        const uploadId = await upload(ana, matchId, original);

        const response = await send(ana, matchId, { imageUploadId: uploadId });

        expect(response.statusCode, response.body).toBe(201);
        const { imageUrl } = response.json<{ imageUrl: string }>();
        const served = await fetch(imageUrl);
        expect(served.ok).toBe(true);
        const metadata = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
        expect(metadata.format).toBe('webp');
        expect(metadata.exif).toBeUndefined();
        const stored = (await messagesOf(matchId))[1];
        const sent = response.json<{ id: string }>();
        expect(stored).toMatchObject({
          kind: 'image',
          senderId: ana.id,
          senderName: 'Ana',
          imageId: sent.id,
        });
        expect(JSON.stringify(stored)).not.toContain('chat/');
        const publicRead = await fetch(
          `${config.storage.publicBaseUrl}/chat/${matchId}/${sent.id}.webp`,
        );
        expect(publicRead.ok).toBe(false);
        const reuse = await send(ana, matchId, { imageUploadId: uploadId });
        expect(reuse.statusCode).toBe(422);
        expect(reuse.json()).toMatchObject({ code: 'IMAGE_NOT_UPLOADED' });
      });

      it('Scenario: Imagen - el otro participante obtiene una URL firmada de la imagen por su imageId; un ajeno, una imagen desconocida o un id que no es UUID dan 404', async () => {
        const { ana, beto, matchId } = await pair();
        const intruder = await registered('Intrusa');
        const uploadId = await upload(ana, matchId, await jpegWithGps());
        const sent = await send(ana, matchId, { imageUploadId: uploadId });
        const imageId = sent.json<{ id: string }>().id;
        const url = (user: EmulatorUser, id: string, match = matchId) =>
          call(user, 'GET', `/v1/matches/${match}/chat/images/${id}`);

        const asBeto = await url(beto, imageId);
        const asIntruder = await url(intruder, imageId);
        const unknown = await url(beto, crypto.randomUUID());
        const notUuid = await url(beto, 'chat/ruta');

        expect(asBeto.statusCode, asBeto.body).toBe(200);
        const body = asBeto.json<{ url: string; expiresAt: string }>();
        const served = await fetch(body.url);
        expect(served.ok).toBe(true);
        expect(
          (await sharp(Buffer.from(await served.arrayBuffer())).metadata()).exif,
        ).toBeUndefined();
        const ttl = Date.parse(body.expiresAt) - Date.now();
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(15 * 60_000 + START_SKEW_MS);
        expect(asIntruder.statusCode).toBe(404);
        expect(unknown.statusCode).toBe(404);
        expect(notUuid.statusCode).toBe(404);
        expect((await url(ana, imageId, crypto.randomUUID())).statusCode).toBe(404);
        expect((await call(beto, 'POST', `/v1/matches/${matchId}/withdraw`)).statusCode).toBe(200);
        expect((await url(ana, imageId)).statusCode).toBe(200);
      });

      it('una subida que no se hizo es 422 IMAGE_NOT_UPLOADED y un fichero que no es imagen, 422 INVALID_IMAGE', async () => {
        const { ana, beto, matchId } = await pair();
        const notUploaded = await send(ana, matchId, { imageUploadId: crypto.randomUUID() });
        const garbage = await upload(ana, matchId, Buffer.from('esto no es una imagen'));
        const invalid = await send(ana, matchId, { imageUploadId: garbage });
        const mine = await upload(ana, matchId, await jpeg());
        const stolen = await send(beto, matchId, { imageUploadId: mine });

        expect(notUploaded.statusCode).toBe(422);
        expect(notUploaded.json()).toMatchObject({ code: 'IMAGE_NOT_UPLOADED' });
        expect(invalid.statusCode).toBe(422);
        expect(invalid.json()).toMatchObject({ code: 'INVALID_IMAGE' });
        expect(stolen.statusCode).toBe(422);
        expect(await messagesOf(matchId)).toHaveLength(1);
      });
    });
  },
);
