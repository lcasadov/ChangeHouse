import { describe, expect, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import type { Database, Executor } from './database.js';
import { DrizzleAdminGrants } from './drizzle-admin-grants.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleCycleCandidates } from './drizzle-cycle-candidates.js';
import { DrizzleDecisionStore } from './drizzle-decision-store.js';
import { DrizzleDecisionUnitOfWork } from './drizzle-decision-unit-of-work.js';
import { DrizzleMatchHomes } from './drizzle-match-homes.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';
import { DrizzleMatchUnitOfWork } from './drizzle-match-unit-of-work.js';
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

/** Como `fakeDb`, pero cada consulta esperada da el siguiente resultado de la lista. */
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

  it('la búsqueda de ciclos y los matches comparten la misma transacción', async () => {
    const database = {
      transaction: (work: (tx: Executor) => Promise<unknown>) => work(fakeDb(undefined).db),
    } as unknown as Database;

    const result = await new DrizzleDecisionUnitOfWork(database).run((_store, matching) =>
      Promise.resolve([
        matching.cycles instanceof DrizzleCycleCandidates,
        matching.matches instanceof DrizzleMatchRepository,
      ]),
    );

    expect(result).toEqual([true, true]);
  });
});

describe('DrizzleDecisionStore.lockPair', () => {
  it('toma el bloqueo asesor del par en la transacción', async () => {
    const { db, calls } = fakeDb(undefined);

    await new DrizzleDecisionStore(db).lockPair('a:b');

    expect(calls.map((call) => call.method)).toEqual(['execute']);
  });
});

