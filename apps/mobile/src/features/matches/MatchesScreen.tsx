import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AMBIENT, EmptyState, Notice, Screen, Text } from '../../ui';
import { useMyHomes } from '../homes/use-homes';
import { LoadingView } from '../session/LoadingView';
import { matchRoutes } from './match-routes';
import type { Match, MatchPage } from './matches-api';
import { MatchRow } from './MatchRow';
import { useMatches } from './use-matches';

/** Los matches de todas las páginas cargadas, sin repetir y en el orden de la API (el más reciente primero). */
function uniqueMatches(pages: readonly MatchPage[] | undefined): Match[] {
  const byId = new Map<string, Match>();
  for (const page of pages ?? []) {
    for (const match of page.items) byId.set(match.id, match);
  }
  return [...byId.values()];
}

/**
 * Pestaña «Matches»: los matches de la persona, del más reciente al más antiguo, con tirar para
 * refrescar y más páginas al llegar al final. Sin matches anima a seguir explorando.
 */
export function MatchesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const matches = useMatches();
  const homes = useMyHomes();
  const [pulling, setPulling] = useState(false);
  const ownHomeIds = useMemo(
    () => new Set((homes.data ?? []).map((home) => home.id)),
    [homes.data],
  );
  const items = useMemo(() => uniqueMatches(matches.data?.pages), [matches.data]);

  const retry = () => {
    matches.refetch().catch(() => undefined);
    homes.refetch().catch(() => undefined);
  };

  const refresh = async () => {
    setPulling(true);
    try {
      await matches.refetch();
    } finally {
      setPulling(false);
    }
  };

  if (!matches.data || !homes.data) {
    if (matches.isError || homes.isError) {
      return (
        <Screen>
          <View style={{ paddingVertical: theme.space[5] }}>
            <Notice tone="danger" action={{ label: t('matches.retry'), onPress: retry }}>
              {t('matches.loadFailed')}
            </Notice>
          </View>
        </Screen>
      );
    }
    return <LoadingView />;
  }

  if (items.length === 0) {
    return (
      <Screen>
        <View testID="matches-empty" style={styles.fill}>
          <EmptyState
            icon="heart-outline"
            image={AMBIENT.emptyMatches}
            title={t('matches.empty.title')}
            description={t('matches.empty.description')}
            action={{
              label: t('matches.empty.action'),
              onPress: () => {
                router.push(matchRoutes.explore);
              },
            }}
          />
        </View>
      </Screen>
    );
  }

  const footer = () => {
    if (matches.isFetchNextPageError) {
      return (
        <Notice
          tone="danger"
          action={{
            label: t('matches.retry'),
            onPress: () => {
              matches.fetchNextPage().catch(() => undefined);
            },
          }}
        >
          {t('matches.loadMoreFailed')}
        </Notice>
      );
    }
    return matches.isFetchingNextPage ? <ActivityIndicator color={theme.color.primary} /> : null;
  };

  return (
    <Screen>
      <FlatList
        testID="matches-list"
        data={items}
        keyExtractor={(match) => match.id}
        contentContainerStyle={{ gap: theme.space[3], paddingVertical: theme.space[5] }}
        refreshing={pulling}
        onRefresh={() => {
          refresh().catch(() => undefined);
        }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (matches.hasNextPage && !matches.isFetchingNextPage && !matches.isFetchNextPageError) {
            matches.fetchNextPage().catch(() => undefined);
          }
        }}
        ListHeaderComponent={
          <Text
            variant="title"
            accessibilityRole="header"
            style={{ paddingBottom: theme.space[2] }}
          >
            {t('matches.title')}
          </Text>
        }
        renderItem={({ item }) => <MatchRow match={item} ownHomeIds={ownHomeIds} />}
        ListFooterComponent={footer() ?? undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
