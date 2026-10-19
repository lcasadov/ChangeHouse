import type {
  HomeFeatures,
  HomeRegime,
  HomeStatus,
  HomeType,
  LocationVisibility,
} from '@changehouse/shared';

import type { GeoPoint, Home } from '../../domain/home/home.js';

/**
 * Forma pública de una vivienda (`HomePublic` en `docs/api/openapi.yaml`): sin dirección postal,
 * sin estado y sin propietario. Los campos que aún no se han rellenado van a `null` (borrador).
 */
export interface HomePublicView {
  id: string;
  type: HomeType;
  regime: HomeRegime;
  usefulM2: number | null;
  builtM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  hasLift: boolean | null;
  garage: boolean | null;
  storageRoom: boolean | null;
  features: HomeFeatures;
  energyRating: string | null;
  yearBuilt: number | null;
  valueMinCents: number | null;
  valueMaxCents: number | null;
  location: {
    visibility: LocationVisibility;
    /** El punto exacto solo si el propietario lo eligió; si no, el centro del barrio o zona. */
    point: GeoPoint;
    areaName: string;
  };
  /** Las fotos llegan con `add-home-photos`. */
  photos: never[];
}

/** Ficha completa (`Home`): la ve su propietario. */
export interface HomeView extends HomePublicView {
  status: HomeStatus;
  isPrimaryResidence: boolean | null;
  mortgageOutstandingCents: number | null;
  vppQualificationDate: string | null;
  vppProtectionEnd: string | null;
  vppMaxLegalPriceCents: number | null;
  address: string;
  moderationNote: string | null;
  createdAt: string;
}

/** Construida campo a campo, sin propagar la entidad: lo que no se nombra aquí no sale de la API. */
export function toHomePublicView(home: Home): HomePublicView {
  const exact = home.locationVisibility === 'exact';
  return {
    id: home.id,
    type: home.type,
    regime: home.regime,
    usefulM2: home.usefulM2,
    builtM2: home.builtM2,
    bedrooms: home.bedrooms,
    bathrooms: home.bathrooms,
    floor: home.floor,
    hasLift: home.hasLift,
    garage: home.garage,
    storageRoom: home.storageRoom,
    features: home.features,
    energyRating: home.energyRating,
    yearBuilt: home.yearBuilt,
    valueMinCents: home.valueMinCents,
    valueMaxCents: home.valueMaxCents,
    location: {
      visibility: home.locationVisibility,
      point: exact ? home.location.exact : home.location.areaCenter,
      areaName: home.location.areaName,
    },
    photos: [],
  };
}

export function toHomeView(home: Home): HomeView {
  return {
    ...toHomePublicView(home),
    status: home.status,
    isPrimaryResidence: home.isPrimaryResidence,
    mortgageOutstandingCents: home.mortgageOutstandingCents,
    vppQualificationDate: home.vppQualificationDate,
    vppProtectionEnd: home.vppProtectionEnd,
    vppMaxLegalPriceCents: home.vppMaxLegalPriceCents,
    address: home.address,
    moderationNote: home.moderationNote,
    createdAt: home.createdAt.toISOString(),
  };
}
