import {
  type HomePatch,
  type HomeRegime,
  type HomeType,
  isProtectedRegime,
  type LocationVisibility,
  validateHomePatch,
} from '@changehouse/shared';
import i18next from 'i18next';
import type { FieldErrors, Resolver } from 'react-hook-form';

import { DEFAULT_LANGUAGE } from '../../i18n';
import type { Home } from './homes-api';

/** Fotos, tipo y dirección, régimen, características, valor, ubicación y revisión. */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const TOTAL_STEPS = 7;

/** Fotos por vivienda: el mínimo para enviarla a revisión y el máximo que admite la API. */
export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 20;

/** Características de sí o no de `HomeFeatures`, en el orden en que se ofrecen. */
export const FEATURE_FLAGS = [
  'terrace',
  'balcony',
  'garden',
  'communalPool',
  'privatePool',
  'airConditioning',
  'exterior',
  'accessible',
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

const locale = () => i18next.language || DEFAULT_LANGUAGE;

// --- Números y euros escritos a mano (es-ES: la coma es el decimal y el punto agrupa miles) ---

const DECIMAL = /^\d+(\.\d+)?$/;
const EUROS = /^\d+(\.\d{1,2})?$/;
const CENTS_PER_EURO = 100;

/** Vacío es «no indicado» (`undefined`); lo que no es un número positivo es `NaN`. */
export function parseDecimal(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const normalized = trimmed.replace(',', '.');
  return DECIMAL.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Euros escritos («250.000», «1.250,50 €») a céntimos; vacío es `undefined` y un importe no válido, `NaN`. */
export function parseEuros(text: string): number | undefined {
  const compact = text.replaceAll(/[\s€]/g, '');
  if (compact === '') return undefined;
  const normalized = compact.replaceAll('.', '').replace(',', '.');
  return EUROS.test(normalized) ? Math.round(Number(normalized) * CENTS_PER_EURO) : Number.NaN;
}

/** Un importe para leer: «250.000 €», con decimales solo si los hay. */
export function formatEuros(cents: number): string {
  const whole = cents % CENTS_PER_EURO === 0;
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
  }).format(cents / CENTS_PER_EURO);
}

/** El importe para un campo editable: el número con separadores, sin moneda. */
export function euroFieldText(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(
    cents / CENTS_PER_EURO,
  );
}

// --- Fechas escritas a mano (dd/mm/aaaa, como se leen en España) ---

const DAY_MONTH_YEAR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Una fecha «dd/mm/aaaa» a `aaaa-mm-dd` (el `date` del contrato). Vacío es «no indicada»
 * (`undefined`); lo que no es una fecha del calendario, `null`.
 */
export function parseDate(text: string): string | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const match = DAY_MONTH_YEAR.exec(trimmed);
  if (!match) return null;
  const [, day = '', month = '', year = ''] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return date.toISOString().startsWith(iso) ? iso : null;
}

/** Una fecha guardada (`aaaa-mm-dd`) para un campo editable: «dd/mm/aaaa». */
export function dateFieldText(iso: string | null | undefined): string {
  const match = ISO_DATE.exec(iso ?? '');
  if (!match) return '';
  const [, year = '', month = '', day = ''] = match;
  return `${day}/${month}/${year}`;
}

/** Un número para un campo editable, con coma decimal. */
export function decimalFieldText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

// --- Campos y errores de formulario ---

/** Nombre de cada campo del formulario que puede fallar (distinto del de la API en los importes). */
export type FormField =
  | 'type'
  | 'address'
  | 'usefulM2'
  | 'builtM2'
  | 'bedrooms'
  | 'bathrooms'
  | 'floor'
  | 'yearBuilt'
  | 'valueMin'
  | 'valueMax'
  | 'mortgage'
  | 'qualificationDate'
  | 'protectionEnd'
  | 'maxLegalPrice';

export type HomeErrorKey =
  | Exclude<FormField, 'qualificationDate' | 'protectionEnd'>
  | 'valueRange'
  | 'addressNotResolved'
  | 'qualificationDateRequired'
  | 'date'
  | 'maxLegalPriceBelowValue'
  | 'valueAboveLegalPrice';

const FORM_FIELD_OF_API: Record<string, FormField> = {
  valueMinCents: 'valueMin',
  valueMaxCents: 'valueMax',
  mortgageOutstandingCents: 'mortgage',
  vppQualificationDate: 'qualificationDate',
  vppProtectionEnd: 'protectionEnd',
  vppMaxLegalPriceCents: 'maxLegalPrice',
};

