import type { HomeInput, HomePatch, PhotoContentType } from '@changehouse/shared';

import type { components } from '../../api/schema';

/** Ficha completa de una vivienda propia (`Home` del contrato). */
export type Home = components['schemas']['Home'];

/** Foto procesada y visible de una vivienda (`Photo` del contrato). */
export type HomePhoto = components['schemas']['Photo'];

/** URL firmada para subir una foto (`PhotoUpload` del contrato). */
export type PhotoUpload = components['schemas']['PhotoUpload'];

export type HomesApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** La vivienda no existe o no es de esta persona (404). */
  | 'not-found'
  /** La vivienda ya no admite el cambio: en operación, cerrada o ya enviada (409). */
  | 'conflict'
  /** El servidor rechaza los datos (400). */
  | 'invalid'
  /** El servicio de direcciones no pudo resolver la elegida (422 `ADDRESS_NOT_RESOLVED`). */
  | 'address-not-resolved'
  /** Mínimo mayor que el máximo, o no positivo (422 `INVALID_VALUE_RANGE`). */
  | 'invalid-value-range'
  /** Valor máximo por encima del precio máximo legal de una protegida (422 `VALUE_ABOVE_VPP_MAX_LEGAL_PRICE`). */
  | 'above-legal-price'
  /**
   * Faltan datos obligatorios para enviar (422 `HOME_INCOMPLETE`, o 400
   * `VPP_QUALIFICATION_DATE_REQUIRED` si es la fecha de calificación de una protegida); `fields`
   * los nombra.
   */
  | 'incomplete'
  /** Ya hay 20 fotos (409 `PHOTO_LIMIT_REACHED`). */
  | 'photo-limit'
  /** Una vivienda publicada no puede quedarse con menos de 3 fotos (409 `HOME_MIN_PHOTOS`). */
  | 'min-photos'
  /** El fichero subido no es una imagen válida (422 `INVALID_IMAGE`). */
  | 'invalid-image'
  /** Se confirmó la subida sin que el fichero hubiera llegado (422 `PHOTO_NOT_UPLOADED`). */
  | 'photo-not-uploaded'
  | 'server';

export class HomesApiError extends Error {
  constructor(
    readonly kind: HomesApiErrorKind,
    /** Campos señalados por la API (`errors[].field`), con los nombres de `HomeInput`. */
    readonly fields: readonly string[] = [],
  ) {
    super(kind);
    this.name = 'HomesApiError';
  }
}

/** Puerto de salida de las viviendas; el adaptador HTTP vive en `http-homes-api.ts`. */
export interface HomesApi {
  /** Las viviendas de la persona en cualquier estado (`listMyHomes`). */
  listMine: () => Promise<Home[]>;
  /** La ficha completa de una vivienda propia (`getHome`). */
  get: (homeId: string) => Promise<Home>;
  /** Crea el borrador con el tipo y la dirección (`createHome`). */
  create: (input: HomeInput) => Promise<Home>;
  /** Guarda un paso del asistente (`updateHome`). */
  update: (homeId: string, patch: HomePatch) => Promise<Home>;
  /** Envía el borrador a revisión (`submitHome`). */
  submit: (homeId: string) => Promise<Home>;
  /** Pide la URL firmada para subir una foto (`createHomePhotoUpload`). */
  createPhotoUpload: (homeId: string, contentType: PhotoContentType) => Promise<PhotoUpload>;
  /** Confirma la subida: la API procesa la foto y la hace visible (`completeHomePhotoUpload`). */
  completePhotoUpload: (homeId: string, photoId: string) => Promise<HomePhoto>;
  /** Elimina una foto, subida o pendiente (`deleteHomePhoto`). */
  deletePhoto: (homeId: string, photoId: string) => Promise<void>;
}
