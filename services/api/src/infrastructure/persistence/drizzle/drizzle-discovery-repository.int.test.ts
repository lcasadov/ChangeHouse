import { randomBytes } from 'node:crypto';

import type { SearchFilters, SearchPreferencesInput } from '@changehouse/shared';
import { sql as drizzleSql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import type { CandidateQuery } from '../../../application/discovery/discovery-repository.js';
import { type GeoPoint, type Home, newDraft } from '../../../domain/home/home.js';
import { newSearchPreferences } from '../../../domain/search-preferences/search-preferences.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { candidateQuerySql, DrizzleDiscoveryRepository } from './drizzle-discovery-repository.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleSearchPreferencesRepository } from './drizzle-search-preferences-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const EUR = 100;
const euros = (amount: number) => amount * EUR;

const ME = '0199c1a2-0000-7000-8000-00000000d001';
const OWNER_A = '0199c1a2-0000-7000-8000-00000000d002';
const OWNER_B = '0199c1a2-0000-7000-8000-00000000d003';
const MY_HOME = '0199c1a2-0000-7000-8000-00000000e000';
const homeId = (n: number) => `0199c1a2-0000-7000-8000-00000000e${String(n).padStart(3, '0')}`;

const POINTS = {
  getafe: { lat: 40.3056, lng: -3.7321 },
  leganes: { lat: 40.3272, lng: -3.7635 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  valencia: { lat: 39.4699, lng: -0.3763 },
} satisfies Record<string, GeoPoint>;

/** Ubicación en un municipio: el centro de la zona, a unos metros del punto exacto. */
function placeIn(municipality: string, exact: GeoPoint) {
  return {
    exact,
    areaName: `${municipality} Centro`,
    areaCenter: { lat: exact.lat + 0.001, lng: exact.lng + 0.001 },
    municipality,
  };
}

const DETAILS = {
  usefulM2: 80,
  builtM2: 95,
  bedrooms: 3,
  bathrooms: 2,
  hasLift: true,
  garage: false,
  storageRoom: false,
  isPrimaryResidence: true,
  features: { exterior: false },
};
const AMOUNTS = { maxToPayCents: euros(30_000), minToReceiveCents: 0, valueReferencePct: 50 };

let connection: DatabaseConnection;
let homes: DrizzleHomeRepository;
let preferences: DrizzleSearchPreferencesRepository;
let repository: DrizzleDiscoveryRepository;
let day = 0;

/** Una vivienda publicada; cada alta se publica un día después de la anterior. */
async function published(
  id: string,
  ownerId: string,
  location: ReturnType<typeof placeIn>,
  changes: Partial<Home> = {},
): Promise<Home> {
  day += 1;
  const draft = newDraft({
    id,
    ownerId,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: 'Calle Mayor, 1',
    location,
    details: { ...DETAILS, valueMinCents: euros(200_000), valueMaxCents: euros(200_000) },
  });
  const home: Home = {
    ...draft,
    status: 'published',
    publishedAt: new Date(Date.UTC(2026, 8, day, 9)),
    ...changes,
  };
  await homes.insert(home);
  return home;
}

async function prefer(
  userId: string,
  input: Partial<SearchPreferencesInput>,
  forHome: string | null = null,
): Promise<void> {
  await preferences.upsert(
    { userId, homeId: forHome },
    crypto.randomUUID(),
    newSearchPreferences({ ...AMOUNTS, ...input }),
  );
}

/** Mi vivienda en Getafe y lo que busco desde ella: Leganés por defecto. */
async function myHome(changes: Partial<Home> = {}): Promise<Home> {
  return published(MY_HOME, ME, placeIn('Getafe', POINTS.getafe), changes);
}

function query(origin: Home | null, overrides: Partial<CandidateQuery> = {}): CandidateQuery {
  return {
    viewerId: ME,
    preferences: newSearchPreferences({ ...AMOUNTS, municipalities: ['Leganés'] }),
    includeVpp: false,
    origin,
    after: null,
    limit: 50,
    ...overrides,
  };
}

async function found(q: CandidateQuery): Promise<string[]> {
  return (await repository.findCandidates(q)).map((candidate) => candidate.home.id);
}

beforeAll(() => {
  connection = createDatabase(inject('databaseUrl'));
  homes = new DrizzleHomeRepository(
    connection.db,
    new AddressCipher(new Map([[1, randomBytes(32)]]), 1),
  );
  preferences = new DrizzleSearchPreferencesRepository(connection.db);
  repository = new DrizzleDiscoveryRepository(connection.db);
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
  const users = new DrizzleUserRepository(connection.db);
  for (const [id, n] of [
    [ME, 1],
    [OWNER_A, 2],
    [OWNER_B, 3],
  ] as const) {
    await users.insertWithConsents(
      makeUser({
        id,
        firebaseUid: `uid-discovery-${String(n)}`,
        email: `d${String(n)}@example.com`,
      }),
      [],
    );
  }
  day = 0;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzleDiscoveryRepository: compatibilidad en los dos sentidos', () => {
  it('Scenario: Compatibles en ambos sentidos - una vivienda en Leganés cuyo dueño busca en Getafe aparece con sus condiciones', async () => {
    const mine = await myHome();
    const candidate = await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes), {
      valueMinCents: euros(220_000),
      valueMaxCents: euros(240_000),
    });
    await prefer(OWNER_A, {
      municipalities: ['Getafe'],
      maxToPayCents: euros(5_000),
      minToReceiveCents: euros(1_000),
      valueReferencePct: 20,
    });

    const [first, ...rest] = await repository.findCandidates(query(mine));

    expect(rest).toEqual([]);
    expect(first).toEqual({
      home: {
        id: candidate.id,
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
        features: { exterior: false },
        energyRating: null,
        yearBuilt: null,
        valueMinCents: euros(220_000),
        valueMaxCents: euros(240_000),
        vppMaxLegalPriceCents: null,
        locationVisibility: 'area',
        location: {
          exact: POINTS.leganes,
          areaName: 'Leganés Centro',
          areaCenter: candidate.location.areaCenter,
        },
      },
      publishedAt: candidate.publishedAt,
      ownerTerms: {
        maxToPayCents: euros(5_000),
        minToReceiveCents: euros(1_000),
        valueReferencePct: 20,
      },
    });
  });

  it('Scenario: Su dueño no busca en mi zona - una vivienda que me encaja cuyo dueño solo busca en Valencia no aparece', async () => {
    const mine = await myHome();
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_A, { municipalities: ['Valencia'] });
    await published(homeId(2), OWNER_B, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_B, { municipalities: ['getafe'] });

    expect(await found(query(mine))).toEqual([homeId(2)]);
  });

  it('la zona inversa también admite un punto con radio alrededor de mi vivienda', async () => {
    const mine = await myHome();
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_A, { center: POINTS.madrid, radiusKm: 20 });
    await published(homeId(2), OWNER_B, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_B, { center: POINTS.valencia, radiusKm: 50 });

    expect(await found(query(mine))).toEqual([homeId(1)]);
  });

  it('las preferencias propias de la vivienda candidata sustituyen a las de su dueño', async () => {
    const mine = await myHome();
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await published(homeId(2), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_A, { municipalities: ['Valencia'] });
    await prefer(OWNER_A, { municipalities: ['Getafe'], maxToPayCents: 7 }, homeId(2));

    const candidates = await repository.findCandidates(query(mine));

    expect(candidates.map((candidate) => candidate.home.id)).toEqual([homeId(2)]);
    expect(candidates[0]?.ownerTerms?.maxToPayCents).toBe(7);
  });

  it('una candidata cuyo dueño no tiene preferencias no es compatible desde una vivienda', async () => {
    const mine = await myHome();
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));

    expect(await found(query(mine))).toEqual([]);
  });

  it.each<[string, SearchFilters]>([
    ['un tipo que no es el mío', { types: ['chalet', 'atico'] }],
    ['más superficie', { minUsefulM2: 81 }],
    ['más dormitorios', { minBedrooms: 4 }],
    ['más baños', { minBathrooms: 3 }],
    ['garaje', { garage: true }],
    ['exterior', { exterior: true }],
  ])('si el dueño de la candidata pide %s, mi vivienda no le encaja', async (_label, filters) => {
    const mine = await myHome();
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_A, { municipalities: ['Getafe'], filters });

    expect(await found(query(mine))).toEqual([]);
  });

  it('si lo que pide el dueño de la candidata lo cumple mi vivienda, encaja', async () => {
    const mine = await myHome();
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_A, {
      municipalities: ['Getafe'],
      filters: {
        types: ['piso', 'atico'],
        minUsefulM2: 80,
        minBedrooms: 3,
        minBathrooms: 2,
        lift: true,
        garage: false,
        exterior: false,
      },
    });

    expect(await found(query(mine))).toEqual([homeId(1)]);
  });
});

