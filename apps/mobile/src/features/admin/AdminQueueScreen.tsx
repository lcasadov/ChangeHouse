import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { Button, EmptyState, Notice, Screen, Text } from '../../ui';
import { LoadingView } from '../session/LoadingView';
import { adminRoutes } from './admin-routes';
import { ModerationCard } from './ModerationCard';
import { homesOf, useModerationQueue } from './use-moderation';

/** Entrada a «Denuncias», visible también cuando la cola de viviendas está vacía o no carga. */
function ReportsEntry() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      label={t('admin.reports.open')}
      onPress={() => {
        router.push(adminRoutes.reports);
      }}
    />
  );
}

/**
 * Pestaña «Administración»: la cola de viviendas en revisión, la más antigua primero. Se carga por
 * páginas («Cargar más») y se refresca tirando hacia abajo. Sin nada pendiente, lo dice. En todos los
 * casos ofrece la suspensión de usuarios.
 */
export function AdminQueueScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queue = useModerationQueue();
  const openUsers = () => {
    router.push(adminRoutes.users);
  };
  const usersEntry = (
    <Button variant="secondary" label={t('admin.users.entry')} onPress={openUsers} />
  );

  if (queue.isPending) return <LoadingView />;

  if (!queue.data) {
    return (
      <Screen>
        <View style={{ gap: theme.space[4], paddingVertical: theme.space[5] }}>
          <ReportsEntry />
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
          {usersEntry}
        </View>
      </Screen>
    );
  }

  const homes = homesOf(queue.data);
  if (homes.length === 0) {
    return (
      <Screen>
        <View style={{ paddingTop: theme.space[5] }}>
          <ReportsEntry />
        </View>
        <EmptyState
          icon="checkmark-done-outline"
          title={t('admin.queue.empty.title')}
          description={t('admin.queue.empty.description')}
          secondaryAction={{ label: t('admin.users.entry'), onPress: openUsers }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
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
            {usersEntry}
            <ReportsEntry />
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
    </Screen>
  );
}
