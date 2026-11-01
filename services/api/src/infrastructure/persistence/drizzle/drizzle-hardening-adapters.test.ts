import { describe, expect, it } from 'vitest';

import type { RetentionScope } from '../../../application/retention/retention-purge.js';
import type { Database, Executor } from './database.js';
import { DrizzleAccountDeletionStore } from './drizzle-account-deletion.js';
import { DrizzleBlockUnitOfWork } from './drizzle-block-unit-of-work.js';
import { DrizzlePhotoRepository } from './drizzle-photo-repository.js';
import {
  DrizzleExpiredChats,
  DrizzleRetentionUnitOfWork,
  DrizzleWaitlistPurge,
} from './drizzle-retention.js';

/**
 * Constructor de consultas falso: cualquier método encadenado devuelve el mismo objeto, que al
 * esperarse da el siguiente resultado de la lista. Las consultas reales se prueban contra
 * PostgreSQL en las pruebas `.int`.
 */
function sequenceDb(...results: unknown[]) {
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

describe('DrizzleExpiredChats', () => {
  it('findExpired devuelve el match y su chat, con el límite pedido', async () => {
    const { db, calls } = sequenceDb([
      { matchId: 'm-1', chatId: 'c-1' },
      { matchId: 'm-2', chatId: null },
    ]);

    const found = await new DrizzleExpiredChats(db).findExpired(new Date('2025-10-30'), 500);

    expect(found).toEqual([
      { matchId: 'm-1', chatId: 'c-1' },
      { matchId: 'm-2', chatId: null },
    ]);
    expect(calls.find((call) => call.method === 'limit')?.args).toEqual([500]);
  });

  it('markPurged solo escribe chat_purged_at', async () => {
    const { db, calls } = sequenceDb(undefined);
    const at = new Date('2026-10-30T10:00:00.000Z');

    await new DrizzleExpiredChats(db).markPurged('m-1', at);

    expect(calls.find((call) => call.method === 'set')?.args).toEqual([{ chatPurgedAt: at }]);
  });
});

describe('DrizzleWaitlistPurge', () => {
  it('deleteAll devuelve cuántas inscripciones borró', async () => {
    const { db } = sequenceDb([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    expect(await new DrizzleWaitlistPurge(db).deleteAll()).toBe(3);
  });
});

describe('DrizzleRetentionUnitOfWork', () => {
  function databaseWith(lock: unknown) {
    const { db } = sequenceDb(lock);
    return {
      transaction: (work: (tx: Executor) => Promise<unknown>) =>
        work({
          execute: () => Promise.resolve(lock),
          ...(db as object),
        } as unknown as Executor),
    } as unknown as Database;
  }

  it('Scenario: Bloqueo consultivo - sin el bloqueo no ejecuta el trabajo', async () => {
    let executed = false;

    const outcome = await new DrizzleRetentionUnitOfWork(
      databaseWith([{ locked: false }]),
    ).runExclusive(() => {
      executed = true;
      return Promise.resolve('hecho');
    });

    expect(outcome).toEqual({ ran: false });
    expect(executed).toBe(false);
  });

  it('con el bloqueo ejecuta el trabajo con los repositorios de la transacción', async () => {
    let scope: RetentionScope | undefined;

    const outcome = await new DrizzleRetentionUnitOfWork(
      databaseWith([{ locked: true }]),
    ).runExclusive((received) => {
      scope = received;
      return Promise.resolve('hecho');
    });

    expect(outcome).toEqual({ ran: true, value: 'hecho' });
    expect(Object.keys(scope ?? {}).sort()).toEqual(['audit', 'chats', 'waitlist']);
  });
});

describe('DrizzleBlockUnitOfWork', () => {
  it('abre una transacción con bloqueos, matches, auditoría y avisos', async () => {
    const { db } = sequenceDb(undefined);
    const database = {
      transaction: (work: (tx: Executor) => Promise<unknown>) => work(db),
    } as unknown as Database;

    const scope = await new DrizzleBlockUnitOfWork(database).run((received) =>
      Promise.resolve(received),
    );

    expect(Object.keys(scope).sort()).toEqual(['audit', 'blocks', 'matches', 'outbox']);
  });
});

describe('DrizzlePhotoRepository.countPending', () => {
  it('devuelve el recuento de fotos pending de la vivienda, o 0 si no hay fila', async () => {
    expect(await new DrizzlePhotoRepository(sequenceDb([{ total: 7 }]).db).countPending('h')).toBe(
      7,
    );
    expect(await new DrizzlePhotoRepository(sequenceDb([]).db).countPending('h')).toBe(0);
  });
});

describe('DrizzleAccountDeletionStore.eraseExactLocation', () => {
  it('Scenario: Datos tras la eliminación - sobrescribe con nulos la dirección y la ubicación exactas', async () => {
    const { db, calls } = sequenceDb(undefined);

    await new DrizzleAccountDeletionStore(db).eraseExactLocation('u-1');

    expect(calls.find((call) => call.method === 'set')?.args).toEqual([
      { exactAddress: null, exactLocation: null },
    ]);
  });
});
