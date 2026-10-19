import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { editHome, type Home, type HomeLocation, newDraft } from '../../../domain/home/home.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleHomeOwnership } from './drizzle-home-ownership.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const NOW = new Date('2026-10-19T10:00:00.000Z');
const LOCATION: HomeLocation = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};
const ADDRESS = 'Calle del Pez, 12, 28004 Madrid, España';
const OWNER = '0199c1a2-0000-7000-8000-0000000000a1';
const OTHER = '0199c1a2-0000-7000-8000-0000000000a2';
const key = randomBytes(32);

let connection: DatabaseConnection;
let repository: DrizzleHomeRepository;
let ownership: DrizzleHomeOwnership;

const homeId = (n: number) => `0199c1a2-0000-7000-8000-00000000010${String(n)}`;

function draft(n: number, ownerId = OWNER, createdAt = NOW): Home {
  return newDraft({
    id: homeId(n),
    ownerId,
    now: createdAt,
    type: 'piso',
    address: ADDRESS,
    location: LOCATION,
    details: {
      usefulM2: 82.5,
      bedrooms: 3,
      hasLift: false,
      features: { terrace: true, heating: 'central' },
      valueMinCents: 250_000_00,
      valueMaxCents: 280_000_00,
      vppQualificationDate: '2005-03-01',
    },
  });
}

beforeAll(async () => {
  connection = createDatabase(inject('databaseUrl'));
  repository = new DrizzleHomeRepository(connection.db, new AddressCipher(new Map([[1, key]]), 1));
  ownership = new DrizzleHomeOwnership(connection.db);
  await sql`TRUNCATE users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  await users.insertWithConsents(
    makeUser({ id: OWNER, firebaseUid: 'uid-owner', email: 'owner@example.com' }),
    [],
  );
  await users.insertWithConsents(
    makeUser({ id: OTHER, firebaseUid: 'uid-other', email: 'other@example.com' }),
    [],
  );
});

beforeEach(async () => {
  await sql`TRUNCATE homes`;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleHomeRepository', () => {
  it('guarda y recupera una vivienda con su ubicación, sus números, sus fechas y sus características', async () => {
    const home = draft(1);

    await repository.insert(home);
    const stored = await repository.findById(home.id);

    expect(stored).toEqual(home);
  });

  it('Scenario: Ubicación y dirección privada - la dirección se guarda cifrada y se descifra al leer', async () => {
    await repository.insert(draft(1));

    const [row] = await sql<
      { raw: string }[]
    >`SELECT encode(exact_address, 'escape') AS raw FROM homes`;

    expect(row?.raw).not.toContain('Calle del Pez');
    expect((await repository.findById(homeId(1)))?.address).toBe(ADDRESS);
  });

  it('no encuentra una vivienda inexistente', async () => {
    expect(await repository.findById(homeId(9))).toBeNull();
  });

  it('save actualiza los datos y el estado, y conserva el propietario y la fecha de alta', async () => {
    const home = draft(1);
    await repository.insert(home);
    const edited = {
      ...editHome(home, { bedrooms: 4, locationVisibility: 'exact' }, NOW),
      status: 'in_review' as const,
      relevantChangedAt: NOW,
    };

    await repository.save(edited);

    expect(await repository.findById(home.id)).toEqual(edited);
  });

  it('save cambia también la dirección y la ubicación resueltas', async () => {
    const home = draft(1);
    await repository.insert(home);
    const moved = editHome(
      home,
      {
        place: {
          address: 'Calle de Ibiza, 30',
          location: {
            exact: { lat: 40.4197, lng: -3.6706 },
            areaName: 'Retiro',
            areaCenter: { lat: 40.4153, lng: -3.6844 },
          },
        },
      },
      NOW,
    );

    await repository.save(moved);

    expect(await repository.findById(home.id)).toMatchObject({
      address: 'Calle de Ibiza, 30',
      location: { areaName: 'Retiro', areaCenter: { lat: 40.4153, lng: -3.6844 } },
    });
  });

  it('save de una vivienda inexistente es un error, no un alta silenciosa', async () => {
    await expect(repository.save(draft(7))).rejects.toThrow(/inexistente/);
  });

  it('lista solo las viviendas del propietario, de la más antigua a la más reciente', async () => {
    await repository.insert(draft(2, OWNER, new Date('2026-10-20T10:00:00.000Z')));
    await repository.insert(draft(1, OWNER, NOW));
    await repository.insert(draft(3, OTHER));

    const homes = await repository.listByOwner(OWNER);

    expect(homes.map((home) => home.id)).toEqual([homeId(1), homeId(2)]);
    expect(await repository.listByOwner('0199c1a2-0000-7000-8000-0000000000ff')).toEqual([]);
  });

  it('un punto se guarda como geografía WGS84 real consultable con PostGIS', async () => {
    await repository.insert(draft(1));

    const [row] = await sql<{ srid: number; metres: number }[]>`
      SELECT ST_SRID(exact_location::geometry) AS srid,
             ST_Distance(exact_location, approx_location) AS metres
      FROM homes`;

    expect(row?.srid).toBe(4326);
    expect(row?.metres).toBeGreaterThan(100);
    expect(row?.metres).toBeLessThan(300);
  });
});

describe('DrizzleHomeOwnership', () => {
  async function withStatus(n: number, status: Home['status'], ownerId = OWNER) {
    await repository.insert({ ...draft(n, ownerId), status });
  }

  it('Scenario: Sin vivienda publicada - sin viviendas o solo con borrador o en revisión no es propietario', async () => {
    expect(await ownership.hasPublishedHome(OWNER)).toBe(false);

    await withStatus(1, 'draft');
    await withStatus(2, 'in_review');
    await withStatus(3, 'closed');

    expect(await ownership.hasPublishedHome(OWNER)).toBe(false);
  });

  it.each(['published', 'paused', 'in_operation'] as const)(
    'una vivienda en %s hace propietario a su dueño',
    async (status) => {
      await withStatus(1, 'draft');
      await withStatus(2, status);

      expect(await ownership.hasPublishedHome(OWNER)).toBe(true);
    },
  );

  it('la vivienda publicada de otro no cuenta', async () => {
    await withStatus(1, 'published', OTHER);

    expect(await ownership.hasPublishedHome(OWNER)).toBe(false);
    expect(await ownership.hasPublishedHome(OTHER)).toBe(true);
  });
});
