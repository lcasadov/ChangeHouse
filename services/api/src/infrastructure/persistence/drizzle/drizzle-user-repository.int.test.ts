import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import type { Consent } from '../../../domain/account/consent.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
let connection: DatabaseConnection;
let repository: DrizzleUserRepository;

const NOW = new Date('2026-10-19T10:00:00.000Z');
const LATER = new Date('2026-11-01T08:30:00.000Z');
const initial: Consent[] = [
  { type: 'terms', version: '2026-10', acceptedAt: NOW },
  { type: 'privacy', version: '2026-10', acceptedAt: NOW },
];

const user = (id: string, uid: string, email: string) =>
  makeUser({ id, firebaseUid: uid, email, createdAt: NOW });

beforeAll(() => {
  connection = createDatabase(inject('databaseUrl'));
  repository = new DrizzleUserRepository(connection.db);
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleUserRepository', () => {
  it('guarda al usuario con sus consentimientos y lo recupera por UID y por id', async () => {
    const ana = user('0199a8a0-0000-7000-8000-000000000001', 'uid-1', 'ana@example.com');

    await expect(repository.insertWithConsents(ana, initial)).resolves.toBe(true);

    await expect(repository.findByFirebaseUid('uid-1')).resolves.toEqual(ana);
    await expect(repository.findById(ana.id)).resolves.toEqual(ana);
    await expect(repository.listByUser(ana.id)).resolves.toEqual([
      { type: 'terms', version: '2026-10', acceptedAt: NOW },
      { type: 'privacy', version: '2026-10', acceptedAt: NOW },
    ]);
  });

  it('devuelve null si el usuario no existe', async () => {
    await expect(repository.findByFirebaseUid('nadie')).resolves.toBeNull();
    await expect(repository.findById('0199a8a0-0000-7000-8000-0000000000ff')).resolves.toBeNull();
  });

  it('el email es único sin distinguir mayúsculas y no deja consentimientos a medias', async () => {
    const ana = user('0199a8a0-0000-7000-8000-000000000001', 'uid-1', 'ana@example.com');
    const intruso = user('0199a8a0-0000-7000-8000-000000000002', 'uid-2', 'ANA@Example.com');
    await repository.insertWithConsents(ana, initial);

    await expect(repository.insertWithConsents(intruso, initial)).resolves.toBe(false);

    await expect(repository.listByUser(intruso.id)).resolves.toEqual([]);
    const [row] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM users`;
    expect(row?.total).toBe(1);
  });

  it('el mismo UID no se inserta dos veces aunque lleguen a la vez', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        repository.insertWithConsents(
          user(`0199a8a0-0000-7000-8000-00000000010${String(index)}`, 'uid-1', 'ana@example.com'),
          initial,
        ),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const [row] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM consents`;
    expect(row?.total).toBe(2);
  });

  it('actualiza solo los campos recibidos y devuelve el usuario completo', async () => {
    const ana = user('0199a8a0-0000-7000-8000-000000000001', 'uid-1', 'ana@example.com');
    await repository.insertWithConsents(ana, initial);

    const updated = await repository.update(ana.id, { displayName: 'Ana María', isOver65: true });

    expect(updated).toEqual({ ...ana, displayName: 'Ana María', isOver65: true });
    await expect(repository.findById(ana.id)).resolves.toEqual(updated);
  });

  it('actualizar sin cambios devuelve el usuario tal cual y actualizar uno inexistente falla', async () => {
    const ana = user('0199a8a0-0000-7000-8000-000000000001', 'uid-1', 'ana@example.com');
    await repository.insertWithConsents(ana, initial);

    await expect(repository.update(ana.id, {})).resolves.toEqual(ana);
    await expect(
      repository.update('0199a8a0-0000-7000-8000-0000000000ff', { isOver65: true }),
    ).rejects.toThrow(/inexistente/);
    await expect(repository.update('0199a8a0-0000-7000-8000-0000000000ff', {})).rejects.toThrow(
      /inexistente/,
    );
  });

  it('un consentimiento ya registrado no cambia: se devuelve el original', async () => {
    const ana = user('0199a8a0-0000-7000-8000-000000000001', 'uid-1', 'ana@example.com');
    await repository.insertWithConsents(ana, initial);

    const again = await repository.add(ana.id, {
      type: 'terms',
      version: '2026-10',
      acceptedAt: LATER,
    });
    const fresh = await repository.add(ana.id, {
      type: 'terms',
      version: '2027-02',
      acceptedAt: LATER,
    });

    expect(again.acceptedAt).toEqual(NOW);
    expect(fresh.acceptedAt).toEqual(LATER);
    const list = await repository.listByUser(ana.id);
    expect(list.map((consent) => consent.version)).toEqual(['2026-10', '2026-10', '2027-02']);
  });

  it('no admite consentimientos de un usuario que no existe', async () => {
    await expect(
      repository.add('0199a8a0-0000-7000-8000-0000000000ff', initial[0] as Consent),
    ).rejects.toThrow();
  });
});
