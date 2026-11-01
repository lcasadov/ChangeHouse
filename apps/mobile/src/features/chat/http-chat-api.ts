import type { PhotoContentType } from '@changehouse/shared';

import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import {
  type ChatApi,
  ChatApiError,
  type ChatApiErrorKind,
  type ChatImageUpload,
  type ChatImageUrl,
  type OutgoingContent,
  type SentMessage,
} from './chat-api';

type Problem = components['schemas']['Problem'];

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const UNPROCESSABLE = 422;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;

const CONFLICT_KINDS: Record<string, ChatApiErrorKind> = {
  MATCH_NOT_OPEN: 'not-open',
  CHAT_NOT_READY: 'not-ready',
};

const UNPROCESSABLE_KINDS: Record<string, ChatApiErrorKind> = {
  INVALID_IMAGE: 'invalid-image',
  IMAGE_NOT_UPLOADED: 'image-not-uploaded',
};

const STATUS_KINDS: Record<number, ChatApiErrorKind> = {
  [UNAUTHORIZED]: 'unauthorized',
  [FORBIDDEN]: 'forbidden',
  [NOT_FOUND]: 'not-found',
  [TOO_MANY_REQUESTS]: 'rate-limited',
  [SERVICE_UNAVAILABLE]: 'busy',
};

/** El mensaje de campo con el que la API señala un texto de más de 2.000 caracteres. */
const TOO_LONG = 'too_long';

function badRequest(problem: Problem | undefined): ChatApiError {
  const tooLong = (problem?.errors ?? []).some((error) => error.message === TOO_LONG);
  return new ChatApiError(tooLong ? 'too-long' : 'invalid');
}

function failureOf(status: number, problem?: Problem): ChatApiError {
  if (status === BAD_REQUEST) return badRequest(problem);
  const code = problem?.code ?? '';
  if (status === CONFLICT) return new ChatApiError(CONFLICT_KINDS[code] ?? 'server');
  if (status === UNPROCESSABLE) return new ChatApiError(UNPROCESSABLE_KINDS[code] ?? 'server');
  return new ChatApiError(STATUS_KINDS[status] ?? 'server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new ChatApiError('network');
  }
}

/** Adaptador HTTP del puerto `ChatApi` sobre el cliente tipado. */
export function createHttpChatApi(client: ApiClient): ChatApi {
  return {
    async sendMessage(matchId: string, content: OutgoingContent): Promise<SentMessage> {
      const { data, error, response } = await request(() =>
        client.POST('/matches/{matchId}/messages', {
          params: { path: { matchId } },
          body: content,
        }),
      );
      if (!data) throw failureOf(response.status, error);
      return { id: data.id };
    },

    async createImageUpload(
      matchId: string,
      contentType: PhotoContentType,
    ): Promise<ChatImageUpload> {
      const { data, error, response } = await request(() =>
        client.POST('/matches/{matchId}/chat/image-uploads', {
          params: { path: { matchId } },
          body: { contentType },
        }),
      );
      if (!data) throw failureOf(response.status, error);
      return { uploadId: data.uploadId, uploadUrl: data.uploadUrl };
    },

    async getImageUrl(matchId: string, imageId: string): Promise<ChatImageUrl> {
      const { data, error, response } = await request(() =>
        client.GET('/matches/{matchId}/chat/images/{imageId}', {
          params: { path: { matchId, imageId } },
        }),
      );
      if (!data) throw failureOf(response.status, error);
      return { url: data.url, expiresAt: new Date(data.expiresAt) };
    },
  };
}
