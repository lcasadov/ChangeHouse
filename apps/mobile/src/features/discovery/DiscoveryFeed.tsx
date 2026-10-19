import { contentMaxWidth, useTheme } from '@changehouse/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Notice } from '../../ui';
import { useMyHomes } from '../homes/use-homes';
import { CardDeck } from './CardDeck';
import { DiscoveryApiError } from './discovery-api';
import { uniqueCards } from './feed-model';
import { FeedPlaceholder } from './FeedPlaceholder';
import { HomeSelector } from './HomeSelector';
import { SeekerNotice } from './SeekerNotice';
import { useDiscoveryFeed } from './use-discovery-feed';

export interface DiscoveryFeedProps {
  /** Cambia cuando cambian las preferencias guardadas: otra búsqueda desde la primera tarjeta. */
  searchKey: string;
  /** Abre los filtros para ampliar la zona. */
  onWidenZone: () => void;
  /** Abre los filtros para ajustar la compensación. */
  onAdjustCompensation: () => void;
  /** La API dice que faltan las preferencias de búsqueda: hay que pedir zona y compensación. */
  onPreferencesRequired: () => void;
}

/**
 * El descubrimiento de «Explorar»: elige la vivienda desde la que se busca, pide las tarjetas y
 * traduce cada fallo a lo que la persona puede hacer. Sin vivienda publicada se mira en modo
 * buscador, con el aviso fijo para publicar la suya.
 */
export function DiscoveryFeed({
  searchKey,
  onWidenZone,
  onAdjustCompensation,
  onPreferencesRequired,
}: Readonly<DiscoveryFeedProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const homes = useMyHomes();
  const published = useMemo(
    () => (homes.data ?? []).filter((home) => home.status === 'published'),
    [homes.data],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  // Cada reintento es una consulta nueva: no depende de qué hizo fallar a la anterior
  const [attempt, setAttempt] = useState(0);
  const homeId = published.find((home) => home.id === chosen)?.id ?? published[0]?.id;
  const feed = useDiscoveryFeed({
    homeId,
    searchKey: `${searchKey}#${String(attempt)}`,
    enabled: homes.isSuccess,
  });
  const failure = feed.data || !(feed.error instanceof DiscoveryApiError) ? null : feed.error.kind;
  const retry = useCallback(() => {
    setAttempt((count) => count + 1);
  }, []);

  useEffect(() => {
    if (failure === 'preferences-required') onPreferencesRequired();
  }, [failure, onPreferencesRequired]);

  const body = () => {
    if (homes.isError) {
      return (
        <Notice
          tone="danger"
          action={{
            label: t('discovery.errors.retry'),
            onPress: () => {
              homes.refetch().catch(() => undefined);
            },
          }}
        >
          {t('discovery.errors.load')}
        </Notice>
      );
    }
    if (feed.data) {
      return (
        <CardDeck
          key={`${homeId ?? 'seeker'}|${searchKey}|${String(attempt)}`}
          cards={uniqueCards(feed.data.pages)}
          hasNextPage={feed.hasNextPage}
          isFetchingNextPage={feed.isFetchingNextPage}
          nextPageFailed={feed.isFetchNextPageError}
          fetchNextPage={feed.fetchNextPage}
          onWidenZone={onWidenZone}
          onAdjustCompensation={onAdjustCompensation}
        />
      );
    }
    if (failure === 'home-required') {
      return <Notice tone="info">{t('discovery.homeSelector.required')}</Notice>;
    }
    if (failure === 'not-found') {
      return (
        <Notice
          tone="warning"
          action={{
            label: t('discovery.errors.retry'),
            onPress: () => {
              setChosen(null);
              homes.refetch().catch(() => undefined);
              retry();
            },
          }}
        >
          {t('discovery.errors.homeGone')}
        </Notice>
      );
    }
    if (failure !== null && failure !== 'preferences-required') {
      return (
        <Notice tone="danger" action={{ label: t('discovery.errors.retry'), onPress: retry }}>
          {t('discovery.errors.load')}
        </Notice>
      );
    }
    return <FeedPlaceholder />;
  };

  return (
    <View
      style={[
        styles.root,
        { gap: theme.space[3], minHeight: theme.space[8] * 6, maxWidth: contentMaxWidth.card },
      ]}
    >
      {homes.isSuccess && published.length === 0 ? <SeekerNotice /> : null}
      {published.length > 1 ? (
        <HomeSelector
          homes={published}
          value={homeId}
          onChange={(id) => {
            setChosen(id);
            // Elegir la que ya estaba elegida tras un fallo repite la búsqueda
            if (id === homeId) retry();
          }}
        />
      ) : null}
      <View style={styles.body}>{body()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  root: { alignSelf: 'center', flex: 1, width: '100%' },
});
