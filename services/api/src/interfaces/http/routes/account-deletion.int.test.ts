import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { authUserExists, emulatorAvailable, signUp } from '../../../../test/auth-emulator.js';
import { InMemoryPhotoStorage } from '../../../../test/fakes.js';
import { firestoreAvailable } from '../../../../test/firestore-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createScenario, POINTS } from '../../../../test/scenario.js';
import type { IdentityRemover } from '../../../application/account/identity-remover.js';
import { createApi } from '../../../bootstrap.js';
import { createFirebaseIdentityVerifier } from '../../../infrastructure/auth/firebase-identity-verifier.js';
import { AddressCipher } from '../../../infrastructure/crypto/address-cipher.js';
import {
  createDatabase,
  type DatabaseConnection,
} from '../../../infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeRepository } from '../../../infrastructure/persistence/drizzle/drizzle-home-repository.js';

const DELETED_NAME = 'Usuario eliminado';

/** Da de baja en el emulador de Auth de verdad, pero puede fallar las primeras veces (Firebase caído). */
class FlakyIdentityRemover implements IdentityRemover {
  failures = 0;
  calls = 0;
  private real: IdentityRemover | undefined;
  private close: (() => Promise<void>) | undefined;

  async remove(uid: string): Promise<void> {
    this.calls += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('Firebase Auth no disponible');
    }
    if (!this.real) {
      const identity = createFirebaseIdentityVerifier(config.firebase);
      this.real = identity.remover;
      this.close = identity.close;
    }
    await this.real.remove(uid);
  }

  async shutdown(): Promise<void> {
    await this.close?.();
  }
}

const sql = openSql();
const config = testConfig();
const storage = new InMemoryPhotoStorage();
const remover = new FlakyIdentityRemover();
let api: ReturnType<typeof createApi>;
let app: FastifyInstance;
let connection: DatabaseConnection;
let firestore: Firestore;
let closeInspector: () => Promise<void>;
let scenario: ReturnType<typeof createScenario>;

/** Espera al despacho que lanzó la petición y lanza uno más, como el reintento periódico. */
async function settleOutbox(): Promise<void> {
  await api.outbox.idle();
  await api.outbox.dispatch();
}

const deleteAccount = (user: { idToken: string }) => scenario.call(user, 'DELETE', '/v1/me');

const messagesOf = async (chatId: string) =>
  (
    await firestore
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt')
      .get()
  ).docs;

interface UserRow {
  email: string;
  display_name: string;
  phone: string | null;
  municipality: string | null;
  deleted_at: Date | null;
}

const userRow = async (id: string): Promise<UserRow | undefined> =>
  (
    await sql<UserRow[]>`
      SELECT email, display_name, phone, municipality, deleted_at FROM users WHERE id = ${id}`
  )[0];

beforeAll(() => {
  api = createApi(config, { photoStorage: storage, identityRemover: remover });
  app = api.app;
  connection = createDatabase(inject('databaseUrl'));
  scenario = createScenario({
    app,
    sql,
    homes: new DrizzleHomeRepository(
      connection.db,
      AddressCipher.fromBase64(config.addressEncryptionKey),
    ),
  });
  const inspector = initializeApp({ projectId: config.firebase.projectId }, 'deletion-inspector');
  firestore = getFirestore(inspector);
  closeInspector = () => deleteApp(inspector);
});

beforeEach(async () => {
  remover.failures = 0;
  remover.calls = 0;
  storage.originals.clear();
  storage.published.clear();
  // Un despacho lanzado por la petición anterior no puede seguir en curso al vaciar las tablas
  await api.outbox.idle();
  await sql`TRUNCATE matches, outbox, users CASCADE`;
});

