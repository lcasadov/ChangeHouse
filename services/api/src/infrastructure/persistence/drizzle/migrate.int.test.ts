import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { openSql } from '../../../../test/fixtures.js';
import { runMigrations } from './migrate.js';

const admin = openSql(inject('adminUrl'));
const MIGRATIONS = resolve(import.meta.dirname, '../../../../../../db/migrations');
const EMPTY_DB = 'empty_for_migration';
const ROLE_DB = 'migration_with_app_role';
const NO_ROLE_DB = 'migration_without_app_role';
const BACKFILL_DB = 'migration_discovery_backfill';
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

  it('GIVEN la base migrada WHEN se inspecciona THEN search_preferences tiene centro PostGIS, municipios normalizados, usuario y vivienda con FK y valor de referencia 50 por defecto', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const columns = await target<{ column_name: string; udt_name: string; is_nullable: string }[]>`
      SELECT column_name, udt_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'search_preferences' ORDER BY column_name`;
    const reference = await target<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'search_preferences' AND column_name = 'value_reference_pct'`;
    const references = await target<{ constraint_name: string; delete_rule: string }[]>`
      SELECT constraint_name, delete_rule FROM information_schema.referential_constraints
      WHERE constraint_name LIKE 'search_preferences_%' ORDER BY constraint_name`;
    await target.end();

    expect(columns).toEqual([
      { column_name: 'center', udt_name: 'geography', is_nullable: 'YES' },
      { column_name: 'filters', udt_name: 'jsonb', is_nullable: 'NO' },
      { column_name: 'home_id', udt_name: 'uuid', is_nullable: 'YES' },
      { column_name: 'id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'max_to_pay_cents', udt_name: 'int8', is_nullable: 'NO' },
      { column_name: 'min_to_receive_cents', udt_name: 'int8', is_nullable: 'NO' },
      { column_name: 'municipalities', udt_name: '_text', is_nullable: 'NO' },
      { column_name: 'municipalities_normalized', udt_name: '_text', is_nullable: 'NO' },
      { column_name: 'radius_km', udt_name: 'numeric', is_nullable: 'YES' },
      { column_name: 'user_id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'value_reference_pct', udt_name: 'int2', is_nullable: 'NO' },
    ]);
    expect(reference).toEqual([{ column_default: '50' }]);
    expect(references).toEqual([
      { constraint_name: 'search_preferences_home_id_homes_id_fk', delete_rule: 'CASCADE' },
      { constraint_name: 'search_preferences_user_id_users_id_fk', delete_rule: 'RESTRICT' },
    ]);
  });

  it('Scenario: Guardar preferencias - dos preferencias por defecto del mismo usuario violan la unicidad, y una por vivienda también', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const user = '0199c1a2-0000-7000-8000-0000000000c1';
    const home = '0199c1a2-0000-7000-8000-0000000000c2';
    await target`INSERT INTO users (id, firebase_uid, email, display_name)
                 VALUES (${user}, 'uid-prefs', 'prefs@example.com', 'Ana')`;
    await target`INSERT INTO homes (id, owner_id, type, exact_address, exact_location, approx_location, area_name)
                 VALUES (${home}, ${user}, 'piso', ${Buffer.from('x')},
                         ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography,
                         ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography, 'Malasaña')`;
    const insert = (id: string, homeId: string | null) => target`
      INSERT INTO search_preferences (id, user_id, home_id, municipalities, municipalities_normalized,
                                      max_to_pay_cents, min_to_receive_cents)
      VALUES (${id}, ${user}, ${homeId}, ARRAY['Getafe'], ARRAY['getafe'], 3000000, 0)`;

    await insert('0199c1a2-0000-7000-8000-0000000000d1', null);
    await expect(insert('0199c1a2-0000-7000-8000-0000000000d2', null)).rejects.toThrow(
      /search_preferences_user_default_key/,
    );
    await insert('0199c1a2-0000-7000-8000-0000000000d3', home);
    await expect(insert('0199c1a2-0000-7000-8000-0000000000d4', home)).rejects.toThrow(
      /search_preferences_home_key/,
    );
    const [defaults] = await target<{ value_reference_pct: number }[]>`
      SELECT value_reference_pct FROM search_preferences WHERE home_id IS NULL`;
    await target`DELETE FROM homes WHERE id = ${home}`;
    const [left] = await target<
      { total: string }[]
    >`SELECT count(*) AS total FROM search_preferences`;
    await target.end();

    expect(defaults?.value_reference_pct).toBe(50);
    expect(left?.total).toBe('1');
  });

  it('search_preferences exige una zona, centro y radio juntos, radio entre 0 y 200 km y referencia entre 0 y 100', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const user = '0199c1a2-0000-7000-8000-0000000000e1';
    await target`INSERT INTO users (id, firebase_uid, email, display_name)
                 VALUES (${user}, 'uid-checks', 'checks@example.com', 'Beto')`;
    const insert = (
      zone: { municipalities?: string[]; radius?: number | null; centre?: boolean },
      pct = 50,
    ) => target`
      INSERT INTO search_preferences (id, user_id, center, radius_km, municipalities,
                 municipalities_normalized, max_to_pay_cents, min_to_receive_cents, value_reference_pct)
      VALUES (${crypto.randomUUID()}, ${user},
        ${zone.centre ? target`ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography` : null},
        ${zone.radius ?? null}, ${zone.municipalities ?? []}, ${zone.municipalities ?? []}, 0, 0, ${pct})`;

    await expect(insert({})).rejects.toThrow(/search_preferences_has_zone/);
    await expect(insert({ centre: true, municipalities: ['a'] })).rejects.toThrow(
      /search_preferences_center_with_radius/,
    );
    await expect(insert({ radius: 5, municipalities: ['a'] })).rejects.toThrow(
      /search_preferences_center_with_radius/,
    );
    await expect(insert({ centre: true, radius: 0 })).rejects.toThrow(
      /search_preferences_radius_range/,
    );
    await expect(insert({ centre: true, radius: 201 })).rejects.toThrow(
      /search_preferences_radius_range/,
    );
    await expect(insert({ municipalities: ['a'] }, 101)).rejects.toThrow(
      /search_preferences_reference_range/,
    );
    await target.end();
  });

  it('GIVEN la base migrada WHEN se inspecciona THEN existen dismissals (PK compuesta, en cascada, sin descartarse a sí misma), homes.published_at, el municipio y los índices del descubrimiento', async () => {
    const target = openSql(urlFor(EMPTY_DB));
    const columns = await target<{ column_name: string; udt_name: string; is_nullable: string }[]>`
      SELECT column_name, udt_name, is_nullable FROM information_schema.columns
      WHERE (table_name = 'homes'
             AND column_name IN ('published_at', 'municipality', 'municipality_normalized'))
         OR table_name = 'dismissals'
      ORDER BY table_name, column_name`;
    const references = await target<{ constraint_name: string; delete_rule: string }[]>`
      SELECT constraint_name, delete_rule FROM information_schema.referential_constraints
      WHERE constraint_name LIKE 'dismissals_%' ORDER BY constraint_name`;
    const indexes = await target<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN ('homes_discovery_feed_idx', 'homes_approx_location_published_idx',
                          'homes_exact_location_published_idx', 'homes_municipality_published_idx',
                          'search_preferences_center_idx', 'search_preferences_municipalities_idx',
                          'dismissals_home_id_dismissed_home_id_pk')
      ORDER BY indexname`;
    const user = '0199c1a2-0000-7000-8000-0000000000f1';
    const home = '0199c1a2-0000-7000-8000-0000000000f2';
    await target`INSERT INTO users (id, firebase_uid, email, display_name)
                 VALUES (${user}, 'uid-dismiss', 'dismiss@example.com', 'Ana')`;
    await target`INSERT INTO homes (id, owner_id, type, exact_address, exact_location, approx_location, area_name)
                 VALUES (${home}, ${user}, 'piso', ${Buffer.from('x')},
                         ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography,
                         ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography, 'Malasaña')`;
    const selfDismissal = target`INSERT INTO dismissals (home_id, dismissed_home_id)
                                 VALUES (${home}, ${home})`;
    await expect(selfDismissal).rejects.toThrow(/dismissals_not_self/);
    await target`DELETE FROM homes WHERE id = ${home}`;
    await target`DELETE FROM users WHERE id = ${user}`;
    await target.end();

    expect(columns).toEqual([
      { column_name: 'created_at', udt_name: 'timestamptz', is_nullable: 'NO' },
      { column_name: 'dismissed_home_id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'home_id', udt_name: 'uuid', is_nullable: 'NO' },
      { column_name: 'municipality', udt_name: 'text', is_nullable: 'YES' },
      { column_name: 'municipality_normalized', udt_name: 'text', is_nullable: 'YES' },
      { column_name: 'published_at', udt_name: 'timestamptz', is_nullable: 'YES' },
    ]);
    expect(references).toEqual([
      { constraint_name: 'dismissals_dismissed_home_id_homes_id_fk', delete_rule: 'CASCADE' },
      { constraint_name: 'dismissals_home_id_homes_id_fk', delete_rule: 'CASCADE' },
    ]);
    expect(indexes.map((row) => row.indexname)).toEqual([
      'dismissals_home_id_dismissed_home_id_pk',
      'homes_approx_location_published_idx',
      'homes_discovery_feed_idx',
      'homes_exact_location_published_idx',
      'homes_municipality_published_idx',
      'search_preferences_center_idx',
      'search_preferences_municipalities_idx',
    ]);
  });

  it('GIVEN viviendas ya publicadas antes de la migración WHEN se aplica THEN reciben su fecha de publicación y las demás no', async () => {
    // Las migraciones hasta la 0006 en una carpeta aparte: la base queda como antes de este cambio
    const before = await mkdtemp(join(tmpdir(), 'migrations-0006-'));
    await cp(MIGRATIONS, before, { recursive: true });
    const journalPath = join(before, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
      entries: { tag: string }[];
    };
    journal.entries = journal.entries.filter((entry) => entry.tag <= '0006');
    await writeFile(journalPath, JSON.stringify(journal));
    await admin.unsafe(`CREATE DATABASE ${BACKFILL_DB}`);
    await runMigrations(urlFor(BACKFILL_DB), before);
    await rm(before, { recursive: true, force: true });

    const target = openSql(urlFor(BACKFILL_DB));
    const user = '0199c1a2-0000-7000-8000-0000000000f3';
    await target`INSERT INTO users (id, firebase_uid, email, display_name)
                 VALUES (${user}, 'uid-backfill', 'backfill@example.com', 'Ana')`;
    const insertHome = (id: string, status: string, submittedAt: string | null) => target`
      INSERT INTO homes (id, owner_id, type, status, exact_address, exact_location, approx_location,
                         area_name, submitted_at, created_at)
      VALUES (${id}, ${user}, 'piso', ${status}, ${Buffer.from('x')},
              ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography,
              ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography, 'Malasaña',
              ${submittedAt}, '2026-10-01T09:00:00.123456Z')`;
    await insertHome('0199c1a2-0000-7000-8000-0000000000a1', 'published', '2026-10-02T09:00:00Z');
    await insertHome('0199c1a2-0000-7000-8000-0000000000a2', 'published', null);
    await insertHome('0199c1a2-0000-7000-8000-0000000000a3', 'paused', '2026-10-03T09:00:00Z');
    await insertHome('0199c1a2-0000-7000-8000-0000000000a4', 'in_review', '2026-10-04T09:00:00Z');
    await insertHome('0199c1a2-0000-7000-8000-0000000000a5', 'draft', null);
    await target.end();

    await runMigrations(urlFor(BACKFILL_DB), MIGRATIONS);

    const check = openSql(urlFor(BACKFILL_DB));
    const rows = await check<{ status: string; published_at: Date | null }[]>`
      SELECT status, published_at FROM homes ORDER BY id`;
    await check.end();
    expect(rows).toEqual([
      { status: 'published', published_at: new Date('2026-10-02T09:00:00.000Z') },
      { status: 'published', published_at: new Date('2026-10-01T09:00:00.123Z') },
      { status: 'paused', published_at: new Date('2026-10-03T09:00:00.000Z') },
      { status: 'in_review', published_at: null },
      { status: 'draft', published_at: null },
    ]);
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