/** Textos propios de un tipo de fallo concreto; el resto usa el texto del campo. */
const SPECIFIC_ERRORS: Partial<Record<FormField, Record<string, HomeErrorKey>>> = {
  valueMax: { range: 'valueRange', aboveLegalPrice: 'valueAboveLegalPrice' },
  address: { unresolved: 'addressNotResolved' },
  qualificationDate: { required: 'qualificationDateRequired' },
  maxLegalPrice: { belowValue: 'maxLegalPriceBelowValue' },
};

/** Clave de `homes.errors` con el texto del fallo de un campo. */
export function errorKeyOf(field: FormField, type: string): HomeErrorKey {
  const specific = SPECIFIC_ERRORS[field]?.[type];
  if (specific) return specific;
  // Una fecha mal escrita se explica igual en cualquier campo de fecha
  if (field === 'qualificationDate' || field === 'protectionEnd') return 'date';
  return field;
}

type RawErrors = Record<string, { type: string }>;

function resolution<O>(patch: unknown, extra: RawErrors = {}) {
  const result = validateHomePatch(patch);
  const errors: RawErrors = { ...extra };
  if (!result.success) {
    for (const { field, code } of result.errors) {
      const name = FORM_FIELD_OF_API[field] ?? field;
      errors[name] ??= { type: code };
    }
  }
  if (Object.keys(errors).length > 0 || !result.success) {
    return { values: {}, errors: errors as FieldErrors };
  }
  return { values: result.data as O, errors: {} };
}

const isPositive = (cents: number | undefined) =>
  cents === undefined || Number.isNaN(cents) || cents > 0;

const defined = <T>(entries: Record<string, T | undefined>): Record<string, T> =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined)) as Record<
    string,
    T
  >;

// --- Paso 1: tipo y dirección ---

export interface AddressChoice {
  placeId: string;
  formatted: string;
}

export type TypeStepValues = {
  type: HomeType | '';
  address: AddressChoice | null;
};

export type TypeStepOutput = {
  type: HomeType;
  /** Ausente si la vivienda ya tenía dirección y no se ha cambiado. */
  address?: AddressChoice;
};

export interface TypeStepContext {
  /** El borrador ya tiene dirección guardada: no hace falta elegir otra. */
  hasSavedAddress: boolean;
}

export const typeStepDefaults = (home?: Home): TypeStepValues => ({
  type: home?.type ?? '',
  address: null,
});

export const typeStepResolver: Resolver<
  TypeStepValues,
  TypeStepContext | undefined,
  TypeStepOutput
> = (values, context) => {
  const errors: RawErrors = {};
  if (values.type === '') errors['type'] = { type: 'required' };
  if (values.address === null && !context?.hasSavedAddress) {
    errors['address'] = { type: 'required' };
  }
  if (Object.keys(errors).length > 0 || values.type === '') {
    return { values: {}, errors: errors as FieldErrors<TypeStepValues> };
  }
  return {
    values: { type: values.type, ...(values.address ? { address: values.address } : {}) },
    errors: {},
  };
};

// --- Paso 3: régimen de protección ---

export type RegimeValues = {
  regime: HomeRegime;
  qualificationDate: string;
  protectionEnd: string;
  maxLegalPrice: string;
};

export interface RegimeContext {
  /** El valor máximo ya guardado: el precio máximo legal no puede quedar por debajo (RN-06). */
  valueMaxCents: number | null;
}

export const regimeDefaults = (home?: Home): RegimeValues => ({
  regime: home?.regime ?? 'libre',
  qualificationDate: dateFieldText(home?.vppQualificationDate),
  protectionEnd: dateFieldText(home?.vppProtectionEnd),
  maxLegalPrice: euroFieldText(home?.vppMaxLegalPriceCents),
});

/**
 * Una vivienda libre solo guarda su régimen: no se le piden datos de protección. Una protegida
 * exige la fecha de calificación definitiva (RF-14); el fin de la protección y el precio máximo
 * legal son opcionales, y este no puede quedar por debajo del valor máximo ya indicado (RN-06).
 */
