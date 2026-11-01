import type { HomeStatus } from '@changehouse/shared';

import { HomeMinPhotosError, PhotoLimitReachedError, TooManyPendingPhotosError } from './errors.js';

/** Estados de una foto: `pending` desde que se emite la URL de subida; `ready` cuando se ha procesado. */
export const PHOTO_STATUSES = ['pending', 'ready'] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

/** Una vivienda tiene entre 3 y 20 fotos (RF-11). */
export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 20;

export interface HomePhoto {
  readonly id: string;
  readonly homeId: string;
  readonly status: PhotoStatus;
  /** Ruta de la foto procesada en el espacio público, aún vacía mientras está `pending`. */
  readonly storagePath: string;
  /** Orden de presentación (1–20); `null` mientras está `pending`. */
  readonly position: number | null;
  readonly createdAt: Date;
}

/** La primera posición libre entre 1 y 20, o `null` si están todas ocupadas. */
export function firstFreePosition(taken: readonly number[]): number | null {
  for (let position = 1; position <= MAX_PHOTOS; position += 1) {
    if (!taken.includes(position)) return position;
  }
  return null;
}

/** Fotos pendientes de confirmar (URL emitida y sin procesar) que una vivienda admite a la vez. */
export const MAX_PENDING_PHOTOS = 25;

/** Pedir otra URL de subida con el cupo de pendientes lleno es un conflicto. */
export function assertCanRequestUpload(pendingPhotos: number): void {
  if (pendingPhotos >= MAX_PENDING_PHOTOS) throw new TooManyPendingPhotosError();
}

/** Solo las fotos procesadas cuentan para el máximo. */
export function assertCanAddPhoto(readyPhotos: number): void {
  if (readyPhotos >= MAX_PHOTOS) throw new PhotoLimitReachedError();
}

/**
 * Una vivienda que ya salió de borrador (enviada, publicada o pausada) no puede quedarse con menos
 * de 3 fotos procesadas. Borrar una foto pendiente nunca afecta al mínimo.
 */
export function assertCanDeletePhoto(
  homeStatus: HomeStatus,
  photo: HomePhoto,
  readyPhotos: number,
): void {
  if (photo.status !== 'ready' || homeStatus === 'draft') return;
  if (readyPhotos - 1 < MIN_PHOTOS) throw new HomeMinPhotosError();
}
