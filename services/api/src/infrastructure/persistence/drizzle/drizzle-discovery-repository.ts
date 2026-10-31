import type {
  HomeFeatures,
  HomeRegime,
  HomeType,
  LocationVisibility,
  SearchFilters,
} from '@changehouse/shared';
import { type SQL, sql } from 'drizzle-orm';

import type {
  CandidateQuery,
  DiscoveryCandidate,
  DiscoveryRepository,
  OwnerTerms,
} from '../../../application/discovery/discovery-repository.js';
import type { Home } from '../../../domain/home/home.js';
import {
  normalizedMunicipalities,
  normalizeMunicipality,
  type SearchPreferences,
} from '../../../domain/search-preferences/search-preferences.js';
import type { Database } from './database.js';
import { pointSql } from './geography.js';

const METERS_PER_KM = 1000;

/** Una fila de la fase 1: números como `float8` y puntos ya separados en latitud y longitud. */
interface CandidateRow extends Record<string, unknown> {
  id: string;
  type: HomeType;
  regime: HomeRegime;
  useful_m2: number | null;
  built_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  has_lift: boolean | null;
  garage: boolean | null;
  storage_room: boolean | null;
  features: HomeFeatures;
  energy_rating: string | null;
  year_built: number | null;
  value_min_cents: number | null;
  value_max_cents: number | null;
  vpp_max_legal_price_cents: number | null;
  location_visibility: LocationVisibility;
  area_name: string;
  exact_lat: number;
  exact_lng: number;
  approx_lat: number;
  approx_lng: number;
  published_ms: number;
  max_to_pay_cents: number | null;
  min_to_receive_cents: number | null;
  value_reference_pct: number | null;
}

const HOME_COLUMNS = sql`
  h.id, h.type, h.regime, h.useful_m2::float8 AS useful_m2, h.built_m2::float8 AS built_m2,
  h.bedrooms, h.bathrooms, h.floor, h.has_lift, h.garage, h.storage_room, h.features,
  h.energy_rating, h.year_built, h.value_min_cents::float8 AS value_min_cents,
  h.value_max_cents::float8 AS value_max_cents,
  h.vpp_max_legal_price_cents::float8 AS vpp_max_legal_price_cents, h.location_visibility, h.area_name,
  ST_Y(h.exact_location::geometry) AS exact_lat, ST_X(h.exact_location::geometry) AS exact_lng,
  ST_Y(h.approx_location::geometry) AS approx_lat, ST_X(h.approx_location::geometry) AS approx_lng,
  (extract(epoch FROM h.published_at) * 1000)::float8 AS published_ms`;

const OWNER_TERMS = sql`
  cp.max_to_pay_cents::float8 AS max_to_pay_cents,
  cp.min_to_receive_cents::float8 AS min_to_receive_cents, cp.value_reference_pct`;

const NO_OWNER_TERMS = sql`
  NULL::float8 AS max_to_pay_cents, NULL::float8 AS min_to_receive_cents,
  NULL::smallint AS value_reference_pct`;

/** Preferencias efectivas del dueño de la candidata: las de la vivienda si las tiene; si no, las suyas. */
const CANDIDATE_PREFERENCES = sql`
  CROSS JOIN LATERAL (
    SELECT sp.center, sp.radius_km, sp.municipalities_normalized, sp.filters,
           sp.max_to_pay_cents, sp.min_to_receive_cents, sp.value_reference_pct
    FROM search_preferences sp
    WHERE sp.home_id = h.id OR (sp.user_id = h.owner_id AND sp.home_id IS NULL)
    ORDER BY sp.home_id IS NULL
    LIMIT 1
  ) cp`;

