import { randomBytes, randomUUID } from 'node:crypto';

import fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { decisionOperations } from '../../../application/decision/decision-operations.js';
import type {
  DecisionStore,
  DecisionUnitOfWork,
} from '../../../application/decision/decision-repository.js';
import { LikeInMatchError } from '../../../application/decision/errors.js';
import type { MatchWriter } from '../../../application/matching/matching-repository.js';
import { type Home, newDraft } from '../../../domain/home/home.js';
import { cycleKey, evaluateCycle, MAX_CYCLE_LENGTH } from '../../../domain/matching/cycle.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleCycleCandidates } from './drizzle-cycle-candidates.js';
import { DrizzleDecisionUnitOfWork } from './drizzle-decision-unit-of-work.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const ANA = '0199c1a2-0000-7000-8000-000000000ca1';
const BETO = '0199c1a2-0000-7000-8000-000000000ca2';
const CARLA = '0199c1a2-0000-7000-8000-000000000ca3';
const DANI = '0199c1a2-0000-7000-8000-000000000ca4';
const OWNERS = [ANA, BETO, CARLA, DANI] as const;
const EUR = 100;
const euros = (amount: number) => amount * EUR;
const NOON = new Date('2026-10-19T10:00:00.000Z');
const BEFORE = new Date('2026-10-18T10:00:00.000Z');
/** Lo que una transacción espera en la barrera a las demás antes de seguir sola. */
const BARRIER_TIMEOUT_MS = 500;
const SIMULTANEOUS_ROUNDS = 10;
const PROPERTY_RUNS = 25;

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

/** Preferencias del usuario para todas sus viviendas. */
async function preferences(
  userId: string,
  terms: { maxToPay: number; minToReceive: number },
): Promise<void> {
  await sql`INSERT INTO search_preferences
              (id, user_id, home_id, municipalities, municipalities_normalized,
               max_to_pay_cents, min_to_receive_cents, value_reference_pct)
            VALUES (${randomUUID()}, ${userId}, ${null}, ${['Madrid']}, ${['madrid']},
                    ${euros(terms.maxToPay)}, ${euros(terms.minToReceive)}, 50)
            ON CONFLICT DO NOTHING`;
}

const like = (from: string, to: string, at = NOON) =>
  sql`INSERT INTO likes (from_home_id, to_home_id, created_at) VALUES (${from}, ${to}, ${at})`;

function operations(decisionUnits: DecisionUnitOfWork = units) {
  return decisionOperations({
    homes,
    units: decisionUnits,
    matches,
    clock: { now: () => NOON },
    ids: { next: () => randomUUID() },
    likesPerDay: 1_000,
  });
}

/**
 * A (Ana, 200.000 €), B (Beto, 210.000 €) y C (Carla, 230.000 €), con B → C y C → A ya dados: el me
 * gusta de A a B cierra la cadena. Ana paga 10.000 €, Beto 20.000 € y Carla recibe 30.000 €.
 */
async function chain(carlaMinToReceive = 0) {
  const a = await home(ANA, 200_000);
  const b = await home(BETO, 210_000);
  const c = await home(CARLA, 230_000);
  await preferences(ANA, { maxToPay: 50_000, minToReceive: 0 });
  await preferences(BETO, { maxToPay: 50_000, minToReceive: 0 });
  await preferences(CARLA, { maxToPay: 50_000, minToReceive: carlaMinToReceive });
  return { a, b, c };
}

