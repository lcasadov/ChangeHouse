import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import type { Home } from '../homes/homes-api';
import {
  type AdminApi,
  AdminApiError,
  type AdminUser,
  type AuditPage,
  type Metrics,
  type MetricsPeriod,
  type ModerationDecision,
  type ModerationPage,
  type Report,
  type ReportResolution,
  type ReportsPage,
  type SuspensionDecision,
  type UsersPage,
  type WaitlistPage,
} from './admin-api';

type Problem = components['schemas']['Problem'];

/** Los 409 de `adminSetUserSuspension`, por su código estable. */
const SUSPENSION_CONFLICTS: Record<string, AdminApiError['kind']> = {
  CANNOT_SUSPEND_SELF: 'cannot-suspend-self',
  CANNOT_SUSPEND_ADMIN: 'cannot-suspend-admin',
};

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;

/** Tamaño de página de la cola; el contrato admite de 1 a 50. */
export const QUEUE_PAGE_SIZE = 10;

function failureOf(status: number, problem?: Problem): AdminApiError {
  const conflict = status === CONFLICT ? SUSPENSION_CONFLICTS[problem?.code ?? ''] : undefined;
  if (conflict) return new AdminApiError(conflict);
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

/**
 * Adaptador HTTP del puerto `AdminApi` sobre el cliente tipado (`adminListHomes`,
 * `adminModerateHome`, `adminSetUserSuspension`, `adminListReports`, `adminResolveReport`).
 */
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

    async setUserSuspension(userId: string, decision: SuspensionDecision): Promise<AdminUser> {
      const { data, error, response } = await request(() =>
        client.PUT('/admin/users/{userId}/suspension', {
          params: { path: { userId } },
          body: decision,
        }),
      );
      if (!data) throw failureOf(response.status, error);
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

    async getMetrics(period: MetricsPeriod): Promise<Metrics> {
      const { data, response } = await request(() =>
        client.GET('/admin/metrics', { params: { query: period } }),
      );
      if (!data) throw failureOf(response.status);
      return data;
    },

    async listUsers({ q, cursor }): Promise<UsersPage> {
      const { data, response } = await request(() =>
        client.GET('/admin/users', {
          params: {
            query: { limit: QUEUE_PAGE_SIZE, ...(q ? { q } : {}), ...(cursor ? { cursor } : {}) },
          },
        }),
      );
      if (!data) throw failureOf(response.status);
      return { items: data.items, nextCursor: data.nextCursor ?? null };
    },

    async listAuditLog(cursor?: string): Promise<AuditPage> {
      const { data, response } = await request(() =>
        client.GET('/admin/audit-log', {
          params: { query: { limit: QUEUE_PAGE_SIZE, ...(cursor ? { cursor } : {}) } },
        }),
      );
      if (!data) throw failureOf(response.status);
      return { items: data.items, nextCursor: data.nextCursor ?? null };
    },

    async listWaitlist({ municipality, cursor }): Promise<WaitlistPage> {
      const { data, response } = await request(() =>
        client.GET('/admin/waitlist', {
          params: {
            query: {
              limit: QUEUE_PAGE_SIZE,
              ...(municipality ? { municipality } : {}),
              ...(cursor ? { cursor } : {}),
            },
          },
        }),
      );
      if (!data || typeof data === 'string') throw failureOf(response.status);
      return { items: data.items, nextCursor: data.nextCursor ?? null };
    },

    async exportWaitlist(municipality?: string): Promise<string> {
      const { data, response } = await request(() =>
        client.GET('/admin/waitlist', {
          params: { query: municipality ? { municipality } : {} },
          headers: { Accept: 'text/csv' },
          parseAs: 'text',
        }),
      );
      if (data === undefined || !response.ok) throw failureOf(response.status);
      return data;
    },
  };
}
