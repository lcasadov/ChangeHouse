import type { PhotoContentType } from '@changehouse/shared';
import { useRef, useState } from 'react';

import { supportedContentType } from '../homes/home-photos';
import { useServices } from '../session/services';
import { ChatApiError } from './chat-api';
import { failureOf, type OutgoingMessage } from './chat-model';

/** Por qué no se pudo empezar a enviar una imagen; cada valor tiene su texto en `chat.attach`. */
export type AttachFailure = 'unsupported' | 'galleryFailed';

export interface ChatOutbox {
  messages: readonly OutgoingMessage[];
  /** La galería está abierta: no se puede abrir otra a la vez. */
  picking: boolean;
  attachFailure: AttachFailure | null;
  sendText: (text: string) => void;
  /** Abre la galería y envía la foto elegida. */
  attachImage: () => Promise<void>;
  retry: (key: string) => void;
  discard: (key: string) => void;
}

interface OutboxOptions {
  matchId: string;
  /** La API respondió que el match ya no admite mensajes. */
  onClosed: () => void;
}

/**
 * Los mensajes que esta persona envía: aparecen al instante, pasan a «enviado» cuando la API los
 * acepta (y desaparecen al llegar del canal en tiempo real) o quedan «no enviados» con su motivo.
 * Una imagen se sube a su URL firmada y solo entonces se envía; si falla el envío, reintentar no
 * la vuelve a subir.
 */
export function useChatOutbox({ matchId, onClosed }: Readonly<OutboxOptions>): ChatOutbox {
  const { chatApi, photoPicker, photoUploader } = useServices();
  const itemsRef = useRef<OutgoingMessage[]>([]);
  const nextKey = useRef(0);
  const [messages, setMessages] = useState<readonly OutgoingMessage[]>([]);
  const [picking, setPicking] = useState(false);
  const [attachFailure, setAttachFailure] = useState<AttachFailure | null>(null);

  const commit = (next: OutgoingMessage[]) => {
    itemsRef.current = next;
    setMessages(next);
  };
  const patch = (key: string, changes: Partial<OutgoingMessage>) => {
    commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };
  const find = (key: string) => itemsRef.current.find((item) => item.key === key);

  /** Sube la imagen si aún no está subida y devuelve el id con el que se envía. */
  const ensureUploaded = async (item: OutgoingMessage, contentType: PhotoContentType) => {
    if (item.uploaded === true && item.uploadId !== undefined) return item.uploadId;
    const upload = await chatApi.createImageUpload(matchId, contentType);
    patch(item.key, { uploadId: upload.uploadId, uploaded: false });
    await photoUploader.upload(
      { url: upload.uploadUrl, contentType, uri: item.uri ?? '' },
      () => undefined,
    );
    patch(item.key, { uploaded: true });
    return upload.uploadId;
  };

  const transmit = async (item: OutgoingMessage) => {
    if (item.kind === 'text') return chatApi.sendMessage(matchId, { text: item.text ?? '' });
    const imageUploadId = await ensureUploaded(item, item.contentType ?? 'image/jpeg');
    return chatApi.sendMessage(matchId, { imageUploadId });
  };

  const run = async (key: string) => {
    const item = find(key);
    if (!item) return;
    patch(key, { stage: 'sending' });
    try {
      const sent = await transmit(item);
      patch(key, { stage: 'sent', serverId: sent.id });
    } catch (error) {
      const failure = failureOf(error);
      // Si la API no recibió el fichero hay que volver a enviarlo, no solo a confirmar
      const lostUpload = error instanceof ChatApiError && error.kind === 'image-not-uploaded';
      patch(key, { stage: 'failed', failure, ...(lostUpload ? { uploaded: false } : {}) });
      if (failure === 'closed') onClosed();
    }
  };

  const enqueue = (item: Omit<OutgoingMessage, 'key' | 'stage' | 'createdAt'>) => {
    nextKey.current += 1;
    const key = `outgoing-${String(nextKey.current)}`;
    commit([...itemsRef.current, { ...item, key, stage: 'sending', createdAt: new Date() }]);
    run(key).catch(() => undefined);
  };

  const attachImage = async () => {
    setAttachFailure(null);
    setPicking(true);
    try {
      const [photo] = await photoPicker.pick(1);
      if (!photo) return;
      const contentType = supportedContentType(photo.contentType);
      if (contentType === null) setAttachFailure('unsupported');
      else enqueue({ kind: 'image', uri: photo.uri, contentType });
    } catch {
      setAttachFailure('galleryFailed');
    } finally {
      setPicking(false);
    }
  };

  return {
    messages,
    picking,
    attachFailure,
    sendText: (text) => {
      enqueue({ kind: 'text', text: text.trim() });
    },
    attachImage,
    retry: (key) => {
      run(key).catch(() => undefined);
    },
    discard: (key) => {
      commit(itemsRef.current.filter((item) => item.key !== key));
    },
  };
}
