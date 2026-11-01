import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { MATCHES_QUERY_KEY } from '../matches/use-matches';
import { useServices } from '../session/services';
import { ModerationApiError, type ReportTarget } from './moderation-api';

/** Denunciar y bloquear: dos acciones independientes, cada una con su estado de envío. */
export function useModerationActions() {
  const { moderationApi } = useServices();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const report = useMutation<void, Error, { target: ReportTarget; reason: string }>({
    mutationFn: ({ target, reason }) => moderationApi.report(target, reason),
  });
  const block = useMutation<void, Error, string>({
    mutationFn: (userId) => moderationApi.block(userId),
    // Bloquear cierra los matches abiertos con esa persona: se vuelven a pedir para verlos cerrados
    onSuccess: () =>
      queryClient
        .invalidateQueries({ queryKey: [MATCHES_QUERY_KEY, user?.uid] })
        .catch(() => undefined),
  });
  return { report, block };
}

/** Clave de `moderation.report.errors` que explica un fallo de la denuncia. */
export function reportErrorKey(error: unknown) {
  const kind = error instanceof ModerationApiError ? error.kind : 'server';
  if (kind === 'rate-limited') return 'rateLimited';
  if (kind === 'network') return 'network';
  if (kind === 'not-found') return 'notFound';
  if (kind === 'invalid') return 'invalid';
  return 'unknown';
}

/** Clave de `moderation.block.errors` que explica un fallo del bloqueo. */
export function blockErrorKey(error: unknown) {
  const kind = error instanceof ModerationApiError ? error.kind : 'server';
  if (kind === 'network') return 'network';
  if (kind === 'not-found') return 'notFound';
  return 'unknown';
}
