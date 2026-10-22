import { contentMaxWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, EmptyState, Screen, Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { FEATURE_FLAGS } from '../homes/home-form';
import { useHomeTitle } from '../homes/HomeCard';
import { VppNotice } from '../homes/VppNotice';
import { LoadingView } from '../session/LoadingView';
import { AreaCard } from './AreaCard';
import { factsOf } from './card-summary';
import { CompensationPill } from './CompensationPill';
import { DetailGallery } from './DetailGallery';
import { DiscoveryApiError, type DiscoveryCard, type PublicHome } from './discovery-api';
import { usePublicHome } from './use-discovery-feed';

/** Vuelve a «Explorar»; si se abrió por su dirección web y no hay historial, lleva al inicio. */
function useGoBack() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
}

function BackButton({ onPress }: Readonly<{ onPress: () => void }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('discovery.detail.back')}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.back,
        {
          backgroundColor: theme.color.photoScrimEnd,
          borderRadius: theme.radius.full,
          left: theme.space[4],
          minHeight: touchTarget,
          minWidth: touchTarget,
          top: insets.top + theme.space[2],
        },
        focusRing.style,
      ]}
    >
      <Ionicons
        accessible={false}
        name="arrow-back"
        size={theme.space[5]}
        color={theme.color.textOnPhoto}
      />
    </Pressable>
  );
}

/** Lo que la vivienda tiene además de las habitaciones: ascensor, garaje, terraza, calefacción… */
function extrasOf(t: TFunction, home: PublicHome): string[] {
  const features = home.features ?? {};
  return [
    ...(home.hasLift === true ? [t('homes.fields.hasLift')] : []),
    ...(home.garage === true ? [t('homes.fields.garage')] : []),
    ...(home.storageRoom === true ? [t('homes.fields.storageRoom')] : []),
    ...FEATURE_FLAGS.filter((flag) => features[flag] === true).map((flag) =>
      t(`homes.features.${flag}`),
    ),
    ...(features.heating ? [t(`homes.heating.${features.heating}`)] : []),
    ...(features.condition ? [t(`homes.condition.${features.condition}`)] : []),
  ];
}

/** Otras líneas de datos: superficies, planta, certificado y año, sólo los que constan. */
function detailLinesOf(t: TFunction, home: PublicHome): string[] {
  return [
    ...(home.usefulM2 !== null && home.builtM2 !== null
      ? [t('discovery.detail.surfaces', { useful: home.usefulM2, built: home.builtM2 })]
      : []),
    ...(home.floor ? [t('discovery.detail.floor', { floor: home.floor })] : []),
    ...(home.energyRating
      ? [t('discovery.detail.energyRating', { rating: home.energyRating })]
      : []),
    ...(home.yearBuilt ? [t('discovery.detail.yearBuilt', { year: home.yearBuilt })] : []),
  ];
}

interface DetailProps {
  home: PublicHome;
  compensation: DiscoveryCard['compensation'];
}

function Detail({ home, compensation }: Readonly<DetailProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const title = useHomeTitle(home);
  const extras = extrasOf(t, home);
  const lines = detailLinesOf(t, home);

  return (
    <View style={[styles.root, { backgroundColor: theme.color.bg }]}>
      <ScrollView
        contentContainerStyle={{
          gap: theme.space[4],
          paddingBottom: insets.bottom + theme.space[6],
          paddingTop: insets.top + theme.space[7],
        }}
      >
        <DetailGallery home={home} title={title} />
        <View
          style={[
            styles.content,
            { gap: theme.space[4], maxWidth: contentMaxWidth.reading, padding: theme.space[4] },
          ]}
        >
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {compensation ? (
            <View style={[styles.row, { gap: theme.space[2] }]}>
              <CompensationPill compensation={compensation} />
              <Text variant="caption" tone="textMuted">
                {t('discovery.compensation.disclaimer')}
              </Text>
            </View>
          ) : null}
          <View style={[styles.row, { columnGap: theme.space[4], rowGap: theme.space[1] }]}>
            {factsOf(t, home).map((fact) => (
              <Text key={fact.key} variant="bodyStrong">
                {fact.text}
              </Text>
            ))}
          </View>
          <VppNotice regime={home.regime} maxLegalPriceCents={home.vppMaxLegalPriceCents} />
          {lines.length > 0 || extras.length > 0 ? (
            <View style={{ gap: theme.space[3] }}>
              <Text variant="heading" accessibilityRole="header">
                {t('discovery.detail.sections.features')}
              </Text>
              {lines.map((line) => (
                <Text key={line}>{line}</Text>
              ))}
              <View style={[styles.row, { gap: theme.space[2] }]}>
                {extras.map((extra) => (
                  <Badge key={extra} tone="neutral" icon="checkmark" label={extra} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={{ gap: theme.space[3] }}>
            <Text variant="heading" accessibilityRole="header">
              {t('discovery.detail.location.title')}
            </Text>
            <AreaCard areaName={home.location.areaName} />
          </View>
        </View>
      </ScrollView>
      <BackButton onPress={goBack} />
    </View>
  );
}

/**
 * El detalle de una vivienda ajena: todas las fotos, las características y su ubicación pública
 * (la zona, nunca la dirección). Se abre con la tarjeta ya cargada o, desde su dirección web, la
 * pide a la API.
 */
export function DiscoveryDetailScreen({ homeId }: Readonly<{ homeId: string }>) {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const { cached, query } = usePublicHome(homeId);
  const home = cached ?? query.data;

  if (home) return <Detail home={home} compensation={cached?.compensation ?? null} />;
  if (!query.isError) return <LoadingView />;

  const gone = query.error instanceof DiscoveryApiError && query.error.kind === 'not-found';
  return (
    <Screen>
      <EmptyState
        icon={gone ? 'home-outline' : 'cloud-offline-outline'}
        title={t(gone ? 'discovery.detail.goneTitle' : 'discovery.detail.loadFailedTitle')}
        description={t(gone ? 'discovery.detail.gone' : 'discovery.detail.loadFailed')}
        action={
          gone
            ? { label: t('discovery.detail.back'), onPress: goBack }
            : {
                label: t('discovery.detail.retry'),
                onPress: () => {
                  query.refetch().catch(() => undefined);
                },
              }
        }
        {...(gone
          ? {}
          : { secondaryAction: { label: t('discovery.detail.back'), onPress: goBack } })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  content: { alignSelf: 'center', width: '100%' },
  root: { flex: 1 },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
});
