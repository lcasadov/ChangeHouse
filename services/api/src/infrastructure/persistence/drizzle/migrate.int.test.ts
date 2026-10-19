import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { openSql } from '../../../../test/fixtures.js';
import { runMigrations } from './migrate.js';

const admin = openSql(inject('adminUrl'));
const MIGRATIONS = resolve(import.meta.dirname, '../../../../../../db/migrations');
const EMPTY_DB = 'empty_for_migration';

function urlFor(database: string): string {
  const url = new URL(inject('adminUrl'));
  url.pathname = `/${database}`;
  return url.toString();
}

beforeAll(async () => {
  await admin.unsafe(`CREATE DATABASE ${EMPTY_DB}`);
});

afterAll(async () => {
  await admin.end();
});

describe('migraciones', () => {
  it('GIVEN una base de datos vacía WHEN se migra THEN existen las extensiones y la tabla waitlist', async () => {
    await runMigrations(urlFor(EMPTY_DB), MIGRATIONS);

    const target = openSql(urlFor(EMPTY_DB));
    const extensions = await target<{ extname: string }[]>`SELECT extname FROM pg_extension`;
    const tables = await target<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'waitlist'`;
    const columns = await target<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'waitlist' ORDER BY ordinal_position`;
    await target.end();

    expect(extensions.map((row) => row.extname)).toEqual(
      expect.arrayContaining(['postgis', 'citext']),
    );
    expect(tables).toHaveLength(1);
    expect(columns.map((row) => row.column_name)).toEqual([
      'id',
      'email',
      'municipality',
      'home_type',
      'looking_for',
      'consent_at',
    ]);
  });

  it('GIVEN la base migrada WHEN se inspecciona THEN existen users (firebase_uid y email únicos) y consents (solo inserción por usuario, tipo y versión)', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const unique = await target<{ table_name: string; columns: string }[]>`
      SELECT tc.table_name, string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name IN ('users', 'consents') AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      GROUP BY tc.table_name, tc.constraint_name ORDER BY 1, 2`;
    const types = await target<{ table_name: string; column_name: string; udt_name: string }[]>`
      SELECT table_name, column_name, udt_name FROM information_schema.columns
      WHERE (table_name = 'users' AND column_name IN ('email', 'assigned_role'))
         OR (table_name = 'consents' AND column_name = 'type')
      ORDER BY 1, 2`;
    const references = await target<{ delete_rule: string }[]>`
      SELECT delete_rule FROM information_schema.referential_constraints
      WHERE constraint_name = 'consents_user_id_users_id_fk'`;
    await target.end();

    expect(unique).toEqual([
      { table_name: 'consents', columns: 'user_id,type,version' },
      { table_name: 'users', columns: 'email' },
      { table_name: 'users', columns: 'firebase_uid' },
      { table_name: 'users', columns: 'id' },
    ]);
    expect(types).toEqual([
      { table_name: 'consents', column_name: 'type', udt_name: 'consent_type' },
      { table_name: 'users', column_name: 'assigned_role', udt_name: 'assigned_role' },
      { table_name: 'users', column_name: 'email', udt_name: 'citext' },
    ]);
    expect(references).toEqual([{ delete_rule: 'RESTRICT' }]);
  });

  it('es repetible: aplicar de nuevo no falla', async () => {
    await expect(runMigrations(urlFor(EMPTY_DB), MIGRATIONS)).resolves.toBeUndefined();
  });
});
