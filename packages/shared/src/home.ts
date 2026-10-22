import { z } from 'zod';

import { HOME_TYPES } from './home-type.js';
import { validateWith } from './validation.js';

const MAX_ADDRESS = 300;
const MAX_FLOOR = 20;
const MAX_AREA_M2 = 10_000;
const MAX_ROOMS = 30;
const MIN_YEAR_BUILT = 1800;
const MAX_YEAR_BUILT = 2100;

/** Estados de una vivienda (`HomeStatus` en `docs/api/openapi.yaml`). */
export const HOME_STATUSES = [
  'draft',
  'in_review',
  'published',
  'paused',
  'in_operation',
  'closed',
] as const;
export type HomeStatus = (typeof HOME_STATUSES)[number];

/** Régimen de la vivienda (`HomeRegime`). */
export const HOME_REGIMES = ['libre', 'VPPB', 'VPPL', 'VPO'] as const;
export type HomeRegime = (typeof HOME_REGIMES)[number];

/** `exact`: ubicación exacta pública; `area`: solo barrio o zona (`LocationVisibility`). */
export const LOCATION_VISIBILITIES = ['exact', 'area'] as const;
export type LocationVisibility = (typeof LOCATION_VISIBILITIES)[number];

export const ENERGY_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export const HEATING_TYPES = ['none', 'individual', 'central'] as const;
export const HOME_CONDITIONS = ['new', 'good', 'needs_renovation'] as const;

/** `HomeFeatures`: claves cerradas. */
export const homeFeaturesSchema = z.strictObject({
  terrace: z.boolean().optional(),
  balcony: z.boolean().optional(),
  garden: z.boolean().optional(),
  communalPool: z.boolean().optional(),
  privatePool: z.boolean().optional(),
  airConditioning: z.boolean().optional(),
  heating: z.enum(HEATING_TYPES).optional(),
  exterior: z.boolean().optional(),
  accessible: z.boolean().optional(),
  condition: z.enum(HOME_CONDITIONS).optional(),
});

export type HomeFeatures = z.infer<typeof homeFeaturesSchema>;

/** `Money`: céntimos de euro, entero y no negativo. */
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const areaM2 = z.number().gt(0).max(MAX_AREA_M2);
const rooms = z.number().int().min(0).max(MAX_ROOMS);

/** Dirección elegida en el autocompletado; el servidor resuelve el `placeId`. */
export const homeAddressSchema = z.strictObject({
  placeId: z.string().trim().min(1).max(MAX_ADDRESS),
  formatted: z.string().trim().min(1).max(MAX_ADDRESS),
});

export type HomeAddressInput = z.infer<typeof homeAddressSchema>;

/**
 * `HomeInput`. Sale del contrato con una salvedad documentada: el borrador nace con el tipo y la
 * dirección (primer paso del asistente) y el resto se completa en los pasos siguientes; la
 * completitud se exige al enviar a revisión (`submitHome`, 422). Cerrado: un campo de estado o de
 * propietario da 400 (RC-17).
 */
export const homeInputSchema = z.strictObject({
  type: z.enum(HOME_TYPES),
  regime: z.enum(HOME_REGIMES).optional(),
  address: homeAddressSchema,
  usefulM2: areaM2.optional(),
  builtM2: areaM2.optional(),
  bedrooms: rooms.optional(),
  bathrooms: rooms.optional(),
  floor: z.string().trim().min(1).max(MAX_FLOOR).optional(),
  hasLift: z.boolean().optional(),
  garage: z.boolean().optional(),
  storageRoom: z.boolean().optional(),
  features: homeFeaturesSchema.optional(),
  locationVisibility: z.enum(LOCATION_VISIBILITIES).optional(),
  energyRating: z.enum(ENERGY_RATINGS).optional(),
  yearBuilt: z.number().int().min(MIN_YEAR_BUILT).max(MAX_YEAR_BUILT).optional(),
  valueMinCents: cents.optional(),
  valueMaxCents: cents.optional(),
  isPrimaryResidence: z.boolean().optional(),
  mortgageOutstandingCents: cents.optional(),
  vppQualificationDate: z.iso.date().optional(),
  vppProtectionEnd: z.iso.date().optional(),
  vppMaxLegalPriceCents: cents.optional(),
});

export type HomeInput = z.infer<typeof homeInputSchema>;

/** `HomePatch`: cualquier subconjunto de `HomeInput`, con al menos un campo. */
export const homePatchSchema = homeInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0);

export type HomePatch = z.infer<typeof homePatchSchema>;

export const validateHomeInput = (input: unknown) => validateWith(homeInputSchema, input);

export const validateHomePatch = (input: unknown) => validateWith(homePatchSchema, input);
