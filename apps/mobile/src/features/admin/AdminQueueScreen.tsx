import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { Button, EmptyState, Notice, Text } from '../../ui';
import { LoadingView } from '../session/LoadingView';
import { adminRoutes } from './admin-routes';
import { AdminScreen } from './AdminScreen';
import { ModerationCard } from './ModerationCard';
import { homesOf, useModerationQueue } from './use-moderation';

/**
 * Pestaña «Administración»: la cola de viviendas en revisión, la más antigua primero. Se carga por
 * páginas («Cargar más») y se refresca tirando hacia abajo. Sin nada pendiente, lo dice.
 */
export function AdminQueueScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queue = useModerationQueue();

  if (queue.isPending) return <LoadingView />;

  if (!queue.data) {
    return (
      <AdminScreen>
        <View style={{ gap: theme.space[4], paddingVertical: theme.space[5] }}>
          <Notice
            tone="danger"
            action={{
              label: t('admin.queue.retry'),
              onPress: () => {
                queue.refetch().catch(() => undefined);
              },
            }}
          >
            {t('admin.queue.loadFailed')}
          </Notice>
        </View>
      </AdminScreen>
    );
  }

  const homes = homesOf(queue.data);
  if (homes.length === 0) {
    return (
      <AdminScreen>
        <View style={{ paddingTop: theme.space[5] }}></View>
        <EmptyState
          icon="checkmark-done-outline"
          title={t('admin.queue.empty.title')}
          description={t('admin.queue.empty.description')}
        />
      </AdminScreen>
    );
  }

  return (
    <AdminScreen>
      <FlatList
        testID="moderation-queue"
        data={homes}
        keyExtractor={(home) => home.id}
        contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
        refreshControl={
          <RefreshControl
            refreshing={queue.isRefetching && !queue.isFetchingNextPage}
            onRefresh={() => {
              queue.refetch().catch(() => undefined);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.space[1] }}>
            <Text variant="title" accessibilityRole="header">
              {t('admin.title')}
            </Text>
            <Text tone="textMuted">{t('admin.queue.intro')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ModerationCard
            home={item}
            onOpen={() => {
              router.push(adminRoutes.detail(item.id));
            }}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: theme.space[3] }}>
            {queue.isFetchNextPageError ? (
              <Notice tone="danger">{t('admin.queue.loadMoreFailed')}</Notice>
            ) : null}
            {queue.hasNextPage ? (
              <Button
                variant="secondary"
                label={t('admin.queue.loadMore')}
                loading={queue.isFetchingNextPage}
                onPress={() => {
                  queue.fetchNextPage().catch(() => undefined);
                }}
              />
            ) : null}
          </View>
        }
      />
    </AdminScreen>
  );
}