describe('DrizzleDiscoveryRepository: lo que busco', () => {
  it('compara el municipio sin tildes ni mayúsculas', async () => {
    await published(homeId(1), OWNER_A, placeIn('LEGANÉS', POINTS.leganes));
    await published(homeId(2), OWNER_A, placeIn('Getafe', POINTS.getafe));

    expect(await found(query(null))).toEqual([homeId(1)]);
  });

  it('con un punto y un radio usa el punto público: el centro de la zona, o el exacto si es público', async () => {
    // Punto exacto a ~0,8 km del centro de búsqueda; centro de la zona a ~2,7 km
    const near = { lat: 40.4168, lng: -3.7038 };
    const far = { lat: 40.4468, lng: -3.7138 };
    const location = { exact: near, areaName: 'Centro', areaCenter: far, municipality: 'Madrid' };
    await published(homeId(1), OWNER_A, location);
    await published(homeId(2), OWNER_A, location, { locationVisibility: 'exact' });
    const center = { lat: 40.4238, lng: -3.7038 };

    const preferences = newSearchPreferences({ ...AMOUNTS, center, radiusKm: 2 });

    expect(await found(query(null, { preferences }))).toEqual([homeId(2)]);
  });

  it.each<[string, SearchFilters, Partial<Home>]>([
    ['tipo', { types: ['atico'] }, { type: 'atico' }],
    ['superficie mínima', { minUsefulM2: 90 }, { usefulM2: 90 }],
    ['dormitorios mínimos', { minBedrooms: 4 }, { bedrooms: 4 }],
    ['baños mínimos', { minBathrooms: 3 }, { bathrooms: 3 }],
    ['garaje', { garage: true }, { garage: true }],
    ['ascensor', { lift: true }, { hasLift: true }],
    ['exterior', { exterior: true }, { features: { exterior: true } }],
  ])('aplica el filtro de %s', async (_label, filters, matching) => {
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes), {
      hasLift: false,
    });
    await published(homeId(2), OWNER_A, placeIn('Leganés', POINTS.leganes), {
      hasLift: false,
      ...matching,
    });
    const preferences = newSearchPreferences({ ...AMOUNTS, municipalities: ['Leganés'], filters });

    expect(await found(query(null, { preferences }))).toEqual([homeId(2)]);
  });

  it('un filtro booleano en false no restringe nada', async () => {
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes), { garage: true });
    await published(homeId(2), OWNER_A, placeIn('Leganés', POINTS.leganes), { garage: false });
    const preferences = newSearchPreferences({
      ...AMOUNTS,
      municipalities: ['Leganés'],
      filters: { garage: false, lift: false, exterior: false },
    });

    expect(await found(query(null, { preferences }))).toEqual([homeId(2), homeId(1)]);
  });
});

