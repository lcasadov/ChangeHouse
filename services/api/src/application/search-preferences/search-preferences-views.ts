import type { SearchFilters } from '@changehouse/shared';

import type { GeoPoint } from '../../domain/home/home.js';
import type { SearchPreferences } from '../../domain/search-preferences/search-preferences.js';

/** `SearchPreferences` del contrato; `center` y `radiusKm` solo cuando hay un punto con radio. */
export interface SearchPreferencesView {
  center?: GeoPoint;
  radiusKm?: number;
  municipalities: string[];
  filters: SearchFilters;
  maxToPayCents: number;
  minToReceiveCents: number;
  valueReferencePct: number;
}

export function toSearchPreferencesView(preferences: SearchPreferences): SearchPreferencesView {
  return {
    ...(preferences.center && preferences.radiusKm !== null
      ? { center: preferences.center, radiusKm: preferences.radiusKm }
      : {}),
    municipalities: [...preferences.municipalities],
    filters: preferences.filters,
    maxToPayCents: preferences.maxToPayCents,
    minToReceiveCents: preferences.minToReceiveCents,
    valueReferencePct: preferences.valueReferencePct,
  };
}