export const regimeResolver: Resolver<RegimeValues, RegimeContext | undefined, HomePatch> = (
  values,
  context,
) => {
  if (!isProtectedRegime(values.regime)) return resolution<HomePatch>({ regime: values.regime });
  const qualification = parseDate(values.qualificationDate);
  const protectionEnd = parseDate(values.protectionEnd);
  const maxLegal = parseEuros(values.maxLegalPrice);
  const extra: RawErrors = {};
  if (qualification === undefined) extra['qualificationDate'] = { type: 'required' };
  if (qualification === null) extra['qualificationDate'] = { type: 'invalid' };
  if (protectionEnd === null) extra['protectionEnd'] = { type: 'invalid' };
  if (!isPositive(maxLegal)) extra['maxLegalPrice'] = { type: 'invalid' };
  const valueMax = context?.valueMaxCents ?? null;
  if (maxLegal !== undefined && valueMax !== null && maxLegal > 0 && maxLegal < valueMax) {
    extra['maxLegalPrice'] = { type: 'belowValue' };
  }
  return resolution<HomePatch>(
    {
      regime: values.regime,
      ...defined({
        vppQualificationDate: qualification ?? undefined,
        vppProtectionEnd: protectionEnd ?? undefined,
        vppMaxLegalPriceCents: maxLegal,
      }),
    },
    extra,
  );
};

/** ¿Coincide lo que se iba a guardar con lo ya guardado? Entonces el paso solo avanza. */
export function sameAsSaved(home: Home, patch: HomePatch): boolean {
  return Object.entries(patch).every(
    ([field, value]) => (home as Record<string, unknown>)[field] === value,
  );
}

// --- Paso 4: características ---

export type CharacteristicsValues = {
  usefulM2: string;
  builtM2: string;
  bedrooms: string;
  bathrooms: string;
  floor: string;
  hasLift: boolean;
  garage: boolean;
  storageRoom: boolean;
  features: Record<FeatureFlag, boolean>;
  heating: 'none' | 'individual' | 'central' | '';
  condition: 'new' | 'good' | 'needs_renovation' | '';
  energyRating: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | '';
  yearBuilt: string;
};

const flagsOf = (features: Home['features']): Record<FeatureFlag, boolean> => ({
  terrace: features?.terrace === true,
  balcony: features?.balcony === true,
  garden: features?.garden === true,
  communalPool: features?.communalPool === true,
  privatePool: features?.privatePool === true,
  airConditioning: features?.airConditioning === true,
  exterior: features?.exterior === true,
  accessible: features?.accessible === true,
});

export function characteristicsDefaults(home?: Home): CharacteristicsValues {
  const features = home?.features ?? {};
  return {
    usefulM2: decimalFieldText(home?.usefulM2),
    builtM2: decimalFieldText(home?.builtM2),
    bedrooms: decimalFieldText(home?.bedrooms),
    bathrooms: decimalFieldText(home?.bathrooms),
    floor: home?.floor ?? '',
    hasLift: home?.hasLift ?? false,
    garage: home?.garage ?? false,
    storageRoom: home?.storageRoom ?? false,
    features: flagsOf(features),
    heating: features.heating ?? '',
    condition: features.condition ?? '',
    energyRating: (home?.energyRating ?? '') as CharacteristicsValues['energyRating'],
    yearBuilt: decimalFieldText(home?.yearBuilt),
  };
}

export const characteristicsResolver: Resolver<CharacteristicsValues, unknown, HomePatch> = (
  values,
) => {
  const selected: [FeatureFlag, true][] = FEATURE_FLAGS.filter((flag) => values.features[flag]).map(
    (flag) => [flag, true],
  );
  const features = {
    ...Object.fromEntries(selected),
    ...(values.heating ? { heating: values.heating } : {}),
    ...(values.condition ? { condition: values.condition } : {}),
  };
  const floor = values.floor.trim();
  return resolution<HomePatch>({
    ...defined({
      usefulM2: parseDecimal(values.usefulM2),
      builtM2: parseDecimal(values.builtM2),
      bedrooms: parseDecimal(values.bedrooms),
      bathrooms: parseDecimal(values.bathrooms),
      floor: floor === '' ? undefined : floor,
      energyRating: values.energyRating === '' ? undefined : values.energyRating,
      yearBuilt: parseDecimal(values.yearBuilt),
    }),
    hasLift: values.hasLift,
    garage: values.garage,
    storageRoom: values.storageRoom,
    features,
  });
};

// --- Paso 5: valor y cargas ---

export type ValueValues = {
  valueMin: string;
  valueMax: string;
  mortgage: string;
  isPrimaryResidence: boolean;
};

