import type { ApiClient } from '../../api/client';
import {
  type ModerationApi,
  ModerationApiError,
  type ModerationApiErrorKind,
  type ReportTarget,
} from './moderation-api';

const KIND_OF_STATUS: Record<number, ModerationApiErrorKind> = {
  400: 'invalid',
  401: 'unauthorized',
  404: 'not-found',
  429: 'rate-limited',
};

const failureOf = (status: number): ModerationApiError =>
  new ModerationApiError(KIND_OF_STATUS[status] ?? 'server');

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new ModerationApiError('network');
  }
}

/** Adaptador HTTP del puerto `ModerationApi` sobre el cliente tipado (`createReport`, `blockUser`). */
export function createHttpModerationApi(client: ApiClient): ModerationApi {
  return {
    async report(target: ReportTarget, reason: string): Promise<void> {
      const { response } = await request(() =>
        client.POST('/reports', {
          body: { targetType: target.type, targetId: target.id, reason },
        }),
      );
      if (!response.ok) throw failureOf(response.status);
    },

    async block(userId: string): Promise<void> {
      const { response } = await request(() =>
        client.POST('/me/blocked-users', { body: { userId } }),
      );
      if (!response.ok) throw failureOf(response.status);
    },
  };
}
