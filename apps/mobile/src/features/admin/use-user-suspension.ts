import { useMutation } from '@tanstack/react-query';

import { useServices } from '../session/services';
import type { AdminUser, SuspensionDecision } from './admin-api';

export interface SuspensionRequest extends SuspensionDecision {
  userId: string;
}

/** Suspende o reactiva a un usuario (`adminSetUserSuspension`); devuelve el usuario actualizado. */
export function useSetUserSuspension() {
  const { adminApi } = useServices();
  return useMutation<AdminUser, Error, SuspensionRequest>({
    mutationFn: ({ userId, ...decision }) => adminApi.setUserSuspension(userId, decision),
  });
}
