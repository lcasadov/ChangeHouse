import { HOME_TYPES } from '@changehouse/shared';
import { customType, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