describe('DrizzleDiscoveryRepository: exclusiones', () => {
  it('nunca devuelve viviendas propias', async () => {
    const mine = await myHome();
    await published(homeId(1), ME, placeIn('Leganés', POINTS.leganes));
    await published(homeId(2), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await prefer(OWNER_A, { municipalities: ['Getafe'] });

    expect(await found(query(mine))).toEqual([homeId(2)]);
    expect(await found(query(null))).toEqual([homeId(2)]);
  });

  it.each(['draft', 'in_review', 'paused', 'in_operation', 'closed'] as const)(
    'Scenario: Vivienda en operación - una vivienda en %s no aparece',
    async (status) => {
      await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes), { status });

      expect(await found(query(null))).toEqual([]);
    },
  );

  it('una vivienda publicada sin fecha de publicación no aparece', async () => {
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes), {
      publishedAt: null,
    });

    expect(await found(query(null))).toEqual([]);
  });

  it('Scenario: Descarte y cambio relevante - lo descartado desde mi vivienda no aparece salvo que cambie después', async () => {
    const mine = await myHome();
    await prefer(OWNER_A, { municipalities: ['Getafe'] });
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await published(homeId(2), OWNER_A, placeIn('Leganés', POINTS.leganes), {
      relevantChangedAt: new Date('2026-10-10T00:00:00.000Z'),
    });
    await published(homeId(3), OWNER_A, placeIn('Leganés', POINTS.leganes), {
      relevantChangedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    for (const dismissed of [homeId(1), homeId(2), homeId(3)]) {
      await sql`INSERT INTO dismissals (home_id, dismissed_home_id, created_at)
                VALUES (${MY_HOME}, ${dismissed}, '2026-10-05T00:00:00Z')`;
    }

    expect(await found(query(mine))).toEqual([homeId(2)]);
  });

  it('un descarte desde otra de mis viviendas no aplica a esta', async () => {
    const mine = await myHome();
    await published(homeId(9), ME, placeIn('Getafe', POINTS.getafe));
    await prefer(OWNER_A, { municipalities: ['Getafe'] });
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await sql`INSERT INTO dismissals (home_id, dismissed_home_id) VALUES (${homeId(9)}, ${homeId(1)})`;

    expect(await found(query(mine))).toEqual([homeId(1)]);
  });

  it.each([false, true])(
    'Scenario: VPP sin requisitos - con includeVpp = %s solo aparecen las VPP si se incluyen',
    async (includeVpp) => {
      await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes), {
        regime: 'VPPB',
        vppQualificationDate: '2005-03-01',
      });
      await published(homeId(2), OWNER_A, placeIn('Leganés', POINTS.leganes));

      const ids = await found(query(null, { includeVpp }));

      expect(ids).toEqual(includeVpp ? [homeId(2), homeId(1)] : [homeId(2)]);
    },
  );
});

