import type { MeInput } from '@changehouse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { useServices } from '../session/services';
import { type Me } from './account-api';

const meQueryKey = (uid: string | undefined) => ['me', uid] as const;

/**
 * El perfil de la persona con sesión. `null` si todavía no se ha dado de alta; sin reintentos
 * automáticos: un fallo se muestra y la persona decide reintentar.
 */
export function useMe() {
  const { accountApi } = useServices();
  const { status, user } = useAuth();
  return useQuery({
    queryKey: meQueryKey(user?.uid),
    queryFn: () => accountApi.getMe(),
    enabled: status === 'signedIn',
    retry: false,
    staleTime: Infinity,
  });
}

/** Alta o actualización del perfil; al terminar deja el perfil en la caché y la sesión pasa a «lista». */
export function useUpsertMe() {
  const { accountApi } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<Me, Error, MeInput>({
    mutationFn: (input) => accountApi.upsertMe(input),
    onSuccess: (me) => {
      queryClient.setQueryData(meQueryKey(user?.uid), me);
    },
  });
}
