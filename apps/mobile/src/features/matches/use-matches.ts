import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import type { PublicHome } from '../discovery/discovery-api';
import { useServices } from '../session/services';

/** Prefijo común de las consultas de matches: invalidarlo vuelve a pedir la lista. */
export const MATCHES_QUERY_KEY = 'matches';

/** Los matches de la persona, del más reciente al más antiguo, con la página siguiente a un `fetchNextPage`. */
export function useMatches() {
  const { matchesApi } = useServices();
  const { status, user } = useAuth();
  return useInfiniteQuery({
    queryKey: [MATCHES_QUERY_KEY, user?.uid],
    queryFn: ({ pageParam }) => matchesApi.list(pageParam ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: status === 'signedIn',
    retry: false,
  });
}

/**
 * La forma pública de la otra casa de un match (portada y zona). Falla si su dueño ya no la tiene
 * publicada: la lista lo muestra como «casa no disponible» en lugar de ocultar el match.
 */
export function useOtherHome(homeId: string | undefined) {
  const { discoveryApi } = useServices();
  const { status, user } = useAuth();
  return useQuery<PublicHome>({
    queryKey: ['public-home', user?.uid, homeId],
    queryFn: () => discoveryApi.getPublicHome(homeId ?? ''),
    enabled: status === 'signedIn' && homeId !== undefined,
    retry: false,
  });
}
