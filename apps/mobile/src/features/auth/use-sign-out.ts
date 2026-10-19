import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useServices } from '../session/services';

/** Cierra la sesión y descarta lo consultado con ella (el perfil de la persona no se queda en memoria). */
export function useSignOut() {
  const { auth } = useServices();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await auth.signOut();
    } finally {
      queryClient.clear();
    }
  }, [auth, queryClient]);
}
