import type { ApiClient } from '../../api/client';
import type { Home } from '../homes/homes-api';
import {
  type AdminApi,
  AdminApiError,
  type ModerationDecision,
  type ModerationPage,
  type Report,
  type ReportResolution,
  type ReportsPage,
} from './admin-api';

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;

/** Tamaño de página de la cola; el contrato admite de 1 a 50. */
export const QUEUE_PAGE_SIZE = 10;

function failureOf(status: number): AdminApiError {
  if (status === UNAUTHORIZED) return new AdminApiError('unauthorized');
  if (status === FORBIDDEN) return new AdminApiError('forbidden');
  if (status === NOT_FOUND) return new AdminApiError('not-found');
  if (status === CONFLICT) return new AdminApiError('conflict');
  return new AdminApiError(status === BAD_REQUEST ? 'invalid' : 'server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new AdminApiError('network');
  }
}

/** Adaptador HTTP del puerto `AdminApi` sobre el cliente tipado (`adminListHomes`, `adminModerateHome`, `adminListReports`, `adminResolveReport`). */
export function createHttpAdminApi(client: ApiClient): AdminApi {
  return {
    async listPending(cursor?: string): Promise<ModerationPage> {
      const { data, response } = await request(() =>
        client.GET('/admin/homes', {
          params: {
            query: {
              status: 'in_review',
              limit: QUEUE_PAGE_SIZE,
              ...(cursor ? { cursor } : {}),
            },
          },
        }),
      );
      if (!data) throw failureOf(response.status);
      return { items: data.items, nextCursor: data.nextCursor ?? null };
    },

    async moderate(homeId: string, decision: ModerationDecision): Promise<Home> {
      const { data, response } = await request(() =>
        client.POST('/admin/homes/{homeId}/moderation', {
          params: { path: { homeId } },
          body: decision,
        }),
      );
      if (!data) throw failureOf(response.status);
      return data;
    },

    async listReports(cursor?: string): Promise<ReportsPage> {
      const { data, response } = await request(() =>
        client.GET('/admin/reports', {
          params: {
            query: { status: 'open', limit: QUEUE_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
          },
        }),
      );
      if (!data) throw failureOf(response.status);
      return { items: data.items, nextCursor: data.nextCursor ?? null };
    },

    async resolveReport(reportId: string, resolution: ReportResolution): Promise<Report> {
      const { data, response } = await request(() =>
        client.PATCH('/admin/reports/{reportId}', {
          params: { path: { reportId } },
          body: resolution,
        }),
      );
      if (!data) throw failureOf(response.status);
      return data;
    },
  };
}
