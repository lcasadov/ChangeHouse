import type { HomeInput, HomePatch } from '@changehouse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { useServices } from '../session/services';
import type { Home } from './homes-api';

const homesKey = (uid: string | undefined) => ['homes', uid] as const;
const homeKey = (uid: string | undefined, homeId: string | undefined) =>
  ['home', uid, homeId] as const;

/** Las viviendas de la persona con sesión, en cualquier estado. Sin reintentos automáticos. */
export function useMyHomes() {
  const { homesApi } = useServices();
  const { status, user } = useAuth();
  return useQuery({
    queryKey: homesKey(user?.uid),
    queryFn: () => homesApi.listMine(),
    enabled: status === 'signedIn',
    retry: false,
  });
}

/** La ficha completa de una vivienda propia; sin `homeId` (alta nueva) no consulta nada. */
export function useHome(homeId: string | undefined) {
  const { homesApi } = useServices();
  const { status, user } = useAuth();
  return useQuery({
    queryKey: homeKey(user?.uid, homeId),
    queryFn: () => homesApi.get(homeId ?? ''),
    enabled: status === 'signedIn' && homeId !== undefined,
    retry: false,
  });
}

/** Deja la vivienda en la caché y marca la lista como desactualizada. */
function useRememberHome() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return (home: Home) => {
    queryClient.setQueryData(homeKey(user?.uid, home.id), home);
    void queryClient.invalidateQueries({ queryKey: homesKey(user?.uid) });
  };
}

/** Primer paso del asistente: crea el borrador con el tipo y la dirección. */
export function useCreateHome() {
  const { homesApi } = useServices();
  const remember = useRememberHome();
  return useMutation<Home, Error, HomeInput>({
    mutationFn: (input) => homesApi.create(input),
    onSuccess: remember,
  });
}

/** Guarda un paso del asistente. */
export function useUpdateHome(homeId: string) {
  const { homesApi } = useServices();
  const remember = useRememberHome();
  return useMutation<Home, Error, HomePatch>({
    mutationFn: (patch) => homesApi.update(homeId, patch),
    onSuccess: remember,
  });
}

/** Envía el borrador a revisión. */
export function useSubmitHome(homeId: string) {
  const { homesApi } = useServices();
  const remember = useRememberHome();
  return useMutation<Home, Error, void>({
    mutationFn: () => homesApi.submit(homeId),
    onSuccess: remember,
  });
}
