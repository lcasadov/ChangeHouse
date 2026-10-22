import { randomBytes, randomUUID } from 'node:crypto';

import { type SQL, sql as drizzleSql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { decisionOperations } from '../../../application/decision/decision-operations.js';
import { newDraft } from '../../../domain/home/home.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection, type Executor } from './database.js';
import { DrizzleCycleCandidates } from './drizzle-cycle-candidates.js';
import { DrizzleDecisionUnitOfWork } from './drizzle-decision-unit-of-work.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

/** Volumen objetivo de RNF-20. */
const HOMES = 50_000;
const LIKES = 500_000;
/** Grafo denso alrededor de la vivienda probada: Y da me gusta a 2.000 viviendas, 1.000 de ellas a X. */
const DENSE_OUT = 2_000;
const DENSE_CYCLES = 1_000;
/** La única cadena aceptable es la centésima más antigua: se evalúan todas las anteriores. */
const COMPATIBLE_POSITION = 100;
const COMPATIBLE_THIRD = `00000000-0000-4000-8000-${COMPATIBLE_POSITION.toString(16).padStart(12, '0')}`;
const DETECTION_BUDGET_MS = 1_000;
const EUR = 100;
const euros = (amount: number) => amount * EUR;
const NOW = new Date('2026-10-19T10:00:00.000Z');
const LOAD_TIMEOUT_MS = 170_000;
const BULK_OWNERS = 5_000;
/** Puntos repartidos por Madrid: con todos iguales, las estadísticas de PostGIS tardan minutos. */
const POINT =
  'ST_SetSRID(ST_MakePoint(-3.8 + random() * 0.2, 40.3 + random() * 0.2), 4326)::geography';

const sql = openSql();
let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let x = '';
let y = '';
let warmUpTarget = '';

/** Una vivienda publicada creada como en la aplicación (con la dirección cifrada). */
async function realHome(ownerId: string): Promise<string> {
  const id = randomUUID();
  const draft = newDraft({
    id,
    ownerId,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: 'Calle del Pez, 12',
    location: {
      exact: { lat: 40.4254, lng: -3.7058 },
      areaName: 'Malasaña',
      areaCenter: { lat: 40.4265, lng: -3.7038 },
    },
  });
  await homes.insert({
    ...draft,
    status: 'published',
    valueMinCents: euros(200_000),
    valueMaxCents: euros(200_000),
    publishedAt: new Date('2026-10-02T09:00:00.000Z'),
  });
  return id;
}

/** Id determinista de la vivienda (o del usuario) generada número `n`, en SQL. */
const generatedId = (prefix: string, n: string) =>
  `('00000000-0000-4000-${prefix}-' || lpad(to_hex(${n}), 12, '0'))::uuid`;
const homeId = (n: string) => generatedId('8000', n);
const userId = (n: string) => generatedId('9000', n);

/**
 * 50.000 viviendas publicadas (X, Y y la del calentamiento creadas por el repositorio; el resto en
 * bloque, de 5.000 propietarios), preferencias para todos, el grafo denso alrededor de Y → X y me
 * gusta aleatorios hasta superar los 500.000, posteriores a los del grafo denso. La carga en bloque
 * desactiva las claves ajenas: los datos son válidos por construcción.
 */
async function loadVolume(): Promise<void> {
  await sql`TRUNCATE matches, users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  const owners: [string, string, string] = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, id] of owners.entries()) {
    await users.insertWithConsents(
      makeUser({
        id,
        firebaseUid: `uid-volume-${String(index)}`,
        email: `volume${String(index)}@example.com`,
      }),
      [],
    );
  }
  [x, y, warmUpTarget] = await Promise.all([
    realHome(owners[0]),
    realHome(owners[1]),
    realHome(owners[2]),
  ]);
  const bulkHomes = HOMES - owners.length;
  const thirds = sql.unsafe(`${homeId('t.n')}`);

  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`
      INSERT INTO users (id, firebase_uid, email, display_name)
      SELECT ${sql.unsafe(userId('n'))}, 'perf-' || n, 'perf-' || n || '@example.com', 'Perf'
      FROM generate_series(1, ${BULK_OWNERS}) AS n`;
    await tx`
      INSERT INTO homes (id, owner_id, type, status, value_min_cents, value_max_cents,
                         exact_address, exact_location, approx_location, area_name, published_at)
      SELECT ${sql.unsafe(homeId('n'))}, ${sql.unsafe(userId(`1 + (n - 1) % ${String(BULK_OWNERS)}`))},
             'piso', 'published', ${euros(200_000)}, ${euros(200_000)}, '\\x00'::bytea,
             ${sql.unsafe(POINT)}, ${sql.unsafe(POINT)}, 'Malasaña', ${NOW}
      FROM generate_series(1, ${bulkHomes}) AS n`;
    await tx`
      INSERT INTO search_preferences (id, user_id, home_id, municipalities,
                                      municipalities_normalized, max_to_pay_cents,
                                      min_to_receive_cents, value_reference_pct)
      SELECT gen_random_uuid(), u.id, NULL, ${['Madrid']}, ${['madrid']},
             CASE WHEN u.id = ${owners[1]}::uuid THEN ${euros(10_000)}::bigint
                  ELSE ${euros(1_000_000)}::bigint END,
             0, 50
      FROM users u`;
    // Todas las cadenas menos la centésima son inaceptables: Beto (Y) pagaría 60.000 € y su máximo
    // es 10.000 €
    await tx`
      UPDATE homes SET value_min_cents = ${euros(260_000)}, value_max_cents = ${euros(260_000)}
      WHERE id BETWEEN ${sql.unsafe(homeId('1'))} AND ${sql.unsafe(homeId(String(DENSE_OUT)))}
        AND id <> ${sql.unsafe(homeId(String(COMPATIBLE_POSITION)))}`;
    // Y → Z para las 2.000 primeras y Z → X para las 1.000 primeras, cada una un minuto después
    await tx`
      INSERT INTO likes (from_home_id, to_home_id, created_at)
      SELECT ${y}::uuid, ${thirds}, ${NOW}::timestamptz - interval '30 days' + t.n * interval '1 minute'
      FROM generate_series(1, ${DENSE_OUT}) AS t(n)`;
    await tx`
      INSERT INTO likes (from_home_id, to_home_id, created_at)
      SELECT ${thirds}, ${x}::uuid, ${NOW}::timestamptz - interval '30 days' + t.n * interval '1 minute'
      FROM generate_series(1, ${DENSE_CYCLES}) AS t(n)`;
    // Sin repetidos: los aleatorios unen solo viviendas en bloque, así que no chocan con los densos
    await tx`
      INSERT INTO likes (from_home_id, to_home_id, created_at)
      SELECT ${sql.unsafe(homeId('p.a'))}, ${sql.unsafe(homeId('p.b'))}, min(p.at)
      FROM (SELECT 1 + floor(random() * ${bulkHomes})::int AS a,
                   1 + floor(random() * ${bulkHomes})::int AS b,
                   ${NOW}::timestamptz - random() * interval '20 days' AS at
            FROM generate_series(1, ${LIKES + LIKES / 100})) AS p
      WHERE p.a <> p.b
      GROUP BY p.a, p.b
      ORDER BY p.a, p.b`;
  });
  await sql`ANALYZE likes, homes, users, search_preferences`;
}

beforeAll(async () => {
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    new AddressCipher(new Map([[1, randomBytes(32)]]), 1),
  );
  await loadVolume();
}, LOAD_TIMEOUT_MS);

afterAll(async () => {
  await sql`TRUNCATE matches, users CASCADE`;
  await connection.close();
  await sql.end();
});

describe('detección de matches con el volumen objetivo (RNF-20)', () => {
  it('el volumen cargado es el objetivo', async () => {
    const [counts] = await sql<{ homes: number; likes: number }[]>`
      SELECT (SELECT count(*)::int FROM homes WHERE status = 'published') AS homes,
             (SELECT count(*)::int FROM likes) AS likes`;
    expect(counts?.homes).toBe(HOMES);
    expect(counts?.likes).toBeGreaterThanOrEqual(LIKES);
  });

  it(`Scenario: Volumen objetivo - el me gusta que cierra ${String(DENSE_CYCLES)} cadenas registra la arista y crea el match en menos de ${String(DETECTION_BUDGET_MS)} ms`, async () => {
    const operations = decisionOperations({
      homes,
      units: new DrizzleDecisionUnitOfWork(connection.db),
      matches: new DrizzleMatchRepository(connection.db),
      clock: { now: () => NOW },
      ids: { next: () => randomUUID() },
      likesPerDay: 1_000,
    });
    const [owner] = await sql<{ owner_id: string }[]>`SELECT owner_id FROM homes WHERE id = ${x}`;
    const xOwner = owner?.owner_id ?? '';
    // Calentamiento: la primera petición abre conexiones y prepara el pool
    await operations.likeHome(xOwner, { fromHomeId: x, targetHomeId: warmUpTarget });

    const started = performance.now();
    const result = await operations.likeHome(xOwner, { fromHomeId: x, targetHomeId: y });
    const elapsed = performance.now() - started;

    expect(result.match?.type).toBe(3);
    expect(result.match?.participants.map((p) => p.homeId).sort()).toEqual(
      [x, y, COMPATIBLE_THIRD].sort(),
    );
    expect(elapsed, `${elapsed.toFixed(0)} ms`).toBeLessThan(DETECTION_BUDGET_MS);
  });

  it('EXPLAIN ANALYZE: la búsqueda de ciclos lee likes solo por sus índices, sin recorrerla entera', async () => {
    const captured: SQL[] = [];
    const recording = new Proxy(connection.db, {
      get(target, property, receiver) {
        if (property === 'execute') {
          return (query: SQL) => {
            captured.push(query);
            return target.execute(query);
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    }) as unknown as Executor;
    await new DrizzleCycleCandidates(recording).findCycles(x, y);
    const [candidates] = captured;
    if (!candidates) throw new Error('no se ejecutó la búsqueda de ciclos');

    const rows = await connection.db.execute<{ 'QUERY PLAN': unknown }>(
      drizzleSql`EXPLAIN (ANALYZE, FORMAT JSON) ${candidates}`,
    );
    const plan = JSON.stringify([...rows][0]?.['QUERY PLAN']);

    const likeScans = [...plan.matchAll(/"Node Type":"([^"]+)"[^{}]*?"Relation Name":"likes"/g)];
    expect(likeScans.length).toBeGreaterThan(0);
    expect(likeScans.map(([, node]) => node)).not.toContain('Seq Scan');
    const likeIndexes = [...plan.matchAll(/"Index Name":"(likes_\w+)"/g)].map(([, name]) => name);
    expect(likeIndexes.length).toBeGreaterThan(0);
    for (const name of likeIndexes) {
      expect(['likes_from_home_id_to_home_id_pk', 'likes_to_home_idx']).toContain(name);
    }
  });
});