export const valueDefaults = (home?: Home): ValueValues => ({
  valueMin: euroFieldText(home?.valueMinCents),
  valueMax: euroFieldText(home?.valueMaxCents),
  mortgage: euroFieldText(home?.mortgageOutstandingCents),
  isPrimaryResidence: home?.isPrimaryResidence ?? false,
});

export interface ValueContext {
  /** Precio máximo legal de una vivienda protegida, si se conoce: tope del valor máximo (RN-06). */
  maxLegalPriceCents: number | null;
}

export const valueResolver: Resolver<ValueValues, ValueContext | undefined, HomePatch> = (
  values,
  context,
) => {
  const min = parseEuros(values.valueMin);
  const max = parseEuros(values.valueMax);
  const extra: RawErrors = {};
  if (!isPositive(min)) extra['valueMin'] = { type: 'invalid' };
  if (!isPositive(max)) extra['valueMax'] = { type: 'invalid' };
  const bothValid = min !== undefined && max !== undefined && !Number.isNaN(min + max);
  if (bothValid && Object.keys(extra).length === 0 && min > max) {
    extra['valueMax'] = { type: 'range' };
  }
  const cap = context?.maxLegalPriceCents ?? null;
  if (cap !== null && max !== undefined && extra['valueMax'] === undefined && max > cap) {
    extra['valueMax'] = { type: 'aboveLegalPrice' };
  }
  return resolution<HomePatch>(
    {
      ...defined({
        valueMinCents: min,
        valueMaxCents: max,
        mortgageOutstandingCents: parseEuros(values.mortgage),
      }),
      isPrimaryResidence: values.isPrimaryResidence,
    },
    extra,
  );
};

// --- Paso 6: ubicación visible ---

export type LocationValues = {
  locationVisibility: LocationVisibility;
};

/** Por defecto, solo el barrio o zona: mostrar el punto exacto es una decisión explícita. */
export const locationDefaults = (home?: Home): LocationValues => ({
  locationVisibility: home?.location.visibility ?? 'area',
});

export const locationResolver: Resolver<LocationValues, unknown, HomePatch> = (values) =>
  resolution<HomePatch>({ locationVisibility: values.locationVisibility });

// --- Reanudar y completar ---

type SubmitField = Extract<
  keyof Home,
  | 'usefulM2'
  | 'builtM2'
  | 'bedrooms'
  | 'bathrooms'
  | 'hasLift'
  | 'garage'
  | 'storageRoom'
  | 'valueMinCents'
  | 'valueMaxCents'
  | 'isPrimaryResidence'
  | 'vppQualificationDate'
>;

/** Los campos que exige `submitHome`, por el paso del asistente donde se rellenan. */
const SUBMIT_FIELDS: readonly (readonly [WizardStep, readonly (SubmitField | 'photos')[]])[] = [
  [1, ['photos']],
  [3, ['vppQualificationDate']],
  [4, ['usefulM2', 'builtM2', 'bedrooms', 'bathrooms', 'hasLift', 'garage', 'storageRoom']],
  [5, ['valueMinCents', 'valueMaxCents', 'isPrimaryResidence']],
];

export const REVIEW_STEP: WizardStep = 7;

function isMissing(home: Home, field: SubmitField | 'photos'): boolean {
  if (field === 'photos') return (home.photos?.length ?? 0) < MIN_PHOTOS;
  // La fecha de calificación solo se exige a una vivienda protegida (RF-14)
  if (field === 'vppQualificationDate' && !isProtectedRegime(home.regime)) return false;
  return (home[field] ?? null) === null;
}

/**
 * El primer paso con datos obligatorios por rellenar; si no falta nada, la revisión final. Las fotos
 * van primero y están completas con 3 procesadas.
 */
export function firstIncompleteStep(home: Home): WizardStep {
  for (const [step, fields] of SUBMIT_FIELDS) {
    if (fields.some((field) => isMissing(home, field))) return step;
  }
  return REVIEW_STEP;
}

/** El paso más temprano que rellena alguno de los campos que la API dice que faltan. */
export function stepOfFields(fields: readonly string[]): WizardStep {
  const steps = SUBMIT_FIELDS.filter(([, owned]) =>
    fields.some((field) => (owned as readonly string[]).includes(field)),
  ).map(([step]) => step);
  return steps[0] ?? REVIEW_STEP;
}
