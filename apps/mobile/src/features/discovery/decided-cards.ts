import { type QueryClient, useQuery } from '@tanstack/react-query';

/** Prefijo de lo ya decidido en esta sesión; vive en la misma caché que las tarjetas y se vacía con ella al cerrar sesión. */
const DECIDED_QUERY_KEY = 'discovery-decided';

const NOTHING: ReadonlySet<string> = new Set();

const decidedKey = (uid: string | undefined, homeId: string | undefined) =>
  [DECIDED_QUERY_KEY, uid, homeId ?? 'seeker'] as const;

/**
 * Las viviendas sobre las que esta persona ya ha decidido desde esa vivienda (o desde su cuenta,
 * sin ella). Se guardan aparte de las páginas de tarjetas, que no se tocan: así la lista no
 * pierde su estado de carga ni sus cursores, y una consulta antigua, ya cargada, no vuelve a
 * enseñar lo decidido al volver a «Explorar». La API sigue siendo la fuente de verdad: al pedir las
 * tarjetas de nuevo ya no las incluye.
 */
export function useDecidedIds(
  uid: string | undefined,
  homeId: string | undefined,
): ReadonlySet<string> {
  const { data } = useQuery<ReadonlySet<string>>({
    queryKey: decidedKey(uid, homeId),
    // Nunca se pide: es solo un sitio de la caché con quien se suscribe a los cambios
    queryFn: () => NOTHING,
    initialData: NOTHING,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

function update(
  queryClient: QueryClient,
  uid: string | undefined,
  homeId: string | undefined,
  change: (ids: Set<string>) => void,
): void {
  queryClient.setQueryData<ReadonlySet<string>>(decidedKey(uid, homeId), (previous) => {
    const ids = new Set(previous ?? NOTHING);
    change(ids);
    return ids;
  });
}

export function markDecided(
  queryClient: QueryClient,
  uid: string | undefined,
  homeId: string | undefined,
  cardId: string,
): void {
  update(queryClient, uid, homeId, (ids) => ids.add(cardId));
}

export function unmarkDecided(
  queryClient: QueryClient,
  uid: string | undefined,
  homeId: string | undefined,
  cardId: string,
): void {
  update(queryClient, uid, homeId, (ids) => ids.delete(cardId));
}
