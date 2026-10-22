import {
  DEFAULT_VALUE_REFERENCE_PCT,
  type HomeType,
  MAX_MUNICIPALITIES,
  type SearchFilters,
  type SearchPreferencesInput,
} from '@changehouse/shared';

import type { SearchPreferences } from './search-preferences-api';

/** Las preferencias tal como las edita la app: el documento completo, con sus valores por defecto. */
export type Preferences = SearchPreferencesInput;

/** Radio con el que se fija un punto al elegir un barrio o un lugar (ajustable en la hoja). */
export const DEFAULT_RADIUS_KM = 5;

/** Mínimos de dormitorios que recorre el chip de un toque; tras el último vuelve a «cualquiera». */
const BEDROOM_STEPS = [1, 2, 3, 4] as const;

export type FlagFilter = 'garage' | 'lift' | 'exterior';

/** Lo que se quita de la zona: un municipio concreto o el punto con su radio. */
export type ZoneRef = { kind: 'municipality'; name: string } | { kind: 'center' };

/** Lo que devuelve la API, con lo omitido completado (filtros vacíos, punto de referencia 50). */
export function fromApi(saved: SearchPreferences): Preferences {
  return {
    ...(saved.center ? { center: saved.center } : {}),
    ...(saved.radiusKm === undefined ? {} : { radiusKm: saved.radiusKm }),
    municipalities: saved.municipalities ?? [],
    filters: saved.filters ?? {},
    maxToPayCents: saved.maxToPayCents,
    minToReceiveCents: saved.minToReceiveCents,
    valueReferencePct: saved.valueReferencePct ?? DEFAULT_VALUE_REFERENCE_PCT,
  };
}

/** Hay al menos un municipio o un punto con radio: sin zona la API responde 422. */
export function hasZone(preferences: Preferences): boolean {
  const municipalities = preferences.municipalities ?? [];
  return municipalities.length > 0 || (!!preferences.center && !!preferences.radiusKm);
}

/** Minúsculas y sin tildes: «Alcalá» y «alcala» son el mismo municipio. */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function addMunicipality(preferences: Preferences, name: string): Preferences {
  const current = preferences.municipalities ?? [];
  const known = current.some((existing) => normalize(existing) === normalize(name));
  if (known || current.length >= MAX_MUNICIPALITIES) return preferences;
  return { ...preferences, municipalities: [...current, name] };
}

export function removeMunicipality(preferences: Preferences, name: string): Preferences {
  return {
    ...preferences,
    municipalities: (preferences.municipalities ?? []).filter((existing) => existing !== name),
  };
}

/** Fija el punto de búsqueda (solo hay uno): conserva el radio ya elegido o usa el de 5 km. */
export function withCenter(
  preferences: Preferences,
  center: { lat: number; lng: number },
): Preferences {
  return { ...preferences, center, radiusKm: preferences.radiusKm ?? DEFAULT_RADIUS_KM };
}

export function withRadius(preferences: Preferences, radiusKm: number): Preferences {
  return { ...preferences, radiusKm };
}

export function removeZone(preferences: Preferences, zone: ZoneRef): Preferences {
  if (zone.kind === 'municipality') return removeMunicipality(preferences, zone.name);
  const rest = { ...preferences };
  delete rest.center;
  delete rest.radiusKm;
  return rest;
}

/** Cambia los filtros; los vacíos desaparecen del documento en lugar de viajar como `undefined`. */
export function withFilters(
  preferences: Preferences,
  changes: Partial<SearchFilters>,
): Preferences {
  const merged = { ...preferences.filters, ...changes };
  const filters = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined && value !== false),
  ) as SearchFilters;
  return { ...preferences, filters };
}

export function toggleFlag(preferences: Preferences, flag: FlagFilter): Preferences {
  const active = preferences.filters?.[flag] === true;
  return withFilters(preferences, { [flag]: active ? undefined : true });
}

export function nextMinBedrooms(preferences: Preferences): Preferences {
  const current = preferences.filters?.minBedrooms;
  const index = BEDROOM_STEPS.findIndex((step) => step === current);
  return withFilters(preferences, { minBedrooms: BEDROOM_STEPS[index + 1] });
}

export function toggleType(preferences: Preferences, type: HomeType): Preferences {
  const current = preferences.filters?.types ?? [];
  const next = current.includes(type)
    ? current.filter((existing) => existing !== type)
    : [...current, type];
  return withFilters(preferences, { types: next.length > 0 ? next : undefined });
}
