import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import type {
  PreferencesScope,
  SearchPreferencesRepository,
} from '../../../application/search-preferences/search-preferences-repository.js';
import {
  normalizedMunicipalities,
  type SearchPreferences,
} from '../../../domain/search-preferences/search-preferences.js';
import type { Database } from './database.js';
import { searchPreferences } from './schema.js';

type PreferencesRow = typeof searchPreferences.$inferSelect;

export function toPreferences(row: PreferencesRow): SearchPreferences {
  return {
    center: row.center,
    radiusKm: row.radiusKm,
    municipalities: row.municipalities,
    filters: row.filters,
    maxToPayCents: row.maxToPayCents,
    minToReceiveCents: row.minToReceiveCents,
    valueReferencePct: row.valueReferencePct,
  };
}

function columnsOf(preferences: SearchPreferences) {
  return {
    center: preferences.center,
    radiusKm: preferences.radiusKm,
    municipalities: [...preferences.municipalities],
    municipalitiesNormalized: normalizedMunicipalities(preferences),
    filters: preferences.filters,
    maxToPayCents: preferences.maxToPayCents,
    minToReceiveCents: preferences.minToReceiveCents,
    valueReferencePct: preferences.valueReferencePct,
  };
}

export class DrizzleSearchPreferencesRepository implements SearchPreferencesRepository {
  constructor(private readonly db: Database) {}

  async find(scope: PreferencesScope): Promise<SearchPreferences | null> {
    const condition =
      scope.homeId === null
        ? and(eq(searchPreferences.userId, scope.userId), isNull(searchPreferences.homeId))
        : eq(searchPreferences.homeId, scope.homeId);
    const [row] = await this.db.select().from(searchPreferences).where(condition).limit(1);
    return row ? toPreferences(row) : null;
  }

  /** Un único `INSERT ... ON CONFLICT` sobre el índice único parcial del ámbito: atómico y sin fusionar. */
  async upsert(
    scope: PreferencesScope,
    id: string,
    preferences: SearchPreferences,
  ): Promise<SearchPreferences> {
    const columns = columnsOf(preferences);
    const target =
      scope.homeId === null
        ? { target: searchPreferences.userId, targetWhere: isNull(searchPreferences.homeId) }
        : { target: searchPreferences.homeId, targetWhere: isNotNull(searchPreferences.homeId) };
    const [row] = await this.db
      .insert(searchPreferences)
      .values({ id, userId: scope.userId, homeId: scope.homeId, ...columns })
      .onConflictDoUpdate({ ...target, set: columns })
      .returning();
    if (!row) throw new Error('El guardado de las preferencias no devolvió la fila');
    return toPreferences(row);
  }

  async deleteForHome(homeId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(searchPreferences)
      .where(eq(searchPreferences.homeId, homeId))
      .returning({ id: searchPreferences.id });
    return deleted.length > 0;
  }
}
