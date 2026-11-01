import type { PhotoContentType } from '@changehouse/shared';

export type ChatApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** El rol de la cuenta no permite usar el chat (403). */
  | 'forbidden'
  /** El texto supera el límite de caracteres (400 con `text: too_long`). */
  | 'too-long'
  /** El mensaje está vacío o no es válido (400). */
  | 'invalid'
  /** El match no existe o la persona no participa en él (404). */
  | 'not-found'
  /** El match está cerrado o caducado: el chat es de solo lectura (409 `MATCH_NOT_OPEN`). */
  | 'not-open'
  /** El chat aún no se ha creado; se reintenta (409 `CHAT_NOT_READY`). */
  | 'not-ready'
  /** El fichero no es una imagen válida (422 `INVALID_IMAGE`). */
  | 'invalid-image'
  /** La imagen no llegó al almacenamiento (422 `IMAGE_NOT_UPLOADED`). */
  | 'image-not-uploaded'
  /** Se superó el límite de 30 subidas de imágenes por hora (429 `CHAT_IMAGE_RATE_LIMITED`). */
  | 'rate-limited'
  /** El procesado de imágenes está saturado; se puede reintentar (503 `IMAGE_PROCESSING_BUSY`). */
  | 'busy'
  | 'server';

export class ChatApiError extends Error {
  constructor(readonly kind: ChatApiErrorKind) {
    super(kind);
    this.name = 'ChatApiError';
  }
}

/** Exactamente uno de los dos, como en `sendMatchMessage`. */
export type OutgoingContent = { text: string } | { imageUploadId: string };

export interface SentMessage {
  /** El id del mensaje: el mismo que tendrá su documento en el chat en tiempo real. */
  id: string;
}

export interface ChatImageUpload {
  uploadId: string;
  /** La URL firmada de subida (`PUT`). */
  uploadUrl: string;
}

export interface ChatImageUrl {
  url: string;
  expiresAt: Date;
}

/** Puerto de salida del chat contra la API; el adaptador HTTP vive en `http-chat-api.ts`. */
export interface ChatApi {
  /** Envía un texto o una imagen ya subida (`sendMatchMessage`). */
  sendMessage: (matchId: string, content: OutgoingContent) => Promise<SentMessage>;
  /** Pide la URL firmada para subir una imagen (`createChatImageUpload`). */
  createImageUpload: (matchId: string, contentType: PhotoContentType) => Promise<ChatImageUpload>;
  /** Cambia el `imageId` de un mensaje por una URL firmada de corta duración (`getChatImageUrl`). */
  getImageUrl: (matchId: string, imageId: string) => Promise<ChatImageUrl>;
}
