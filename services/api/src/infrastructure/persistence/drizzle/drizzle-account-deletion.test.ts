import { describe, expect, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import type { Database, Executor } from './database.js';
import { DrizzleAccountDeletionStore } from './drizzle-account-deletion.js';
import { DrizzleAccountDeletionUnitOfWork } from './drizzle-account-deletion-unit-of-work.js';
import { DrizzleAccountExportReader } from './drizzle-account-export.js';
import { DrizzleErasureFollowUp } from './drizzle-erasure-follow-up.js';

/** Constructor de consultas falso: cada consulta esperada da el siguiente resultado. */
function sequenceDb(results: unknown[]) {
  const pending = [...results];
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          return (resolve: (value: unknown) => void) => {
            resolve(pending.shift());
          };
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    },
  );
  return { db: builder as Executor, calls };
}

const AT = new Date('2026-10-20T09:00:00.000Z');
const methods = (calls: { method: string }[]) => calls.map((call) => call.method);

describe('DrizzleAccountDeletionStore', () => {
  it('bloquea la fila del usuario al leerlo y devuelve el usuario', async () => {
    const row = { ...makeUser({ id: 'u1' }) };
    const { db, calls } = sequenceDb([[row]]);

    const user = await new DrizzleAccountDeletionStore(db).lockUser('u1');

    expect(user).toEqual(row);
    expect(methods(calls)).toEqual(['select', 'from', 'where', 'limit', 'for']);
    expect(calls.at(-1)?.args[0]).toBe('update');
  });

  it('devuelve null si el usuario no existe', async () => {
    const { db } = sequenceDb([[]]);

    await expect(new DrizzleAccountDeletionStore(db).lockUser('u1')).resolves.toBeNull();
  });

  it('guarda solo los campos anonimizados', async () => {
    const { db, calls } = sequenceDb([undefined]);
    const anonymous = makeUser({
      id: 'u1',
      email: 'deleted+u1@changehouse.invalid',
      displayName: 'Usuario eliminado',
      deletedAt: AT,
    });

    await new DrizzleAccountDeletionStore(db).saveAnonymized(anonymous);

    expect(calls.find((call) => call.method === 'set')?.args).toEqual([
      {
        email: 'deleted+u1@changehouse.invalid',
        displayName: 'Usuario eliminado',
        phone: null,
        municipality: null,
        deletedAt: AT,
      },
    ]);
  });

  it('lista los matches vivos sin repetir ids', async () => {
    const { db } = sequenceDb([[{ id: 'm1' }, { id: 'm1' }, { id: 'm2' }]]);

    await expect(new DrizzleAccountDeletionStore(db).liveMatchIds('u1')).resolves.toEqual([
      'm1',
      'm2',
    ]);
  });

  it('borra de cinco tablas los datos derivados', async () => {
    const { db, calls } = sequenceDb([undefined, undefined, undefined, undefined, undefined]);

    await new DrizzleAccountDeletionStore(db).eraseDerivedData('u1');

    expect(methods(calls).filter((method) => method === 'delete')).toHaveLength(5);
  });
});

describe('DrizzleErasureFollowUp', () => {
  it('lee las fotos de las viviendas del usuario', async () => {
    const photos = [{ homeId: 'h1', photoId: 'p1', status: 'ready', storagePath: 'homes/h1/p1' }];
    const { db } = sequenceDb([photos]);

    await expect(new DrizzleErasureFollowUp(db).photosOf('u1')).resolves.toEqual(photos);
  });

  it('borra las filas de las fotos', async () => {
    const { db, calls } = sequenceDb([undefined]);

    await new DrizzleErasureFollowUp(db).deletePhotoRecords('u1');

    expect(methods(calls)).toEqual(['delete', 'where']);
  });

  it('lista los matches del usuario sin repetir', async () => {
    const { db } = sequenceDb([[{ id: 'm1' }, { id: 'm1' }]]);

    await expect(new DrizzleErasureFollowUp(db).matchIdsOf('u1')).resolves.toEqual(['m1']);
  });
});

describe('DrizzleAccountDeletionUnitOfWork', () => {
  it('ejecuta el trabajo en una transacción y le da el alcance con todos sus puertos', async () => {
    const { db: tx } = sequenceDb([]);
    const transactions: unknown[] = [];
    const database = {
      transaction: (work: (tx: Executor) => Promise<unknown>) => {
        transactions.push(tx);
        return work(tx);
      },
    } as unknown as Database;
    const cipher = AddressCipher.fromBase64(Buffer.alloc(32, 7).toString('base64'));

    const scope = await new DrizzleAccountDeletionUnitOfWork(database, cipher).run((s) =>
      Promise.resolve(s),
    );

    expect(transactions).toHaveLength(1);
    expect(Object.keys(scope).sort()).toEqual(['accounts', 'audit', 'homes', 'matches', 'outbox']);
  });
});

describe('DrizzleAccountExportReader', () => {
  it('lee los me gusta de las viviendas del usuario', async () => {
    const likes = [{ fromHomeId: 'h1', toHomeId: 'h2', createdAt: AT }];
    const { db } = sequenceDb([likes]);

    await expect(new DrizzleAccountExportReader(db).likesOf('u1')).resolves.toEqual(likes);
  });

  it('une los descartes desde viviendas y desde la cuenta, por fecha', async () => {
    const later = new Date('2026-10-21T09:00:00.000Z');
    const { db } = sequenceDb([
      [{ homeId: 'h1', dismissedHomeId: 'h3', createdAt: later }],
      [{ dismissedHomeId: 'h4', createdAt: AT }],
    ]);

    await expect(new DrizzleAccountExportReader(db).dismissalsOf('u1')).resolves.toEqual([
      { homeId: null, dismissedHomeId: 'h4', createdAt: AT },
      { homeId: 'h1', dismissedHomeId: 'h3', createdAt: later },
    ]);
  });

  it('agrupa la participación propia por match y añade solo los ids de las otras viviendas', async () => {
    const own = [
      {
        matchId: 'm1',
        type: 2,
        status: 'open',
        createdAt: AT,
        homeId: 'h1',
        givesHomeId: 'h1',
        receivesHomeId: 'h2',
        compensationCents: 100,
        participantStatus: 'pending',
        sharesPhone: false,
      },
    ];
    const { db } = sequenceDb([own, [{ matchId: 'm1', homeId: 'h2' }]]);

    await expect(new DrizzleAccountExportReader(db).matchesOf('u1')).resolves.toEqual([
      {
        id: 'm1',
        type: 2,
        status: 'open',
        createdAt: AT,
        participation: [
          {
            homeId: 'h1',
            givesHomeId: 'h1',
            receivesHomeId: 'h2',
            compensationCents: 100,
            status: 'pending',
            sharesPhone: false,
          },
        ],
        otherHomeIds: ['h2'],
      },
    ]);
  });

  it('sin matches no consulta a los demás participantes', async () => {
    const { db, calls } = sequenceDb([[]]);

    await expect(new DrizzleAccountExportReader(db).matchesOf('u1')).resolves.toEqual([]);
    expect(methods(calls).filter((method) => method === 'select')).toHaveLength(1);
  });
});
