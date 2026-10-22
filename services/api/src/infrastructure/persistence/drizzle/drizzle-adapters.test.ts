import { describe, expect, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import type { Database, Executor } from './database.js';
import { DrizzleAdminGrants } from './drizzle-admin-grants.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleDecisionStore } from './drizzle-decision-store.js';
import { DrizzleDecisionUnitOfWork } from './drizzle-decision-unit-of-work.js';
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

describe('DrizzleDecisionStore', () => {
  const at = new Date('2026-10-19T10:00:00.000Z');

  it('lockUser toma el bloqueo asesor de la transacción', async () => {
    const { db, calls } = fakeDb(undefined);

    await new DrizzleDecisionStore(db).lockUser('u');

    expect(calls.map((call) => call.method)).toEqual(['execute']);
  });

  it('countLikes devuelve el total o cero; likeExists, si hay fila', async () => {
    expect(await new DrizzleDecisionStore(fakeDb([{ total: 7 }]).db).countLikes('u', at, at)).toBe(
      7,
    );
    expect(await new DrizzleDecisionStore(fakeDb([]).db).countLikes('u', at, at)).toBe(0);
    expect(await new DrizzleDecisionStore(fakeDb([{ one: 1 }]).db).likeExists('a', 'b')).toBe(true);
    expect(await new DrizzleDecisionStore(fakeDb([]).db).likeExists('a', 'b')).toBe(false);
  });

  it('insertLike inserta la arista con la fecha dada y deleteLike la borra', async () => {
    const inserted = fakeDb(undefined);
    const deleted = fakeDb(undefined);

    await new DrizzleDecisionStore(inserted.db).insertLike('a', 'b', at);
    await new DrizzleDecisionStore(deleted.db).deleteLike('a', 'b');

    expect(inserted.calls[1]?.args).toEqual([{ fromHomeId: 'a', toHomeId: 'b', createdAt: at }]);
    expect(deleted.calls.map((call) => call.method)).toEqual(['delete', 'where']);
  });

  it('saveDismissal renueva la fecha si el descarte existía, desde una vivienda o desde la cuenta', async () => {
    const fromHome = fakeDb(undefined);
    const fromAccount = fakeDb(undefined);

    await new DrizzleDecisionStore(fromHome.db).saveDismissal(
      { kind: 'home', homeId: 'a' },
      'b',
      at,
    );
    await new DrizzleDecisionStore(fromAccount.db).saveDismissal(
      { kind: 'account', userId: 'u' },
      'b',
      at,
    );

    expect(fromHome.calls[1]?.args).toEqual([{ homeId: 'a', dismissedHomeId: 'b', createdAt: at }]);
    expect(fromAccount.calls[1]?.args).toEqual([
      { userId: 'u', dismissedHomeId: 'b', createdAt: at },
    ]);
    expect(fromHome.calls.map((call) => call.method)).toContain('onConflictDoUpdate');
    expect(fromAccount.calls.map((call) => call.method)).toContain('onConflictDoUpdate');
  });

  it('deleteDismissal borra el descarte de la vivienda o de la cuenta', async () => {
    const fromHome = fakeDb(undefined);
    const fromAccount = fakeDb(undefined);

    await new DrizzleDecisionStore(fromHome.db).deleteDismissal({ kind: 'home', homeId: 'a' }, 'b');
    await new DrizzleDecisionStore(fromAccount.db).deleteDismissal(
      { kind: 'account', userId: 'u' },
      'b',
    );

    expect(fromHome.calls.map((call) => call.method)).toEqual(['delete', 'where']);
    expect(fromAccount.calls.map((call) => call.method)).toEqual(['delete', 'where']);
  });

  it('lastAction traduce la fila más reciente o devuelve null', async () => {
    const row = { kind: 'like', target_home_id: 'b', at_ms: at.getTime() };

    expect(
      await new DrizzleDecisionStore(fakeDb([row]).db).lastAction({ kind: 'home', homeId: 'a' }),
    ).toEqual({ kind: 'like', targetHomeId: 'b', at });
    expect(
      await new DrizzleDecisionStore(fakeDb([]).db).lastAction({ kind: 'account', userId: 'u' }),
    ).toBeNull();
  });
});

describe('DrizzleDecisionUnitOfWork', () => {
  it('ejecuta el trabajo dentro de una transacción con el almacén sobre ella', async () => {
    let opened = 0;
    const database = {
      transaction: (work: (tx: Executor) => Promise<unknown>) => {
        opened += 1;
        return work(fakeDb(undefined).db);
      },
    } as unknown as Database;

    const result = await new DrizzleDecisionUnitOfWork(database).run((store) =>
      Promise.resolve(store instanceof DrizzleDecisionStore),
    );

    expect(opened).toBe(1);
    expect(result).toBe(true);
  });
});
