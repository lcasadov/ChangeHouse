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
import { MATCH_STATUSES, PARTICIPANT_STATUSES } from '../../../domain/matching/match.js';
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

/**
 * Personas dadas de alta (`docs/datamodel.md`). `owner` y `seeker` no se guardan: se derivan. Una
 * suspensión guarda siempre su instante y su motivo, o ninguno de los dos.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    firebaseUid: text('firebase_uid').notNull().unique(),
    email: citext('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    phone: text('phone'),
    municipality: text('municipality'),
    meetsVppRequirements: boolean('meets_vpp_requirements').notNull().default(false),
    isOver65: boolean('is_over_65').notNull().default(false),
    assignedRole: assignedRoleEnum('assigned_role'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'users_suspension_complete',
      sql`(${table.suspendedAt} IS NULL) = (${table.suspensionReason} IS NULL)`,
    ),
  ],
);

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
    // Municipio tal como lo da el servicio de direcciones y su forma comparable con las preferencias
    municipality: text('municipality'),
    municipalityNormalized: text('municipality_normalized'),
    moderationNote: text('moderation_note'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    relevantChangedAt: timestamp('relevant_changed_at', { withTimezone: true }),
    // Última aprobación en moderación: ordena las tarjetas del descubrimiento
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('homes_owner_id_idx').on(table.ownerId),
    // La cola de moderación: solo las viviendas en revisión, por antigüedad
    index('homes_review_queue_idx')
      .on(table.submittedAt, table.id)
      .where(sql`${table.status} = 'in_review'`),
    // Descubrimiento: solo las publicadas, por orden de publicación, zona y municipio
    index('homes_discovery_feed_idx')
      .on(table.publishedAt, table.id)
      .where(sql`${table.status} = 'published'`),
    index('homes_approx_location_published_idx')
      .using('gist', table.approxLocation)
      .where(sql`${table.status} = 'published'`),
    index('homes_exact_location_published_idx')
      .using('gist', table.exactLocation)
      .where(sql`${table.status} = 'published'`),
    index('homes_municipality_published_idx')
      .on(table.municipalityNormalized)
      .where(sql`${table.status} = 'published'`),
    // Red de seguridad de las reglas de régimen del dominio (RF-14, RN-06): el borrador admite
    // una protegida sin fecha de calificación mientras el asistente guarda el avance
    check(
      'homes_vpp_qualification_date_required',
      sql`${table.regime} = 'libre' OR ${table.status} = 'draft' OR ${table.vppQualificationDate} IS NOT NULL`,
    ),
    check(
      'homes_value_max_within_vpp_max_legal_price',
      sql`${table.regime} = 'libre' OR ${table.vppMaxLegalPriceCents} IS NULL OR ${table.valueMaxCents} <= ${table.vppMaxLegalPriceCents}`,
    ),
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
    // La zona de búsqueda: el punto con radio y los municipios
    index('search_preferences_center_idx').using('gist', table.center),
    index('search_preferences_municipalities_idx').using('gin', table.municipalitiesNormalized),
  ],
);

/**
 * Descartes (RF-44): `home_id` descarta `dismissed_home_id`. Deja de aplicarse si la vivienda
 * descartada tiene un cambio relevante posterior (`homes.relevant_changed_at`). Se escriben al
 * descartar y se borran al deshacer (`add-like-dismiss-undo`).
 */
export const dismissals = pgTable(
  'dismissals',
  {
    homeId: uuid('home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    dismissedHomeId: uuid('dismissed_home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.homeId, table.dismissedHomeId] }),
    check('dismissals_not_self', sql`${table.homeId} <> ${table.dismissedHomeId}`),
    index('dismissals_dismissed_home_idx').on(table.dismissedHomeId),
  ],
);

/**
 * Descartes de un `seeker`, que no tiene vivienda desde la que descartar: `user_id` descarta
 * `dismissed_home_id` con la misma regla de cambio relevante que `dismissals`.
 */
export const accountDismissals = pgTable(
  'account_dismissals',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dismissedHomeId: uuid('dismissed_home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.dismissedHomeId] }),
    index('account_dismissals_dismissed_home_idx').on(table.dismissedHomeId),
  ],
);

/**
 * Arista del grafo de interés (RF-41): el propietario de `from_home_id` quiere `to_home_id`. Cada
 * vivienda del usuario participa de forma independiente (RF-20). El límite diario se cuenta sobre
 * estas filas (`likes_created_at_idx` más la unión con `homes.owner_id`).
 */
export const likes = pgTable(
  'likes',
  {
    fromHomeId: uuid('from_home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    toHomeId: uuid('to_home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.fromHomeId, table.toHomeId] }),
    check('likes_not_self', sql`${table.fromHomeId} <> ${table.toHomeId}`),
    // Ciclos de 2 y 3 (`add-direct-match`) y borrado en cascada por destino
    index('likes_to_home_idx').on(table.toHomeId, table.fromHomeId),
    index('likes_created_at_idx').on(table.createdAt),
  ],
);

export const matchStatusEnum = pgEnum('match_status', MATCH_STATUSES);
export const participantStatusEnum = pgEnum('participant_status', PARTICIPANT_STATUSES);

/**
 * Ciclos de interés recíproco y compatible (`docs/datamodel.md`): de 2 viviendas (directo) o 3
 * (cadena). `cycle_key` (identificadores de vivienda ordenados y unidos) es única: el mismo
 * conjunto de viviendas nunca forma dos matches, tampoco con dos me gusta simultáneos.
 */
export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey(),
    type: smallint('type').notNull(),
    status: matchStatusEnum('status').notNull().default('open'),
    cycleKey: text('cycle_key').notNull().unique(),
    // Chat de grupo en Firestore: llega con `add-match-chat`
    chatId: text('chat_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('matches_type_range', sql`${table.type} IN (2, 3)`)],
);

/**
 * Cada vivienda de un match: la que entrega (`gives_home_id`, igual a `home_id`), la que recibe y la
 * compensación estimada de su propietario (positiva, paga; negativa, recibe; suma 0 por match,
 * RN-04). Las viviendas y los usuarios no se borran mientras figuren en un match.
 */
export const matchParticipants = pgTable(
  'match_participants',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    homeId: uuid('home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    givesHomeId: uuid('gives_home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'restrict' }),
    receivesHomeId: uuid('receives_home_id')
      .notNull()
      .references(() => homes.id, { onDelete: 'restrict' }),
    compensationCents: bigint('compensation_cents', { mode: 'number' }).notNull(),
    status: participantStatusEnum('status').notNull().default('pending'),
    // Autoriza mostrar su teléfono a los demás participantes (RF-53): llega con `setPhoneSharing`
    sharesPhone: boolean('shares_phone').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.homeId] }),
    check('match_participants_gives_own_home', sql`${table.givesHomeId} = ${table.homeId}`),
    check('match_participants_not_self', sql`${table.receivesHomeId} <> ${table.givesHomeId}`),
    // Mis matches (`listMyMatches`) y ¿este me gusta forma parte de un match? (deshacer)
    index('match_participants_user_idx').on(table.userId, table.matchId),
    index('match_participants_gives_receives_idx').on(table.givesHomeId, table.receivesHomeId),
  ],
);
