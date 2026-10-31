import {
  type HomeFeatures,
  type HomeInput,
  type HomeRegime,
  type HomeStatus,
  type HomeType,
  isProtectedRegime,
  type LocationVisibility,
  MAX_MODERATION_REASON,
} from '@changehouse/shared';

import {
  HomeIncompleteError,
  HomeInOperationError,
  HomeNotEditableError,
  HomeNotInReviewError,
  HomeNotPausableError,
  HomeNotResumableError,
  HomeNotSubmittableError,
  InvalidModerationReasonError,
  ValueAboveVppMaxLegalPriceError,
  VppQualificationDateRequiredError,
} from './errors.js';
import { assertValueRange } from './money.js';
import { MIN_PHOTOS } from './photo.js';

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/** Lo que el servidor resuelve de una dirección: punto exacto (privado), barrio o zona y su centro. */
export interface HomeLocation {
  readonly exact: GeoPoint;
  readonly areaName: string;
  readonly areaCenter: GeoPoint;
  /**
   * Municipio (la localidad de la dirección): con él se comparan los municipios de las preferencias
   * de búsqueda. Puede faltar si el servicio de direcciones no lo da; entonces solo cuenta el punto.
   */
  readonly municipality?: string;
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
  /** Cuándo entró en la cola de moderación por última vez; ordena la cola. `null` si nunca se envió. */
  readonly submittedAt: Date | null;
  /** Último cambio de un dato relevante tras publicarse; `null` si no lo hubo. */
  readonly relevantChangedAt: Date | null;
  /** Última aprobación en moderación: ordena las tarjetas del descubrimiento. `null` si nunca se publicó. */
  readonly publishedAt: Date | null;
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

/**
 * Cambiar estos datos de una vivienda publicada o pausada exige volver a moderarla (RF-18), igual
 * que sus fotos, sus características (`features`) y su dirección. La visibilidad de la ubicación,
 * la calificación energética, el año, la vivienda habitual y la hipoteca no son relevantes.
 */
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
] as const satisfies readonly (keyof Home)[];

/** Estados en los que la vivienda está o estaba a la vista: un cambio relevante la devuelve a revisión. */
const RESUBMIT_ON_CHANGE: readonly HomeStatus[] = ['published', 'paused'];

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

/** Una vivienda protegida no vale más que su precio máximo legal, si se conoce (RN-06). */
function assertWithinLegalPrice(home: Home): void {
  const { regime, valueMaxCents, vppMaxLegalPriceCents } = home;
  if (!isProtectedRegime(regime) || valueMaxCents === null || vppMaxLegalPriceCents === null)
    return;
  if (valueMaxCents > vppMaxLegalPriceCents) throw new ValueAboveVppMaxLegalPriceError();
}

/**
 * Una vivienda protegida necesita su fecha de calificación definitiva para salir del borrador
 * (RF-14); el borrador la admite vacía mientras el asistente guarda el avance.
 */
function assertQualified(home: Home): void {
  if (isProtectedRegime(home.regime) && home.vppQualificationDate === null) {
    throw new VppQualificationDateRequiredError();
  }
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
    submittedAt: null,
    relevantChangedAt: null,
    publishedAt: null,
    createdAt: params.now,
    ...fromDetails(params.details ?? {}),
  };
  assertValueRange(home.valueMinCents, home.valueMaxCents);
  assertWithinLegalPrice(home);
  return home;
}

/** Las características son planas: iguales si coinciden clave a clave, sin importar el orden. */
function sameFeatures(before: HomeFeatures, after: HomeFeatures): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof HomeFeatures>;
  return [...keys].every((key) => before[key] === after[key]);
}

function relevantChanged(before: Home, after: Home): boolean {
  const placeChanged =
    before.address !== after.address ||
    JSON.stringify(before.location) !== JSON.stringify(after.location);
  return (
    placeChanged ||
    !sameFeatures(before.features, after.features) ||
    RELEVANT_FIELDS.some((field) => before[field] !== after[field])
  );
}

/**
 * ¿Ha estado alguna vez a la vista en el descubrimiento? Lo está si está publicada o pausada, o si
 * tiene fecha de publicación (una publicada que volvió a revisión). Solo entonces un cambio de valor
 * o de fotos es un cambio relevante que reactiva sus descartes (RF-44).
 */
export function hasBeenPublished(home: Home): boolean {
  return home.status === 'published' || home.status === 'paused' || home.publishedAt !== null;
}

/** Lo que un cambio relevante deja anotado en la vivienda. */
export interface RelevantChange {
  readonly relevantChangedAt: Date;
  /** Presentes solo si la vivienda vuelve a la cola de moderación. */
  readonly status?: 'in_review';
  readonly submittedAt?: Date;
}

