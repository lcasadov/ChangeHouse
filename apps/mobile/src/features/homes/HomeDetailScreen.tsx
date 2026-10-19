import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Button, FormScreen, Notice, Text } from '../../ui';
import { LoadingView } from '../session/LoadingView';
import { homeRoutes } from './home-routes';
import { STATUS_PRESENTATION } from './home-status';
import { PhotoPlaceholder, useHomeTitle } from './HomeCard';
import { type Home, HomesApiError } from './homes-api';
import { HomeSummary } from './HomeSummary';
import { SubmitAction } from './SubmitAction';
import { useHome } from './use-homes';

function HomeDetail({ home }: Readonly<{ home: Home }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const title = useHomeTitle(home);
  const { tone, icon } = STATUS_PRESENTATION[home.status];

  return (
    <FormScreen>
      <Button
        variant="ghost"
        label={t('homes.detail.back')}
        onPress={() => {
          router.dismissTo(homeRoutes.list);
        }}
      />
      <PhotoPlaceholder />
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Badge tone={tone} icon={icon} label={t(`homes.status.${home.status}`)} />
      <Text accessibilityLiveRegion="polite">{t(`homes.detail.statusNote.${home.status}`)}</Text>
      <Text tone="textMuted">{t('homes.detail.privateAddress')}</Text>
      <HomeSummary home={home} />
      {home.status === 'draft' ? (
        <View style={{ gap: theme.space[3] }}>
          <SubmitAction
            home={home}
            onComplete={(step) => {
              router.push(homeRoutes.edit(home.id, step));
            }}
          />
          <Button
            variant="secondary"
            label={t('homes.detail.edit')}
            onPress={() => {
              router.push(homeRoutes.edit(home.id));
            }}
          />
        </View>
      ) : null}
    </FormScreen>
  );
}

/** Detalle de una vivienda para su propietario: todos los datos (incluida la dirección), el estado y el envío a revisión. */
export function HomeDetailScreen({ homeId }: Readonly<{ homeId: string }>) {
  const { t } = useTranslation();
  const router = useRouter();
  const query = useHome(homeId);

  if (query.isPending) return <LoadingView />;
  if (query.data) return <HomeDetail home={query.data} />;

  const notFound = query.error instanceof HomesApiError && query.error.kind === 'not-found';
  return (
    <FormScreen>
      <Notice
        tone="danger"
        action={
          notFound
            ? {
                label: t('homes.detail.back'),
                onPress: () => {
                  router.dismissTo(homeRoutes.list);
                },
              }
            : {
                label: t('homes.retry'),
                onPress: () => {
                  query.refetch().catch(() => undefined);
                },
              }
        }
      >
        {t(notFound ? 'homes.detail.notFound' : 'homes.detail.loadFailed')}
      </Notice>
    </FormScreen>
  );
}