const list = (values: readonly (string | number)[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

/**
 * La candidata está en mi zona. Con un punto y un radio se mide desde su punto público (el exacto
 * si su dueño lo hizo público; si no, el centro de su zona), para que el radio no sirva para
 * acotar la dirección de nadie.
 */
function inMyZone(preferences: SearchPreferences): SQL {
  const zones: SQL[] = [];
  if (preferences.center !== null && preferences.radiusKm !== null) {
    const center = pointSql(preferences.center);
    const meters = preferences.radiusKm * METERS_PER_KM;
    zones.push(sql`(h.location_visibility = 'exact'
                     AND ST_DWithin(h.exact_location, ${center}, ${meters}::float8))`);
    zones.push(sql`(h.location_visibility = 'area'
                     AND ST_DWithin(h.approx_location, ${center}, ${meters}::float8))`);
  }
  const municipalities = normalizedMunicipalities(preferences);
  if (municipalities.length > 0)
    zones.push(sql`h.municipality_normalized IN (${list(municipalities)})`);
  return zones.length === 0 ? sql`false` : sql`(${sql.join(zones, sql` OR `)})`;
}

/** Mis filtros sobre la candidata; un filtro booleano solo restringe si está activado. */
function meetsMyFilters(filters: SearchFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.types !== undefined && filters.types.length > 0) {
    conditions.push(sql`h.type::text IN (${list(filters.types)})`);
  }
  if (filters.minUsefulM2 !== undefined)
    conditions.push(sql`h.useful_m2 >= ${filters.minUsefulM2}`);
  if (filters.minBedrooms !== undefined) conditions.push(sql`h.bedrooms >= ${filters.minBedrooms}`);
  if (filters.minBathrooms !== undefined) {
    conditions.push(sql`h.bathrooms >= ${filters.minBathrooms}`);
  }
  if (filters.garage === true) conditions.push(sql`h.garage`);
  if (filters.lift === true) conditions.push(sql`h.has_lift`);
  if (filters.exterior === true) conditions.push(sql`h.features @> '{"exterior": true}'::jsonb`);
  return conditions;
}

/** Mi vivienda está en la zona que busca el dueño de la candidata (`cp`). */
function inTheirZone(origin: Home): SQL {
  const { municipality } = origin.location;
  const normalized = municipality === undefined ? null : normalizeMunicipality(municipality);
  const point = pointSql(origin.location.exact);
  return sql`((cp.center IS NOT NULL
               AND ST_DWithin(cp.center, ${point}, (cp.radius_km * ${METERS_PER_KM})::float8))
              OR ${normalized}::text = ANY(cp.municipalities_normalized))`;
}

/** Mi vivienda cumple los filtros del dueño de la candidata (`cp.filters`). */
function meetsTheirFilters(origin: Home): SQL {
  const flag = (key: string, value: boolean | null | undefined) =>
    sql`(cp.filters->>${key} IS DISTINCT FROM 'true' OR ${value === true})`;
  const atLeast = (key: string, value: number | null) =>
    sql`(cp.filters->>${key} IS NULL OR (cp.filters->>${key})::numeric <= ${value}::numeric)`;
  return sql.join(
    [
      sql`(NOT cp.filters ? 'types' OR jsonb_array_length(cp.filters->'types') = 0
           OR cp.filters->'types' ? ${origin.type}::text)`,
      atLeast('minUsefulM2', origin.usefulM2),
      atLeast('minBedrooms', origin.bedrooms),
      atLeast('minBathrooms', origin.bathrooms),
      flag('garage', origin.garage),
      flag('lift', origin.hasLift),
      flag('exterior', origin.features.exterior),
    ],
    sql` AND `,
  );
}

/** Su dueño está suspendido: sus viviendas no aparecen en el descubrimiento (RF-90). */
const OWNER_SUSPENDED = sql`EXISTS (
  SELECT 1 FROM users owner WHERE owner.id = h.owner_id AND owner.suspended_at IS NOT NULL)`;

/** Descartada desde mi vivienda y sin cambio relevante posterior al descarte (RF-44). */
function dismissedFrom(origin: Home): SQL {
  return sql`EXISTS (
    SELECT 1 FROM dismissals d
    WHERE d.home_id = ${origin.id}::uuid AND d.dismissed_home_id = h.id
      AND (h.relevant_changed_at IS NULL OR h.relevant_changed_at <= d.created_at))`;
}

/** Ya le he dado «Me gusta» desde mi vivienda: deja de aparecer en sus tarjetas (RF-41). */
function likedFrom(origin: Home): SQL {
  return sql`EXISTS (
    SELECT 1 FROM likes l
    WHERE l.from_home_id = ${origin.id}::uuid AND l.to_home_id = h.id)`;
}

/** Descartada desde mi cuenta de `seeker` y sin cambio relevante posterior al descarte (RF-44). */
function dismissedByAccount(viewerId: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM account_dismissals ad
    WHERE ad.user_id = ${viewerId}::uuid AND ad.dismissed_home_id = h.id
      AND (h.relevant_changed_at IS NULL OR h.relevant_changed_at <= ad.created_at))`;
}

/** El dueño de la candidata y yo no nos hemos bloqueado, en ningún sentido (RF-63). */
function notBlockedWith(viewerId: string): SQL {
  return sql`NOT EXISTS (
    SELECT 1 FROM user_blocks ub
    WHERE (ub.blocker_id = ${viewerId}::uuid AND ub.blocked_id = h.owner_id)
       OR (ub.blocker_id = h.owner_id AND ub.blocked_id = ${viewerId}::uuid))`;
}

/**
 * Fase 1 del descubrimiento: viviendas publicadas, ajenas, de dueños no suspendidos y sin bloqueo conmigo (en ningún
 * sentido), en mi zona y con mis filtros, sin VPP si
 * no se incluyen y, desde una vivienda, sin las descartadas ni las que ya han recibido mi «Me gusta»
 * (en modo `seeker`, sin las descartadas desde la cuenta) y solo si mi vivienda encaja en la zona
 * y los filtros de las preferencias efectivas de su dueño (sin preferencias no es compatible). De
 * la publicada más recientemente a la más antigua; el id desempata y completa el cursor.
 */
export function candidateQuerySql(query: CandidateQuery): SQL {
  const { origin, after } = query;
  const conditions: SQL[] = [
    sql`h.status = 'published'`,
    sql`h.published_at IS NOT NULL`,
    sql`h.owner_id <> ${query.viewerId}::uuid`,
    sql`NOT ${OWNER_SUSPENDED}`,
    notBlockedWith(query.viewerId),
    inMyZone(query.preferences),
    ...meetsMyFilters(query.preferences.filters),
  ];
  if (!query.includeVpp) conditions.push(sql`h.regime = 'libre'`);
  if (after !== null) {
    conditions.push(
      sql`(h.published_at, h.id) < (${after.at.toISOString()}::timestamptz, ${after.id}::uuid)`,
    );
  }
  if (origin === null) {
    conditions.push(sql`NOT ${dismissedByAccount(query.viewerId)}`);
  } else {
    conditions.push(
      inTheirZone(origin),
      meetsTheirFilters(origin),
      sql`NOT ${dismissedFrom(origin)}`,
      sql`NOT ${likedFrom(origin)}`,
    );
  }
  return sql`
    SELECT ${HOME_COLUMNS}, ${origin === null ? NO_OWNER_TERMS : OWNER_TERMS}
    FROM homes h ${origin === null ? sql`` : CANDIDATE_PREFERENCES}
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY h.published_at DESC, h.id DESC
    LIMIT ${query.limit}`;
}

/** Las condiciones del dueño de la candidata; solo existen al buscar desde una vivienda. */
function ownerTermsOf(row: CandidateRow): OwnerTerms | null {
  const {
    max_to_pay_cents: maxToPayCents,
    min_to_receive_cents: minToReceiveCents,
    value_reference_pct: valueReferencePct,
  } = row;
  if (maxToPayCents === null || minToReceiveCents === null || valueReferencePct === null) {
    return null;
  }
  return { maxToPayCents, minToReceiveCents, valueReferencePct };
}

function toCandidate(row: CandidateRow): DiscoveryCandidate {
  return {
    home: {
      id: row.id,
      type: row.type,
      regime: row.regime,
      usefulM2: row.useful_m2,
      builtM2: row.built_m2,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      floor: row.floor,
      hasLift: row.has_lift,
      garage: row.garage,
      storageRoom: row.storage_room,
      features: row.features,
      energyRating: row.energy_rating,
      yearBuilt: row.year_built,
      valueMinCents: row.value_min_cents,
      valueMaxCents: row.value_max_cents,
      vppMaxLegalPriceCents: row.vpp_max_legal_price_cents,
      locationVisibility: row.location_visibility,
      location: {
        exact: { lat: row.exact_lat, lng: row.exact_lng },
        areaName: row.area_name,
        areaCenter: { lat: row.approx_lat, lng: row.approx_lng },
      },
    },
    // Truncado al milisegundo: el cursor nunca queda por delante de la fila de la que sale
    publishedAt: new Date(Math.trunc(row.published_ms)),
    ownerTerms: ownerTermsOf(row),
  };
}

/** Fase 1 del descubrimiento con PostgreSQL y PostGIS. */
export class DrizzleDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly db: Database) {}

  async findCandidates(query: CandidateQuery): Promise<DiscoveryCandidate[]> {
    const rows = await this.db.execute<CandidateRow>(candidateQuerySql(query));
    return [...rows].map(toCandidate);
  }
}
