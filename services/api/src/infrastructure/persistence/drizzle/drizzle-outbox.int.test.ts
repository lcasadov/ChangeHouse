import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { openSql } from '../../../../test/fixtures.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleChatSetup } from './drizzle-chat-setup.js';
import { DrizzleOutbox } from './drizzle-outbox.js';

const sql = openSql();
const AT = new Date('2026-10-20T09:00:00.000Z');
const LATER = new Date('2026-10-20T09:05:00.000Z');
const MATCH_A = '0199c1a2-0000-7000-8000-0000000000a1';
const MATCH_B = '0199c1a2-0000-7000-8000-0000000000a2';
const EVENT_A = '0199c1a2-0000-7000-8000-0000000000e1';
const EVENT_B = '0199c1a2-0000-7000-8000-0000000000e2';
const EVENT_DUP = '0199c1a2-0000-7000-8000-0000000000e3';

let connection: DatabaseConnection;
let outbox: DrizzleOutbox;

beforeAll(() => {
  connection = createDatabase(inject('databaseUrl'));
  outbox = new DrizzleOutbox(connection.db);
});

beforeEach(async () => {
  await sql`TRUNCATE outbox`;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

const rows = () =>
  sql<{ id: string; attempts: number; processed_at: Date | null }[]>`
    SELECT id, attempts, processed_at FROM outbox ORDER BY created_at, id`;

describe('DrizzleOutbox.enqueue', () => {
  it('guarda cada hecho una sola vez: registrarlo de nuevo no hace nada ni falla', async () => {
    await outbox.enqueue({ id: EVENT_A, type: 'match.created', aggregateId: MATCH_A, at: AT });
    await outbox.enqueue({ id: EVENT_DUP, type: 'match.created', aggregateId: MATCH_A, at: LATER });

    expect((await rows()).map((row) => row.id)).toEqual([EVENT_A]);
  });
});

describe('DrizzleOutbox - carga del hecho', () => {
  it('guarda la carga con el hecho y la entrega al procesarlo; sin carga entrega null', async () => {
    await outbox.enqueue({
      id: EVENT_A,
      type: 'message.sent',
      aggregateId: MATCH_A,
      payload: { matchId: MATCH_B, senderId: EVENT_B },
      at: AT,
    });
    await outbox.enqueue({ id: EVENT_B, type: 'match.closed', aggregateId: MATCH_B, at: LATER });
    const seen: unknown[] = [];

    await outbox.processPending(
      10,
      (event) => {
        seen.push(event.payload);
        return Promise.resolve();
      },
      LATER,
    );

    expect(seen).toEqual([{ matchId: MATCH_B, senderId: EVENT_B }, null]);
  });
});

describe('DrizzleOutbox.processPending', () => {
  it('entrega los pendientes del más antiguo al más reciente y marca los procesados con la fecha dada', async () => {
    await outbox.enqueue({ id: EVENT_B, type: 'match.created', aggregateId: MATCH_B, at: LATER });
    await outbox.enqueue({ id: EVENT_A, type: 'match.created', aggregateId: MATCH_A, at: AT });
    const seen: string[] = [];

    const summary = await outbox.processPending(
      10,
      (event) => {
        seen.push(`${event.type}:${event.aggregateId}:${String(event.attempts)}`);
        return Promise.resolve();
      },
      LATER,
    );
    const again = await outbox.processPending(10, () => Promise.resolve(), LATER);

    expect(summary).toEqual({ processed: 2, failed: 0 });
    expect(seen).toEqual([`match.created:${MATCH_A}:0`, `match.created:${MATCH_B}:0`]);
    expect((await rows()).map((row) => row.processed_at?.toISOString())).toEqual([
      LATER.toISOString(),
      LATER.toISOString(),
    ]);
    expect(again).toEqual({ processed: 0, failed: 0 });
  });

  it('un fallo deja el hecho pendiente con un intento más y no impide procesar los demás', async () => {
    await outbox.enqueue({ id: EVENT_A, type: 'match.created', aggregateId: MATCH_A, at: AT });
    await outbox.enqueue({ id: EVENT_B, type: 'match.created', aggregateId: MATCH_B, at: LATER });

    const first = await outbox.processPending(
      10,
      (event) =>
        event.aggregateId === MATCH_A ? Promise.reject(new Error('Firestore')) : Promise.resolve(),
      LATER,
    );
    const afterFailure = await rows();
    const retried: number[] = [];
    const second = await outbox.processPending(
      10,
      (event) => {
        retried.push(event.attempts);
        return Promise.resolve();
      },
      LATER,
    );

    expect(first).toEqual({ processed: 1, failed: 1 });
    expect(afterFailure.map((row) => [row.id, row.attempts, row.processed_at === null])).toEqual([
      [EVENT_A, 1, true],
      [EVENT_B, 0, false],
    ]);
    expect(second).toEqual({ processed: 1, failed: 0 });
    expect(retried).toEqual([1]);
  });

  it('respeta el límite del lote', async () => {
    await outbox.enqueue({ id: EVENT_A, type: 'match.created', aggregateId: MATCH_A, at: AT });
    await outbox.enqueue({ id: EVENT_B, type: 'match.created', aggregateId: MATCH_B, at: LATER });

    const summary = await outbox.processPending(1, () => Promise.resolve(), LATER);

    expect(summary).toEqual({ processed: 1, failed: 0 });
    expect((await rows()).filter((row) => row.processed_at === null)).toHaveLength(1);
  });

  it('dos procesadores simultáneos nunca reciben el mismo hecho', async () => {
    await outbox.enqueue({ id: EVENT_A, type: 'match.created', aggregateId: MATCH_A, at: AT });
    const handled: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => {
      release = done;
    });

    const first = outbox.processPending(
      10,
      async (event) => {
        handled.push(`primero:${event.id}`);
        await gate;
      },
      LATER,
    );
    await new Promise((done) => setTimeout(done, 200));
    const second = await outbox.processPending(
      10,
      (event) => {
        handled.push(`segundo:${event.id}`);
        return Promise.resolve();
      },
      LATER,
    );
    release();
    await first;

    expect(second).toEqual({ processed: 0, failed: 0 });
    expect(handled).toEqual([`primero:${EVENT_A}`]);
  });
});

describe('DrizzleChatSetup', () => {
  const ANA = '0199c1a2-0000-7000-8000-0000000000b1';
  const BETO = '0199c1a2-0000-7000-8000-0000000000b2';
  const HOME_ANA = '0199c1a2-0000-7000-8000-0000000000c1';
  const HOME_BETO = '0199c1a2-0000-7000-8000-0000000000c2';

  async function seed(): Promise<void> {
    await sql`TRUNCATE matches, users CASCADE`;
    await sql`INSERT INTO users (id, firebase_uid, email, display_name, phone) VALUES
      (${ANA}, 'uid-ana', 'ana@example.com', 'Ana', '+34600111222'),
      (${BETO}, 'uid-beto', 'beto@example.com', 'Beto', NULL)`;
    for (const [id, owner] of [
      [HOME_ANA, ANA],
      [HOME_BETO, BETO],
    ] as const) {
      await sql`INSERT INTO homes (id, owner_id, type, exact_address, exact_location, approx_location, area_name)
                VALUES (${id}, ${owner}, 'piso', ${Buffer.from('x')},
                        ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography, 'Centro')`;
    }
    await sql`INSERT INTO matches (id, type, cycle_key) VALUES (${MATCH_A}, 2, ${`${HOME_ANA}:${HOME_BETO}`})`;
    await sql`INSERT INTO match_participants
        (match_id, home_id, user_id, gives_home_id, receives_home_id, compensation_cents)
      VALUES (${MATCH_A}, ${HOME_ANA}, ${ANA}, ${HOME_ANA}, ${HOME_BETO}, 0),
             (${MATCH_A}, ${HOME_BETO}, ${BETO}, ${HOME_BETO}, ${HOME_ANA}, 0)`;
  }

  it('lee los participantes con su uid de Firebase y su nombre, sin email ni teléfono, y enlaza el chat', async () => {
    await seed();
    const setup = new DrizzleChatSetup(connection.db);

    const before = await setup.findRoster(MATCH_A);
    await setup.linkChat(MATCH_A, MATCH_A);
    const after = await setup.findRoster(MATCH_A);
    const missing = await setup.findRoster(MATCH_B);

    expect(before?.chatId).toBeNull();
    expect(before?.members).toEqual([
      { userId: ANA, firebaseUid: 'uid-ana', displayName: 'Ana' },
      { userId: BETO, firebaseUid: 'uid-beto', displayName: 'Beto' },
    ]);
    expect(after?.chatId).toBe(MATCH_A);
    expect(missing).toBeNull();
    await sql`TRUNCATE matches, users CASCADE`;
  });
});
