import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { openSql } from '../../../../test/fixtures.js';
import { runMigrations } from './migrate.js';

const admin = openSql(inject('adminUrl'));
const MIGRATIONS = resolve(import.meta.dirname, '../../../../../../db/migrations');
const EMPTY_DB = 'empty_for_migration';
const ROLE_DB = 'migration_with_app_role';
const NO_ROLE_DB = 'migration_without_app_role';
/** Rol con el que se conectará la API en DES y PROD; la migración le quita lo que el log de auditoría no admite. */
const APP_ROLE = 'changehouse_app';

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

  it('GIVEN la base migrada WHEN se inspecciona THEN homes tiene columnas PostGIS, dirección cifrada, visibilidad por defecto area y propietario con FK', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const columns = await target<{ column_name: string; udt_name: string; is_nullable: string }[]>`
      SELECT column_name, udt_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'homes'
        AND column_name IN ('id', 'owner_id', 'status', 'type', 'regime', 'location_visibility',
                            'exact_address', 'exact_location', 'approx_location', 'area_name',
                            'relevant_changed_at', 'features', 'value_min_cents', 'useful_m2')
      ORDER BY column_name`;
    const defaults = await target<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'homes' AND column_name IN ('location_visibility', 'status', 'regime')
      ORDER BY column_name`;
    const references = await target<{ delete_rule: string }[]>`
      SELECT delete_rule FROM information_schema.referential_constraints
      WHERE constraint_name = 'homes_owner_id_users_id_fk'`;
    await target.end();

    expect(columns).toEqual([
      { column_name: 'approx_location', udt_name: 'geography', is_nullable: 'NO' },
      { column_name: 'area_name', udt_name: 'text', is_nullable: 'NO' },
      { column_name: 'exact_address', udt_name: 'bytea', is_nullable: 'NO' },
      { column_name: 'exact_location', udt_name: 'geography', is_nullable: 'NO' },
      { column_name: 'features', udt_name: 'jsonb', is_nullable: 'NO' },
      { column_name: 'id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'location_visibility', udt_name: 'location_visibility', is_nullable: 'NO' },
      { column_name: 'owner_id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'regime', udt_name: 'home_regime', is_nullable: 'NO' },
      { column_name: 'relevant_changed_at', udt_name: 'timestamptz', is_nullable: 'YES' },
      { column_name: 'status', udt_name: 'home_status', is_nullable: 'NO' },
      { column_name: 'type', udt_name: 'home_type', is_nullable: 'NO' },
      { column_name: 'useful_m2', udt_name: 'numeric', is_nullable: 'YES' },
      { column_name: 'value_min_cents', udt_name: 'int8', is_nullable: 'YES' },
    ]);
    expect(defaults.map((row) => row.column_default)).toEqual([
      "'area'::location_visibility",
      "'libre'::home_regime",
      "'draft'::home_status",
    ]);
    expect(references).toEqual([{ delete_rule: 'RESTRICT' }]);
  });

  it('GIVEN la base migrada WHEN se inspecciona THEN home_photos cuelga de homes en cascada, con estado pending por defecto, posición 1-20 y única por vivienda', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const columns = await target<{ column_name: string; udt_name: string; is_nullable: string }[]>`
      SELECT column_name, udt_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'home_photos' ORDER BY column_name`;
    const status = await target<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'home_photos' AND column_name = 'status'`;
    const references = await target<{ delete_rule: string }[]>`
      SELECT delete_rule FROM information_schema.referential_constraints
      WHERE constraint_name = 'home_photos_home_id_homes_id_fk'`;
    const constraints = await target<{ conname: string; contype: string }[]>`
      SELECT conname, contype FROM pg_constraint
      WHERE conrelid = 'home_photos'::regclass AND contype IN ('c', 'u') ORDER BY conname`;
    await target.end();

    expect(columns).toEqual([
      { column_name: 'created_at', udt_name: 'timestamptz', is_nullable: 'NO' },
      { column_name: 'home_id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'position', udt_name: 'int2', is_nullable: 'YES' },
      { column_name: 'status', udt_name: 'photo_status', is_nullable: 'NO' },
      { column_name: 'storage_path', udt_name: 'text', is_nullable: 'NO' },
    ]);
    expect(status).toEqual([{ column_default: "'pending'::photo_status" }]);
    expect(references).toEqual([{ delete_rule: 'CASCADE' }]);
    expect(constraints).toEqual([
      { conname: 'home_photos_home_id_position_key', contype: 'u' },
      { conname: 'home_photos_position_range', contype: 'c' },
      { conname: 'home_photos_ready_has_position', contype: 'c' },
    ]);
  });

  it('GIVEN la base migrada WHEN se inspecciona THEN homes tiene submitted_at (timestamptz, nula) y audit_log tiene id identidad bigint, actor con FK RESTRICT y todas las columnas obligatorias', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const submitted = await target<{ udt_name: string; is_nullable: string }[]>`
      SELECT udt_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'homes' AND column_name = 'submitted_at'`;
    const columns = await target<
      { column_name: string; udt_name: string; is_nullable: string; is_identity: string }[]
    >`
      SELECT column_name, udt_name, is_nullable, is_identity FROM information_schema.columns
      WHERE table_name = 'audit_log' ORDER BY column_name`;
    const references = await target<{ delete_rule: string }[]>`
      SELECT delete_rule FROM information_schema.referential_constraints
      WHERE constraint_name = 'audit_log_actor_id_users_id_fk'`;
    await target.end();

    expect(submitted).toEqual([{ udt_name: 'timestamptz', is_nullable: 'YES' }]);
    expect(columns).toEqual([
      { column_name: 'action', udt_name: 'text', is_nullable: 'NO', is_identity: 'NO' },
      { column_name: 'actor_id', udt_name: 'uuid', is_nullable: 'NO', is_identity: 'NO' },
      { column_name: 'at', udt_name: 'timestamptz', is_nullable: 'NO', is_identity: 'NO' },
      { column_name: 'entity', udt_name: 'text', is_nullable: 'NO', is_identity: 'NO' },
      { column_name: 'entity_id', udt_name: 'uuid', is_nullable: 'NO', is_identity: 'NO' },
      { column_name: 'id', udt_name: 'int8', is_nullable: 'NO', is_identity: 'YES' },
    ]);
    expect(references).toEqual([{ delete_rule: 'RESTRICT' }]);
  });

  it('Scenario: Decisión auditada - audit_log es de solo inserción: un disparador rechaza UPDATE y DELETE, incluso al superusuario', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const actor = '0199c1a2-0000-7000-8000-0000000000b1';
    await target`INSERT INTO users (id, firebase_uid, email, display_name)
                 VALUES (${actor}, 'uid-audit', 'audit@example.com', 'Admin')`;
    await target`INSERT INTO audit_log (actor_id, action, entity, entity_id)
                 VALUES (${actor}, 'home.approve', 'home', ${actor})`;

    const update = target`UPDATE audit_log SET action = 'home.reject'`;
    const remove = target`DELETE FROM audit_log`;
    const [kept] = await target<{ action: string; at: Date }[]>`SELECT action, at FROM audit_log`;
    await expect(update).rejects.toThrow(/solo inserci/);
    await expect(remove).rejects.toThrow(/solo inserci/);
    await target.end();

    expect(kept?.action).toBe('home.approve');
    expect(kept?.at).toBeInstanceOf(Date);
  });

  it('el rol de la aplicación pierde UPDATE, DELETE y TRUNCATE sobre audit_log y conserva INSERT y SELECT', async () => {
    await admin.unsafe(`DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE};
      END IF; END $do$`);
    await admin.unsafe(`CREATE DATABASE ${ROLE_DB}`);
    const target = openSql(urlFor(ROLE_DB));
    // Cualquier tabla que cree la migración nace con todos los permisos para el rol de la aplicación
    await target.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${APP_ROLE}`,
    );
    await target.end();

    await runMigrations(urlFor(ROLE_DB), MIGRATIONS);

    const check = openSql(urlFor(ROLE_DB));
    const privileges = await check<{ privilege: string; allowed: boolean }[]>`
      SELECT p AS privilege, has_table_privilege(${APP_ROLE}, 'audit_log', p) AS allowed
      FROM unnest(ARRAY['INSERT', 'SELECT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p`;
    const homes = await check<{ allowed: boolean }[]>`
      SELECT has_table_privilege(${APP_ROLE}, 'homes', 'UPDATE') AS allowed`;
    await check.end();

    expect(privileges).toEqual([
      { privilege: 'INSERT', allowed: true },
      { privilege: 'SELECT', allowed: true },
      { privilege: 'UPDATE', allowed: false },
      { privilege: 'DELETE', allowed: false },
      { privilege: 'TRUNCATE', allowed: false },
    ]);
    expect(homes).toEqual([{ allowed: true }]);
  });

  it('la migración no falla si el rol de la aplicación no existe (local y pruebas)', async () => {
    await admin.unsafe(`CREATE DATABASE ${NO_ROLE_DB}`);
    await admin.unsafe(`DROP DATABASE ${ROLE_DB}`);
    await admin.unsafe(`DROP ROLE ${APP_ROLE}`);

    await expect(runMigrations(urlFor(NO_ROLE_DB), MIGRATIONS)).resolves.toBeUndefined();
  });

  it('es repetible: aplicar de nuevo no falla', async () => {
    await expect(runMigrations(urlFor(EMPTY_DB), MIGRATIONS)).resolves.toBeUndefined();
  });
});
