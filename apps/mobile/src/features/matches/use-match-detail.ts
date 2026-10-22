import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { announce } from '../../ui/announce';
import { haptics } from '../../ui/haptics';
import { useAuth } from '../auth/AuthProvider';
import { useServices } from '../session/services';
import { type Match, type MatchDetail, MatchesApiError } from './matches-api';
import { MATCHES_QUERY_KEY } from './use-matches';

const detailKey = (uid: string | undefined, matchId: string) =>
  [MATCHES_QUERY_KEY, uid, 'detail', matchId] as const;

/** El detalle de un match: viviendas con todas sus fotos, direcciones exactas y teléfonos autorizados. */
export function useMatchDetail(matchId: string) {
  const { matchesApi } = useServices();
  const { status, user } = useAuth();
  return useQuery({
    queryKey: detailKey(user?.uid, matchId),
    queryFn: () => matchesApi.get(matchId),
    enabled: status === 'signedIn',
    retry: false,
  });
}

/** Qué le pasó a la última acción; cada valor tiene su texto en `matches.detail.errors`. */
export type ActionFailure = 'network' | 'server' | 'conflict' | 'phone';

/** Un match cerrado o que ya no existe se resuelve volviendo a mirarlo; el resto, reintentando. */
function failureOf(error: unknown, fallback: 'server' | 'phone'): ActionFailure {
  if (!(error instanceof MatchesApiError)) return fallback;
  if (error.kind === 'not-open' || error.kind === 'not-found') return 'conflict';
  return error.kind === 'network' ? 'network' : fallback;
}

/** El estado que devuelve la acción, aplicado al detalle que ya se ve: así no parpadea mientras se vuelve a pedir. */
function withStatusesOf(detail: MatchDetail, updated: Match): MatchDetail {
  return {
    ...detail,
    status: updated.status,
    participants: detail.participants.map((participant) => {
      const status = updated.participants.find((p) => p.homeId === participant.homeId)?.status;
      return status ? { ...participant, status } : participant;
    }),
  };
}

/**
 * Las decisiones de quien mira el detalle: confirmar interés, retirarse y compartir el teléfono.
 * Cada una avisa de su resultado a los lectores de pantalla y deja la lista y el detalle al día.
 */
export function useMatchActions(matchId: string, ownHomeId: string | undefined) {
  const { t } = useTranslation();
  const { matchesApi } = useServices();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const key = detailKey(user?.uid, matchId);

  const refresh = () => queryClient.invalidateQueries({ queryKey: [MATCHES_QUERY_KEY, user?.uid] });

  const onDecided = (updated: Match, announcement: string) => {
    setFailure(null);
    queryClient.setQueryData<MatchDetail>(key, (detail) =>
      detail ? withStatusesOf(detail, updated) : detail,
    );
    announce(announcement);
  };

  const onFailed = (error: unknown) => {
    const kind = failureOf(error, 'server');
    setFailure(kind);
    // El match cambió por otro lado: se enseña como está ahora
    if (kind === 'conflict') refresh().catch(() => undefined);
  };

  const confirm = useMutation({
    mutationFn: () => matchesApi.confirm(matchId),
    onSuccess: (updated) => {
      onDecided(
        updated,
        t(
          updated.status === 'confirmed'
            ? 'matches.detail.announce.allConfirmed'
            : 'matches.detail.announce.confirmed',
        ),
      );
      haptics.success().catch(() => undefined);
    },
    onError: onFailed,
    onSettled: () => {
      refresh().catch(() => undefined);
    },
  });

  const withdraw = useMutation({
    mutationFn: () => matchesApi.withdraw(matchId),
    onSuccess: (updated) => {
      onDecided(updated, t('matches.detail.announce.withdrawn'));
    },
    onError: onFailed,
    onSettled: () => {
      refresh().catch(() => undefined);
    },
  });

  const sharePhone = useMutation({
    mutationFn: (share: boolean) => matchesApi.setPhoneSharing(matchId, share),
    // Optimista: el interruptor responde al instante y vuelve a su valor si no se guarda
    onMutate: async (share) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MatchDetail>(key);
      queryClient.setQueryData<MatchDetail>(key, (detail) =>
        detail
          ? {
              ...detail,
              participants: detail.participants.map((participant) =>
                participant.homeId === ownHomeId
                  ? { ...participant, sharesPhone: share }
                  : participant,
              ),
            }
          : detail,
      );
      return { previous };
    },
    onSuccess: (_result, share) => {
      setFailure(null);
      announce(t(share ? 'matches.detail.announce.shared' : 'matches.detail.announce.unshared'));
    },
    onError: (error, _share, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      const kind = failureOf(error, 'phone');
      setFailure(kind);
      if (kind === 'conflict') refresh().catch(() => undefined);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
    },
  });

  return {
    failure,
    confirm: () => {
      setFailure(null);
      confirm.mutate();
    },
    withdraw: () => {
      setFailure(null);
      withdraw.mutate();
    },
    sharePhone: (share: boolean) => {
      setFailure(null);
      sharePhone.mutate(share);
    },
    confirming: confirm.isPending,
    withdrawing: withdraw.isPending,
    savingPhone: sharePhone.isPending,
  };
}