/** Ningún match abierto puede usar un me gusta que ya no existe. */
const participantsWithoutLike = () => sql`
  SELECT 1 FROM match_participants p
  JOIN matches m ON m.id = p.match_id
  WHERE m.status <> 'closed'
    AND NOT EXISTS (SELECT 1 FROM likes l
                    WHERE l.from_home_id = p.gives_home_id AND l.to_home_id = p.receives_home_id)`;

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
  for (const [index, id] of OWNERS.entries()) {
    await users.insertWithConsents(
      makeUser({
        id,
        firebaseUid: `uid-chain-${String(index)}`,
        email: `chain${String(index)}@example.com`,
        displayName: ['Ana', 'Beto', 'Carla', 'Dani'][index] ?? 'Sin nombre',
      }),
      [],
    );
  }
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleCycleCandidates con ciclos de tres', () => {
  it('devuelve la cadena [X, Y, Z] con estado, valor y preferencias de cada dueño', async () => {
    const { a, b, c } = await chain();
    await like(b, c);
    await like(c, a);
    await like(a, b);

    const found = await cycles.findCycles(a, b);

    expect(found.map((cycle) => cycle.map((member) => member.homeId))).toEqual([[a, b, c]]);
    expect(found[0]?.[2]).toEqual({
      homeId: c,
      ownerId: CARLA,
      status: 'published',
      valueMinCents: euros(230_000),
      valueMaxCents: euros(230_000),
      terms: { maxToPayCents: euros(50_000), minToReceiveCents: 0, valueReferencePct: 50 },
    });
  });

  it('el directo va primero y después las cadenas', async () => {
    const { a, b, c } = await chain();
    await like(b, a);
    await like(b, c);
    await like(c, a);
    await like(a, b);

    const found = await cycles.findCycles(a, b);

    expect(found.map((cycle) => cycle.map((member) => member.homeId))).toEqual([
      [a, b],
      [a, b, c],
    ]);
  });

  it('ordena las cadenas por la antigüedad de su me gusta más reciente y, a igualdad, por vivienda', async () => {
    const a = await home(ANA, 200_000);
    const b = await home(BETO, 200_000);
    const [recent, old, tieFirst, tieSecond] = await Promise.all([
      home(CARLA, 200_000),
      home(CARLA, 200_000),
      home(DANI, 200_000),
      home(DANI, 200_000),
    ]);
    const ties = [tieFirst, tieSecond].sort();
    await like(b, recent, BEFORE);
    await like(recent, a, NOON);
    await like(b, old, new Date('2026-10-17T10:00:00.000Z'));
    await like(old, a, BEFORE);
    for (const tie of ties) {
      await like(b, tie, new Date('2026-10-18T12:00:00.000Z'));
      await like(tie, a, new Date('2026-10-18T12:00:00.000Z'));
    }
    await like(a, b);

    const found = await cycles.findCycles(a, b);

    expect(found.map((cycle) => cycle[2]?.homeId)).toEqual([old, ...ties, recent]);
  });

  it('no forma cadena con una tercera vivienda no publicada ni de uno de los otros dos propietarios', async () => {
    const a = await home(ANA, 200_000);
    const b = await home(BETO, 200_000);
    const paused = await home(CARLA, 200_000, 'paused');
    const anasOther = await home(ANA, 200_000);
    const betosOther = await home(BETO, 200_000);
    for (const z of [paused, anasOther, betosOther]) {
      await like(b, z);
      await like(z, a);
    }
    await like(a, b);

    expect(await cycles.findCycles(a, b)).toEqual([]);
  });

  it('Scenario: Nunca más de tres - un ciclo de cuatro viviendas no es candidato', async () => {
    const a = await home(ANA, 200_000);
    const b = await home(BETO, 200_000);
    const c = await home(CARLA, 200_000);
    const d = await home(DANI, 200_000);
    await like(b, c);
    await like(c, d);
    await like(d, a);
    await like(a, b);

    expect(await cycles.findCycles(a, b)).toEqual([]);
  });

  it(`propiedad: en grafos aleatorios solo hay ciclos de 2 o 3 que existen, sin repetir y todas las cadenas posibles (${String(PROPERTY_RUNS)} grafos)`, async () => {
    const graph = fc
      .integer({ min: 4, max: 7 })
      .chain((size) =>
        fc.record({
          owners: fc.array(fc.integer({ min: 0, max: OWNERS.length - 1 }), {
            minLength: size,
            maxLength: size,
          }),
          published: fc.array(fc.boolean(), { minLength: size, maxLength: size }),
          edges: fc.uniqueArray(
            fc
              .tuple(fc.nat({ max: size - 1 }), fc.nat({ max: size - 1 }))
              .filter(([from, to]) => from !== to),
            { selector: ([from, to]) => `${String(from)}>${String(to)}`, maxLength: size * 4 },
          ),
          values: fc.array(fc.integer({ min: 150_000, max: 250_000 }), {
            minLength: size,
            maxLength: size,
          }),
        }),
      )
      // La arista nueva sale de la vivienda 0 (Ana) hacia la 1 (Beto), como en un me gusta real
      .map((generated) => ({
        ...generated,
        owners: [0, 1, ...generated.owners.slice(2)],
        published: [true, true, ...generated.published.slice(2)],
        edges: generated.edges.filter(([from, to]) => !(from === 0 && to === 1)),
      }));

    await preferences(ANA, { maxToPay: 30_000, minToReceive: 0 });
    await preferences(BETO, { maxToPay: 30_000, minToReceive: 0 });
    await preferences(CARLA, { maxToPay: 30_000, minToReceive: 0 });
    await preferences(DANI, { maxToPay: 30_000, minToReceive: 0 });

    await fc.assert(
      fc.asyncProperty(graph, async ({ owners, published, edges, values }) => {
        const ownerOf = owners.map((index) => OWNERS[index] ?? ANA);
        const ids: string[] = [];
        for (const [index, ownerId] of ownerOf.entries()) {
          ids.push(
            await home(
              ownerId,
              values[index] ?? 200_000,
              published[index] ? 'published' : 'paused',
            ),
          );
        }
        const id = (index: number) => ids[index] ?? '';
        const newEdge: [number, number] = [0, 1];
        const edgeSet = new Set([...edges, newEdge].map(([from, to]) => `${id(from)}>${id(to)}`));
        for (const [from, to] of edges) await like(id(from), id(to));
        await like(id(0), id(1));

        const found = await cycles.findCycles(id(0), id(1));

        const keys = found.map((cycle) => cycleKey(cycle.map((member) => member.homeId)));
        expect(new Set(keys).size).toBe(found.length);
        for (const cycle of found) {
          const homeIds = cycle.map((member) => member.homeId);
          expect(cycle.length).toBeGreaterThanOrEqual(2);
          expect(cycle.length).toBeLessThanOrEqual(MAX_CYCLE_LENGTH);
          expect(homeIds.slice(0, 2)).toEqual([id(0), id(1)]);
          expect(new Set(homeIds).size).toBe(cycle.length);
          for (const [at, from] of homeIds.entries()) {
            const to = homeIds[(at + 1) % homeIds.length] ?? '';
            expect(edgeSet.has(`${from}>${to}`)).toBe(true);
          }
          if (cycle.length === 3) {
            expect(new Set(cycle.map((member) => member.ownerId)).size).toBe(3);
            expect(cycle[2]?.status).toBe('published');
          }
          const evaluation = evaluateCycle(cycle);
          if (evaluation.accepted) {
            const total = evaluation.match.participants.reduce(
              (sum, participant) => sum + participant.compensationCents,
              0,
            );
            expect(total).toBe(0);
          }
        }
        const direct = edgeSet.has(`${id(1)}>${id(0)}`);
        expect(found[0]?.length === 2).toBe(direct);
        const expectedThirds = ids
          .map((third, index) => ({ third, index }))
          .filter(
            ({ third, index }) =>
              index > 1 &&
              published[index] === true &&
              ownerOf[index] !== ownerOf[0] &&
              ownerOf[index] !== ownerOf[1] &&
              edgeSet.has(`${id(1)}>${third}`) &&
              edgeSet.has(`${third}>${id(0)}`),
          )
          .map(({ third }) => third)
          .sort();
        const thirds = found
          .filter((cycle) => cycle.length === 3)
          .map((cycle) => cycle[2]?.homeId ?? '')
          .sort();
        expect(thirds).toEqual(expectedThirds);
      }),
      { numRuns: PROPERTY_RUNS },
    );
  });
});

