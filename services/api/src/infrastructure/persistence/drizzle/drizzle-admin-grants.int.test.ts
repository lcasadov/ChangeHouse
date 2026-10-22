import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { grantAdmin } from '../../../application/account/admin-grant.js';
import { UserHasActiveHomesError, UserNotFoundError } from '../../../application/account/errors.js';
import { newDraft } from '../../../domain/home/home.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleAdminGrants } from './drizzle-admin-grants.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const run = promisify(execFile);
const sql = openSql();
const ANA = '0199c1a2-0000-7000-8000-0000000000d1';
const BETO = '0199c1a2-0000-7000-8000-0000000000d2';
const API_ROOT = resolve(import.meta.dirname, '../../../..');
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};

let connection: DatabaseConnection;
let grants: DrizzleAdminGrants;
let homes: DrizzleHomeRepository;
const events: unknown[] = [];

const roleOf = async (id: string) =>
  (
    await sql<{ assigned_role: string | null }[]>`SELECT assigned_role FROM users WHERE id = ${id}`
  )[0]?.assigned_role;

beforeAll(() => {
  connection = createDatabase(inject('databaseUrl'));
  grants = new DrizzleAdminGrants(connection.db);
  homes = new DrizzleHomeRepository(
    connection.db,
    new AddressCipher(new Map([[1, Buffer.alloc(32, 3)]]), 1),
  );
});

beforeEach(async () => {
  events.length = 0;
  await sql`TRUNCATE users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  await users.insertWithConsents(
    makeUser({ id: ANA, firebaseUid: 'uid-ana', email: 'Ana@Example.com' }),
    [],
  );
  await users.insertWithConsents(
    makeUser({ id: BETO, firebaseUid: 'uid-beto', email: 'beto@example.com' }),
    [],
  );
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('admin:grant contra PostgreSQL', () => {
  it('Scenario: Asignar el rol de administración - fija assigned_role = admin (el email no distingue mayúsculas) y no escribe en audit_log', async () => {
    await grantAdmin({ grants, log: (event) => events.push(event) }, 'ana@example.com');

    expect(await roleOf(ANA)).toBe('admin');
    expect(await roleOf(BETO)).toBeNull();
    expect(await sql`SELECT 1 FROM audit_log`).toHaveLength(0);
    expect(events).toEqual([{ event: 'admin.granted', userId: ANA, previousRole: null }]);
  });

  it('un usuario inexistente falla y no cambia a nadie', async () => {
    await expect(
      grantAdmin({ grants, log: (event) => events.push(event) }, 'nadie@example.com'),
    ).rejects.toBeInstanceOf(UserNotFoundError);

    expect(await roleOf(ANA)).toBeNull();
  });

  it.each(['draft', 'in_review', 'published', 'paused'] as const)(
    'un usuario con una vivienda en %s falla y conserva su rol',
    async (status) => {
      await homes.insert({
        ...newDraft({
          id: '0199c1a2-0000-7000-8000-000000000601',
          ownerId: ANA,
          now: new Date('2026-10-19T10:00:00.000Z'),
          type: 'piso',
          address: 'Calle del Pez, 12',
          location: LOCATION,
        }),
        status,
      });

      await expect(
        grantAdmin({ grants, log: (event) => events.push(event) }, 'ana@example.com'),
      ).rejects.toBeInstanceOf(UserHasActiveHomesError);

      expect(await roleOf(ANA)).toBeNull();
    },
  );

  it('una vivienda cerrada no impide la concesión', async () => {
    await homes.insert({
      ...newDraft({
        id: '0199c1a2-0000-7000-8000-000000000602',
        ownerId: ANA,
        now: new Date('2026-10-19T10:00:00.000Z'),
        type: 'piso',
        address: 'Calle del Pez, 12',
        location: LOCATION,
      }),
      status: 'closed',
    });

    await grantAdmin({ grants, log: (event) => events.push(event) }, 'ana@example.com');

    expect(await roleOf(ANA)).toBe('admin');
  });

  it('el script `pnpm admin:grant <email>` concede el rol, deja un registro JSON y sale con 0', async () => {
    const result = await run(
      process.execPath,
      ['--import', 'tsx', 'scripts/admin-grant.ts', 'beto@example.com'],
      { cwd: API_ROOT, env: { ...process.env, DATABASE_URL: inject('databaseUrl') } },
    );

    expect(await roleOf(BETO)).toBe('admin');
    expect(JSON.parse(result.stdout.trim())).toEqual({
      event: 'admin.granted',
      userId: BETO,
      previousRole: null,
    });
  });

  it('el script sale con código 1 y un mensaje claro si el usuario no existe, y con 2 si falta el email', async () => {
    const env = { ...process.env, DATABASE_URL: inject('databaseUrl') };

    const missing = await run(
      process.execPath,
      ['--import', 'tsx', 'scripts/admin-grant.ts', 'x@y.es'],
      {
        cwd: API_ROOT,
        env,
      },
    ).catch((error: { code: number; stderr: string }) => error);
    const noArgs = await run(process.execPath, ['--import', 'tsx', 'scripts/admin-grant.ts'], {
      cwd: API_ROOT,
      env,
    }).catch((error: { code: number; stderr: string }) => error);

    expect(missing).toMatchObject({ code: 1 });
    expect((missing as { stderr: string }).stderr).toContain('No existe ningún usuario');
    expect(noArgs).toMatchObject({ code: 2 });
    expect((noArgs as { stderr: string }).stderr).toContain('Uso:');
    expect(await sql`SELECT 1 FROM users WHERE assigned_role = 'admin'`).toHaveLength(0);
  });
});
