import type { SearchFilters, SearchPreferencesInput } from '@changehouse/shared';

import type { GeoPoint } from '../home/home.js';
import { SearchPreferencesIncompleteError } from './errors.js';

/** Lo que busca un usuario, por defecto o desde una vivienda concreta (RF-30 a RF-33, RN-03). */
export interface SearchPreferences {
  /** Centro de la zona; siempre acompañado de `radiusKm`. */
  readonly center: GeoPoint | null;
  readonly radiusKm: number | null;
  /** Municipios tal y como los eligió el usuario (para mostrarlos), sin repetidos. */
  readonly municipalities: readonly string[];
  readonly filters: SearchFilters;
  readonly maxToPayCents: number;
  readonly minToReceiveCents: number;
  /** Punto del rango de valor de sus viviendas que se usa para compensar: 0 = mínimo, 100 = máximo. */
  readonly valueReferencePct: number;
}

/** Forma comparable de un municipio: sin tildes, sin mayúsculas y con los espacios colapsados. */
export function normalizeMunicipality(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Los municipios en su forma comparable, en el mismo orden que `municipalities`. */
export function normalizedMunicipalities(preferences: SearchPreferences): string[] {
  return preferences.municipalities.map(normalizeMunicipality);
}

/** Quita los municipios que, una vez normalizados, ya figuran antes; conserva la primera forma. */
function distinctMunicipalities(municipalities: readonly string[]): string[] {
  const seen = new Set<string>();
  return municipalities.filter((municipality) => {
    const key = normalizeMunicipality(municipality);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Preferencias válidas a partir de la entrada ya validada en su forma; exige al menos una zona. */
export function newSearchPreferences(input: SearchPreferencesInput): SearchPreferences {
  const municipalities = distinctMunicipalities(input.municipalities ?? []);
  if (municipalities.length === 0 && input.center === undefined) {
    throw new SearchPreferencesIncompleteError();
  }
  return {
    center: input.center ?? null,
    radiusKm: input.radiusKm ?? null,
    municipalities,
    filters: input.filters ?? {},
    maxToPayCents: input.maxToPayCents,
    minToReceiveCents: input.minToReceiveCents,
    valueReferencePct: input.valueReferencePct,
  };
}
