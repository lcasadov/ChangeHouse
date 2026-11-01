import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { emulatorAvailable } from '../../../../test/auth-emulator.js';
import { firestoreAvailable } from '../../../../test/firestore-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createScenario, type Person, POINTS } from '../../../../test/scenario.js';
import { createApi } from '../../../bootstrap.js';
import { AddressCipher } from '../../../infrastructure/crypto/address-cipher.js';
import {
  createDatabase,
  type DatabaseConnection,
} from '../../../infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeRepository } from '../../../infrastructure/persistence/drizzle/drizzle-home-repository.js';

const sql = openSql();
const config = testConfig();
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';
const OFFENSIVE = 'Eres un estafador';
let api: ReturnType<typeof createApi>;
let app: FastifyInstance;
let connection: DatabaseConnection;
let scenario: ReturnType<typeof createScenario>;

interface ReportJson {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  resolution: string | null;
  evidence: { text: string | null; senderId: string; sentAt: string } | null;
  createdAt: string;
}

interface ReportRow {
  reporter_id: string;
  target_type: string;
  target_id: string;
  status: string;
  evidence_text: string | null;
  evidence_sender_id: string | null;
  evidence_sent_at: Date | null;
}

beforeAll(() => {
  api = createApi(config);
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
});

beforeEach(async () => {
  await api.outbox.idle();
  await sql`TRUNCATE matches, outbox, users CASCADE`;
});

afterAll(async () => {
  await api.close();
  await connection.close();
  await sql.end();
});

const report = (user: Person, payload: object) =>
  scenario.call(user, 'POST', '/v1/reports', payload);
const block = (user: Person, userId: string) =>
  scenario.call(user, 'POST', '/v1/me/blocked-users', { userId });
const rowsOf = () => sql<ReportRow[]>`SELECT * FROM reports ORDER BY created_at`;

async function admin(): Promise<Person> {
  const person = await scenario.registered('Admin');
  await sql`UPDATE users SET assigned_role = 'admin' WHERE id = ${person.id}`;
  return person;
}

/** Ana y Beto con un match y el chat creado en Firestore; Ana ya ha escrito un mensaje ofensivo. */
async function chatWithMessage() {
  const pair = await scenario.pair();
  await api.outbox.idle();
  await api.outbox.dispatch();
  const sent = await scenario.call(pair.ana, 'POST', `/v1/matches/${pair.matchId}/messages`, {
    text: OFFENSIVE,
  });
  expect(sent.statusCode, sent.body).toBe(201);
  return { ...pair, messageId: sent.json<{ id: string }>().id };
}

