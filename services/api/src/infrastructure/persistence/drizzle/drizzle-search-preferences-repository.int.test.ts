import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { newDraft } from '../../../domain/home/home.js';
import {
  newSearchPreferences,
  type SearchPreferences,
} from '../../../domain/search-preferences/search-preferences.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleSearchPreferencesRepository } from './drizzle-search-preferences-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const NOW = new Date('2026-10-19T10:00:00.000Z');
const OWNER = '0199c1a2-0000-7000-8000-0000000000f1';
const OTHER = '0199c1a2-0000-7000-8000-0000000000f2';
const HOME = '0199c1a2-0000-7000-8000-000000000401';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};
const AMOUNTS = { maxToPayCents: 30_000_00, minToReceiveCents: 0, valueReferencePct: 50 };
const id = (n: number) => `0199c1a2-0000-7000-8000-0000000005${String(n).padStart(2, '0')}`;

let connection: DatabaseConnection;
let repository: DrizzleSearchPreferencesRepository;

const GETAFE: SearchPreferences = newSearchPreferences({
  ...AMOUNTS,
  municipalities: ['Getafe', 'Alcalá de Henares'],
  filters: { types: ['piso'], minBedrooms: 3, garage: true },
});
const RADIUS: SearchPreferences = newSearchPreferences({
  ...AMOUNTS,
  center: { lat: 39.4699, lng: -0.3763 },
  radiusKm: 12.5,
  valueReferencePct: 80,
});

beforeAll(async () => {
  connection = createDatabase(inject('databaseUrl'));
  repository = new DrizzleSearchPreferencesRepository(connection.db);
  await sql`TRUNCATE users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  await users.insertWithConsents(
    makeUser({ id: OWNER, firebaseUid: 'uid-prefs-1', email: 'prefs1@example.com' }),
    [],
  );
  await users.insertWithConsents(
    makeUser({ id: OTHER, firebaseUid: 'uid-prefs-2', email: 'prefs2@example.com' }),
    [],
  );
  await new DrizzleHomeRepository(
    connection.db,
    new AddressCipher(new Map([[1, randomBytes(32)]]), 1),
  ).insert(
    newDraft({
      id: HOME,
      ownerId: OWNER,
      now: NOW,
      type: 'piso',
      address: 'Calle del Pez, 12',
      location: LOCATION,
    }),
  );
});

beforeEach(async () => {
  await sql`TRUNCATE search_preferences`;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleSearchPreferencesRepository', () => {
  it('Scenario: Guardar preferencias - guarda las del usuario y las devuelve tal cual, con su forma normalizada para comparar', async () => {
    await repository.upsert({ userId: OWNER, homeId: null }, id(1), GETAFE);

    await expect(repository.find({ userId: OWNER, homeId: null })).resolves.toEqual(GETAFE);
    const [row] = await sql<{ municipalities_normalized: string[]; home_id: string | null }[]>`
      SELECT municipalities_normalized, home_id FROM search_preferences`;
    expect(row).toEqual({
      municipalities_normalized: ['getafe', 'alcala de henares'],
      home_id: null,
    });
  });

  it('guarda y recupera un punto con radio sin perder precisión', async () => {
    await repository.upsert({ userId: OWNER, homeId: null }, id(1), RADIUS);

    const found = await repository.find({ userId: OWNER, homeId: null });

    expect(found).toEqual(RADIUS);
    expect(found?.center).toEqual({ lat: 39.4699, lng: -0.3763 });
  });

  it('guardar de nuevo reemplaza el documento entero, conserva la fila y no deja la zona anterior', async () => {
    await repository.upsert({ userId: OWNER, homeId: null }, id(1), GETAFE);

    await repository.upsert({ userId: OWNER, homeId: null }, id(2), RADIUS);

    await expect(repository.find({ userId: OWNER, homeId: null })).resolves.toEqual(RADIUS);
    const rows = await sql<{ id: string }[]>`SELECT id FROM search_preferences`;
    expect(rows).toEqual([{ id: id(1) }]);
  });

  it('Scenario: Preferencias distintas para una segunda vivienda - las de la vivienda y las del usuario conviven', async () => {
    await repository.upsert({ userId: OWNER, homeId: null }, id(1), GETAFE);
    await repository.upsert({ userId: OWNER, homeId: HOME }, id(2), RADIUS);

    await expect(repository.find({ userId: OWNER, homeId: null })).resolves.toEqual(GETAFE);
    await expect(repository.find({ userId: OWNER, homeId: HOME })).resolves.toEqual(RADIUS);
    await expect(repository.find({ userId: OTHER, homeId: null })).resolves.toBeNull();
  });

  it('Scenario: Volver a las del usuario - eliminar las de la vivienda no toca las del usuario y repetirlo informa de que no había', async () => {
    await repository.upsert({ userId: OWNER, homeId: null }, id(1), GETAFE);
    await repository.upsert({ userId: OWNER, homeId: HOME }, id(2), RADIUS);

    const first = await repository.deleteForHome(HOME);
    const second = await repository.deleteForHome(HOME);

    expect(first).toBe(true);
    expect(second).toBe(false);
    await expect(repository.find({ userId: OWNER, homeId: HOME })).resolves.toBeNull();
    await expect(repository.find({ userId: OWNER, homeId: null })).resolves.toEqual(GETAFE);
  });
});
