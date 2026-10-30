import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { decisionOperations } from '../../../application/decision/decision-operations.js';
import type {
  DecisionStore,
  DecisionUnitOfWork,
} from '../../../application/decision/decision-repository.js';
import type { NewMatch } from '../../../application/matching/matching-repository.js';
import { type Home, newDraft } from '../../../domain/home/home.js';
import { cycleKey, evaluateCycle } from '../../../domain/matching/cycle.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleCycleCandidates } from './drizzle-cycle-candidates.js';
import { DrizzleDecisionUnitOfWork } from './drizzle-decision-unit-of-work.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const ME = '0199c1a2-0000-7000-8000-000000000ea1';
const OTHER = '0199c1a2-0000-7000-8000-000000000ea2';
const THIRD = '0199c1a2-0000-7000-8000-000000000ea3';
const EUR = 100;
const euros = (amount: number) => amount * EUR;
const NOON = new Date('2026-10-19T10:00:00.000Z');
/** Lo que una transacción espera en la barrera a la otra antes de seguir sola. */
const BARRIER_TIMEOUT_MS = 500;
const SIMULTANEOUS_ROUNDS = 10;

let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let cycles: DrizzleCycleCandidates;
let matches: DrizzleMatchRepository;
let units: DrizzleDecisionUnitOfWork;

const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};

/** Una vivienda de valor fijo, publicada salvo que se pida otro estado. */
async function home(
  ownerId: string,
  valueEuros: number,
  status: Home['status'] = 'published',
): Promise<string> {
  const id = randomUUID();
  const draft = newDraft({
    id,
    ownerId,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: 'Calle del Pez, 12',
    location: LOCATION,
  });
  await homes.insert({
    ...draft,
    status,
    valueMinCents: euros(valueEuros),
    valueMaxCents: euros(valueEuros),
    publishedAt: status === 'published' ? new Date('2026-10-02T09:00:00.000Z') : null,
  });
  return id;
}

/** Preferencias del usuario (`homeId` nulo) o propias de una vivienda; si ya las tenía, se quedan. */
async function preferences(
  userId: string,
  homeId: string | null,
  terms: { maxToPay: number; minToReceive: number; pct?: number },
): Promise<void> {
  await sql`INSERT INTO search_preferences
              (id, user_id, home_id, municipalities, municipalities_normalized,
               max_to_pay_cents, min_to_receive_cents, value_reference_pct)
            VALUES (${randomUUID()}, ${userId}, ${homeId}, ${['Madrid']}, ${['madrid']},
                    ${euros(terms.maxToPay)}, ${euros(terms.minToReceive)}, ${terms.pct ?? 50})
            ON CONFLICT DO NOTHING`;
}

const like = (from: string, to: string, at = NOON) =>
  sql`INSERT INTO likes (from_home_id, to_home_id, created_at) VALUES (${from}, ${to}, ${at})`;

/** Guarda el match de un ciclo de dos ya aceptado por el dominio. */
async function savedMatch(first: string, second: string, createdAt = NOON): Promise<string> {
  const found = await cycles.findCycles(first, second);
  const evaluation = evaluateCycle(found[0] ?? []);
  if (!evaluation.accepted) throw new Error(`ciclo rechazado: ${evaluation.reason}`);
  return matches.saveMatch({ id: randomUUID(), createdAt, cycle: evaluation.match });
}

beforeAll(() => {
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    new AddressCipher(new Map([[1, randomBytes(32)]]), 1),
  );
  cycles = new DrizzleCycleCandidates(connection.db);
  matches = new DrizzleMatchRepository(connection.db);
  units = new DrizzleDecisionUnitOfWork(connection.db);
});