describe.skipIf(!emulatorAvailable() || !firestoreAvailable())(
  'denuncias, bloqueos y revisión con tokens reales, PostgreSQL y el emulador de Firestore',
  () => {
    describe('createReport', () => {
      it('Scenario: Denunciar una vivienda - responde 201 y la denuncia queda abierta sin evidencia', async () => {
        const ana = await scenario.registered('Ana');
        const beto = await scenario.registered('Beto');
        const betoHome = await scenario.publishedHome(beto, 'Leganés', POINTS.leganes, 212_000);

        const response = await report(ana, {
          targetType: 'home',
          targetId: betoHome,
          reason: 'Anuncio falso',
        });

        expect(response.statusCode, response.body).toBe(201);
        expect(response.json<ReportJson>()).toMatchObject({
          targetType: 'home',
          targetId: betoHome,
          reason: 'Anuncio falso',
          status: 'open',
          resolution: null,
          evidence: null,
        });
        expect(await rowsOf()).toEqual([
          expect.objectContaining({
            reporter_id: ana.id,
            target_type: 'home',
            target_id: betoHome,
            status: 'open',
            evidence_text: null,
          }),
        ]);
      });

      it('denunciar a un usuario responde 201; a uno mismo, a un inexistente o a una vivienda inexistente, no', async () => {
        const ana = await scenario.registered('Ana');
        const beto = await scenario.registered('Beto');

        const ok = await report(ana, { targetType: 'user', targetId: beto.id, reason: 'Acoso' });
        const self = await report(ana, { targetType: 'user', targetId: ana.id, reason: 'x' });
        const ghost = await report(ana, { targetType: 'user', targetId: MISSING_ID, reason: 'x' });
        const home = await report(ana, { targetType: 'home', targetId: MISSING_ID, reason: 'x' });
        const invalid = await report(ana, { targetType: 'home', targetId: 'abc', reason: 'x' });

        expect([ok, self, ghost, home, invalid].map((r) => r.statusCode)).toEqual([
          201, 400, 404, 404, 400,
        ]);
        expect(await rowsOf()).toHaveLength(1);
      });

      it('Scenario: Denunciar un mensaje - guarda el texto, el remitente y la fecha del mensaje como evidencia', async () => {
        const { ana, beto, messageId } = await chatWithMessage();

        const response = await report(beto, {
          targetType: 'message',
          targetId: messageId,
          reason: 'Insultos',
        });

        expect(response.statusCode, response.body).toBe(201);
        const body = response.json<ReportJson>();
        expect(body.evidence).toMatchObject({ text: OFFENSIVE, senderId: ana.id });
        const [row] = await rowsOf();
        expect(row).toMatchObject({
          reporter_id: beto.id,
          target_type: 'message',
          target_id: messageId,
          evidence_text: OFFENSIVE,
          evidence_sender_id: ana.id,
        });
        expect(row?.evidence_sent_at?.toISOString()).toBe(body.evidence?.sentAt);
      });

      it('Scenario: Mensaje de un chat ajeno - responde 404 sin revelar que existe y no guarda nada', async () => {
        const { messageId } = await chatWithMessage();
        const outsider = await scenario.registered('Carla');

        const foreign = await report(outsider, {
          targetType: 'message',
          targetId: messageId,
          reason: 'Insultos',
        });
        const unknown = await report(outsider, {
          targetType: 'message',
          targetId: 'no-existe',
          reason: 'Insultos',
        });

        expect(foreign.statusCode).toBe(404);
        expect(unknown.statusCode).toBe(404);
        expect(foreign.json<{ title: string }>().title).toBe(
          unknown.json<{ title: string }>().title,
        );
        expect(await rowsOf()).toHaveLength(0);
      });

      it('no se puede denunciar el mensaje propio ni el de bienvenida del sistema', async () => {
        const { ana, matchId, messageId } = await chatWithMessage();

        const own = await report(ana, {
          targetType: 'message',
          targetId: messageId,
          reason: 'x',
        });
        const system = await report(ana, {
          targetType: 'message',
          targetId: 'welcome',
          reason: 'x',
        });

        expect(matchId).toBeTruthy();
        expect(own.statusCode).toBe(400);
        expect(system.statusCode).toBe(404);
      });

      it('Scenario: límite - la denuncia número 11 en una hora responde 429 y el límite es por usuario', async () => {
        const ana = await scenario.registered('Ana');
        const beto = await scenario.registered('Beto');
        const carla = await scenario.registered('Carla');
        const body = { targetType: 'user', targetId: carla.id, reason: 'Spam' };

        const statuses: number[] = [];
        for (let attempt = 0; attempt < 11; attempt += 1) {
          statuses.push((await report(ana, body)).statusCode);
        }
        const other = await report(beto, body);

        expect(statuses.slice(0, 10)).toEqual(Array<number>(10).fill(201));
        expect(statuses[10]).toBe(429);
        expect(other.statusCode).toBe(201);
        expect(await rowsOf()).toHaveLength(11);
      });
    });

    describe('blockUser', () => {
      it('es idempotente (204 siempre), rechaza bloquearse a uno mismo (400) y a un inexistente (404)', async () => {
        const ana = await scenario.registered('Ana');
        const beto = await scenario.registered('Beto');

        const first = await block(ana, beto.id);
        const again = await block(ana, beto.id);
        const self = await block(ana, ana.id);
        const ghost = await block(ana, MISSING_ID);
        const invalid = await block(ana, 'abc');

        expect([first, again, self, ghost, invalid].map((r) => r.statusCode)).toEqual([
          204, 204, 400, 404, 400,
        ]);
        expect(
          await sql`SELECT 1 FROM user_blocks WHERE blocker_id = ${ana.id} AND blocked_id = ${beto.id}`,
        ).toHaveLength(1);
      });

      it.each(['blocker', 'blocked'] as const)(
        'Scenario: Efecto del bloqueo - cuando bloquea %s, ninguno ve las viviendas del otro en el descubrimiento',
        async (who) => {
          const ana = await scenario.registered('Ana');
          const anaHome = await scenario.publishedHome(ana, 'Getafe', POINTS.getafe, 200_000);
          await scenario.search(ana, {
            municipalities: ['Leganés'],
            maxToPayCents: 3_000_000,
            minToReceiveCents: 0,
          });
          const beto = await scenario.registered('Beto');
          const betoHome = await scenario.publishedHome(beto, 'Leganés', POINTS.leganes, 212_000);
          await scenario.search(beto, {
            municipalities: ['Getafe'],
            maxToPayCents: 3_000_000,
            minToReceiveCents: 0,
          });
          const idsSeenBy = async (user: Person) =>
            (await scenario.call(user, 'GET', '/v1/discover'))
              .json<{ items: { id: string }[] }>()
              .items.map((card) => card.id);
          expect(await idsSeenBy(ana)).toEqual([betoHome]);
          expect(await idsSeenBy(beto)).toEqual([anaHome]);

          const response =
            who === 'blocker' ? await block(ana, beto.id) : await block(beto, ana.id);

          expect(response.statusCode).toBe(204);
          expect(await idsSeenBy(ana)).toEqual([]);
          expect(await idsSeenBy(beto)).toEqual([]);
        },
      );

      it('Scenario: Sin matches nuevos - con me gusta cruzados y un bloqueo, el me gusta que cerraría el ciclo no crea match', async () => {
        const ana = await scenario.registered('Ana');
        const anaHome = await scenario.publishedHome(ana, 'Getafe', POINTS.getafe, 200_000);
        await scenario.search(ana, {
          municipalities: ['Leganés'],
          maxToPayCents: 3_000_000,
          minToReceiveCents: 0,
        });
        const beto = await scenario.registered('Beto');
        const betoHome = await scenario.publishedHome(beto, 'Leganés', POINTS.leganes, 212_000);
        await scenario.search(beto, {
          municipalities: ['Getafe'],
          maxToPayCents: 3_000_000,
          minToReceiveCents: 0,
        });
        await scenario.like(beto, betoHome, anaHome);
        await block(ana, beto.id);

        const liked = await scenario.like(ana, anaHome, betoHome);

        expect(liked.statusCode, liked.body).toBe(201);
        expect(liked.json<{ match: unknown }>().match).toBeNull();
        expect(await sql`SELECT 1 FROM matches`).toHaveLength(0);
      });

      // Requisito MODIFIED «Bloquear a un usuario»: antes el match seguía abierto; ahora se cierra
      it('Scenario: El bloqueo cierra el match y su chat - el match queda cerrado para los dos y queda auditado', async () => {
        const { ana, beto, matchId } = await scenario.pair();

        const response = await block(ana, beto.id);
        const mine = await scenario.call(ana, 'GET', `/v1/matches/${matchId}`);
        const theirs = await scenario.call(beto, 'GET', `/v1/matches/${matchId}`);

        expect(response.statusCode, response.body).toBe(204);
        expect(mine.json<{ status: string }>().status).toBe('closed');
        expect(theirs.json<{ status: string }>().status).toBe('closed');
        expect(
          await sql`SELECT 1 FROM audit_log WHERE actor_id = ${ana.id} AND action = 'match.block_close' AND entity_id = ${matchId}`,
        ).toHaveLength(1);
      });

      it('Scenario: El bloqueo cierra el match y su chat - un mensaje nuevo del bloqueado se rechaza con 409 y no se publica', async () => {
        const { ana, beto, matchId } = await chatWithMessage();

        await block(ana, beto.id);
        const fromBlocked = await scenario.call(beto, 'POST', `/v1/matches/${matchId}/messages`, {
          text: 'Hola otra vez',
        });
        const fromBlocker = await scenario.call(ana, 'POST', `/v1/matches/${matchId}/messages`, {
          text: 'Y yo',
        });

        expect([fromBlocked.statusCode, fromBlocker.statusCode]).toEqual([409, 409]);
        expect(fromBlocked.json<{ code?: string }>()).toMatchObject({ code: 'MATCH_NOT_OPEN' });
      });

      it('un bloqueo sin match entre los dos no cierra los demás matches de quien bloquea', async () => {
        const { ana, matchId } = await scenario.pair();
        const carla = await scenario.registered('Carla');

        await block(ana, carla.id);
        const detail = await scenario.call(ana, 'GET', `/v1/matches/${matchId}`);

        expect(detail.json<{ status: string }>().status).toBe('open');
      });
    });

    describe('adminListReports y adminResolveReport', () => {
      async function openReports() {
        const ana = await scenario.registered('Ana');
        const beto = await scenario.registered('Beto');
        const betoHome = await scenario.publishedHome(beto, 'Leganés', POINTS.leganes, 212_000);
        const recent = await report(ana, {
          targetType: 'user',
          targetId: beto.id,
          reason: 'Acoso',
        });
        const old = await report(ana, { targetType: 'home', targetId: betoHome, reason: 'Falso' });
        // Fuerza el orden por antigüedad: la segunda denuncia es la más antigua
        await sql`UPDATE reports SET created_at = '2026-10-01T09:00:00Z' WHERE id = ${old.json<ReportJson>().id}`;
        await sql`UPDATE reports SET created_at = '2026-10-02T09:00:00Z' WHERE id = ${recent.json<ReportJson>().id}`;
        return { old: old.json<ReportJson>(), recent: recent.json<ReportJson>() };
      }

      it('Scenario: Revisión de denuncias - las abiertas, de la más antigua a la más reciente, con su evidencia', async () => {
        const { beto, messageId } = await chatWithMessage();
        await report(beto, { targetType: 'message', targetId: messageId, reason: 'Insultos' });
        const { old, recent } = await openReports();
        const boss = await admin();

        const response = await scenario.call(boss, 'GET', '/v1/admin/reports');

        expect(response.statusCode, response.body).toBe(200);
        const page = response.json<{ items: ReportJson[]; nextCursor: string | null }>();
        expect(page.items.map((item) => item.id).slice(0, 2)).toEqual([old.id, recent.id]);
        const message = page.items.find((item) => item.targetType === 'message');
        expect(message?.evidence).toMatchObject({ text: OFFENSIVE });
        expect(page.nextCursor).toBeNull();
      });

      it('pagina con nextCursor y filtra por estado', async () => {
        const { old, recent } = await openReports();
        const boss = await admin();

        const first = await scenario.call(boss, 'GET', '/v1/admin/reports?limit=1');
        const cursor = first.json<{ nextCursor: string }>().nextCursor;
        const second = await scenario.call(
          boss,
          'GET',
          `/v1/admin/reports?limit=1&cursor=${cursor}`,
        );
        const dismissed = await scenario.call(boss, 'GET', '/v1/admin/reports?status=dismissed');

        expect(first.json<{ items: ReportJson[] }>().items.map((i) => i.id)).toEqual([old.id]);
        expect(second.json<{ items: ReportJson[] }>().items.map((i) => i.id)).toEqual([recent.id]);
        expect(second.json<{ nextCursor: string | null }>().nextCursor).toBeNull();
        expect(dismissed.json<{ items: unknown[] }>().items).toEqual([]);
      });

      it.each([
        ['resolved', 'report.resolve'],
        ['dismissed', 'report.dismiss'],
      ] as const)(
        'Scenario: Resolver una denuncia - %s deja la nota, el admin y la fecha, y la auditoría %s',
        async (status, action) => {
          const { old } = await openReports();
          const boss = await admin();

          const response = await scenario.call(boss, 'PATCH', `/v1/admin/reports/${old.id}`, {
            status,
            resolution: 'Revisada por el equipo',
          });

          expect(response.statusCode, response.body).toBe(200);
          expect(response.json<ReportJson>()).toMatchObject({
            id: old.id,
            status,
            resolution: 'Revisada por el equipo',
          });
          const [row] = await sql<{ resolved_by: string; resolved_at: Date }[]>`
            SELECT resolved_by, resolved_at FROM reports WHERE id = ${old.id}`;
          expect(row?.resolved_by).toBe(boss.id);
          const audit = await sql<{ actor_id: string; action: string; entity: string; at: Date }[]>`
            SELECT actor_id, action, entity, at FROM audit_log WHERE entity_id = ${old.id}`;
          expect(audit).toEqual([
            expect.objectContaining({ actor_id: boss.id, action, entity: 'report' }),
          ]);
          expect(audit[0]?.at.getTime()).toBe(row?.resolved_at.getTime());
        },
      );

      it('la nota es obligatoria (400), una denuncia inexistente es 404 y una ya resuelta, 409', async () => {
        const { old } = await openReports();
        const boss = await admin();
        const patch = (id: string, payload: object) =>
          scenario.call(boss, 'PATCH', `/v1/admin/reports/${id}`, payload);

        const noNote = await patch(old.id, { status: 'resolved' });
        const ghost = await patch(MISSING_ID, { status: 'resolved', resolution: 'x' });
        const first = await patch(old.id, { status: 'resolved', resolution: 'Hecho' });
        const again = await patch(old.id, { status: 'dismissed', resolution: 'Otra vez' });

        expect([noNote, ghost, first, again].map((r) => r.statusCode)).toEqual([
          400, 404, 200, 409,
        ]);
        expect(await sql`SELECT 1 FROM audit_log WHERE entity_id = ${old.id}`).toHaveLength(1);
      });

      it('Scenario: Resolver una denuncia - si la auditoría falla, la denuncia sigue abierta (misma transacción)', async () => {
        const { old } = await openReports();
        const boss = await admin();
        await sql.unsafe(`CREATE FUNCTION reject_report_audit() RETURNS trigger LANGUAGE plpgsql AS
          $$ BEGIN IF NEW.entity = 'report' THEN RAISE EXCEPTION 'auditoría caída'; END IF; RETURN NEW; END $$`);
        await sql.unsafe(`CREATE TRIGGER reject_report_audit BEFORE INSERT ON audit_log
          FOR EACH ROW EXECUTE FUNCTION reject_report_audit()`);
        try {
          const response = await scenario.call(boss, 'PATCH', `/v1/admin/reports/${old.id}`, {
            status: 'resolved',
            resolution: 'Hecho',
          });

          expect(response.statusCode).toBe(500);
        } finally {
          await sql.unsafe('DROP TRIGGER reject_report_audit ON audit_log');
          await sql.unsafe('DROP FUNCTION reject_report_audit()');
        }
        const [row] = await sql<{ status: string; resolution: string | null }[]>`
          SELECT status, resolution FROM reports WHERE id = ${old.id}`;
        expect(row).toEqual({ status: 'open', resolution: null });
      });

      it('un usuario sin rol de admin no ve ni resuelve denuncias (403)', async () => {
        const { old } = await openReports();
        const ana = await scenario.registered('Otra');

        const list = await scenario.call(ana, 'GET', '/v1/admin/reports');
        const patch = await scenario.call(ana, 'PATCH', `/v1/admin/reports/${old.id}`, {
          status: 'resolved',
          resolution: 'x',
        });

        expect([list.statusCode, patch.statusCode]).toEqual([403, 403]);
      });
    });
  },
);
