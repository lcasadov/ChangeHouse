import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { newDraft } from '../../../domain/home/home.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleDecisionUnitOfWork } from './drizzle-decision-unit-of-work.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const ME = '0199c1a2-0000-7000-8000-0000000007a1';
const OTHER = '0199c1a2-0000-7000-8000-0000000007a2';
const MINE = '0199c1a2-0000-7000-8000-0000000007b1';
const MINE_TOO = '0199c1a2-0000-7000-8000-0000000007b2';
const THEIRS = '0199c1a2-0000-7000-8000-0000000007b3';
const THEIRS_TOO = '0199c1a2-0000-7000-8000-0000000007b4';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};
const at = (time: string) => new Date(`2026-10-19T${time}.000Z`);

let connection: DatabaseConnection;
let units: DrizzleDecisionUnitOfWork;

beforeAll(async () => {
  connection = createDatabase(inject('databaseUrl'));
  units = new DrizzleDecisionUnitOfWork(connection.db);
  await sql`TRUNCATE users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  for (const [id, n] of [
    [ME, 1],
    [OTHER, 2],
  ] as const) {
    await users.insertWithConsents(
      makeUser({
        id,
        firebaseUid: `uid-decision-${String(n)}`,
        email: `decision${String(n)}@example.com`,
      }),
      [],
    );
  }
  const homes = new DrizzleHomeRepository(
    connection.db,
    new AddressCipher(new Map([[1, randomBytes(32)]]), 1),
  );
  for (const [id, ownerId] of [
    [MINE, ME],
    [MINE_TOO, ME],
    [THEIRS, OTHER],
    [THEIRS_TOO, OTHER],
  ] as const) {
    await homes.insert(
      newDraft({
        id,
        ownerId,
        now: at('09:00:00'),
        type: 'piso',
        address: 'Calle del Pez, 12',
        location: LOCATION,
      }),
    );
  }
});

beforeEach(async () => {
  await sql`TRUNCATE likes, dismissals, account_dismissals`;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleDecisionStore', () => {
  it('guarda y borra me gusta, y sabe si existen', async () => {
    const result = await units.run(async (store) => {
      const before = await store.likeExists(MINE, THEIRS);
      await store.insertLike(MINE, THEIRS, at('10:00:00'));
      const after = await store.likeExists(MINE, THEIRS);
      const reverse = await store.likeExists(THEIRS, MINE);
      await store.deleteLike(MINE, THEIRS);
      return { before, after, reverse, gone: !(await store.likeExists(MINE, THEIRS)) };
    });

    expect(result).toEqual({ before: false, after: true, reverse: false, gone: true });
  });

  it('cuenta los me gusta de todas las viviendas del usuario dentro de [inicio, fin)', async () => {
    await sql`INSERT INTO likes (from_home_id, to_home_id, created_at) VALUES
      (${MINE}, ${THEIRS}, '2026-10-19T09:59:59Z'),
      (${MINE}, ${THEIRS_TOO}, '2026-10-19T10:00:00Z'),
      (${MINE_TOO}, ${THEIRS}, '2026-10-19T12:00:00Z'),
      (${MINE_TOO}, ${THEIRS_TOO}, '2026-10-19T14:00:00Z'),
      (${THEIRS}, ${MINE}, '2026-10-19T11:00:00Z')`;

    const [mine, theirs] = await units.run(async (store) => [
      await store.countLikes(ME, at('10:00:00'), at('14:00:00')),
      await store.countLikes(OTHER, at('10:00:00'), at('14:00:00')),
    ]);

    // Incluye el inicio, excluye el fin y no mezcla los me gusta de otro usuario
    expect(mine).toBe(2);
    expect(theirs).toBe(1);
  });

  it('el descarte se repite sin duplicar y renueva su fecha', async () => {
    await units.run(async (store) => {
      await store.saveDismissal({ kind: 'home', homeId: MINE }, THEIRS, at('10:00:00'));
      await store.saveDismissal({ kind: 'home', homeId: MINE }, THEIRS, at('11:00:00'));
      await store.saveDismissal({ kind: 'account', userId: ME }, THEIRS, at('10:00:00'));
      await store.saveDismissal({ kind: 'account', userId: ME }, THEIRS, at('11:30:00'));
    });

    const homeRows = await sql<{ created_at: Date }[]>`SELECT created_at FROM dismissals`;
    const accountRows = await sql<
      { created_at: Date }[]
    >`SELECT created_at FROM account_dismissals`;
    expect(homeRows.map((row) => row.created_at)).toEqual([at('11:00:00')]);
    expect(accountRows.map((row) => row.created_at)).toEqual([at('11:30:00')]);
  });

  it('la última acción de una vivienda es la más reciente entre sus me gusta y sus descartes', async () => {
    await sql`INSERT INTO dismissals (home_id, dismissed_home_id, created_at) VALUES
      (${MINE}, ${THEIRS}, '2026-10-19T10:00:00Z'),
      (${MINE_TOO}, ${THEIRS}, '2026-10-19T13:00:00Z')`;
    await sql`INSERT INTO likes (from_home_id, to_home_id, created_at) VALUES
      (${MINE}, ${THEIRS_TOO}, '2026-10-19T11:00:00Z')`;

    const [liked, dismissed, none] = await units.run(async (store) => {
      const first = await store.lastAction({ kind: 'home', homeId: MINE });
      await store.deleteLike(MINE, THEIRS_TOO);
      return [
        first,
        await store.lastAction({ kind: 'home', homeId: MINE }),
        await store.lastAction({ kind: 'account', userId: ME }),
      ];
    });

    expect(liked).toEqual({ kind: 'like', targetHomeId: THEIRS_TOO, at: at('11:00:00') });
    expect(dismissed).toEqual({ kind: 'dismissal', targetHomeId: THEIRS, at: at('10:00:00') });
    expect(none).toBeNull();
  });

  it('la última acción de la cuenta de un seeker son sus descartes de cuenta y se borran con deleteDismissal', async () => {
    await sql`INSERT INTO account_dismissals (user_id, dismissed_home_id, created_at) VALUES
      (${ME}, ${THEIRS}, '2026-10-19T10:00:00Z'),
      (${ME}, ${THEIRS_TOO}, '2026-10-19T12:00:00Z')`;

    const result = await units.run(async (store) => {
      const origin = { kind: 'account', userId: ME } as const;
      const first = await store.lastAction(origin);
      await store.deleteDismissal(origin, THEIRS_TOO);
      return [first, await store.lastAction(origin)];
    });

    expect(result).toEqual([
      { kind: 'dismissal', targetHomeId: THEIRS_TOO, at: at('12:00:00') },
      { kind: 'dismissal', targetHomeId: THEIRS, at: at('10:00:00') },
    ]);
  });

  it('si el trabajo falla, nada de lo escrito queda confirmado', async () => {
    const failing = units.run(async (store) => {
      await store.insertLike(MINE, THEIRS, at('10:00:00'));
      throw new Error('fallo a mitad');
    });

    await expect(failing).rejects.toThrow('fallo a mitad');
    expect(await sql`SELECT 1 FROM likes`).toHaveLength(0);
  });

  it('bloquear al usuario serializa las transacciones: con un cupo de 3, diez en paralelo dan exactamente 3', async () => {
    const destinations = Array.from(
      { length: 10 },
      (_unused, index) => `0199c1a2-0000-7000-8000-0000000008${String(index).padStart(2, '0')}`,
    );
    for (const id of destinations) {
      await sql`INSERT INTO homes (id, owner_id, type, exact_address, exact_location, approx_location, area_name)
                VALUES (${id}, ${OTHER}, 'piso', ${Buffer.from('x')},
                        ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography, 'Malasaña')`;
    }

    const attempts = await Promise.all(
      destinations.map((destination) =>
        units.run(async (store) => {
          await store.lockUser(ME);
          if ((await store.countLikes(ME, at('00:00:00'), at('23:59:59'))) >= 3) return false;
          await store.insertLike(MINE, destination, at('10:00:00'));
          return true;
        }),
      ),
    );

    expect(attempts.filter(Boolean)).toHaveLength(3);
    expect(await sql`SELECT 1 FROM likes`).toHaveLength(3);
    await sql`DELETE FROM homes WHERE id IN ${sql(destinations)}`;
  });
});