describe('DrizzleCycleCandidates', () => {
  const member = (id: string, terms: boolean) => ({
    id,
    owner_id: `owner-${id}`,
    status: 'published',
    value_min_cents: 100,
    value_max_cents: 200,
    max_to_pay_cents: terms ? 50 : null,
    min_to_receive_cents: terms ? 0 : null,
    value_reference_pct: terms ? 50 : null,
  });
  const backEdge = [{ one: 1 }];

  it('sin la arista de vuelta no hay ciclos ni se leen las viviendas', async () => {
    const { db, calls } = sequenceDb([[]]);

    expect(await new DrizzleCycleCandidates(db).findCycles('a', 'b')).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('con la arista de vuelta devuelve el ciclo en orden, con o sin límites', async () => {
    const { db } = sequenceDb([backEdge, [member('b', false), member('a', true)]]);

    const [cycle] = await new DrizzleCycleCandidates(db).findCycles('a', 'b');

    expect(cycle?.map((home) => home.homeId)).toEqual(['a', 'b']);
    expect(cycle?.[0]?.terms).toEqual({
      maxToPayCents: 50,
      minToReceiveCents: 0,
      valueReferencePct: 50,
    });
    expect(cycle?.[1]?.terms).toBeNull();
  });

  it('si una de las viviendas ya no existe, no hay ciclo', async () => {
    const { db } = sequenceDb([backEdge, [member('a', true)]]);

    expect(await new DrizzleCycleCandidates(db).findCycles('a', 'b')).toEqual([]);
  });
});

describe('DrizzleMatchRepository', () => {
  const at = new Date('2026-10-19T10:00:00.000Z');
  const match = {
    id: 'm-new',
    createdAt: at,
    cycle: {
      type: 2 as const,
      cycleKey: 'a:b',
      participants: [
        {
          homeId: 'a',
          userId: 'u-a',
          givesHomeId: 'a',
          receivesHomeId: 'b',
          compensationCents: 10,
        },
        {
          homeId: 'b',
          userId: 'u-b',
          givesHomeId: 'b',
          receivesHomeId: 'a',
          compensationCents: -10,
        },
      ],
    },
  };

  it('saveMatch inserta el match y sus participantes si la clave era nueva', async () => {
    const { db, calls } = sequenceDb([[{ id: 'm-new' }], undefined]);

    expect(await new DrizzleMatchRepository(db).saveMatch(match)).toBe('m-new');
    expect(calls.map((call) => call.method)).toContain('onConflictDoNothing');
    expect(calls.filter((call) => call.method === 'values')[1]?.args[0]).toHaveLength(2);
  });

  it('saveMatch devuelve el match existente si la clave ya estaba', async () => {
    const { db } = sequenceDb([[], [{ id: 'm-old' }]]);

    expect(await new DrizzleMatchRepository(db).saveMatch(match)).toBe('m-old');
  });

  it('saveMatch falla si ni se creó ni existe', async () => {
    const { db } = sequenceDb([[], []]);

    await expect(new DrizzleMatchRepository(db).saveMatch(match)).rejects.toThrow();
  });

  it('findMatch agrupa los participantes de cada match, o devuelve null', async () => {
    const row = { id: 'm', type: 2, status: 'open', createdAt: at, cycleKey: 'a:b', chatId: 'm' };
    const participant = {
      homeId: 'a',
      userId: 'u-a',
      displayName: 'Ana',
      givesHomeId: 'a',
      receivesHomeId: 'b',
      compensationCents: 10,
      status: 'pending',
    };
    const found = await new DrizzleMatchRepository(
      sequenceDb([[row], [{ matchId: 'm', ...participant }]]).db,
    ).findMatch('m');
    const missing = await new DrizzleMatchRepository(sequenceDb([[]]).db).findMatch('x');

    expect(found).toEqual({
      id: 'm',
      type: 2,
      status: 'open',
      createdAt: at,
      chatId: 'm',
      participants: [participant],
    });
    expect(missing).toBeNull();
  });

  it('listForUser aplica estado y cursor; isLikeInMatch dice si hay fila', async () => {
    const listed = sequenceDb([[]]);

    const page = await new DrizzleMatchRepository(listed.db).listForUser({
      userId: 'u',
      status: 'open',
      after: { at, id: 'm' },
      limit: 5,
    });

    expect(page).toEqual([]);
    expect(listed.calls.find((call) => call.method === 'limit')?.args).toEqual([5]);
    expect(await new DrizzleMatchRepository(fakeDb([{ one: 1 }]).db).isLikeInMatch('a', 'b')).toBe(
      true,
    );
    expect(await new DrizzleMatchRepository(fakeDb([]).db).isLikeInMatch('a', 'b')).toBe(false);
  });
});

describe('DrizzleMatchRepository: decisiones y detalle', () => {
  it('findById lee el match con sus participantes y findForUpdate lo hace bloqueando la fila', async () => {
    const row = { id: 'm-1', type: 2, status: 'open', createdAt: new Date() };
    const { db, calls } = sequenceDb([[row], [], [row], []]);
    const repository = new DrizzleMatchRepository(db);

    await repository.findById('m-1');
    expect(calls.map((call) => call.method)).not.toContain('for');
    const locked = await repository.findForUpdate('m-1');

    expect(calls.some((call) => call.method === 'for' && call.args[0] === 'update')).toBe(true);
    expect(locked).toMatchObject({ id: 'm-1', participants: [] });
  });

  it('findForUpdate de un match inexistente devuelve null', async () => {
    const { db } = sequenceDb([[]]);

    expect(await new DrizzleMatchRepository(db).findForUpdate('no-existe')).toBeNull();
  });

  it('saveState actualiza el match y cada participante por su vivienda', async () => {
    const { db, calls } = fakeDb(undefined);

    await new DrizzleMatchRepository(db).saveState('m-1', {
      status: 'closed',
      participants: [
        { homeId: 'a', userId: 'u-a', status: 'withdrawn' },
        { homeId: 'b', userId: 'u-b', status: 'confirmed' },
      ],
    });

    expect(calls.filter((call) => call.method === 'update')).toHaveLength(3);
    expect(calls.filter((call) => call.method === 'set').map((call) => call.args[0])).toEqual([
      { status: 'closed' },
      { status: 'withdrawn' },
      { status: 'confirmed' },
    ]);
  });

  it('setPhoneSharing cambia solo shares_phone', async () => {
    const { db, calls } = fakeDb(undefined);

    await new DrizzleMatchRepository(db).setPhoneSharing('m-1', 'u-a', true);

    expect(calls.find((call) => call.method === 'set')?.args).toEqual([{ sharesPhone: true }]);
  });

  it('phoneSharing devuelve los usuarios que han autorizado, tengan o no teléfono', async () => {
    const { db } = fakeDb([{ userId: 'u-a' }, { userId: 'u-b' }]);

    const sharing = await new DrizzleMatchRepository(db).phoneSharing('m-1');

    expect([...sharing]).toEqual(['u-a', 'u-b']);
  });

  it('sharedPhones devuelve el teléfono por usuario y omite a quien no tiene uno', async () => {
    const { db } = fakeDb([
      { userId: 'u-a', phone: '+34600000001' },
      { userId: 'u-b', phone: null },
    ]);

    const phones = await new DrizzleMatchRepository(db).sharedPhones('m-1');

    expect([...phones]).toEqual([['u-a', '+34600000001']]);
  });
});

describe('DrizzleMatchUnitOfWork', () => {
  it('ejecuta el trabajo en una transacción con las decisiones y la auditoría sobre ella', async () => {
    const { db: tx } = fakeDb(undefined);
    const transactions: unknown[] = [];
    const database = {
      transaction: (work: (tx: Executor) => Promise<unknown>) => {
        transactions.push(tx);
        return work(tx);
      },
    } as unknown as Database;

    const result = await new DrizzleMatchUnitOfWork(database).run((scope) =>
      Promise.resolve(Object.keys(scope).sort()),
    );

    expect(result).toEqual(['audit', 'matches']);
    expect(transactions).toHaveLength(1);
  });
});

/** Cifrador que anota cada descifrado: prueba que no se descifra nada de más. */
class SpyCipher extends AddressCipher {
  readonly decrypted: Buffer[] = [];

  constructor() {
    super(new Map([[1, Buffer.alloc(32, 1)]]), 1);
  }

  override decrypt(stored: Buffer): string {
    this.decrypted.push(stored);
    return super.decrypt(stored);
  }
}

describe('DrizzleMatchHomes', () => {
  const homeRow = {
    id: 'h-1',
    type: 'piso',
    regime: 'libre',
    usefulM2: 80,
    builtM2: 95,
    bedrooms: 3,
    bathrooms: 2,
    floor: null,
    hasLift: true,
    garage: false,
    storageRoom: false,
    features: {},
    energyRating: null,
    yearBuilt: null,
    valueMinCents: 1,
    valueMaxCents: 2,
    locationVisibility: 'area',
    exactLocation: { lat: 1, lng: 2 },
    approxLocation: { lat: 3, lng: 4 },
    areaName: 'Getafe Centro',
  };

  it('la forma pública se lee sin descifrar ninguna dirección y sin la columna de la dirección', async () => {
    const cipher = new SpyCipher();
    const { db, calls } = fakeDb([
      { ...homeRow, municipality: 'Getafe' },
      { ...homeRow, id: 'h-2', municipality: null },
    ]);

    const found = await new DrizzleMatchHomes(db, cipher).findPublicHomes(['h-1', 'h-2']);

    expect(cipher.decrypted).toEqual([]);
    const selected = calls.find((call) => call.method === 'select')?.args[0] as object;
    expect(Object.keys(selected)).not.toContain('exactAddress');
    expect(found[0]).toMatchObject({
      id: 'h-1',
      location: {
        exact: { lat: 1, lng: 2 },
        areaCenter: { lat: 3, lng: 4 },
        areaName: 'Getafe Centro',
        municipality: 'Getafe',
      },
    });
    expect(found[1]?.location).not.toHaveProperty('municipality');
  });

  it('exactAddresses descifra la dirección de cada vivienda pedida y solo esas', async () => {
    const cipher = new SpyCipher();
    const { db } = fakeDb([{ id: 'h-1', exactAddress: cipher.encrypt('Calle Real, 9, Leganés') }]);

    const addresses = await new DrizzleMatchHomes(db, cipher).exactAddresses(['h-1']);

    expect([...addresses]).toEqual([['h-1', 'Calle Real, 9, Leganés']]);
    expect(cipher.decrypted).toHaveLength(1);
  });
});