/**
 * Qué anota un cambio relevante (de la ficha o de las fotos) en `now`. Una vivienda publicada o
 * pausada vuelve a `in_review` y se encola; una que ya se publicó alguna vez y ahora está en
 * revisión o en borrador solo anota la fecha (RF-44). Si nunca se publicó, no hay nada que anotar.
 */
export function relevantChangeOf(home: Home, now: Date): RelevantChange | null {
  if (RESUBMIT_ON_CHANGE.includes(home.status)) {
    return { relevantChangedAt: now, status: 'in_review', submittedAt: now };
  }
  return hasBeenPublished(home) ? { relevantChangedAt: now } : null;
}

/**
 * Aplica los cambios del propietario. No se edita en `in_operation` ni `closed`. Una vivienda
 * publicada o pausada que cambia un dato relevante vuelve a `in_review` (RF-18); los demás cambios
 * relevantes se anotan según `relevantChangeOf`. El valor no supera el precio máximo legal de una
 * protegida, y fuera de borrador una protegida lleva su fecha de calificación.
 */
export function editHome(home: Home, changes: HomeChanges, now: Date): Home {
  assertEditable(home);

  const { place, type, ...details } = changes;
  const edited: Home = {
    ...home,
    ...fromDetails(details),
    ...(type === undefined ? {} : { type }),
    ...(place === undefined ? {} : { address: place.address, location: place.location }),
  };
  assertValueRange(edited.valueMinCents, edited.valueMaxCents);
  assertWithinLegalPrice(edited);
  if (home.status !== 'draft') assertQualified(edited);

  if (!relevantChanged(home, edited)) return edited;
  return { ...edited, ...relevantChangeOf(home, now) };
}

/**
 * Pausa una vivienda publicada: deja de aparecer en el descubrimiento y de formar matches nuevos,
 * pero conserva sus matches abiertos y su fecha de publicación (RF-17).
 */
export function pauseHome(home: Home): Home {
  if (home.status !== 'published') throw new HomeNotPausableError();
  return { ...home, status: 'paused' };
}

/**
 * Cierra una vivienda por la eliminación de la cuenta de su propietario, sea cual sea su estado.
 * Una ya cerrada se queda igual; una en operación no se cierra.
 */
export function closeHome(home: Home): Home {
  if (home.status === 'closed') return home;
  if (home.status === 'in_operation') throw new HomeInOperationError();
  return { ...home, status: 'closed' };
}

/** Reactiva una vivienda pausada sin pasar por moderación: los cambios relevantes ya la habrían sacado de `paused`. */
export function resumeHome(home: Home): Home {
  if (home.status !== 'paused') throw new HomeNotResumableError();
  return { ...home, status: 'published' };
}

/** Campos obligatorios aún sin rellenar. */
export function missingFields(home: Home): string[] {
  return REQUIRED_FOR_SUBMIT.filter((field) => home[field] === null);
}

/** Comprueba que la vivienda admite cambios (también en sus fotos): no en `in_operation` ni `closed`. */
export function assertEditable(home: Home): void {
  if (NOT_EDITABLE.includes(home.status)) throw new HomeNotEditableError();
}

/**
 * Envía a revisión una vivienda en borrador con la ficha completa y al menos 3 fotos procesadas
 * (`readyPhotos`). Si falta algo, el error lista los campos y `photos` si faltan fotos. Una
 * vivienda protegida sin fecha de calificación se rechaza antes (400, RF-14).
 */
export function submitHome(home: Home, readyPhotos: number, now: Date): Home {
  if (home.status !== 'draft') throw new HomeNotSubmittableError();
  assertQualified(home);
  const missing = [...missingFields(home), ...(readyPhotos < MIN_PHOTOS ? ['photos'] : [])];
  if (missing.length > 0) throw new HomeIncompleteError(missing);
  return { ...home, status: 'in_review', submittedAt: now };
}

function assertInReview(home: Home): void {
  if (home.status !== 'in_review') throw new HomeNotInReviewError();
}

/**
 * Aprueba una vivienda en revisión: se publica en `now` y el motivo de un rechazo anterior deja de
 * aplicar. La fecha de publicación ordena las tarjetas del descubrimiento.
 */
export function approveHome(home: Home, now: Date): Home {
  assertInReview(home);
  return { ...home, status: 'published', moderationNote: null, publishedAt: now };
}

/**
 * Rechaza una vivienda en revisión con un motivo de 1 a 1000 caracteres (tras recortar espacios):
 * vuelve a borrador y el propietario ve el motivo.
 */
export function rejectHome(home: Home, reason: string): Home {
  assertInReview(home);
  const note = reason.trim();
  if (note.length === 0 || note.length > MAX_MODERATION_REASON) {
    throw new InvalidModerationReasonError();
  }
  return { ...home, status: 'draft', moderationNote: note };
}
