import { contentMaxWidth, useTheme } from '@changehouse/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Notice } from '../../ui';
import { useAuth } from '../auth/AuthProvider';
import { useMyHomes } from '../homes/use-homes';
import { CardDeck } from './CardDeck';
import { useDecidedIds } from './decided-cards';
import { DiscoveryApiError } from './discovery-api';
import { feedMinHeight } from './feed-height';
import { uniqueCards, withoutDecided } from './feed-model';
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
  const { height } = useWindowDimensions();
  const homes = useMyHomes();
  const { user } = useAuth();
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
  // Lo decidido desde esta vivienda no vuelve a la pila aunque la consulta ya cargada se reutilice
  const decided = useDecidedIds(user?.uid, homeId);
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
          cards={withoutDecided(uniqueCards(feed.data.pages), decided)}
          homeId={homeId}
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
        { gap: theme.space[3], minHeight: feedMinHeight(height), maxWidth: contentMaxWidth.card },
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
