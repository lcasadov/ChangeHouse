import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import type { CandidateQuery } from '../../../application/discovery/discovery-repository.js';
import { type Home, newDraft } from '../../../domain/home/home.js';
import { newSearchPreferences } from '../../../domain/search-preferences/search-preferences.js';
import type { Database } from './database.js';
import { candidateQuerySql, DrizzleDiscoveryRepository } from './drizzle-discovery-repository.js';

const dialect = new PgDialect();
const AMOUNTS = { maxToPayCents: 0, minToReceiveCents: 0, valueReferencePct: 50 };
const ORIGIN: Home = {
  ...newDraft({
    id: '0199c1a2-0000-7000-8000-00000000e000',
    ownerId: '0199c1a2-0000-7000-8000-00000000d001',
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: 'Calle Mayor, 1',
    location: {
      exact: { lat: 40.3, lng: -3.7 },
      areaName: 'Getafe Centro',
      areaCenter: { lat: 40.31, lng: -3.71 },
    },
  }),
  status: 'published',
};

function queryOf(overrides: Partial<CandidateQuery> = {}): CandidateQuery {
  return {
    viewerId: ORIGIN.ownerId,
    preferences: newSearchPreferences({ ...AMOUNTS, municipalities: ['Leganés'] }),
    includeVpp: true,
    origin: null,
    after: null,
    limit: 21,
    ...overrides,
  };
}

/** La consulta con sus parámetros; `where` es solo la parte de las condiciones. */
function render(overrides: Partial<CandidateQuery> = {}) {
  const { sql, params } = dialect.sqlToQuery(candidateQuerySql(queryOf(overrides)));
  return { sql, params, where: sql.slice(sql.indexOf('WHERE')) };
}

describe('candidateQuerySql', () => {
  it('en modo seeker no cruza las preferencias de la candidata y solo excluye los descartes de su cuenta', () => {
    const { sql, params } = render();

    expect(sql).not.toContain('CROSS JOIN LATERAL');
    expect(sql).toContain('FROM account_dismissals ad');
    expect(sql).not.toContain('FROM dismissals d');
    expect(sql).not.toContain('FROM likes');
    expect(params).toContain(ORIGIN.ownerId);
    expect(sql).not.toContain("h.regime = 'libre'");
    expect(sql).toContain('h.municipality_normalized IN');
    expect(params).toContain('leganes');
  });

  it('desde una vivienda añade la compatibilidad inversa y los descartes; sin VPP filtra el régimen', () => {
    const { sql, params } = render({ origin: ORIGIN, includeVpp: false });

    expect(sql).toContain('CROSS JOIN LATERAL');
    expect(sql).toContain('FROM dismissals d');
    expect(sql).toContain('FROM likes l');
    expect(sql).not.toContain('FROM account_dismissals');
    expect(sql).toContain("h.regime = 'libre'");
    // Sin municipio en la vivienda de origen, la zona inversa solo puede cumplirse por radio
    expect(params).toContain(null);
  });

  it('con un punto y un radio mide desde el punto público y en metros', () => {
    const preferences = newSearchPreferences({
      ...AMOUNTS,
      center: { lat: 40.4, lng: -3.7 },
      radiusKm: 2.5,
    });

    const { sql, params } = render({ preferences });

    expect(sql).toContain('ST_DWithin(h.exact_location');
    expect(sql).toContain('ST_DWithin(h.approx_location');
    expect(sql).not.toContain('h.municipality_normalized IN');
    expect(params).toContain(2500);
  });

  it('aplica solo los filtros presentes, y los booleanos solo si están activados', () => {
    const preferences = newSearchPreferences({
      ...AMOUNTS,
      municipalities: ['Leganés'],
      filters: { types: [], minUsefulM2: 70, garage: false, lift: true, exterior: true },
    });

    const { where } = render({ preferences });

    expect(where).not.toContain('h.type::text IN');
    expect(where).toContain('h.useful_m2 >=');
    expect(where).not.toContain('h.garage');
    expect(where).toContain('h.has_lift');
    expect(where).toContain('"exterior": true');
  });

  it('el cursor continúa tras (fecha de publicación, id)', () => {
    const at = new Date('2026-10-05T00:00:00.000Z');

    const { sql, params } = render({ after: { at, id: ORIGIN.id } });

    expect(sql).toContain('(h.published_at, h.id) <');
    expect(params).toEqual(expect.arrayContaining([at.toISOString(), ORIGIN.id]));
  });
});

describe('DrizzleDiscoveryRepository', () => {
  const row = {
    id: 'h1',
    type: 'piso',
    regime: 'libre',
    useful_m2: 80,
    built_m2: 95,
    bedrooms: 3,
    bathrooms: 2,
    floor: null,
    has_lift: true,
    garage: false,
    storage_room: false,
    features: {},
    energy_rating: null,
    year_built: null,
    value_min_cents: 100,
    value_max_cents: 200,
    location_visibility: 'area',
    area_name: 'Leganés Centro',
    exact_lat: 40.3,
    exact_lng: -3.7,
    approx_lat: 40.31,
    approx_lng: -3.71,
    published_ms: 1_790_000_000_123.9,
  };

  function repositoryReturning(rows: object[]) {
    const db = { execute: () => Promise.resolve(rows) } as unknown as Database;
    return new DrizzleDiscoveryRepository(db);
  }

  it('convierte cada fila en una candidata, con la fecha truncada al milisegundo', async () => {
    const terms = { max_to_pay_cents: 5, min_to_receive_cents: 1, value_reference_pct: 20 };

    const [candidate] = await repositoryReturning([{ ...row, ...terms }]).findCandidates(queryOf());

    expect(candidate).toMatchObject({
      home: {
        id: 'h1',
        location: {
          exact: { lat: 40.3, lng: -3.7 },
          areaName: 'Leganés Centro',
          areaCenter: { lat: 40.31, lng: -3.71 },
        },
      },
      ownerTerms: { maxToPayCents: 5, minToReceiveCents: 1, valueReferencePct: 20 },
    });
    expect(candidate?.publishedAt.getTime()).toBe(1_790_000_000_123);
  });

  it('sin condiciones del dueño (modo seeker) no hay ownerTerms', async () => {
    const empty = { max_to_pay_cents: null, min_to_receive_cents: null, value_reference_pct: null };

    const [candidate] = await repositoryReturning([{ ...row, ...empty }]).findCandidates(queryOf());

    expect(candidate?.ownerTerms).toBeNull();
  });
});
