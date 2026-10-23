import { useTheme } from '@changehouse/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Button, FormScreen, Notice, Text } from '../../ui';
import { HomePreferences } from '../search/HomePreferences';
import { LoadingView } from '../session/LoadingView';
import { AvailabilityAction } from './AvailabilityAction';
import { homeRoutes } from './home-routes';
import { rejectionOf, STATUS_PRESENTATION } from './home-status';
import { useHomeTitle } from './HomeCard';
import { HomeCover, HomeGallery } from './HomeCover';
import { type Home, HomesApiError } from './homes-api';
import { HomeSummary } from './HomeSummary';
import { SubmitAction } from './SubmitAction';
import { useHome } from './use-homes';

/**
 * Estados a la vista (o pausados): se pueden pausar o reactivar, editar sus datos desde el tipo y la
 * dirección (un cambio relevante la devuelve a revisión) y gestionar sus fotos.
 */
const LISTED = new Set<Home['status']>(['published', 'paused']);
/** Primer paso de datos del asistente: la edición de una vivienda publicada empieza aquí. */
const FIRST_DATA_STEP = 2;

function HomeDetail({ home }: Readonly<{ home: Home }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const title = useHomeTitle(home);
  const { tone, icon } = STATUS_PRESENTATION[home.status];
  const rejection = rejectionOf(home);

  return (
    <FormScreen>
      <Button
        variant="ghost"
        label={t('homes.detail.back')}
        onPress={() => {
          router.dismissTo(homeRoutes.list);
        }}
      />
      <HomeCover home={home} title={title} />
      <HomeGallery home={home} title={title} />
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Badge tone={tone} icon={icon} label={t(`homes.status.${home.status}`)} />
      <Text accessibilityLiveRegion="polite">{t(`homes.detail.statusNote.${home.status}`)}</Text>
      <Text tone="textMuted">{t('homes.detail.privateAddress')}</Text>
      <HomeSummary home={home} />
      {rejection ? (
        <View style={{ gap: theme.space[3] }}>
          <Notice tone="warning">{t('homes.rejection.notice', { reason: rejection })}</Notice>
          <Button
            label={t('homes.rejection.action')}
            onPress={() => {
              router.push(homeRoutes.edit(home.id));
            }}
          />
        </View>
      ) : null}
      {home.status === 'draft' && !rejection ? (
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
      {LISTED.has(home.status) ? (
        <View style={{ gap: theme.space[3] }}>
          <AvailabilityAction home={home} />
          <Button
            variant="secondary"
            label={t('homes.detail.edit')}
            onPress={() => {
              router.push(homeRoutes.edit(home.id, FIRST_DATA_STEP));
            }}
          />
          <Button
            variant="secondary"
            label={t('homes.detail.managePhotos')}
            onPress={() => {
              router.push(homeRoutes.edit(home.id, 1));
            }}
          />
        </View>
      ) : null}
      <HomePreferences homeId={home.id} />
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
