import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { useServices } from '../session/services';
import type { Report, ReportResolution, ReportsPage } from './admin-api';

const reportsKey = (uid: string | undefined) => ['moderation', 'reports', uid] as const;

/** La cola de denuncias abiertas paginada por cursor, de la más antigua a la más reciente. */
export function useReportsQueue() {
  const { adminApi } = useServices();
  const { status, user } = useAuth();
  return useInfiniteQuery<
    ReportsPage,
    Error,
    InfiniteData<ReportsPage, string | undefined>,
    ReturnType<typeof reportsKey>,
    string | undefined
  >({
    queryKey: reportsKey(user?.uid),
    queryFn: ({ pageParam }) => adminApi.listReports(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: status === 'signedIn',
    retry: false,
  });
}

/** Todas las denuncias cargadas de la cola, en orden. */
export function reportsOf(pages: InfiniteData<ReportsPage, string | undefined> | undefined) {
  return pages?.pages.flatMap((page) => page.items) ?? [];
}

/** Resuelve o desestima una denuncia; al terminar (con éxito o no) la cola se pide de nuevo. */
export function useResolveReport() {
  const { adminApi } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<Report, Error, { reportId: string } & ReportResolution>({
    mutationFn: ({ reportId, ...resolution }) => adminApi.resolveReport(reportId, resolution),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportsKey(user?.uid) }),
  });
}
