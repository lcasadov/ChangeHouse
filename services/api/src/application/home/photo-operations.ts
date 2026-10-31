import type { PhotoContentType } from '@changehouse/shared';

import {
  InvalidImageError,
  PhotoLimitReachedError,
  PhotoNotUploadedError,
} from '../../domain/home/errors.js';
import { assertEditable, type Home, relevantChangeOf } from '../../domain/home/home.js';
import {
  assertCanAddPhoto,
  assertCanDeletePhoto,
  type HomePhoto,
} from '../../domain/home/photo.js';
import type { Clock } from '../clock.js';
import type { IdGenerator } from '../id-generator.js';
import { PhotoNotFoundError } from './errors.js';
import type { HomeRepository } from './home-repository.js';
import type { PhotoUploadView, PhotoView } from './home-views.js';
import type { ImageProcessor } from './image-processor.js';
import { ownHome } from './own-home.js';
import { originalPath, publishedPath } from './photo-paths.js';
import type { PhotoRepository } from './photo-repository.js';
import type { PhotoStorage } from './photo-storage.js';

/** Vigencia de la URL firmada de subida (`createHomePhotoUpload`). */
const UPLOAD_URL_MINUTES = 15;
const MS_PER_MINUTE = 60_000;
/** Tamaño máximo del original: un original mayor se descarta sin descargarlo. */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

export interface PhotoDeps {
  homes: HomeRepository;
  photos: PhotoRepository;
  storage: PhotoStorage;
  images: ImageProcessor;
  clock: Clock;
  ids: IdGenerator;
}

function toView(deps: PhotoDeps, photo: HomePhoto): PhotoView {
  return {
    id: photo.id,
    url: deps.storage.publicUrl(photo.storagePath),
    position: photo.position ?? 0,
  };
}

/** La foto de una vivienda propia y editable; si no existe en esa vivienda, 404. */
async function ownPhoto(deps: PhotoDeps, ownerId: string, homeId: string, photoId: string) {
  const home = await ownHome(deps.homes, ownerId, homeId);
  assertEditable(home);
  const photo = await deps.photos.find(homeId, photoId);
  if (!photo) throw new PhotoNotFoundError();
  return { home, photo };
}

/**
 * Las fotos de una vivienda que ya estuvo en el descubrimiento son un cambio relevante (RF-44): si
 * está publicada o pausada, además, vuelve a revisión (RF-18).
 */
async function noteRelevantChange(deps: PhotoDeps, home: Home): Promise<void> {
  const change = relevantChangeOf(home, deps.clock.now());
  if (change) await deps.homes.markRelevantChange(home.id, change);
}

/** Descarta una foto que no llegó a publicarse: su fila y el original subido. */
async function discard(deps: PhotoDeps, photo: HomePhoto): Promise<void> {
  await deps.photos.delete(photo.homeId, photo.id);
  await deps.storage.deleteOriginal(originalPath(photo.homeId, photo.id));
}

async function createPhotoUpload(
  deps: PhotoDeps,
  ownerId: string,
  homeId: string,
  contentType: PhotoContentType,
): Promise<PhotoUploadView> {
  const home = await ownHome(deps.homes, ownerId, homeId);
  assertEditable(home);
  assertCanAddPhoto(await deps.photos.countReady(homeId));

  const now = deps.clock.now();
  const photoId = deps.ids.next();
  const expiresAt = new Date(now.getTime() + UPLOAD_URL_MINUTES * MS_PER_MINUTE);
  const uploadUrl = await deps.storage.createUploadUrl(
    originalPath(homeId, photoId),
    contentType,
    expiresAt,
  );
  await deps.photos.insertPending({
    id: photoId,
    homeId,
    status: 'pending',
    storagePath: publishedPath(homeId, photoId),
    position: null,
    createdAt: now,
  });
  return { photoId, uploadUrl, expiresAt: expiresAt.toISOString() };
}

/** Procesa el original; si no es una imagen válida lo descarta todo y propaga el error. */
async function processOriginal(deps: PhotoDeps, photo: HomePhoto): Promise<void> {
  const original = await deps.storage.readOriginal(
    originalPath(photo.homeId, photo.id),
    MAX_ORIGINAL_BYTES,
  );
  if (original.status === 'missing') throw new PhotoNotUploadedError();
  try {
    if (original.status === 'too_large') throw new InvalidImageError();
    const processed = await deps.images.process(original.data);
    await deps.storage.publish(photo.storagePath, processed.data, processed.contentType);
  } catch (error) {
    if (error instanceof InvalidImageError) await discard(deps, photo);
    throw error;
  }
}

async function completePhotoUpload(
  deps: PhotoDeps,
  ownerId: string,
  homeId: string,
  photoId: string,
): Promise<PhotoView> {
  const { home, photo } = await ownPhoto(deps, ownerId, homeId, photoId);
  if (photo.status === 'ready') return toView(deps, photo);

  await processOriginal(deps, photo);
  const ready = await deps.photos.markReady(homeId, photoId);
  if (ready === null) {
    await deps.storage.deletePublished(photo.storagePath);
    await discard(deps, photo);
    // Otra confirmación se llevó la última posición libre mientras se procesaba esta
    throw new PhotoLimitReachedError();
  }
  await deps.storage.deleteOriginal(originalPath(homeId, photoId));
  await noteRelevantChange(deps, home);
  return toView(deps, ready);
}

async function deletePhoto(
  deps: PhotoDeps,
  ownerId: string,
  homeId: string,
  photoId: string,
): Promise<void> {
  const { home, photo } = await ownPhoto(deps, ownerId, homeId, photoId);
  assertCanDeletePhoto(home.status, photo, await deps.photos.countReady(homeId));

  await deps.photos.delete(homeId, photoId);
  await deps.storage.deletePublished(photo.storagePath);
  await deps.storage.deleteOriginal(originalPath(homeId, photoId));
  await noteRelevantChange(deps, home);
}

/** Los casos de uso de las fotos con sus dependencias ya inyectadas, listos para el transporte. */
export function photoOperations(deps: PhotoDeps) {
  return {
    createPhotoUpload: (ownerId: string, homeId: string, contentType: PhotoContentType) =>
      createPhotoUpload(deps, ownerId, homeId, contentType),
    completePhotoUpload: (ownerId: string, homeId: string, photoId: string) =>
      completePhotoUpload(deps, ownerId, homeId, photoId),
    deletePhoto: (ownerId: string, homeId: string, photoId: string) =>
      deletePhoto(deps, ownerId, homeId, photoId),
  };
}