beforeEach(async () => {
  await sql`TRUNCATE matches, users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  for (const [id, n, name] of [
    [ME, 1, 'Ana'],
    [OTHER, 2, 'Beto'],
    [THIRD, 3, 'Carla'],
  ] as const) {
    await users.insertWithConsents(
      makeUser({
        id,
        firebaseUid: `uid-match-${String(n)}`,
        email: `match${String(n)}@example.com`,
        displayName: name,
      }),
      [],
    );
  }
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleCycleCandidates', () => {
  it('con la arista de vuelta devuelve el ciclo de dos en orden, con estado, valor y las preferencias efectivas de cada dueño', async () => {
    const mine = await home(ME, 200_000);
    const theirs = await home(OTHER, 212_000, 'paused');
    await preferences(ME, null, { maxToPay: 30_000, minToReceive: 0, pct: 40 });
    // Las propias de la vivienda sustituyen a las del usuario
    await preferences(OTHER, null, { maxToPay: 1, minToReceive: 1 });
    await preferences(OTHER, theirs, { maxToPay: 0, minToReceive: 5_000, pct: 60 });
    await like(theirs, mine);
    await like(mine, theirs);

    const found = await cycles.findCycles(mine, theirs);

    expect(found).toEqual([
      [
        {
          homeId: mine,
          ownerId: ME,
          status: 'published',
          valueMinCents: euros(200_000),
          valueMaxCents: euros(200_000),
          terms: { maxToPayCents: euros(30_000), minToReceiveCents: 0, valueReferencePct: 40 },
        },
        {
          homeId: theirs,
          ownerId: OTHER,
          status: 'paused',
          valueMinCents: euros(212_000),
          valueMaxCents: euros(212_000),
          terms: { maxToPayCents: 0, minToReceiveCents: euros(5_000), valueReferencePct: 60 },
        },
      ],
    ]);
  });

  it('sin la arista de vuelta no hay ciclo, y sin preferencias los límites quedan vacíos', async () => {
    const mine = await home(ME, 200_000);
    const theirs = await home(OTHER, 212_000);
    await like(mine, theirs);

    expect(await cycles.findCycles(mine, theirs)).toEqual([]);

    await like(theirs, mine);
    const [cycle] = await cycles.findCycles(mine, theirs);
    expect(cycle?.map((member) => member.terms)).toEqual([null, null]);
  });
});

describe('DrizzleMatchRepository', () => {
  async function pair(mineValue = 200_000, theirValue = 212_000) {
    const mine = await home(ME, mineValue);
    const theirs = await home(OTHER, theirValue);
    await preferences(ME, null, { maxToPay: 30_000, minToReceive: 0 });
    await preferences(OTHER, null, { maxToPay: 30_000, minToReceive: 0 });
    await like(mine, theirs);
    await like(theirs, mine);
    return { mine, theirs };
  }

  it('guarda el match con sus participantes y lo lee con el nombre de cada uno', async () => {
    const { mine, theirs } = await pair();

    const id = await savedMatch(mine, theirs);
    const found = await matches.findMatch(id);

    const [first, second] = [mine, theirs].sort();
    const compensation = (homeId: string | undefined) =>
      homeId === mine ? euros(12_000) : -euros(12_000);
    expect(found).toEqual({
      id,
      type: 2,
      status: 'open',
      createdAt: NOON,
      chatId: null,
      participants: [first, second].map((homeId) => ({
        homeId,
        userId: homeId === mine ? ME : OTHER,
        displayName: homeId === mine ? 'Ana' : 'Beto',
        givesHomeId: homeId,
        receivesHomeId: homeId === mine ? theirs : mine,
        compensationCents: compensation(homeId),
        status: 'pending',
      })),
    });
  });

  it('Scenario: Suma cero - las compensaciones guardadas de un match suman 0', async () => {
    const { mine, theirs } = await pair(200_000, 223_457);

    const id = await savedMatch(mine, theirs);

    const [row] = await sql<{ total: string }[]>`
      SELECT sum(compensation_cents)::text AS total FROM match_participants WHERE match_id = ${id}`;
    expect(row?.total).toBe('0');
  });

  it('Scenario: Un solo match por ciclo - guardar otra vez el mismo ciclo devuelve el match existente y no crea otro', async () => {
    const { mine, theirs } = await pair();
    const first = await savedMatch(mine, theirs);

    const second = await savedMatch(theirs, mine);

    expect(second).toBe(first);
    expect(await sql`SELECT 1 FROM matches`).toHaveLength(1);
    expect(await sql`SELECT 1 FROM match_participants`).toHaveLength(2);
  });

  it('findMatch de un id que no existe es null', async () => {
    expect(await matches.findMatch(randomUUID())).toBeNull();
  });

  it('isLikeInMatch: solo el me gusta de un match no cerrado, y en ese sentido', async () => {
    const { mine, theirs } = await pair();
    const stranger = await home(THIRD, 200_000);
    expect(await matches.isLikeInMatch(mine, theirs)).toBe(false);

    const id = await savedMatch(mine, theirs);

    expect(await matches.isLikeInMatch(mine, theirs)).toBe(true);
    expect(await matches.isLikeInMatch(theirs, mine)).toBe(true);
    expect(await matches.isLikeInMatch(mine, stranger)).toBe(false);
    expect(await matches.isLikeInMatch(stranger, mine)).toBe(false);
    await sql`UPDATE matches SET status = 'closed' WHERE id = ${id}`;
    expect(await matches.isLikeInMatch(mine, theirs)).toBe(false);
  });

  describe('listForUser', () => {
    it('Scenario: Ver mis matches - los suyos, del más reciente al más antiguo, y nunca los ajenos', async () => {
      const older = await pair();
      const newer = await pair();
      const foreignA = await home(OTHER, 200_000);
      const foreignB = await home(THIRD, 200_000);
      await preferences(THIRD, null, { maxToPay: 30_000, minToReceive: 0 });
      await like(foreignA, foreignB);
      await like(foreignB, foreignA);
      const olderId = await savedMatch(older.mine, older.theirs, new Date('2026-10-18T10:00:00Z'));
      const newerId = await savedMatch(newer.mine, newer.theirs, new Date('2026-10-19T10:00:00Z'));
      const foreignId = await savedMatch(foreignA, foreignB, new Date('2026-10-20T10:00:00Z'));

      const mine = await matches.listForUser({ userId: ME, limit: 10 });
      const theirs = await matches.listForUser({ userId: OTHER, limit: 10 });
      const third = await matches.listForUser({ userId: THIRD, limit: 10 });

      expect(mine.map((match) => match.id)).toEqual([newerId, olderId]);
      expect(mine[0]?.participants).toHaveLength(2);
      expect(theirs.map((match) => match.id)).toEqual([foreignId, newerId, olderId]);
      expect(third.map((match) => match.id)).toEqual([foreignId]);
    });

    it('Scenario: Sin matches - un usuario sin matches recibe una lista vacía', async () => {
      await pair();

      expect(await matches.listForUser({ userId: ME, limit: 10 })).toEqual([]);
    });

    it('pagina tras el cursor (fecha e id) y filtra por estado', async () => {
      const ids: string[] = [];
      for (const day of [17, 18, 19]) {
        const { mine, theirs } = await pair();
        ids.push(await savedMatch(mine, theirs, new Date(Date.UTC(2026, 9, day, 10))));
      }
      await sql`UPDATE matches SET status = 'closed' WHERE id = ${ids[0] ?? ''}`;

      const firstPage = await matches.listForUser({ userId: ME, limit: 2 });
      const after = { at: new Date(Date.UTC(2026, 9, 18, 10)), id: ids[1] ?? '' };
      const secondPage = await matches.listForUser({ userId: ME, after, limit: 2 });
      const closed = await matches.listForUser({ userId: ME, status: 'closed', limit: 10 });
      const open = await matches.listForUser({ userId: ME, status: 'open', limit: 10 });

      expect(firstPage.map((match) => match.id)).toEqual([ids[2], ids[1]]);
      expect(secondPage.map((match) => match.id)).toEqual([ids[0]]);
      expect(closed.map((match) => match.id)).toEqual([ids[0]]);
      expect(open.map((match) => match.id)).toEqual([ids[2], ids[1]]);
    });
  });
});

/** Barrera de dos con espera acotada: si la otra transacción no llega (está bloqueada), se sigue. */
function barrier() {
  let arrived = 0;
  let release: () => void = () => undefined;
  const together = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    async arrive(): Promise<void> {
      arrived += 1;
      if (arrived >= 2) release();
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, BARRIER_TIMEOUT_MS);
      });
      await Promise.race([together, timeout]);
      clearTimeout(timer);
    },
  };
}

/**
 * Cada transacción espera a la otra justo después de insertar su me gusta, sin confirmar: sin el
 * bloqueo del par las dos buscarían el ciclo a la vez, ninguna vería la arista de la otra y no se
 * formaría el match.
 */
function unitsWithBarrier(
  inner: DecisionUnitOfWork,
  gate: ReturnType<typeof barrier>,
): DecisionUnitOfWork {
  return {
    run: (work) =>
      inner.run((store, matching) => {
        const waiting = Object.create(store) as DecisionStore;
        waiting.insertLike = async (from, to, at) => {
          await store.insertLike(from, to, at);
          await gate.arrive();
        };
        return work(waiting, matching);
      }),
  };
}

describe('Scenario: Me gusta simultáneos - con PostgreSQL real', () => {
  it(`dos me gusta cruzados a la vez, ${String(SIMULTANEOUS_ROUNDS)} veces: siempre exactamente un match y ninguna petición falla`, async () => {
    for (let round = 0; round < SIMULTANEOUS_ROUNDS; round += 1) {
      const mine = await home(ME, 200_000);
      const theirs = await home(OTHER, 212_000);
      if (round === 0) {
        await preferences(ME, null, { maxToPay: 30_000, minToReceive: 0 });
        await preferences(OTHER, null, { maxToPay: 30_000, minToReceive: 0 });
      }
      const operations = decisionOperations({
        homes,
        units: unitsWithBarrier(units, barrier()),
        matches,
        clock: { now: () => NOON },
        ids: { next: () => randomUUID() },
        likesPerDay: 1_000,
      });

      const results = await Promise.all([
        operations.likeHome(ME, { fromHomeId: mine, targetHomeId: theirs }),
        operations.likeHome(OTHER, { fromHomeId: theirs, targetHomeId: mine }),
      ]);

      const withMatch = results.filter((result) => result.match !== null);
      const stored = await sql<{ id: string }[]>`
        SELECT id FROM matches WHERE cycle_key = ${cycleKey([mine, theirs])}`;
      expect(results.every((result) => result.liked)).toBe(true);
      expect(stored, `ronda ${String(round)}`).toHaveLength(1);
      expect(withMatch.map((result) => result.match?.id)).toEqual([stored[0]?.id]);
    }
  });
});

describe('DrizzleDecisionUnitOfWork', () => {
  it('el bloqueo del par serializa dos transacciones sobre las mismas viviendas', async () => {
    const order: string[] = [];
    const key = cycleKey([randomUUID(), randomUUID()]);
    let unlockFirst: () => void = () => undefined;
    const firstHolds = new Promise<void>((resolve) => {
      unlockFirst = resolve;
    });
    let firstLocked: () => void = () => undefined;
    const lockedOnce = new Promise<void>((resolve) => {
      firstLocked = resolve;
    });

    const first = units.run(async (store) => {
      await store.lockPair(key);
      order.push('first-locked');
      firstLocked();
      await firstHolds;
      order.push('first-done');
    });
    await lockedOnce;
    const second = units.run(async (store) => {
      await store.lockPair(key);
      order.push('second-locked');
    });
    setTimeout(unlockFirst, 200);
    await Promise.all([first, second]);

    expect(order).toEqual(['first-locked', 'first-done', 'second-locked']);
  });

  it('si el trabajo falla tras crear el match, ni el match ni sus participantes quedan guardados', async () => {
    const mine = await home(ME, 200_000);
    const theirs = await home(OTHER, 200_000);
    await preferences(ME, null, { maxToPay: 0, minToReceive: 0 });
    await preferences(OTHER, null, { maxToPay: 0, minToReceive: 0 });
    await like(theirs, mine);

    const failing = units.run(async (store, matching) => {
      await store.insertLike(mine, theirs, NOON);
      const [cycle] = await matching.cycles.findCycles(mine, theirs);
      const evaluation = evaluateCycle(cycle ?? []);
      if (!evaluation.accepted) throw new Error('debía aceptarse');
      const match: NewMatch = { id: randomUUID(), createdAt: NOON, cycle: evaluation.match };
      await matching.matches.saveMatch(match);
      throw new Error('fallo a mitad');
    });

    await expect(failing).rejects.toThrow('fallo a mitad');
    expect(await sql`SELECT 1 FROM matches`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM match_participants`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM likes`).toHaveLength(1);
  });
});
