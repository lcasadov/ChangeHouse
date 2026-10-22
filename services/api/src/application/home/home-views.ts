import type {
  HomeFeatures,
  HomeRegime,
  HomeStatus,
  HomeType,
  LocationVisibility,
} from '@changehouse/shared';

import type { GeoPoint, Home } from '../../domain/home/home.js';
import type { HomePhoto } from '../../domain/home/photo.js';

/** `Photo` del contrato: solo las fotos procesadas llegan a una vista. */
export interface PhotoView {
  id: string;
  url: string;
  position: number;
}

/** `PhotoUpload` del contrato: dónde subir el original y hasta cuándo vale la URL. */
export interface PhotoUploadView {
  photoId: string;
  uploadUrl: string;
  expiresAt: string;
}

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
  photos: PhotoView[];
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
export function toHomePublicView(home: Home, photos: readonly PhotoView[]): HomePublicView {
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
    photos: [...photos],
  };
}

export function toHomeView(home: Home, photos: readonly PhotoView[]): HomeView {
  return {
    ...toHomePublicView(home, photos),
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

/** Las fotos listas de una vivienda como las ve el cliente; `publicUrl` resuelve su dirección pública. */
export function toPhotoViews(
  photos: readonly HomePhoto[],
  publicUrl: (path: string) => string,
): PhotoView[] {
  return photos.flatMap((photo) =>
    photo.status === 'ready' && photo.position !== null
      ? [{ id: photo.id, url: publicUrl(photo.storagePath), position: photo.position }]
      : [],
  );
}
