import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Notice } from '../../ui';
import { CardStack } from './CardStack';
import type { DiscoveryCard } from './discovery-api';
import { discoveryRoutes } from './discovery-routes';
import { EndOfFeed } from './EndOfFeed';
import { shouldLoadMore } from './feed-model';
import { FeedPlaceholder } from './FeedPlaceholder';
import { prefetchImage } from './image-prefetch';

export interface CardDeckProps {
  /** Todas las tarjetas cargadas hasta ahora, sin repetir. */
  cards: readonly DiscoveryCard[];
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
 * La pila de tarjetas con su botón «Siguiente». Pide la página siguiente al quedar pocas tarjetas y
 * calienta la portada de las que vienen. Aún no hay me gusta ni descartar (`add-like-dismiss-undo`):
 * «Siguiente» pasa de tarjeta sin descartar nada.
 */
export function CardDeck({
  cards,
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
  const [index, setIndex] = useState(0);
  const remaining = cards.length - index;
  const current = cards[index];

  useEffect(() => {
    if (
      shouldLoadMore({ remaining, hasNextPage, busy: isFetchingNextPage, failed: nextPageFailed })
    ) {
      fetchNextPage().catch(() => undefined);
    }
  }, [remaining, hasNextPage, isFetchingNextPage, nextPageFailed, fetchNextPage]);

  useEffect(() => {
    for (let ahead = 1; ahead <= COVERS_AHEAD; ahead += 1) {
      prefetchImage(cards[index + ahead]?.photos[0]?.url);
    }
  }, [cards, index]);

  if (!current) {
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
  }

  return (
    <View style={[styles.deck, { gap: theme.space[3] }]}>
      <View style={styles.stack}>
        <CardStack
          current={current}
          next={cards[index + 1]}
          onOpen={(card) => {
            router.push(discoveryRoutes.detail(card.id));
          }}
        />
      </View>
      <Button
        label={t('discovery.next')}
        onPress={() => {
          setIndex((position) => position + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { flex: 1 },
  stack: { flex: 1 },
});
