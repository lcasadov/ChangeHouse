import type { HomePatch } from '@changehouse/shared';

import type { Home } from './homes-api';

/** Datos que la API vuelve a moderar si cambian en una vivienda publicada o pausada (`updateHome`). */
const RELEVANT_FIELDS = [
  'type',
  'regime',
  'usefulM2',
  'builtM2',
  'bedrooms',
  'bathrooms',
  'floor',
  'hasLift',
  'garage',
  'storageRoom',
  'valueMinCents',
  'valueMaxCents',
  'vppQualificationDate',
  'vppProtectionEnd',
  'vppMaxLegalPriceCents',
] as const satisfies readonly (keyof HomePatch & keyof Home)[];

/** ¿Un cambio relevante la devolvería a revisión? Solo si está publicada o pausada. */
export function returnsToReview(home: Home): boolean {
  return home.status === 'published' || home.status === 'paused';
}

/** Las características son planas: se comparan clave a clave, ignorando las que no tienen valor. */
function sameFeatures(before: Home['features'], after: NonNullable<HomePatch['features']>) {
  const defined = (features: object) =>
    Object.entries(features).filter(([, value]) => value !== undefined);
  const saved = new Map(defined(before ?? {}));
  const sent = defined(after);
  return sent.length === saved.size && sent.every(([key, value]) => saved.get(key) === value);
}

/**
 * ¿Cambia el guardado de un paso algún dato relevante respecto a lo guardado? Los pasos envían
 * todos sus campos, así que solo cuenta lo que tiene otro valor; la visibilidad de la ubicación, la
 * calificación energética, el año, la vivienda habitual y la hipoteca no son relevantes.
 */
export function changesRelevantData(home: Home, patch: HomePatch): boolean {
  if (patch.address !== undefined && patch.address.formatted !== home.address) return true;
  if (patch.features !== undefined && !sameFeatures(home.features, patch.features)) return true;
  return RELEVANT_FIELDS.some(
    (field) => patch[field] !== undefined && (patch[field] ?? null) !== (home[field] ?? null),
  );
}
