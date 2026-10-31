import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSharedValue } from 'react-native-reanimated';

import type { NoticeTone } from '../../ui';
import { announce } from '../../ui/announce';
import { haptics } from '../../ui/haptics';
import { useAuth } from '../auth/AuthProvider';
import type { Celebration } from '../matches/MatchCelebrationHost';
import { MATCHES_QUERY_KEY } from '../matches/use-matches';
import { useNotificationPermission } from '../notifications/use-notification-permission';
import { useServices } from '../session/services';
import { markDecided, unmarkDecided } from './decided-cards';
import { type Decision, UNDO_WINDOW_MS } from './decision-model';
import type { ExitDirection } from './decision-motion';
import { availableAgainAt, formatLocalTime } from './decision-time';
import { DecisionApiError, type DiscoveryCard } from './discovery-api';

/** Una decisión reciente que todavía se puede deshacer. */
interface Offer {
  id: number;
  decision: Decision;
  card: DiscoveryCard;
  /** Se resuelve a `true` si la API la registró y a `false` si falló (y ya se revirtió). */
  settled: Promise<boolean>;
}

/** Lo que hay que decirle a la persona tras un fallo o un rechazo. */
export interface DecisionNotice {
  message: string;
  tone: NoticeTone;
}

export interface CardDecisionsOptions {
  /** La vivienda propia y publicada desde la que se decide; sin ella, el buscador decide desde su cuenta. */
  homeId: string | undefined;
}

/**
 * Las decisiones sobre las tarjetas. «Me gusta» y «Descartar» son optimistas: la tarjeta sale de la
 * pila al instante, y si la API rechaza la decisión vuelve con un mensaje que dice qué hacer. La
 * última decisión se puede deshacer durante `UNDO_WINDOW_MS`. Lo decidido se recuerda aparte de las
 * páginas de tarjetas (`decided-cards.ts`) para que no vuelva aunque la consulta ya cargada se reutilice.
 */
