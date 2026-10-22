import type {
  HomeFeatures,
  HomeInput,
  HomeRegime,
  HomeStatus,
  HomeType,
  LocationVisibility,
} from '@changehouse/shared';

import { HomeIncompleteError, HomeNotEditableError, HomeNotSubmittableError } from './errors.js';
import { assertValueRange } from './money.js';

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/** Lo que el servidor resuelve de una dirección: punto exacto (privado), barrio o zona y su centro. */
export interface HomeLocation {
  readonly exact: GeoPoint;
  readonly areaName: string;
  readonly areaCenter: GeoPoint;
}

/** Datos de la ficha que el propietario rellena paso a paso; todos opcionales mientras es borrador. */
export type HomeDetails = Partial<Omit<HomeInput, 'type' | 'address'>>;

export interface Home {
  readonly id: string;
  readonly ownerId: string;
  readonly status: HomeStatus;
  readonly type: HomeType;
  readonly regime: HomeRegime;
  /** Dirección postal exacta formateada: privada, nunca sale en la forma pública. */
  readonly address: string;
  readonly location: HomeLocation;
  readonly locationVisibility: LocationVisibility;
  readonly usefulM2: number | null;
  readonly builtM2: number | null;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly floor: string | null;
  readonly hasLift: boolean | null;
  readonly garage: boolean | null;
  readonly storageRoom: boolean | null;
  readonly features: HomeFeatures;
  readonly energyRating: string | null;
  readonly yearBuilt: number | null;
  readonly valueMinCents: number | null;
  readonly valueMaxCents: number | null;
  readonly isPrimaryResidence: boolean | null;
  readonly mortgageOutstandingCents: number | null;
  readonly vppQualificationDate: string | null;
  readonly vppProtectionEnd: string | null;
  readonly vppMaxLegalPriceCents: number | null;
  readonly moderationNote: string | null;
  /** Último cambio de un dato relevante tras publicarse; `null` si no lo hubo. */
  readonly relevantChangedAt: Date | null;
  readonly createdAt: Date;
}

/** Cambios sobre una vivienda: datos de la ficha, tipo y, si cambia la dirección, el lugar ya resuelto. */
export interface HomeChanges extends HomeDetails {
  type?: HomeType;
  place?: { address: string; location: HomeLocation };
}

export interface NewDraft {
  id: string;
  ownerId: string;
  now: Date;
  type: HomeType;
  address: string;
  location: HomeLocation;
  details?: HomeDetails;
}

/** Datos sin los cuales una vivienda no se puede enviar a revisión, en el orden de la ficha. */
const REQUIRED_FOR_SUBMIT = [
  'usefulM2',
  'builtM2',
  'bedrooms',
  'bathrooms',
  'hasLift',
  'garage',
  'storageRoom',
  'valueMinCents',
  'valueMaxCents',
  'isPrimaryResidence',
] as const satisfies readonly (keyof Home)[];

/** Cambiar estos datos de una vivienda ya publicada exige volver a moderarla (RF-18). */
const RELEVANT_FIELDS = [
  'type',
  'regime',
  'usefulM2',
  'builtM2',
  'bedrooms',
  'bathrooms',
  'valueMinCents',
  'valueMaxCents',
  'vppQualificationDate',
  'vppProtectionEnd',
  'vppMaxLegalPriceCents',
] as const satisfies readonly (keyof Home)[];

const NOT_EDITABLE: readonly HomeStatus[] = ['in_operation', 'closed'];

/** Conserva solo las claves con valor: un `undefined` no pisa lo ya guardado. */
function defined<T extends object>(source: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function fromDetails(details: HomeDetails): Partial<Home> {
  return defined({
    regime: details.regime,
    locationVisibility: details.locationVisibility,
    usefulM2: details.usefulM2,
    builtM2: details.builtM2,
    bedrooms: details.bedrooms,
    bathrooms: details.bathrooms,
    floor: details.floor,
    hasLift: details.hasLift,
    garage: details.garage,
    storageRoom: details.storageRoom,
    features: details.features,
    energyRating: details.energyRating,
    yearBuilt: details.yearBuilt,
    valueMinCents: details.valueMinCents,
    valueMaxCents: details.valueMaxCents,
    isPrimaryResidence: details.isPrimaryResidence,
    mortgageOutstandingCents: details.mortgageOutstandingCents,
    vppQualificationDate: details.vppQualificationDate,
    vppProtectionEnd: details.vppProtectionEnd,
    vppMaxLegalPriceCents: details.vppMaxLegalPriceCents,
  });
}

/** Una vivienda nueva siempre nace en `draft`, con lo que el propietario ya ha rellenado. */
export function newDraft(params: NewDraft): Home {
  const home: Home = {
    id: params.id,
    ownerId: params.ownerId,
    status: 'draft',
    type: params.type,
    regime: 'libre',
    address: params.address,
    location: params.location,
    locationVisibility: 'area',
    usefulM2: null,
    builtM2: null,
    bedrooms: null,
    bathrooms: null,
    floor: null,
    hasLift: null,
    garage: null,
    storageRoom: null,
    features: {},
    energyRating: null,
    yearBuilt: null,
    valueMinCents: null,
    valueMaxCents: null,
    isPrimaryResidence: null,
    mortgageOutstandingCents: null,
    vppQualificationDate: null,
    vppProtectionEnd: null,
    vppMaxLegalPriceCents: null,
    moderationNote: null,
    relevantChangedAt: null,
    createdAt: params.now,
    ...fromDetails(params.details ?? {}),
  };
  assertValueRange(home.valueMinCents, home.valueMaxCents);
  return home;
}

function relevantChanged(before: Home, after: Home): boolean {
  const placeChanged =
    before.address !== after.address ||
    JSON.stringify(before.location) !== JSON.stringify(after.location);
  return placeChanged || RELEVANT_FIELDS.some((field) => before[field] !== after[field]);
}

/**
 * Aplica los cambios del propietario. No se edita en `in_operation` ni `closed`. Una vivienda
 * publicada que cambia un dato relevante vuelve a `in_review`; una pausada se queda pausada, pero
 * el cambio queda anotado para moderarlo al reactivarla.
 */
export function editHome(home: Home, changes: HomeChanges, now: Date): Home {
  if (NOT_EDITABLE.includes(home.status)) throw new HomeNotEditableError();

  const { place, type, ...details } = changes;
  const edited: Home = {
    ...home,
    ...fromDetails(details),
    ...(type === undefined ? {} : { type }),
    ...(place === undefined ? {} : { address: place.address, location: place.location }),
  };
  assertValueRange(edited.valueMinCents, edited.valueMaxCents);

  const moderated = home.status === 'published' || home.status === 'paused';
  if (!moderated || !relevantChanged(home, edited)) return edited;
  return {
    ...edited,
    status: home.status === 'published' ? 'in_review' : home.status,
    relevantChangedAt: now,
  };
}

/** Campos obligatorios aún sin rellenar. */
export function missingFields(home: Home): string[] {
  return REQUIRED_FOR_SUBMIT.filter((field) => home[field] === null);
}

/** Envía a revisión una vivienda en borrador con la ficha completa. */
export function submitHome(home: Home): Home {
  if (home.status !== 'draft') throw new HomeNotSubmittableError();
  const missing = missingFields(home);
  if (missing.length > 0) throw new HomeIncompleteError(missing);
  return { ...home, status: 'in_review' };
}