describe('likeHome con PostgreSQL: match en cadena', () => {
  it('Scenario: Cadena compatible - crea el match de tres, cada uno entrega al siguiente y recibe del anterior, y la suma es 0', async () => {
    const { a, b, c } = await chain();
    await like(b, c);
    await like(c, a);

    const result = await operations().likeHome(ANA, { fromHomeId: a, targetHomeId: b });

    expect(result.match).toMatchObject({ type: 3, status: 'open' });
    const id = result.match?.id ?? '';
    const stored = await matches.findMatch(id);
    expect(stored?.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          homeId: a,
          userId: ANA,
          displayName: 'Ana',
          givesHomeId: a,
          receivesHomeId: b,
          compensationCents: euros(10_000),
          status: 'pending',
        }),
        expect.objectContaining({
          homeId: b,
          userId: BETO,
          givesHomeId: b,
          receivesHomeId: c,
          compensationCents: euros(20_000),
        }),
        expect.objectContaining({
          homeId: c,
          userId: CARLA,
          givesHomeId: c,
          receivesHomeId: a,
          compensationCents: -euros(30_000),
        }),
      ]),
    );
    expect(stored?.participants).toHaveLength(3);
    const [row] = await sql<{ total: string; type: number; key: string }[]>`
      SELECT sum(p.compensation_cents)::text AS total, m.type, m.cycle_key AS key
      FROM matches m JOIN match_participants p ON p.match_id = m.id
      WHERE m.id = ${id} GROUP BY m.id`;
    expect(row).toEqual({ total: '0', type: 3, key: cycleKey([a, b, c]) });
  });

  it('el match en cadena aparece en la lista de los tres y bloquea deshacer cualquiera de sus me gusta', async () => {
    const { a, b, c } = await chain();
    await like(b, c);
    await like(c, a);
    const { match } = await operations().likeHome(ANA, { fromHomeId: a, targetHomeId: b });

    for (const userId of [ANA, BETO, CARLA]) {
      const listed = await matches.listForUser({ userId, limit: 10 });
      expect(listed.map((found) => found.id)).toEqual([match?.id]);
      expect(listed[0]?.participants).toHaveLength(3);
    }
    expect(await matches.listForUser({ userId: DANI, limit: 10 })).toEqual([]);
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      expect(await matches.isLikeInMatch(from, to)).toBe(true);
      expect(await matches.isLikeInMatch(to, from)).toBe(false);
    }
    await expect(operations().undoLastAction(BETO, b)).rejects.toBeInstanceOf(LikeInMatchError);
  });

  it('Scenario: Un eslabón incompatible - si Carla no acepta recibir tan poco, no se crea el match', async () => {
    const { a, b, c } = await chain(40_000);
    await like(b, c);
    await like(c, a);

    const result = await operations().likeHome(ANA, { fromHomeId: a, targetHomeId: b });

    expect(result).toEqual({ liked: true, match: null });
    expect(await sql`SELECT 1 FROM matches`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM likes`).toHaveLength(3);
  });

  it('Scenario: Nunca más de tres - el me gusta que cierra un ciclo de cuatro no crea ningún match', async () => {
    const { a, b, c } = await chain();
    const d = await home(DANI, 215_000);
    await preferences(DANI, { maxToPay: 50_000, minToReceive: 0 });
    await like(b, c);
    await like(c, d);
    await like(d, a);

    const result = await operations().likeHome(ANA, { fromHomeId: a, targetHomeId: b });

    expect(result).toEqual({ liked: true, match: null });
    expect(await sql`SELECT 1 FROM matches`).toHaveLength(0);
  });

  it('Scenario: Directo y en cadena a la vez - se crea el directo, una sola vez, y no la cadena con las mismas viviendas', async () => {
    const { a, b, c } = await chain();
    await like(b, a);
    await like(b, c);
    await like(c, a);

    const result = await operations().likeHome(ANA, { fromHomeId: a, targetHomeId: b });

    expect(result.match).toMatchObject({ type: 2 });
    const stored = await sql<{ key: string }[]>`SELECT cycle_key AS key FROM matches`;
    expect(stored).toEqual([{ key: cycleKey([a, b]) }]);
  });

  it('si el directo no es aceptable, se crea la cadena', async () => {
    const a = await home(ANA, 200_000);
    const b = await home(BETO, 210_000);
    const c = await home(CARLA, 215_000);
    await preferences(ANA, { maxToPay: 50_000, minToReceive: 0 });
    // En el directo Beto recibiría 10.000 € y pide al menos 15.000 €; en la cadena paga 5.000 €
    await preferences(BETO, { maxToPay: 5_000, minToReceive: 15_000 });
    await preferences(CARLA, { maxToPay: 50_000, minToReceive: 0 });
    await like(b, a);
    await like(b, c);
    await like(c, a);

    const result = await operations().likeHome(ANA, { fromHomeId: a, targetHomeId: b });

    expect(result.match).toMatchObject({ type: 3 });
    expect(await sql`SELECT 1 FROM matches`).toHaveLength(1);
  });
});

/** Barrera de `parties` con espera acotada: si alguna transacción no llega (está bloqueada), se sigue. */
function barrier(parties: number) {
  let arrived = 0;
  let release: () => void = () => undefined;
  const together = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    async arrive(): Promise<void> {
      arrived += 1;
      if (arrived >= parties) release();
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, BARRIER_TIMEOUT_MS);
      });
      await Promise.race([together, timeout]);
      clearTimeout(timer);
    },
  };
}

type Gate = ReturnType<typeof barrier>;

/**
 * Cada me gusta espera a los demás justo después de insertarse, sin confirmar, y cada deshacer
 * justo después de borrar: sin un bloqueo común ninguna transacción vería la arista de las otras.
 */
function unitsWithBarrier(inner: DecisionUnitOfWork, gate: Gate): DecisionUnitOfWork {
  return {
    run: (work) =>
      inner.run((store, matching) => {
        const waiting = Object.create(store) as DecisionStore;
        waiting.insertLike = async (from, to, at) => {
          await store.insertLike(from, to, at);
          await gate.arrive();
        };
        waiting.deleteLike = async (from, to) => {
          await store.deleteLike(from, to);
          await gate.arrive();
        };
        return work(waiting, matching);
      }),
  };
}

/** El me gusta espera a los demás tras buscar los ciclos y antes de guardar el match. */
function unitsPausingBeforeSave(inner: DecisionUnitOfWork, gate: Gate): DecisionUnitOfWork {
  return {
    run: (work) =>
      inner.run((store, matching) => {
        const writer = Object.create(matching.matches) as MatchWriter;
        writer.saveMatch = async (match) => {
          await gate.arrive();
          return matching.matches.saveMatch(match);
        };
        return work(store, { cycles: matching.cycles, matches: writer });
      }),
  };
}

describe('Scenario: Cadena compatible - con me gusta simultáneos en PostgreSQL real', () => {
  it(`los tres me gusta de una cadena a la vez, ${String(SIMULTANEOUS_ROUNDS)} veces: siempre exactamente un match de tres y ninguna petición falla`, async () => {
    for (let round = 0; round < SIMULTANEOUS_ROUNDS; round += 1) {
      const { a, b, c } = await chain();
      const concurrent = operations(unitsWithBarrier(units, barrier(3)));

      const results = await Promise.all([
        concurrent.likeHome(ANA, { fromHomeId: a, targetHomeId: b }),
        concurrent.likeHome(BETO, { fromHomeId: b, targetHomeId: c }),
        concurrent.likeHome(CARLA, { fromHomeId: c, targetHomeId: a }),
      ]);

      const label = `ronda ${String(round)}`;
      const stored = await sql<{ id: string; type: number }[]>`
        SELECT id, type FROM matches WHERE cycle_key = ${cycleKey([a, b, c])}`;
      expect(results.every((result) => result.liked)).toBe(true);
      expect(stored, label).toEqual([{ id: expect.any(String) as string, type: 3 }]);
      const returned = results.flatMap((result) => (result.match ? [result.match.id] : []));
      expect(returned, label).toEqual([stored[0]?.id]);
    }
  });

  it(`deshacer un eslabón mientras otro me gusta cierra la cadena, ${String(SIMULTANEOUS_ROUNDS)} veces: nunca queda un match sin su me gusta`, async () => {
    for (let round = 0; round < SIMULTANEOUS_ROUNDS; round += 1) {
      const { a, b, c } = await chain();
      await like(b, c);
      await like(c, a);
      const gate = barrier(2);
      const closing = operations(unitsPausingBeforeSave(units, gate));
      const undoing = operations(unitsWithBarrier(units, gate));

      const [liked, undone] = await Promise.allSettled([
        closing.likeHome(ANA, { fromHomeId: a, targetHomeId: b }),
        undoing.undoLastAction(BETO, b),
      ]);

      const label = `ronda ${String(round)}`;
      expect(liked.status, label).toBe('fulfilled');
      expect(await participantsWithoutLike(), label).toHaveLength(0);
      const created = liked.status === 'fulfilled' && liked.value.match !== null;
      // O se creó la cadena y no se pudo deshacer, o se deshizo antes y no hay cadena
      expect(undone.status, label).toBe(created ? 'rejected' : 'fulfilled');
      if (undone.status === 'rejected') expect(undone.reason).toBeInstanceOf(LikeInMatchError);
    }
  });
});
