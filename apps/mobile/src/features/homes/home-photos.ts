import { PHOTO_CONTENT_TYPES, type PhotoContentType } from '@changehouse/shared';

import { type Home, type HomePhoto, HomesApiError } from './homes-api';

/** Las fotos procesadas de una vivienda, por posición: la primera es la portada. */
export function photosOf(home: Pick<Home, 'photos'> | undefined): HomePhoto[] {
  return [...(home?.photos ?? [])].sort((a, b) => a.position - b.position);
}

/** El tipo de contenido si la API lo admite (JPEG, PNG, HEIC o WebP). */
export function supportedContentType(contentType: string): PhotoContentType | null {
  return PHOTO_CONTENT_TYPES.find((supported) => supported === contentType) ?? null;
}

/** Por qué una foto no se ha podido subir; cada valor tiene su texto en `homes.photos.failures`. */
export type PhotoFailure =
  | 'unsupported'
  | 'upload'
  | 'invalidImage'
  | 'notUploaded'
  | 'limit'
  | 'tooManyPending'
  | 'busy'
  | 'notEditable'
  | 'network'
  | 'unknown';

/** Lo que se arregla volviendo a intentarlo; el resto solo se puede quitar. */
const RETRYABLE: ReadonlySet<PhotoFailure> = new Set([
  'upload',
  'notUploaded',
  'network',
  'busy',
  'unknown',
]);

export const canRetry = (failure: PhotoFailure | undefined): boolean =>
  failure !== undefined && RETRYABLE.has(failure);

/** El envío del fichero al almacenamiento falló (no es un error de la API). */
export class UploadTransferError extends Error {
  constructor() {
    super('upload');
    this.name = 'UploadTransferError';
  }
}

const FAILURE_OF_KIND: Partial<Record<HomesApiError['kind'], PhotoFailure>> = {
  network: 'network',
  'photo-limit': 'limit',
  'too-many-pending': 'tooManyPending',
  busy: 'busy',
  'invalid-image': 'invalidImage',
  'photo-not-uploaded': 'notUploaded',
  conflict: 'notEditable',
};

export function failureOf(error: unknown): PhotoFailure {
  if (error instanceof UploadTransferError) return 'upload';
  if (error instanceof HomesApiError) return FAILURE_OF_KIND[error.kind] ?? 'unknown';
  return 'unknown';
}

export type UploadStage = 'queued' | 'uploading' | 'processing' | 'failed';

/** Una foto elegida en este dispositivo que aún no es una foto de la vivienda. */
export interface UploadItem {
  key: string;
  uri: string;
  /** `null` si la API no admite el formato. */
  contentType: PhotoContentType | null;
  stage: UploadStage;
  /** De 0 a 1 mientras se envía el fichero. */
  progress: number;
  failure?: PhotoFailure;
  /** La foto pendiente que creó la API al pedir la URL. */
  photoId?: string;
  /** El fichero ya está en el almacenamiento: reintentar solo repite la confirmación. */
  uploaded: boolean;
}