afterAll(async () => {
  await api.close();
  await remover.shutdown();
  await closeInspector();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable() || !firestoreAvailable())(
  'deleteMe con tokens reales, PostgreSQL y los emuladores de Auth y Firestore',
  () => {
    it('Scenario: Eliminación completa - la vivienda pasa a closed, el match se cierra para el otro participante y la cuenta no puede volver a entrar', async () => {
      const { ana, anaHome, beto, betoHome, matchId } = await scenario.pair();
      await settleOutbox();

      const response = await deleteAccount(ana);
      await settleOutbox();

      expect(response.statusCode, response.body).toBe(204);
      const [home] = await sql<
        { status: string }[]
      >`SELECT status FROM homes WHERE id = ${anaHome}`;
      expect(home?.status).toBe('closed');
      const [match] = await sql<
        { status: string }[]
      >`SELECT status FROM matches WHERE id = ${matchId}`;
      expect(match?.status).toBe('closed');
      const participants = await sql<{ home_id: string; status: string }[]>`
        SELECT home_id, status FROM match_participants WHERE match_id = ${matchId}`;
      expect(Object.fromEntries(participants.map((p) => [p.home_id, p.status]))).toEqual({
        [anaHome]: 'withdrawn',
        [betoHome]: 'pending',
      });
      const seenByBeto = await scenario.call(beto, 'GET', '/v1/matches');
      const [listed] = seenByBeto.json<{
        items: { status: string; participants: { homeId: string; displayName: string }[] }[];
      }>().items;
      expect(listed?.status).toBe('closed');
      expect(listed?.participants.find((p) => p.homeId === anaHome)?.displayName).toBe(
        DELETED_NAME,
      );
      expect(await authUserExists(ana.uid)).toBe(false);
      expect((await scenario.call(ana, 'GET', '/v1/me')).statusCode).toBe(401);
      expect((await deleteAccount(ana)).statusCode).toBe(401);
    });

    it('Scenario: Eliminación completa - un match confirmado también se cierra para todos', async () => {
      const { ana, beto, matchId } = await scenario.pair();
      await scenario.call(ana, 'POST', `/v1/matches/${matchId}/confirm`);
      await scenario.call(beto, 'POST', `/v1/matches/${matchId}/confirm`);
      const [before] = await sql<
        { status: string }[]
      >`SELECT status FROM matches WHERE id = ${matchId}`;

      const response = await deleteAccount(beto);
      await settleOutbox();

      expect(before?.status).toBe('confirmed');
      expect(response.statusCode, response.body).toBe(204);
      const [after] = await sql<
        { status: string }[]
      >`SELECT status FROM matches WHERE id = ${matchId}`;
      expect(after?.status).toBe('closed');
      const [withdrawn] = await sql<{ status: string }[]>`
        SELECT status FROM match_participants WHERE match_id = ${matchId} AND user_id = ${beto.id}`;
      expect(withdrawn?.status).toBe('withdrawn');
    });

    it('Scenario: Datos tras la eliminación - no queda email, nombre ni teléfono y se conservan consentimientos y auditoría', async () => {
      const { ana, matchId } = await scenario.pair({ ana: 'Ana Real', beto: 'Beto' });
      await sql`UPDATE users SET phone = '+34600111222', municipality = 'Getafe' WHERE id = ${ana.id}`;
      const [consentsBefore] = await sql<{ count: string }[]>`
        SELECT count(*) FROM consents WHERE user_id = ${ana.id}`;

      const response = await deleteAccount(ana);
      await settleOutbox();

      expect(response.statusCode).toBe(204);
      const row = await userRow(ana.id);
      expect(row).toMatchObject({
        email: `deleted+${ana.id}@changehouse.invalid`,
        display_name: DELETED_NAME,
        phone: null,
        municipality: null,
      });
      expect(row?.deleted_at).toBeInstanceOf(Date);
      const consents = await sql<{ type: string; version: string; accepted_at: Date }[]>`
        SELECT type, version, accepted_at FROM consents WHERE user_id = ${ana.id}`;
      expect(consents).toHaveLength(Number(consentsBefore?.count));
      expect(consents.map((c) => c.version)).toContain(TERMS_VERSION);
      expect(consents.map((c) => c.version)).toContain(PRIVACY_VERSION);
      const audit = await sql<{ action: string; entity: string; entity_id: string }[]>`
        SELECT action, entity, entity_id FROM audit_log WHERE actor_id = ${ana.id} ORDER BY id`;
      expect(audit).toContainEqual({ action: 'user.delete', entity: 'user', entity_id: ana.id });
      expect(audit).toContainEqual({
        action: 'match.withdraw',
        entity: 'match',
        entity_id: matchId,
      });
      const everything = JSON.stringify(await sql`SELECT * FROM users WHERE id = ${ana.id}`);
      expect(everything).not.toContain(ana.email);
      expect(everything).not.toContain('Ana Real');
      expect(everything).not.toContain('+34600111222');
    });

    it('Scenario: Datos tras la eliminación - sus viviendas pierden la dirección y la ubicación exactas y el otro participante deja de ver el contacto', async () => {
      const { ana, anaHome, beto, matchId } = await scenario.pair();
      await sql`UPDATE users SET phone = '+34600111222' WHERE id = ${ana.id}`;
      await scenario.call(ana, 'PUT', `/v1/matches/${matchId}/phone-sharing`, { share: true });
      const before = await scenario.call(beto, 'GET', `/v1/matches/${matchId}`);

      const response = await deleteAccount(ana);
      await settleOutbox();

      expect(before.body).toContain('+34600111222');
      expect(response.statusCode, response.body).toBe(204);
      const [home] = await sql<
        { exact_address: Buffer | null; exact_location: string | null; approx: string | null }[]
      >`SELECT exact_address, exact_location, approx_location AS approx FROM homes WHERE id = ${anaHome}`;
      expect(home?.exact_address).toBeNull();
      expect(home?.exact_location).toBeNull();
      const shares = await sql<{ shares_phone: boolean }[]>`
        SELECT shares_phone FROM match_participants WHERE match_id = ${matchId}`;
      expect(shares.every((row) => !row.shares_phone)).toBe(true);
      const after = await scenario.call(beto, 'GET', `/v1/matches/${matchId}`);
      expect(after.statusCode, after.body).toBe(200);
      expect(after.body).not.toContain('+34600111222');
      expect(after.body).not.toContain('Calle Mayor');
    });

    it('Scenario: Usuario suspendido elimina su cuenta - responde 204 y las denuncias y la auditoría de su suspensión se conservan', async () => {
      const { ana, beto } = await scenario.pair();
      const reported = await scenario.call(beto, 'POST', '/v1/reports', {
        targetType: 'user',
        targetId: ana.id,
        reason: 'Fraude reiterado',
      });
      expect(reported.statusCode, reported.body).toBe(201);
      const admin = await scenario.registered('Admin');
      await sql`UPDATE users SET assigned_role = 'admin' WHERE id = ${admin.id}`;
      const suspended = await scenario.call(admin, 'PUT', `/v1/admin/users/${ana.id}/suspension`, {
        suspended: true,
        reason: 'Fraude reiterado',
      });
      expect(suspended.statusCode, suspended.body).toBe(200);

      const response = await deleteAccount(ana);
      await settleOutbox();

      expect(response.statusCode, response.body).toBe(204);
      expect((await userRow(ana.id))?.deleted_at).toBeInstanceOf(Date);
      expect(await sql`SELECT 1 FROM reports WHERE target_id = ${ana.id}`).toHaveLength(1);
      const audit = await sql<{ action: string }[]>`
        SELECT action FROM audit_log WHERE entity_id = ${ana.id}`;
      expect(audit.map((row) => row.action).sort()).toEqual(['user.delete', 'user.suspend']);
    });

    it('borra preferencias, dispositivos, me gusta y descartes del usuario, y las fotos de sus viviendas', async () => {
      const { ana, anaHome } = await scenario.pair();
      const carla = await scenario.registered('Carla');
      const carlaHome = await scenario.publishedHome(carla, 'Leganés', POINTS.leganes, 150_000);
      const dismissed = await scenario.call(ana, 'POST', '/v1/me/dismissals', {
        fromHomeId: anaHome,
        targetHomeId: carlaHome,
      });
      expect(dismissed.statusCode, dismissed.body).toBe(204);
      await scenario.call(ana, 'PUT', '/v1/me/devices', {
        fcmToken: 'token-de-ana',
        platform: 'android',
      });
      const readyId = crypto.randomUUID();
      const pendingId = crypto.randomUUID();
      const readyPath = `homes/${anaHome}/${readyId}.webp`;
      const pendingPath = `originals/${anaHome}/${pendingId}`;
      await sql`INSERT INTO home_photos (id, home_id, status, storage_path, position)
                VALUES (${readyId}, ${anaHome}, 'ready', ${readyPath}, 1)`;
      await sql`INSERT INTO home_photos (id, home_id, status, storage_path)
                VALUES (${pendingId}, ${anaHome}, 'pending', ${pendingPath})`;
      storage.published.set(readyPath, { data: Buffer.from('x'), contentType: 'image/webp' });
      storage.originals.set(pendingPath, Buffer.from('x'));

      const response = await deleteAccount(ana);
      await settleOutbox();

      expect(response.statusCode, response.body).toBe(204);
      const counts = async (table: 'search_preferences' | 'user_devices' | 'account_dismissals') =>
        (await sql`SELECT 1 FROM ${sql(table)} WHERE user_id = ${ana.id}`).length;
      expect(await counts('search_preferences')).toBe(0);
      expect(await counts('user_devices')).toBe(0);
      expect((await sql`SELECT 1 FROM likes WHERE from_home_id = ${anaHome}`).length).toBe(0);
      expect((await sql`SELECT 1 FROM dismissals WHERE home_id = ${anaHome}`).length).toBe(0);
      expect((await sql`SELECT 1 FROM home_photos WHERE home_id = ${anaHome}`).length).toBe(0);
      expect(storage.published.has(readyPath)).toBe(false);
      expect(storage.originals.has(pendingPath)).toBe(false);
    });

    it('conserva los mensajes del chat con el remitente renombrado a «Usuario eliminado»', async () => {
      const { ana, beto, matchId } = await scenario.pair();
      await settleOutbox();
      const sent = await scenario.call(ana, 'POST', `/v1/matches/${matchId}/messages`, {
        text: 'Hola Beto',
      });
      expect(sent.statusCode, sent.body).toBe(201);
      await scenario.call(beto, 'POST', `/v1/matches/${matchId}/messages`, { text: 'Hola Ana' });

      await deleteAccount(ana);
      await settleOutbox();

      const documents = await messagesOf(matchId);
      const texts = documents.map((d): unknown[] => [
        d.data()['kind'],
        d.data()['senderName'],
        d.data()['text'],
      ]);
      expect(texts).toContainEqual(['text', DELETED_NAME, 'Hola Beto']);
      expect(texts).toContainEqual(['text', 'Beto', 'Hola Ana']);
      const welcome = documents.find((d) => d.data()['kind'] === 'system');
      expect([...(welcome?.data()['participantNames'] as string[])].sort()).toEqual(
        ['Beto', DELETED_NAME].sort(),
      );
    });

    it('Scenario: Eliminación completa - un usuario sin viviendas ni matches (seeker) también puede eliminar su cuenta', async () => {
      const seeker = await scenario.registered('Seeker');

      const response = await deleteAccount(seeker);
      await settleOutbox();

      expect(response.statusCode).toBe(204);
      expect((await userRow(seeker.id))?.deleted_at).toBeInstanceOf(Date);
      expect(await authUserExists(seeker.uid)).toBe(false);
    });

    it('GIVEN una cuenta eliminada WHEN se registra de nuevo el mismo email THEN el alta funciona como un usuario nuevo', async () => {
      const first = await scenario.registered('Ana');
      await deleteAccount(first);
      await settleOutbox();

      const again = await signUp(first.email);
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/me',
        headers: { authorization: `Bearer ${again.idToken}` },
        payload: {
          displayName: 'Ana de nuevo',
          acceptedTermsVersion: TERMS_VERSION,
          acceptedPrivacyVersion: PRIVACY_VERSION,
        },
      });

      expect(again.uid).not.toBe(first.uid);
      expect(response.statusCode, response.body).toBe(201);
      const me = response.json<{ id: string; email: string }>();
      expect(me.id).not.toBe(first.id);
      expect(me.email).toBe(first.email.toLowerCase());
      expect((await userRow(first.id))?.deleted_at).toBeInstanceOf(Date);
    });

    it('GIVEN un fallo al dar de baja en Firebase Auth WHEN se reintenta THEN la baja termina sin duplicar efectos', async () => {
      const { ana, matchId } = await scenario.pair();
      await settleOutbox();
      remover.failures = 1;

      const response = await deleteAccount(ana);
      await api.outbox.idle();
      const [pending] = await sql<{ attempts: number; processed_at: Date | null }[]>`
        SELECT attempts, processed_at FROM outbox WHERE type = 'user.deleted' AND aggregate_id = ${ana.id}`;
      const stillThere = await authUserExists(ana.uid);
      const blocked = await scenario.call(ana, 'GET', '/v1/me');
      await api.outbox.dispatch();
      const [done] = await sql<{ attempts: number; processed_at: Date | null }[]>`
        SELECT attempts, processed_at FROM outbox WHERE type = 'user.deleted' AND aggregate_id = ${ana.id}`;

      expect(response.statusCode).toBe(204);
      expect(pending).toMatchObject({ attempts: 1, processed_at: null });
      expect(stillThere).toBe(true);
      // Aunque Auth tarde en borrarse, la API ya la rechaza
      expect(blocked.statusCode).toBe(401);
      expect(done?.processed_at).not.toBeNull();
      expect(await authUserExists(ana.uid)).toBe(false);
      expect(remover.calls).toBe(2);
      const deletions =
        await sql`SELECT 1 FROM audit_log WHERE action = 'user.delete' AND actor_id = ${ana.id}`;
      const closures =
        await sql`SELECT 1 FROM outbox WHERE type = 'match.closed' AND aggregate_id = ${matchId}`;
      expect(deletions).toHaveLength(1);
      expect(closures).toHaveLength(1);
    });

    it('si el usuario ya no existe en Firebase Auth la baja cuenta como hecha', async () => {
      const person = await scenario.registered('Ana');
      remover.failures = 1;
      const response = await deleteAccount(person);
      await api.outbox.idle();
      // La baja llegó a hacerse aunque el primer intento dijera lo contrario
      const identity = createFirebaseIdentityVerifier(config.firebase);
      await identity.remover.remove(person.uid);
      await identity.close();

      await api.outbox.dispatch();

      expect(response.statusCode).toBe(204);
      const [event] = await sql<{ processed_at: Date | null }[]>`
        SELECT processed_at FROM outbox WHERE type = 'user.deleted' AND aggregate_id = ${person.id}`;
      expect(event?.processed_at).not.toBeNull();
    });

    it('una vivienda en operación impide eliminar la cuenta (409) y no cambia nada', async () => {
      const { ana, anaHome, matchId } = await scenario.pair();
      await sql`UPDATE homes SET status = 'in_operation' WHERE id = ${anaHome}`;

      const response = await deleteAccount(ana);
      await settleOutbox();

      expect(response.statusCode, response.body).toBe(409);
      expect((await userRow(ana.id))?.deleted_at).toBeNull();
      expect((await userRow(ana.id))?.email).toBe(ana.email.toLowerCase());
      const [match] = await sql<
        { status: string }[]
      >`SELECT status FROM matches WHERE id = ${matchId}`;
      expect(match?.status).toBe('open');
      expect(await authUserExists(ana.uid)).toBe(true);
    });
  },
);
