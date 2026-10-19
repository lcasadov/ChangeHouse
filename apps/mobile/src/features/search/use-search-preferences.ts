import type { SearchPreferencesInput } from '@changehouse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { DISCOVERY_QUERY_KEY } from '../discovery/use-discovery-feed';
import { useServices } from '../session/services';
import { fromApi, type Preferences } from './preferences';

const mineKey = (uid: string | undefined) => ['search-preferences', uid] as const;
const homeKey = (uid: string | undefined, homeId: string) =>
  ['search-preferences', uid, 'home', homeId] as const;

/** Las preferencias del usuario; `null` si aún no las ha guardado (primer uso). Sin reintentos. */
export function useMyPreferences(enabled = true) {
  const { searchPreferencesApi } = useServices();
  const { status, user } = useAuth();
  return useQuery({
    queryKey: mineKey(user?.uid),
    queryFn: async () => {
      const saved = await searchPreferencesApi.getMine();
      return saved ? fromApi(saved) : null;
    },
    enabled: enabled && status === 'signedIn',
    retry: false,
  });
}

/** Guarda las del usuario y deja el resultado en la caché. */
export function useSaveMyPreferences() {
  const { searchPreferencesApi } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return async (input: SearchPreferencesInput): Promise<Preferences> => {
    const saved = fromApi(await searchPreferencesApi.putMine(input));
    queryClient.setQueryData(mineKey(user?.uid), saved);
    return saved;
  };
}

/** Deja unas preferencias ya guardadas del usuario en la caché (las guardó el guardado diferido). */
export function useRememberMyPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return (saved: Preferences) => {
    queryClient.setQueryData(mineKey(user?.uid), saved);
  };
}

/** Las propias de una vivienda; `null` si no las tiene y busca con las del usuario. */
export function useHomePreferences(homeId: string) {
  const { searchPreferencesApi } = useServices();
  const { status, user } = useAuth();
  return useQuery({
    queryKey: homeKey(user?.uid, homeId),
    queryFn: async () => {
      const saved = await searchPreferencesApi.getForHome(homeId);
      return saved ? fromApi(saved) : null;
    },
    enabled: status === 'signedIn',
    retry: false,
  });
}

/** Define las propias de una vivienda y deja el resultado en la caché. */
export function useSaveHomePreferences(homeId: string) {
  const { searchPreferencesApi } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return async (input: SearchPreferencesInput): Promise<Preferences> => {
    const saved = fromApi(await searchPreferencesApi.putForHome(homeId, input));
    queryClient.setQueryData(homeKey(user?.uid, homeId), saved);
    // Las tarjetas de «Explorar» dependen de las preferencias de la vivienda desde la que se busca
    void queryClient.invalidateQueries({ queryKey: [DISCOVERY_QUERY_KEY] });
    return saved;
  };
}

/** Elimina las propias de una vivienda: vuelve a buscar con las del usuario. */
export function useDeleteHomePreferences(homeId: string) {
  const { searchPreferencesApi } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => searchPreferencesApi.deleteForHome(homeId),
    onSuccess: () => {
      queryClient.setQueryData(homeKey(user?.uid, homeId), null);
      void queryClient.invalidateQueries({ queryKey: [DISCOVERY_QUERY_KEY] });
    },
  });
}
