import { CONSENT_TYPES, HOME_TYPES } from '@changehouse/shared';
import {
  boolean,
  customType,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Texto sin distinción de mayúsculas (extensión `citext`): el email es único sea cual sea su capitalización. */
const citext = customType<{ data: string }>({ dataType: () => 'citext' });

export const homeTypeEnum = pgEnum('home_type', HOME_TYPES);

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