export function useCardDecisions({ homeId }: Readonly<CardDecisionsOptions>) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { discoveryApi } = useServices();
  const { user } = useAuth();
  const exitDirection = useSharedValue<ExitDirection>(0);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [notice, setNotice] = useState<DecisionNotice | null>(null);
  const [needsHome, setNeedsHome] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const sequence = useRef(0);
  const notifications = useNotificationPermission();

  const uid = user?.uid;
  const offerId = offer?.id;

  useEffect(() => {
    if (offerId === undefined) return undefined;
    const timer = setTimeout(() => {
      setOffer((current) => (current?.id === offerId ? null : current));
    }, UNDO_WINDOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [offerId]);

  const takeOut = (card: DiscoveryCard) => {
    markDecided(queryClient, uid, homeId, card.id);
  };

  const putBack = (card: DiscoveryCard) => {
    exitDirection.value = 0;
    unmarkDecided(queryClient, uid, homeId, card.id);
  };

  const noticeFor = (error: unknown): DecisionNotice => {
    if (!(error instanceof DecisionApiError)) {
      return { message: t('discovery.decision.errors.server'), tone: 'danger' };
    }
    if (error.kind === 'daily-limit') {
      const { retryAfterSeconds } = error;
      return {
        tone: 'warning',
        message:
          retryAfterSeconds === undefined
            ? t('discovery.decision.errors.dailyLimitUnknown')
            : t('discovery.decision.errors.dailyLimit', {
                time: formatLocalTime(availableAgainAt(retryAfterSeconds), i18n.language),
              }),
      };
    }
    if (error.kind === 'network') {
      return { message: t('discovery.decision.errors.network'), tone: 'danger' };
    }
    if (error.kind === 'home-not-published') {
      return { message: t('discovery.decision.errors.homeNotPublished'), tone: 'danger' };
    }
    return { message: t('discovery.decision.errors.server'), tone: 'danger' };
  };

  const revert = (error: unknown, card: DiscoveryCard) => {
    const kind = error instanceof DecisionApiError ? error.kind : 'server';
    if (kind === 'not-found') {
      // La casa ya no está: no tiene sentido devolverla a la pila
      setNotice({ message: t('discovery.decision.errors.gone'), tone: 'warning' });
      return;
    }
    putBack(card);
    if (kind === 'forbidden') setNeedsHome(true);
    else setNotice(noticeFor(error));
  };

  /** Registra la decisión; para un «Me gusta», devuelve el match que ha formado, si lo hay. */
  const send = async (decision: Decision, card: DiscoveryCard): Promise<Celebration | null> => {
    if (decision === 'dismiss') {
      await discoveryApi.dismiss({
        ...(homeId ? { fromHomeId: homeId } : {}),
        targetHomeId: card.id,
      });
      return null;
    }
    if (!homeId) throw new DecisionApiError('forbidden');
    const result = await discoveryApi.like({ fromHomeId: homeId, targetHomeId: card.id });
    return result.match ? { match: result.match, ownHomeId: homeId, card } : null;
  };

  /**
   * Un «Me gusta» que forma un match lo celebra en lugar de confirmar el envío: lo anuncia, abre la
   * celebración y avisa a «Matches» de que su lista ya no está al día. Un match ya no se deshace, así
   * que tampoco queda nada que deshacer.
   */
  const celebrate = (found: Celebration, id: number) => {
    setOffer((current) => (current?.id === id ? null : current));
    setCelebration(found);
    announce(t('matches.celebration.title'));
    queryClient.invalidateQueries({ queryKey: [MATCHES_QUERY_KEY, uid] }).catch(() => undefined);
  };

  const register = async (decision: Decision, card: DiscoveryCard, id: number) => {
    let found: Celebration | null = null;
    try {
      found = await send(decision, card);
    } catch (error) {
      // Ya le había gustado: la API lo tiene, que es lo que la persona quería
      if (!(error instanceof DecisionApiError && error.kind === 'already-liked')) {
        setOffer((current) => (current?.id === id ? null : current));
        revert(error, card);
        return false;
      }
    }
    if (found) celebrate(found, id);
    else {
      announce(
        t(decision === 'like' ? 'discovery.decision.liked' : 'discovery.decision.dismissed'),
      );
    }
    void haptics.success();
    if (decision === 'like') void notifications.afterLike();
    return true;
  };

  const decide = (decision: Decision, card: DiscoveryCard) => {
    if (decision === 'like' && !homeId) {
      setNeedsHome(true);
      return;
    }
    sequence.current += 1;
    const id = sequence.current;
    setNotice(null);
    exitDirection.value = decision === 'like' ? 1 : -1;
    takeOut(card);
    setOffer({ id, decision, card, settled: register(decision, card, id) });
  };

  const undo = async () => {
    if (!offer || undoing) return;
    const target = offer;
    setUndoing(true);
    setOffer(null);
    setNotice(null);
    try {
      // Si la API aún no ha registrado la decisión se espera: deshacer antes no deshace nada
      if (!(await target.settled)) return;
      await discoveryApi.undo(homeId ? { homeId } : {});
      putBack(target.card);
      announce(t('discovery.decision.undone'));
    } catch (error) {
      const matched = error instanceof DecisionApiError && error.kind === 'like-in-match';
      setNotice({
        message: t(
          matched
            ? 'discovery.decision.errors.likeInMatch'
            : 'discovery.decision.errors.undoFailed',
        ),
        tone: matched ? 'warning' : 'danger',
      });
    } finally {
      setUndoing(false);
    }
  };

  return {
    /** La decisión que se puede deshacer, mientras dura la ventana. */
    offer: offer ? { id: offer.id, decision: offer.decision } : null,
    canUndo: offer !== null && !undoing,
    /** Mientras se deshace no se decide: la API deshace «la última», y no debe ser otra. */
    busy: undoing,
    notice,
    needsHome,
    openNeedsHome: () => {
      setNeedsHome(true);
    },
    closeNeedsHome: () => {
      setNeedsHome(false);
    },
    exitDirection,
    decide,
    undo,
    /** El match que acaba de formar un «Me gusta», mientras se celebra. */
    celebration,
    /** La explicación del permiso de avisos, que se ofrece tras el primer «Me gusta». */
    notifications,
    closeCelebration: () => {
      setCelebration(null);
    },
  };
}
