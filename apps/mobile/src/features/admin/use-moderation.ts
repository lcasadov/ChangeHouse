import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import type { Home } from '../homes/homes-api';
import { useServices } from '../session/services';
import type { ModerationDecision, ModerationPage } from './admin-api';

const queueKey = (uid: string | undefined) => ['moderation', 'queue', uid] as const;

/** La cola de moderación paginada por cursor, de la vivienda enviada antes a la enviada después. */
export function useModerationQueue() {
  const { adminApi } = useServices();
  const { status, user } = useAuth();
  return useInfiniteQuery<
    ModerationPage,
    Error,
    InfiniteData<ModerationPage, string | undefined>,
    ReturnType<typeof queueKey>,
    string | undefined
  >({
    queryKey: queueKey(user?.uid),
    queryFn: ({ pageParam }) => adminApi.listPending(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: status === 'signedIn',
    retry: false,
  });
}

/** Todas las viviendas cargadas de la cola, en orden. */
export function homesOf(
  pages: InfiniteData<ModerationPage, string | undefined> | undefined,
): Home[] {
  return pages?.pages.flatMap((page) => page.items) ?? [];
}

/** Aprueba o rechaza una vivienda; al terminar (con éxito o no) la cola se pide de nuevo. */
export function useModerate(homeId: string) {
  const { adminApi } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<Home, Error, ModerationDecision>({
    mutationFn: (decision) => adminApi.moderate(homeId, decision),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queueKey(user?.uid) }),
  });
}
