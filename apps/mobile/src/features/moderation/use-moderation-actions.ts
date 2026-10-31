import { useMutation } from '@tanstack/react-query';

import { useServices } from '../session/services';
import { ModerationApiError, type ReportTarget } from './moderation-api';

/** Denunciar y bloquear: dos acciones independientes, cada una con su estado de envío. */
export function useModerationActions() {
  const { moderationApi } = useServices();
  const report = useMutation<void, Error, { target: ReportTarget; reason: string }>({
    mutationFn: ({ target, reason }) => moderationApi.report(target, reason),
  });
  const block = useMutation<void, Error, string>({
    mutationFn: (userId) => moderationApi.block(userId),
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
