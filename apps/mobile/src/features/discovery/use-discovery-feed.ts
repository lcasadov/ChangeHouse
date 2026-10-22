import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { useServices } from '../session/services';
import type { DiscoveryCard, DiscoveryPage } from './discovery-api';
import { uniqueCards } from './feed-model';

/** Prefijo común de las consultas del descubrimiento: invalidarlo las vuelve a pedir todas. */
export const DISCOVERY_QUERY_KEY = 'discovery';

export interface DiscoveryFeedOptions {
  /** La vivienda propia y publicada desde la que se busca; sin ella, modo `seeker`. */
  homeId: string | undefined;
  /** Cambia cuando cambian las preferencias guardadas: otra búsqueda, otra primera página. */
  searchKey: string;
  enabled: boolean;
}

/** Las páginas de tarjetas compatibles, con la siguiente a un `fetchNextPage` de distancia. */
export function useDiscoveryFeed({ homeId, searchKey, enabled }: Readonly<DiscoveryFeedOptions>) {
  const { discoveryApi } = useServices();
  const { status, user } = useAuth();
  return useInfiniteQuery({
    queryKey: [DISCOVERY_QUERY_KEY, user?.uid, homeId ?? 'seeker', searchKey],
    queryFn: ({ pageParam }) =>
      discoveryApi.list({
        ...(homeId ? { homeId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && status === 'signedIn',
    // Una tarjeta que cambia de sitio bajo el dedo es peor que una lista algo antigua: solo se
    // vuelve a pedir si cambian las preferencias, la vivienda o con el botón de reintentar
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** La tarjeta que ya se ha cargado en alguna página del descubrimiento, si la hay. */
export function useCachedCard(homeId: string): DiscoveryCard | undefined {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const feeds = queryClient.getQueriesData<InfiniteData<DiscoveryPage>>({
    queryKey: [DISCOVERY_QUERY_KEY, user?.uid],
  });
  return feeds.flatMap(([, data]) => uniqueCards(data?.pages)).find((card) => card.id === homeId);
}

/** El detalle público de una vivienda ajena: la tarjeta ya cargada o, si no, lo que diga la API. */
export function usePublicHome(homeId: string) {
  const { discoveryApi } = useServices();
  const { status, user } = useAuth();
  const cached = useCachedCard(homeId);
  const query = useQuery({
    queryKey: ['public-home', user?.uid, homeId],
    queryFn: () => discoveryApi.getPublicHome(homeId),
    enabled: status === 'signedIn' && cached === undefined,
    retry: false,
  });
  return { cached, query };
}
