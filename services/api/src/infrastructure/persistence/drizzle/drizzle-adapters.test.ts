import { describe, expect, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import type { Database, Executor } from './database.js';
import { DrizzleAdminGrants } from './drizzle-admin-grants.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work.js';

/**
 * Constructor de consultas falso: cualquier método encadenado devuelve el mismo objeto, que al
 * esperarse da `result`. Las consultas reales se prueban contra PostgreSQL en las pruebas `.int`.
 */
function fakeDb(result: unknown) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          return (resolve: (value: unknown) => void) => {
            resolve(result);
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

describe('DrizzleAuditLog', () => {
  it('inserta una fila con la entrada y nada más', async () => {
    const { db, calls } = fakeDb(undefined);
    const at = new Date('2026-10-19T10:00:00.000Z');

    await new DrizzleAuditLog(db).record({
      actorId: 'admin-1',
      action: 'home.approve',
      entity: 'home',
      entityId: 'home-1',
      at,
    });

    expect(calls.map((call) => call.method)).toEqual(['insert', 'values']);
    expect(calls[1]?.args).toEqual([
      { actorId: 'admin-1', action: 'home.approve', entity: 'home', entityId: 'home-1', at },
    ]);
  });
});

describe('DrizzleAdminGrants', () => {
  it('findByEmail devuelve la fila encontrada o null', async () => {
    const user = makeUser();

    expect(
      await new DrizzleAdminGrants(fakeDb([user]).db as Database).findByEmail('a@b.c'),
    ).toEqual(user);
    expect(await new DrizzleAdminGrants(fakeDb([]).db as Database).findByEmail('a@b.c')).toBeNull();
  });

  it('hasActiveHomes es verdadero si hay alguna vivienda no cerrada', async () => {
    expect(
      await new DrizzleAdminGrants(fakeDb([{ id: 'h' }]).db as Database).hasActiveHomes('u'),
    ).toBe(true);
    expect(await new DrizzleAdminGrants(fakeDb([]).db as Database).hasActiveHomes('u')).toBe(false);
  });

  it('assignAdmin fija el rol admin', async () => {
    const { db, calls } = fakeDb(undefined);

    await new DrizzleAdminGrants(db).assignAdmin('u');

    expect(calls.find((call) => call.method === 'set')?.args).toEqual([{ assignedRole: 'admin' }]);
  });
});

describe('DrizzleUnitOfWork', () => {
  it('ejecuta el trabajo dentro de una transacción con repositorios sobre ella y devuelve su resultado', async () => {
    const { db: tx } = fakeDb(undefined);
    let opened = 0;
    const database = {
      transaction: (work: (tx: Executor) => Promise<unknown>) => {
        opened += 1;
        return work(tx);
      },
    } as unknown as Database;
    const cipher = new AddressCipher(new Map([[1, Buffer.alloc(32, 1)]]), 1);

    const result = await new DrizzleUnitOfWork(database, cipher).run((scope) =>
      Promise.resolve(Object.keys(scope).sort()),
    );

    expect(opened).toBe(1);
    expect(result).toEqual(['audit', 'homes']);
  });

  it('un fallo del trabajo se propaga para que la transacción se revierta', async () => {
    const database = {
      transaction: (work: (tx: Executor) => Promise<unknown>) => work(fakeDb(undefined).db),
    } as unknown as Database;
    const cipher = new AddressCipher(new Map([[1, Buffer.alloc(32, 1)]]), 1);

    await expect(
      new DrizzleUnitOfWork(database, cipher).run(() => Promise.reject(new Error('auditoría'))),
    ).rejects.toThrow('auditoría');
  });
});
