import { z } from 'zod';

import { HOME_TYPES } from './home-type.js';
import { validateWith } from './validation.js';

export const MAX_RADIUS_KM = 200;
export const MAX_MUNICIPALITIES = 50;
export const MAX_MUNICIPALITY_LENGTH = 120;
export const DEFAULT_VALUE_REFERENCE_PCT = 50;
const MAX_PCT = 100;
const MAX_ROOMS = 30;
const MAX_AREA_M2 = 10_000;

/** `Money`: céntimos de euro, entero y no negativo. */
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** `GeoPoint` del contrato. */
const geoPointSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Filtros de `SearchPreferences` (RF-31); cerrados: una clave desconocida da 400. */
export const searchFiltersSchema = z.strictObject({
  types: z.array(z.enum(HOME_TYPES)).optional(),
  minUsefulM2: z.number().min(0).max(MAX_AREA_M2).optional(),
  minBedrooms: z.number().int().min(0).max(MAX_ROOMS).optional(),
  minBathrooms: z.number().int().min(0).max(MAX_ROOMS).optional(),
  garage: z.boolean().optional(),
  lift: z.boolean().optional(),
  exterior: z.boolean().optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

/**
 * `SearchPreferences` (RF-30 a RF-33, RN-03). Valida la forma: un centro sin radio, o un radio
 * sin centro, es un 400. Que exista al menos una zona (municipio o centro con radio) es una regla
 * de negocio (422 `SEARCH_PREFERENCES_INCOMPLETE`) y la comprueba el caso de uso.
 */
export const searchPreferencesSchema = z
  .strictObject({
    center: geoPointSchema.optional(),
    radiusKm: z.number().gt(0).max(MAX_RADIUS_KM).optional(),
    municipalities: z
      .array(z.string().trim().min(1).max(MAX_MUNICIPALITY_LENGTH))
      .max(MAX_MUNICIPALITIES)
      .optional(),
    filters: searchFiltersSchema.optional(),
    maxToPayCents: cents,
    minToReceiveCents: cents,
    valueReferencePct: z.number().int().min(0).max(MAX_PCT).default(DEFAULT_VALUE_REFERENCE_PCT),
  })
  .superRefine((preferences, context) => {
    const hasCenter = preferences.center !== undefined;
    const hasRadius = preferences.radiusKm !== undefined;
    if (hasCenter && !hasRadius) {
      context.addIssue({ code: 'custom', path: ['radiusKm'], message: 'required' });
    }
    if (hasRadius && !hasCenter) {
      context.addIssue({ code: 'custom', path: ['center'], message: 'required' });
    }
  });

export type SearchPreferencesInput = z.infer<typeof searchPreferencesSchema>;

export const validateSearchPreferences = (input: unknown) =>
  validateWith(searchPreferencesSchema, input);