describe('DrizzleDiscoveryRepository: orden y cursor', () => {
  it('de la publicada más recientemente a la más antigua; con el mismo instante desempata el id', async () => {
    const same = new Date('2026-09-20T09:00:00.000Z');
    await published(homeId(1), OWNER_A, placeIn('Leganés', POINTS.leganes));
    await published(homeId(2), OWNER_A, placeIn('Leganés', POINTS.leganes), { publishedAt: same });
    await published(homeId(3), OWNER_A, placeIn('Leganés', POINTS.leganes), { publishedAt: same });
    await published(homeId(4), OWNER_A, placeIn('Leganés', POINTS.leganes));

    expect(await found(query(null))).toEqual([homeId(3), homeId(2), homeId(4), homeId(1)]);
    expect(await found(query(null, { limit: 2 }))).toEqual([homeId(3), homeId(2)]);
    expect(await found(query(null, { after: { at: same, id: homeId(3) } }))).toEqual([
      homeId(2),
      homeId(4),
      homeId(1),
    ]);
  });
});

describe('DrizzleDiscoveryRepository: rendimiento (RNF-20)', () => {
  const HOMES = 50_000;
  const OWNERS = 5_000;
  const BUDGET_MS = 300;

  it('GIVEN 50.000 viviendas sintéticas WHEN se pide una página THEN la consulta termina en menos de 300 ms en el entorno de integración', async () => {
    await sql`
      INSERT INTO users (id, firebase_uid, email, display_name)
      SELECT ('0199c1a2-0000-7000-9000-' || lpad(to_hex(g), 12, '0'))::uuid,
             'perf-' || g, 'perf-' || g || '@example.com', 'Sintético'
      FROM generate_series(1, ${OWNERS}) AS g`;
    // Viviendas repartidas por 20 municipios de un área de ~100 km, publicadas a lo largo de un mes
    await sql`
      INSERT INTO homes (id, owner_id, type, status, regime, useful_m2, built_m2, bedrooms, bathrooms,
                         has_lift, garage, storage_room, value_min_cents, value_max_cents,
                         is_primary_residence, vpp_qualification_date, exact_address,
                         exact_location, approx_location, area_name, municipality,
                         municipality_normalized, published_at)
      SELECT ('0199c1a2-0000-7000-a000-' || lpad(to_hex(g), 12, '0'))::uuid,
             ('0199c1a2-0000-7000-9000-' || lpad(to_hex(1 + g % ${OWNERS}), 12, '0'))::uuid,
             (ARRAY['piso','atico','duplex','estudio','chalet']::home_type[])[1 + g % 5],
             CASE WHEN g % 10 = 0 THEN 'paused'::home_status ELSE 'published'::home_status END,
             CASE WHEN g % 25 = 0 THEN 'VPPB'::home_regime ELSE 'libre'::home_regime END,
             50 + g % 100, 60 + g % 100, 1 + g % 5, 1 + g % 3, g % 2 = 0, g % 3 = 0, g % 4 = 0,
             (150000 + (g % 200) * 1000) * 100, (170000 + (g % 200) * 1000) * 100, true,
             -- Una VPP publicada lleva su fecha de calificación (RF-14)
             CASE WHEN g % 25 = 0 THEN date '2010-01-01' END,
             '\\x00'::bytea,
             ST_SetSRID(ST_MakePoint(-4.2 + (g % 997) / 997.0, 40.0 + (g % 991) / 991.0), 4326)::geography,
             ST_SetSRID(ST_MakePoint(-4.2 + (g % 997) / 997.0 + 0.001, 40.0 + (g % 991) / 991.0), 4326)::geography,
             'Zona ' || (g % 20),
             'Municipio ' || (g % 20), 'municipio ' || (g % 20),
             timestamptz '2026-09-01T00:00:00Z' + g * interval '50 seconds'
      FROM generate_series(1, ${HOMES}) AS g`;
    // Cada dueño busca en tres municipios y la mitad, además, en un radio de 30 km
    await sql`
      INSERT INTO search_preferences (id, user_id, center, radius_km, municipalities,
                                      municipalities_normalized, max_to_pay_cents, min_to_receive_cents)
      SELECT gen_random_uuid(),
             ('0199c1a2-0000-7000-9000-' || lpad(to_hex(g), 12, '0'))::uuid,
             CASE WHEN g % 2 = 0
                  THEN ST_SetSRID(ST_MakePoint(-3.7, 40.4), 4326)::geography END,
             CASE WHEN g % 2 = 0 THEN 30 END,
             ARRAY['Municipio ' || (g % 20), 'Municipio ' || ((g + 7) % 20), 'Municipio ' || ((g + 13) % 20)],
             ARRAY['municipio ' || (g % 20), 'municipio ' || ((g + 7) % 20), 'municipio ' || ((g + 13) % 20)],
             3000000, 0
      FROM generate_series(1, ${OWNERS}) AS g`;
    await sql`ANALYZE users`;
    await sql`ANALYZE homes`;
    await sql`ANALYZE search_preferences`;
    const mine = await published(MY_HOME, ME, placeIn('Municipio 3', { lat: 40.4, lng: -3.7 }));
    const page = query(mine, {
      preferences: newSearchPreferences({
        ...AMOUNTS,
        municipalities: ['Municipio 5', 'Municipio 11'],
        filters: { minBedrooms: 2 },
      }),
      // Página por defecto con el sobremuestreo de la fase económica
      limit: 63,
    });

    const warmUp = await repository.findCandidates(page);
    const result = await connection.db.execute<{ 'QUERY PLAN': { 'Execution Time': number }[] }>(
      drizzleSql`EXPLAIN (ANALYZE, FORMAT JSON) ${candidateQuerySql(page)}`,
    );
    const executionMs =
      result[0]?.['QUERY PLAN'][0]?.['Execution Time'] ?? Number.POSITIVE_INFINITY;

    expect(warmUp.length).toBeGreaterThan(0);
    expect(executionMs).toBeLessThan(BUDGET_MS);
  });
});
