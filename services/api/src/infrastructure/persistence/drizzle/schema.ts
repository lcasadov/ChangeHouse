import {
  CONSENT_TYPES,
  HOME_REGIMES,
  HOME_STATUSES,
  HOME_TYPES,
  type HomeFeatures,
  LOCATION_VISIBILITIES,
  type SearchFilters,
} from '@changehouse/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { PHOTO_STATUSES } from '../../../domain/home/photo.js';
import { type GeoPoint, parsePoint, pointSql } from './geography.js';

/** Texto sin distinción de mayúsculas (extensión `citext`): el email es único sea cual sea su capitalización. */
const citext = customType<{ data: string }>({ dataType: () => 'citext' });

export const homeTypeEnum = pgEnum('home_type', HOME_TYPES);
export const homeStatusEnum = pgEnum('home_status', HOME_STATUSES);
export const homeRegimeEnum = pgEnum('home_regime', HOME_REGIMES);
export const photoStatusEnum = pgEnum('photo_status', PHOTO_STATUSES);
export const locationVisibilityEnum = pgEnum('location_visibility', LOCATION_VISIBILITIES);

/** Dirección cifrada (`bytea`): se lee y se escribe como `Buffer`. */
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

/** Punto `geography(Point, 4326)`: se escribe como `ST_MakePoint(lng, lat)` y se lee de su EWKB. */
const geographyPoint = customType<{ data: GeoPoint; driverData: string }>({
  dataType: () => 'geography(Point,4326)',
  toDriver: pointSql,
  fromDriver: parsePoint,
});

export const waitlist = pgTable('waitlist', {
  id: uuid('id').primaryKey(),
  email: citext('email').notNull().unique(),
  municipality: text('municipality').notNull(),
  homeType: homeTypeEnum('home_type').notNull(),
  lookingFor: text('looking_for').notNull(),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
});

export const assignedRoleEnum = pgEnum('assigned_role', ['agency', 'admin']);
export const consentTypeEnum = pgEnum('consent_type', CONSENT_TYPES);

/** Personas dadas de alta (`docs/datamodel.md`). `owner` y `seeker` no se guardan: se derivan. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: citext('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  phone: text('phone'),
  municipality: text('municipality'),
  meetsVppRequirements: boolean('meets_vpp_requirements').notNull().default(false),
  isOver65: boolean('is_over_65').notNull().default(false),
  assignedRole: assignedRoleEnum('assigned_role'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Consentimientos aceptados: solo inserción, una fila por (usuario, tipo, versión). */
export const consents = pgTable(
  'consents',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: consentTypeEnum('type').notNull(),
    version: text('version').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type, table.version] })],
);

