import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { approveHome, type Home, newDraft, rejectHome } from '../../../domain/home/home.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const ADMIN = '0199c1a2-0000-7000-8000-0000000000c1';
const OWNER = '0199c1a2-0000-7000-8000-0000000000c2';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};
const key = randomBytes(32);
const cipher = new AddressCipher(new Map([[1, key]]), 1);

const homeId = (n: number) => `0199c1a2-0000-7000-8000-00000000050${String(n)}`;
const day = (n: number) => new Date(`2026-10-${String(n).padStart(2, '0')}T08:00:00.000Z`);

let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let units: DrizzleUnitOfWork;

function home(n: number, changes: Partial<Home> = {}): Home {
  return {
    ...newDraft({
      id: homeId(n),
      ownerId: OWNER,
      now: day(1),
      type: 'piso',
      address: 'Calle del Pez, 12, 28004 Madrid',
      location: LOCATION,
    }),
    ...changes,
  };
}

const inReview = (n: number, submittedAt: Date): Home =>
  home(n, { status: 'in_review', submittedAt, createdAt: day(1) });

beforeAll(async () => {
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(connection.db, cipher);
  units = new DrizzleUnitOfWork(connection.db, cipher);
  await sql`TRUNCATE users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  await users.insertWithConsents(
    makeUser({ id: ADMIN, firebaseUid: 'uid-admin', email: 'admin@example.com' }),
    [],
  );
  await users.insertWithConsents(
    makeUser({ id: OWNER, firebaseUid: 'uid-owner', email: 'owner@example.com' }),
    [],
  );
});

beforeEach(async () => {
  await sql`TRUNCATE homes CASCADE`;
  await sql`TRUNCATE audit_log`;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleHomeRepository: moderación', () => {
  it('guarda y recupera la fecha de envío y el motivo del rechazo', async () => {
    const rejected = rejectHome(inReview(1, day(10)), 'Fotos borrosas');

    await homes.insert(rejected);

    expect(await homes.findById(homeId(1))).toEqual(rejected);
    expect((await homes.findById(homeId(1)))?.submittedAt).toEqual(day(10));
  });

  it('Scenario: Ver la cola - la cola va de la más antigua a la más reciente, solo con las viviendas en revisión', async () => {
    await homes.insert(inReview(1, day(12)));
    await homes.insert(inReview(2, day(10)));
    await homes.insert(inReview(3, day(11)));
    await homes.insert(home(4));
    await homes.insert(home(5, { status: 'published', submittedAt: day(9) }));

    const queue = await homes.listForModeration({ status: 'in_review', limit: 10 });

    expect(queue.map((item) => item.id)).toEqual([homeId(2), homeId(3), homeId(1)]);
  });

  it('Scenario: Cola vacía - sin viviendas en revisión devuelve una lista vacía', async () => {
    await homes.insert(home(1, { status: 'published' }));

    expect(await homes.listForModeration({ status: 'in_review', limit: 10 })).toEqual([]);
  });

  it('pagina por (envío, id): con el mismo instante desempata por id y no salta ni repite', async () => {
    await homes.insert(inReview(1, day(10)));
    await homes.insert(inReview(3, day(11)));
    await homes.insert(inReview(2, day(11)));
    await homes.insert(inReview(4, day(12)));

    const seen: string[] = [];
    let after: { at: Date; id: string } | undefined;
    for (let page = 0; page < 3; page += 1) {
      const items = await homes.listForModeration({
        status: 'in_review',
        limit: 2,
        ...(after ? { after } : {}),
      });
      seen.push(...items.map((item) => item.id));
      const last = items.at(-1);
      after = last?.submittedAt ? { at: last.submittedAt, id: last.id } : undefined;
      if (items.length < 2) break;
    }

    expect(seen).toEqual([homeId(1), homeId(2), homeId(3), homeId(4)]);
  });

  it('sin estado devuelve todas las viviendas, de la más reciente a la más antigua por alta', async () => {
    await homes.insert(home(1, { createdAt: day(2), status: 'published' }));
    await homes.insert(home(2, { createdAt: day(5) }));
    await homes.insert({ ...inReview(3, day(9)), createdAt: day(3) });

    const all = await homes.listForModeration({ limit: 10 });
    const rest = await homes.listForModeration({
      limit: 10,
      after: { at: day(3), id: homeId(3) },
    });

    expect(all.map((item) => item.id)).toEqual([homeId(2), homeId(3), homeId(1)]);
    expect(rest.map((item) => item.id)).toEqual([homeId(1)]);
  });

  it('findByIdForUpdate devuelve la vivienda (o nada) y bloquea la fila hasta que acaba la transacción', async () => {
    await homes.insert(inReview(1, day(10)));
    expect(await homes.findByIdForUpdate(homeId(9))).toBeNull();

    const order: string[] = [];
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = connection.db.transaction(async (tx) => {
      const locking = new DrizzleHomeRepository(tx, cipher);
      expect((await locking.findByIdForUpdate(homeId(1)))?.status).toBe('in_review');
      order.push('primero bloquea');
      await held;
      await locking.save(approveHome((await locking.findById(homeId(1)))!, day(20)));
      order.push('primero confirma');
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const second = homes.findByIdForUpdate(homeId(1)).then((found) => {
      order.push(`segundo ve ${found?.status ?? 'nada'}`);
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    order.push('se libera');
    release();
    await Promise.all([first, second]);

    expect(order).toEqual([
      'primero bloquea',
      'se libera',
      'primero confirma',
      'segundo ve published',
    ]);
  });
});

describe('DrizzleUnitOfWork y DrizzleAuditLog', () => {
  it('Scenario: Decisión auditada - la decisión y su entrada se confirman juntas', async () => {
    await homes.insert(inReview(1, day(10)));

    await units.run(async (scope) => {
      const found = await scope.homes.findByIdForUpdate(homeId(1));
      await scope.homes.save(rejectHome(found!, 'Fotos borrosas'));
      await scope.audit.record({
        actorId: ADMIN,
        action: 'home.reject',
        entity: 'home',
        entityId: homeId(1),
        at: day(15),
      });
    });

    const entries = await sql<
      { actor_id: string; action: string; entity: string; entity_id: string; at: Date }[]
    >`SELECT actor_id, action, entity, entity_id, at FROM audit_log`;
    expect(entries).toEqual([
      {
        actor_id: ADMIN,
        action: 'home.reject',
        entity: 'home',
        entity_id: homeId(1),
        at: day(15),
      },
    ]);
    expect((await homes.findById(homeId(1)))?.status).toBe('draft');
  });

  it('Scenario: Sin auditoría no hay decisión - si la entrada de auditoría falla, la vivienda sigue en revisión', async () => {
    await homes.insert(inReview(1, day(10)));
    const unknownActor = '0199c1a2-0000-7000-8000-0000000000ff';

    await expect(
      units.run(async (scope) => {
        const found = await scope.homes.findByIdForUpdate(homeId(1));
        await scope.homes.save(approveHome(found!, day(20)));
        await scope.audit.record({
          actorId: unknownActor,
          action: 'home.approve',
          entity: 'home',
          entityId: homeId(1),
          at: day(15),
        });
      }),
    ).rejects.toThrow();

    expect((await homes.findById(homeId(1)))?.status).toBe('in_review');
    expect(await sql`SELECT 1 FROM audit_log`).toHaveLength(0);
  });

  it('el registro rechaza actualizar y borrar entradas', async () => {
    const audit = new DrizzleAuditLog(connection.db);
    await audit.record({
      actorId: ADMIN,
      action: 'home.approve',
      entity: 'home',
      entityId: homeId(1),
      at: day(15),
    });

    await expect(sql`UPDATE audit_log SET action = 'home.reject'`).rejects.toThrow(/solo inserci/);
    await expect(sql`DELETE FROM audit_log`).rejects.toThrow(/solo inserci/);
  });

  it('no se puede borrar un usuario que figura como actor en la auditoría', async () => {
    const audit = new DrizzleAuditLog(connection.db);
    await audit.record({
      actorId: ADMIN,
      action: 'home.approve',
      entity: 'home',
      entityId: homeId(1),
      at: day(15),
    });

    await expect(sql`DELETE FROM users WHERE id = ${ADMIN}`).rejects.toThrow();
  });
});
