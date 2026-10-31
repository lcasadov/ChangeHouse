import { type InfiniteData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { useServices } from '../session/services';
import type { AdminUser, AuditEntry, Metrics, MetricsPeriod, WaitlistEntry } from './admin-api';

/** Prefijo común de las listas de usuarios; la suspensión lo invalida para refrescar el estado. */
export const USERS_KEY = ['admin', 'users'] as const;

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Una lista paginada por cursor, solo con sesión iniciada y sin reintentos automáticos. */
function usePagedQuery<T>(
  key: readonly unknown[],
  fetchPage: (cursor?: string) => Promise<Page<T>>,
) {
  const { status } = useAuth();
  return useInfiniteQuery<
    Page<T>,
    Error,
    InfiniteData<Page<T>, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: status === 'signedIn',
    retry: false,
  });
}

/** Todos los elementos cargados de una lista paginada, en orden. */
export function itemsOf<T>(pages: InfiniteData<Page<T>, string | undefined> | undefined): T[] {
  return pages?.pages.flatMap((page) => page.items) ?? [];
}

/** Las métricas de un periodo; sin periodo no pide nada. */
export function useMetrics(period: MetricsPeriod | null) {
  const { adminApi } = useServices();
  const { status, user } = useAuth();
  return useQuery<Metrics, Error>({
    queryKey: ['admin', 'metrics', user?.uid, period?.from, period?.to],
    queryFn: () =>
      period ? adminApi.getMetrics(period) : Promise.reject(new Error('Sin periodo')),
    enabled: status === 'signedIn' && period !== null,
    retry: false,
  });
}

/** Los usuarios que coinciden con la búsqueda (todos si está vacía). */
export function useAdminUsers(q: string) {
  const { adminApi } = useServices();
  const { user } = useAuth();
  return usePagedQuery<AdminUser>([...USERS_KEY, user?.uid, q], (cursor) =>
    adminApi.listUsers({ ...(q ? { q } : {}), ...(cursor ? { cursor } : {}) }),
  );
}

/** El registro de auditoría, del más reciente al más antiguo. */
export function useAuditLog() {
  const { adminApi } = useServices();
  const { user } = useAuth();
  return usePagedQuery<AuditEntry>(['admin', 'audit', user?.uid], (cursor) =>
    adminApi.listAuditLog(cursor),
  );
}

/** La lista de espera, filtrada por municipio si se indica. */
export function useWaitlist(municipality: string) {
  const { adminApi } = useServices();
  const { user } = useAuth();
  return usePagedQuery<WaitlistEntry>(['admin', 'waitlist', user?.uid, municipality], (cursor) =>
    adminApi.listWaitlist({
      ...(municipality ? { municipality } : {}),
      ...(cursor ? { cursor } : {}),
    }),
  );
}

/** Descarga la lista de espera en CSV con el mismo filtro. */
export function useExportWaitlist() {
  const { adminApi } = useServices();
  return useMutation<string, Error, string>({
    mutationFn: (municipality) => adminApi.exportWaitlist(municipality || undefined),
  });
}