/** Fichas de vivienda (`docs/datamodel.md`). La dirección exacta va cifrada y no se expone a terceros. */
export const homes = pgTable(
  'homes',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: homeTypeEnum('type').notNull(),
    status: homeStatusEnum('status').notNull().default('draft'),
    regime: homeRegimeEnum('regime').notNull().default('libre'),
    vppQualificationDate: date('vpp_qualification_date', { mode: 'string' }),
    vppProtectionEnd: date('vpp_protection_end', { mode: 'string' }),
    vppMaxLegalPriceCents: bigint('vpp_max_legal_price_cents', { mode: 'number' }),
    usefulM2: numeric('useful_m2', { precision: 7, scale: 2, mode: 'number' }),
    builtM2: numeric('built_m2', { precision: 7, scale: 2, mode: 'number' }),
    bedrooms: smallint('bedrooms'),
    bathrooms: smallint('bathrooms'),
    floor: text('floor'),
    hasLift: boolean('has_lift'),
    garage: boolean('garage'),
    storageRoom: boolean('storage_room'),
    features: jsonb('features')
      .$type<HomeFeatures>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    energyRating: text('energy_rating'),
    yearBuilt: smallint('year_built'),
    valueMinCents: bigint('value_min_cents', { mode: 'number' }),
    valueMaxCents: bigint('value_max_cents', { mode: 'number' }),
    isPrimaryResidence: boolean('is_primary_residence'),
    mortgageOutstandingCents: bigint('mortgage_outstanding_cents', { mode: 'number' }),
    exactAddress: bytea('exact_address').notNull(),
    locationVisibility: locationVisibilityEnum('location_visibility').notNull().default('area'),
    exactLocation: geographyPoint('exact_location').notNull(),
    approxLocation: geographyPoint('approx_location').notNull(),
    areaName: text('area_name').notNull(),
    moderationNote: text('moderation_note'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    relevantChangedAt: timestamp('relevant_changed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('homes_owner_id_idx').on(table.ownerId),
    // La cola de moderación: solo las viviendas en revisión, por antigüedad
    index('homes_review_queue_idx')
      .on(table.submittedAt, table.id)
      .where(sql`${table.status} = 'in_review'`),
  ],
);

/**
 * Fotos de una vivienda (`docs/datamodel.md`). `pending`: URL de subida emitida y aún sin procesar,
 * sin posición; `ready`: ya procesada y publicada en `storage_path` (bucket público), con posición 1–20.
 */
export const homePhotos = pgTable(
  'home_photos',
  {
    id: uuid('id').primaryKey(),
    homeId: uuid('home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    status: photoStatusEnum('status').notNull().default('pending'),
    storagePath: text('storage_path').notNull(),
    position: smallint('position'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('home_photos_home_id_idx').on(table.homeId),
    unique('home_photos_home_id_position_key').on(table.homeId, table.position),
    check('home_photos_position_range', sql`${table.position} BETWEEN 1 AND 20`),
    check(
      'home_photos_ready_has_position',
      sql`${table.status} = 'pending' OR ${table.position} IS NOT NULL`,
    ),
  ],
);

/**
 * Acciones administrativas y sensibles (RF-93): solo inserción. La migración añade un disparador que
 * rechaza `UPDATE` y `DELETE` y retira esos permisos (y `TRUNCATE`) al rol de la aplicación.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_entity_idx').on(table.entity, table.entityId)],
);

/**
 * Preferencias de búsqueda (`docs/datamodel.md`). `home_id` nulo = las por defecto del usuario; con valor =
 * las propias de esa vivienda, que las sustituyen por completo. Un índice único parcial por ámbito.
 * `municipalities` guarda el texto elegido y `municipalities_normalized` su forma para comparar.
 */
export const searchPreferences = pgTable(
  'search_preferences',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    homeId: uuid('home_id').references(() => homes.id, { onDelete: 'cascade' }),
    center: geographyPoint('center'),
    radiusKm: numeric('radius_km', { precision: 6, scale: 2, mode: 'number' }),
    municipalities: text('municipalities').array().notNull(),
    municipalitiesNormalized: text('municipalities_normalized').array().notNull(),
    filters: jsonb('filters')
      .$type<SearchFilters>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    maxToPayCents: bigint('max_to_pay_cents', { mode: 'number' }).notNull(),
    minToReceiveCents: bigint('min_to_receive_cents', { mode: 'number' }).notNull(),
    valueReferencePct: smallint('value_reference_pct').notNull().default(50),
  },
  (table) => [
    uniqueIndex('search_preferences_user_default_key')
      .on(table.userId)
      .where(sql`${table.homeId} IS NULL`),
    uniqueIndex('search_preferences_home_key')
      .on(table.homeId)
      .where(sql`${table.homeId} IS NOT NULL`),
    check(
      'search_preferences_has_zone',
      sql`${table.center} IS NOT NULL OR cardinality(${table.municipalities}) > 0`,
    ),
    check(
      'search_preferences_center_with_radius',
      sql`(${table.center} IS NULL) = (${table.radiusKm} IS NULL)`,
    ),
    check(
      'search_preferences_radius_range',
      sql`${table.radiusKm} IS NULL OR (${table.radiusKm} > 0 AND ${table.radiusKm} <= 200)`,
    ),
    check('search_preferences_reference_range', sql`${table.valueReferencePct} BETWEEN 0 AND 100`),
    check(
      'search_preferences_amounts_non_negative',
      sql`${table.maxToPayCents} >= 0 AND ${table.minToReceiveCents} >= 0`,
    ),
  ],
);
