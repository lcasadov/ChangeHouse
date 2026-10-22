import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import { Button, EmptyState, Notice, Screen, Text } from '../../ui';
import { LoadingView } from '../session/LoadingView';
import { homeRoutes } from './home-routes';
import { primaryActionOf } from './home-status';
import { HomeCard } from './HomeCard';
import { useMyHomes } from './use-homes';

/**
 * Pestaña «Mis casas»: todas las viviendas de la persona con su estado y la acción que toca. Sin
 * viviendas, explica que sin una casa publicada no hay matches y ofrece publicar la primera.
 */
export function MyHomesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const homes = useMyHomes();

  if (homes.isPending) return <LoadingView />;

  if (!homes.data) {
    return (
      <Screen>
        <View style={{ gap: theme.space[4], paddingVertical: theme.space[5] }}>
          <Notice
            tone="danger"
            action={{
              label: t('homes.retry'),
              onPress: () => {
                homes.refetch().catch(() => undefined);
              },
            }}
          >
            {t('homes.loadFailed')}
          </Notice>
        </View>
      </Screen>
    );
  }

  if (homes.data.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="home-outline"
          title={t('homes.empty.title')}
          description={t('homes.empty.description')}
          action={{
            label: t('homes.empty.action'),
            onPress: () => {
              router.push(homeRoutes.create);
            },
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={homes.data}
        keyExtractor={(home) => home.id}
        contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
        ListHeaderComponent={
          <View style={{ gap: theme.space[3] }}>
            <Text variant="title" accessibilityRole="header">
              {t('homes.title')}
            </Text>
            <Button
              variant="secondary"
              label={t('homes.add')}
              onPress={() => {
                router.push(homeRoutes.create);
              }}
            />
          </View>
        }
        renderItem={({ item }) => (
          <HomeCard
            home={item}
            onOpen={() => {
              router.push(homeRoutes.detail(item.id));
            }}
            onPrimary={() => {
              const action = primaryActionOf(item);
              router.push(
                action.kind === 'view'
                  ? homeRoutes.detail(item.id)
                  : homeRoutes.edit(item.id, action.step),
              );
            }}
          />
        )}
      />
    </Screen>
  );
}
