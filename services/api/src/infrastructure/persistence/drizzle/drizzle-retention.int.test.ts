import { deleteApp, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { emulatorAvailable } from '../../../../test/auth-emulator.js';
import { firestoreAvailable } from '../../../../test/firestore-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createScenario, type Person } from '../../../../test/scenario.js';
import { createApi } from '../../../bootstrap.js';
import type { ApiConfig } from '../../../config.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { CloudChatImageStorage } from '../../storage/cloud-chat-image-storage.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { RETENTION_LOCK_KEY } from './drizzle-retention.js';

const sql = openSql();
const config = testConfig();
const chatImages = new CloudChatImageStorage(config.storage);
const MONTHS_AGO = (months: number) => `now() - interval '${String(months)} months'`;

let connection: DatabaseConnection;
let firestore: Firestore;
let closeInspector: () => Promise<void>;
const apis: ReturnType<typeof createApi>[] = [];

function apiWith(overrides: Partial<ApiConfig> = {}) {
  const api = createApi({ ...config, ...overrides });
  apis.push(api);
  return api;
}

function scenarioOf(api: ReturnType<typeof createApi>) {
  return createScenario({
    app: api.app,
    sql,
    homes: new DrizzleHomeRepository(
      connection.db,
      AddressCipher.fromBase64(config.addressEncryptionKey),
    ),
  });
}

const messagesOf = async (chatId: string) =>
  (await firestore.collection('chats').doc(chatId).collection('messages').get()).docs;

/** Un match con chat creado, un mensaje y una imagen procesada, cerrado por la retirada de Beto. */
async function closedMatchWithChat(
  api: ReturnType<typeof createApi>,
  scenario: ReturnType<typeof scenarioOf>,
): Promise<{ matchId: string; ana: Person; beto: Person; imagePath: string }> {
  const { ana, beto, matchId } = await scenario.pair();
  await api.outbox.idle();
  await api.outbox.dispatch();
  const sent = await scenario.call(ana, 'POST', `/v1/matches/${matchId}/messages`, {
    text: 'Hola, ¿te viene bien el sábado?',
  });
  expect(sent.statusCode, sent.body).toBe(201);
  const imagePath = `chat/${matchId}/imagen-1.webp`;
  await chatImages.store(imagePath, Buffer.from('webp'), 'image/webp');
  const withdrawn = await scenario.call(beto, 'POST', `/v1/matches/${matchId}/withdraw`);
  expect(withdrawn.statusCode, withdrawn.body).toBe(200);
  return { matchId, ana, beto, imagePath };
}

beforeAll(() => {
  connection = createDatabase(inject('databaseUrl'));
  const inspector = initializeApp({ projectId: config.firebase.projectId }, 'retention-inspector');
  firestore = getFirestore(inspector);
  closeInspector = () => deleteApp(inspector);
});

beforeEach(async () => {
  for (const api of apis) await api.outbox.idle();
  await sql`TRUNCATE matches, outbox, waitlist, users CASCADE`;
});

afterAll(async () => {
  for (const api of apis) await api.close();
  await closeInspector();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable() || !firestoreAvailable())(
  'purga de retención con PostgreSQL y los emuladores de Auth y Firestore',
  () => {
    it('cerrar un match guarda cuándo se cerró', async () => {
      const api = apiWith();
      const { matchId } = await closedMatchWithChat(api, scenarioOf(api));

      const [row] = await sql<{ closed_at: Date | null }[]>`
        SELECT closed_at FROM matches WHERE id = ${matchId}`;

      expect(row?.closed_at).toBeInstanceOf(Date);
    });

    it('Scenario: Chat de un match cerrado hace más de un año - sus mensajes e imágenes ya no existen, el detalle del match sigue y la auditoría registra la purga', async () => {
      const api = apiWith();
      const scenario = scenarioOf(api);
      const { matchId, ana, imagePath } = await closedMatchWithChat(api, scenario);
      await sql`UPDATE matches SET closed_at = ${sql.unsafe(MONTHS_AGO(13))} WHERE id = ${matchId}`;
      expect(await messagesOf(matchId)).not.toHaveLength(0);

      const summary = await api.retention.run();

      expect(summary).toEqual({ ran: true, chats: 1, waitlist: 0 });
      expect(await messagesOf(matchId)).toHaveLength(0);
      expect((await firestore.collection('chats').doc(matchId).get()).exists).toBe(true);
      expect(await chatImages.exists(imagePath)).toBe(false);
      const [match] = await sql<{ chat_purged_at: Date | null }[]>`
        SELECT chat_purged_at FROM matches WHERE id = ${matchId}`;
      expect(match?.chat_purged_at).toBeInstanceOf(Date);
      const detail = await scenario.call(ana, 'GET', `/v1/matches/${matchId}`);
      expect(detail.statusCode, detail.body).toBe(200);
      expect(detail.json<{ status: string }>().status).toBe('closed');
      const audit = await sql<
        { actor_id: string | null; entity: string; entity_id: string | null; detail: unknown }[]
      >`SELECT actor_id, entity, entity_id, detail FROM audit_log WHERE action = 'retention.purge'`;
      expect(audit).toEqual([
        { actor_id: null, entity: 'chat', entity_id: null, detail: { count: 1 } },
      ]);
    });

    it('Scenario: Chat reciente - un match cerrado hace 11 meses conserva su chat y su imagen', async () => {
      const api = apiWith();
      const { matchId, imagePath } = await closedMatchWithChat(api, scenarioOf(api));
      await sql`UPDATE matches SET closed_at = ${sql.unsafe(MONTHS_AGO(11))} WHERE id = ${matchId}`;

      const summary = await api.retention.run();

      expect(summary.chats).toBe(0);
      expect((await messagesOf(matchId)).length).toBeGreaterThan(1);
      expect(await chatImages.exists(imagePath)).toBe(true);
      expect(await sql`SELECT 1 FROM audit_log WHERE action = 'retention.purge'`).toHaveLength(0);
    });

    it('un match abierto no se purga, aunque se creara hace más de un año', async () => {
      const api = apiWith();
      const scenario = scenarioOf(api);
      const { matchId } = await scenario.pair();
      await api.outbox.idle();
      await api.outbox.dispatch();
      await sql`UPDATE matches SET created_at = ${sql.unsafe(MONTHS_AGO(20))} WHERE id = ${matchId}`;

      expect((await api.retention.run()).chats).toBe(0);
    });

    it('repetir la purga no vuelve a auditar el mismo chat', async () => {
      const api = apiWith();
      const { matchId } = await closedMatchWithChat(api, scenarioOf(api));
      await sql`UPDATE matches SET closed_at = ${sql.unsafe(MONTHS_AGO(13))} WHERE id = ${matchId}`;

      await api.retention.run();
      await api.retention.run();

      expect(await sql`SELECT 1 FROM audit_log WHERE action = 'retention.purge'`).toHaveLength(1);
    });

    it('Scenario: Bloqueo consultivo - con otra sesión reteniendo el bloqueo no se purga nada', async () => {
      const api = apiWith();
      const { matchId } = await closedMatchWithChat(api, scenarioOf(api));
      await sql`UPDATE matches SET closed_at = ${sql.unsafe(MONTHS_AGO(13))} WHERE id = ${matchId}`;
      const other = await sql.reserve();
      await other`SELECT pg_advisory_lock(${RETENTION_LOCK_KEY})`;

      try {
        const blocked = await api.retention.run();
        expect(blocked).toEqual({ ran: false, chats: 0, waitlist: 0 });
        expect((await messagesOf(matchId)).length).toBeGreaterThan(0);
      } finally {
        await other`SELECT pg_advisory_unlock(${RETENTION_LOCK_KEY})`;
        other.release();
      }

      expect((await api.retention.run()).chats).toBe(1);
    });

    describe('lista de espera', () => {
      async function seedWaitlist(rows: number): Promise<void> {
        for (let index = 0; index < rows; index += 1) {
          await sql`INSERT INTO waitlist (id, email, municipality, home_type, looking_for, consent_at)
                    VALUES (${crypto.randomUUID()}, ${`espera${String(index)}@example.com`},
                            'Madrid', 'piso', 'Un ático', now())`;
        }
      }

      it('Scenario: Purga tras el plazo - con el lanzamiento hace 13 meses se borran las inscripciones y la auditoría registra cuántas', async () => {
        const launch = new Date();
        launch.setUTCMonth(launch.getUTCMonth() - 13);
        const api = apiWith({ launchDate: launch });
        await seedWaitlist(3);

        const summary = await api.retention.run();

        expect(summary).toEqual({ ran: true, chats: 0, waitlist: 3 });
        expect(await sql`SELECT 1 FROM waitlist`).toHaveLength(0);
        const audit = await sql<{ entity: string; detail: unknown; actor_id: string | null }[]>`
          SELECT entity, detail, actor_id FROM audit_log WHERE action = 'retention.purge'`;
        expect(audit).toEqual([{ entity: 'waitlist', detail: { count: 3 }, actor_id: null }]);
      });

      it('Scenario: Sin fecha de lanzamiento - no se borra ninguna inscripción', async () => {
        const api = apiWith({ launchDate: undefined });
        await seedWaitlist(3);

        const summary = await api.retention.run();

        expect(summary.waitlist).toBe(0);
        expect(await sql`SELECT 1 FROM waitlist`).toHaveLength(3);
        expect(await sql`SELECT 1 FROM audit_log WHERE action = 'retention.purge'`).toHaveLength(0);
      });

      it('con el lanzamiento hace 11 meses las inscripciones se conservan', async () => {
        const launch = new Date();
        launch.setUTCMonth(launch.getUTCMonth() - 11);
        const api = apiWith({ launchDate: launch });
        await seedWaitlist(2);

        await api.retention.run();

        expect(await sql`SELECT 1 FROM waitlist`).toHaveLength(2);
      });
    });
  },
);
