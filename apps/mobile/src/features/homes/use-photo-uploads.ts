import type { PhotoContentType } from '@changehouse/shared';
import { useRef, useState } from 'react';

import { useServices } from '../session/services';
import { MAX_PHOTOS } from './home-form';
import {
  failureOf,
  supportedContentType,
  type UploadItem,
  UploadTransferError,
} from './home-photos';
import type { PickedPhoto } from './photo-picker';
import { useAddedPhoto } from './use-homes';

/** Cuántas fotos se envían a la vez: suficiente para ir rápido sin saturar una conexión móvil. */
const MAX_PARALLEL = 3;

const isRunning = (item: UploadItem) => item.stage === 'uploading' || item.stage === 'processing';

export interface PhotoUploads {
  items: readonly UploadItem[];
  /** La galería está abierta: no se puede abrir otra a la vez. */
  picking: boolean;
  /** La galería no se pudo abrir. */
  pickFailed: boolean;
  /** Abre la galería y encola lo elegido; sin `homeId` las fotos esperan a que exista el borrador. */
  choose: (limit: number, homeId: string | undefined) => Promise<void>;
  /** Vuelve a intentar una foto que falló. */
  retry: (key: string, homeId: string | undefined) => void;
  /** Descarta una foto que falló. */
  discard: (key: string) => void;
  /** Empieza a subir lo que esperaba a que existiera la vivienda. */
  flush: (homeId: string) => void;
}

function toItem(photo: PickedPhoto, key: string): UploadItem {
  const contentType = supportedContentType(photo.contentType);
  const base = { key, uri: photo.uri, contentType, progress: 0, uploaded: false };
  return contentType === null
    ? { ...base, stage: 'failed', failure: 'unsupported' }
    : { ...base, stage: 'queued' };
}

/**
 * Las fotos que se están subiendo: pide la URL firmada, envía el fichero con progreso y confirma la
 * subida para que la API la procese. Cuando termina, la foto pasa a la ficha de la vivienda y deja
 * la cola. Vive en el asistente, no en un paso, para que las subidas sigan al cambiar de paso.
 */
export function usePhotoUploads(): PhotoUploads {
  const { homesApi, photoPicker, photoUploader } = useServices();
  const addPhoto = useAddedPhoto();
  const itemsRef = useRef<UploadItem[]>([]);
  const nextKey = useRef(0);
  const [items, setItems] = useState<readonly UploadItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickFailed, setPickFailed] = useState(false);

  const commit = (next: UploadItem[]) => {
    itemsRef.current = next;
    setItems(next);
  };
  const patch = (key: string, changes: Partial<UploadItem>) => {
    commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };

  const upload = async (homeId: string, item: UploadItem, contentType: PhotoContentType) => {
    let photoId = item.photoId;
    if (!item.uploaded || photoId === undefined) {
      const target = await homesApi.createPhotoUpload(homeId, contentType);
      photoId = target.photoId;
      patch(item.key, { photoId });
      try {
        await photoUploader.upload(
          { url: target.uploadUrl, contentType, uri: item.uri },
          (progress) => {
            patch(item.key, { progress });
          },
        );
      } catch {
        throw new UploadTransferError();
      }
      patch(item.key, { uploaded: true });
    }
    patch(item.key, { stage: 'processing', progress: 1 });
    return homesApi.completePhotoUpload(homeId, photoId);
  };

  const run = (homeId: string, item: UploadItem, contentType: PhotoContentType) => {
    upload(homeId, item, contentType)
      .then((photo) => {
        addPhoto(homeId, photo);
        commit(itemsRef.current.filter((candidate) => candidate.key !== item.key));
      })
      .catch((error: unknown) => {
        const failure = failureOf(error);
        patch(item.key, {
          stage: 'failed',
          failure,
          // Si la API no recibió el fichero hay que volver a enviarlo, no solo a confirmar
          ...(failure === 'notUploaded' ? { uploaded: false } : {}),
        });
      })
      .finally(() => {
        pump(homeId);
      });
  };

  /** Arranca las fotos en espera mientras quepan en el máximo de envíos simultáneos. */
  const pump = (homeId: string) => {
    let slots = MAX_PARALLEL - itemsRef.current.filter(isRunning).length;
    for (const item of itemsRef.current) {
      if (slots <= 0) return;
      if (item.stage !== 'queued' || item.contentType === null) continue;
      slots -= 1;
      patch(item.key, { stage: 'uploading', progress: 0 });
      run(homeId, item, item.contentType);
    }
  };

  const choose = async (limit: number, homeId: string | undefined) => {
    setPickFailed(false);
    setPicking(true);
    try {
      const picked = await photoPicker.pick(Math.min(limit, MAX_PHOTOS));
      const added = picked.map((photo) => {
        nextKey.current += 1;
        return toItem(photo, `upload-${String(nextKey.current)}`);
      });
      commit([...itemsRef.current, ...added]);
      if (homeId !== undefined) pump(homeId);
    } catch {
      setPickFailed(true);
    } finally {
      setPicking(false);
    }
  };

  const retry = (key: string, homeId: string | undefined) => {
    patch(key, { stage: 'queued', progress: 0 });
    if (homeId !== undefined) pump(homeId);
  };

  const discard = (key: string) => {
    commit(itemsRef.current.filter((item) => item.key !== key));
  };

  return { items, picking, pickFailed, choose, retry, discard, flush: pump };
}
