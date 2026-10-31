import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Notice } from '../../ui';
import { MatchCelebrationHost } from '../matches/MatchCelebrationHost';
import { NotificationPermissionDialog } from '../notifications/NotificationPermissionDialog';
import { CardStack } from './CardStack';
import { DecisionActions } from './DecisionActions';
import { DecisionBar } from './DecisionBar';
import type { DiscoveryCard } from './discovery-api';
import { discoveryRoutes } from './discovery-routes';
import { EndOfFeed } from './EndOfFeed';
import { shouldLoadMore } from './feed-model';
import { FeedPlaceholder } from './FeedPlaceholder';
import { prefetchImage } from './image-prefetch';
import { PublishHomeSheet } from './PublishHomeSheet';
import { useCardDecisions } from './use-card-decisions';

export interface CardDeckProps {
  /** Todas las tarjetas cargadas hasta ahora y aún sin decidir, sin repetir; la primera es la que se ve. */
  cards: readonly DiscoveryCard[];
  /** La vivienda propia y publicada desde la que se decide; sin ella, el buscador decide desde su cuenta. */
  homeId: string | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** La última petición de página falló. */
  nextPageFailed: boolean;
  fetchNextPage: () => Promise<unknown>;
  onWidenZone: () => void;
  onAdjustCompensation: () => void;
}

/** Cuántas tarjetas por delante se calienta la foto de portada. */
const COVERS_AHEAD = 2;

/**
 * La pila de tarjetas con sus botones de decisión. Decidir cuesta un gesto: se desliza la tarjeta
 * o se pulsa «Me gusta» o «Descartar», y siempre queda a la vista «Deshacer» durante unos segundos.
 * Pide la página siguiente al quedar pocas tarjetas y calienta la portada de las que vienen.
 */
export function CardDeck({
  cards,
  homeId,
  hasNextPage,
  isFetchingNextPage,
  nextPageFailed,
  fetchNextPage,
  onWidenZone,
  onAdjustCompensation,
}: Readonly<CardDeckProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const decisions = useCardDecisions({ homeId });
  const remaining = cards.length;
  const current = cards[0];

  useEffect(() => {
    if (
      shouldLoadMore({ remaining, hasNextPage, busy: isFetchingNextPage, failed: nextPageFailed })
    ) {
      fetchNextPage().catch(() => undefined);
    }
  }, [remaining, hasNextPage, isFetchingNextPage, nextPageFailed, fetchNextPage]);

  useEffect(() => {
    for (let ahead = 1; ahead <= COVERS_AHEAD; ahead += 1) {
      prefetchImage(cards[ahead]?.photos[0]?.url);
    }
  }, [cards]);

  const stack = () => {
    if (current) {
      return (
        <CardStack
          current={current}
          next={cards[1]}
          canLike={homeId !== undefined}
          canDecide={!decisions.busy}
          exitDirection={decisions.exitDirection}
          onOpen={(card) => {
            router.push(discoveryRoutes.detail(card.id));
          }}
          onDecide={(card, decision) => {
            decisions.decide(decision, card);
          }}
          onBlockedLike={decisions.openNeedsHome}
        />
      );
    }
    if (!hasNextPage) {
      return <EndOfFeed onWidenZone={onWidenZone} onAdjustCompensation={onAdjustCompensation} />;
    }
    return nextPageFailed ? (
      <Notice
        tone="danger"
        action={{
          label: t('discovery.errors.retry'),
          onPress: () => {
            fetchNextPage().catch(() => undefined);
          },
        }}
      >
        {t('discovery.errors.more')}
      </Notice>
    ) : (
      <FeedPlaceholder />
    );
  };

  return (
    <View style={[styles.deck, { gap: theme.space[3] }]}>
      <View style={styles.stack}>{stack()}</View>
      {decisions.notice ? (
        <Notice tone={decisions.notice.tone}>{decisions.notice.message}</Notice>
      ) : null}
      {decisions.offer ? (
        <DecisionBar key={decisions.offer.id} decision={decisions.offer.decision} />
      ) : null}
      {current || decisions.canUndo ? (
        <DecisionActions
          canUndo={decisions.canUndo}
          canDecide={current !== undefined && !decisions.busy}
          onDismiss={() => {
            if (current) decisions.decide('dismiss', current);
          }}
          onUndo={() => {
            decisions.undo().catch(() => undefined);
          }}
          onLike={() => {
            if (current) decisions.decide('like', current);
          }}
        />
      ) : null}
      <PublishHomeSheet visible={decisions.needsHome} onClose={decisions.closeNeedsHome} />
      <NotificationPermissionDialog
        visible={decisions.notifications.explaining && !decisions.celebration}
        onAccept={() => {
          decisions.notifications.accept().catch(() => undefined);
        }}
        onDecline={decisions.notifications.decline}
      />
      <MatchCelebrationHost
        celebration={decisions.celebration}
        onClose={decisions.closeCelebration}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { flex: 1 },
  stack: { flex: 1 },
});
