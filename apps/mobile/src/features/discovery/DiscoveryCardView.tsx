import { borderWidth, motion, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { useReduceMotion } from '../../ui/useReduceMotion';
import { photosOf } from '../homes/home-photos';
import { useHomeTitle } from '../homes/HomeCard';
import { cardSummary, factsOf } from './card-summary';
import { CompensationPill } from './CompensationPill';
import type { Decision } from './decision-model';
import type { DiscoveryCard } from './discovery-api';
import { prefetchImage } from './image-prefetch';
import { PhotoIndicator } from './PhotoIndicator';

type IconName = ComponentProps<typeof Ionicons>['name'];

const FACT_ICONS: Record<'m2' | 'bedrooms' | 'bathrooms', IconName> = {
  m2: 'resize-outline',
  bedrooms: 'bed-outline',
  bathrooms: 'water-outline',
};

/** Alto del degradado inferior sobre el que se lee el texto, en proporción al de la tarjeta. */
const SCRIM_HEIGHT = '60%';

export interface DiscoveryCardViewProps {
  card: DiscoveryCard;
  /** Abre el detalle de la vivienda. */
  onOpen: () => void;
  /** Si se da, el lector de pantalla ofrece "Me gusta" y "Descartar" como acciones de la tarjeta. */
  onDecide?: (decision: Decision) => void;
}

interface ZoneButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
}

/** Una mitad de la foto que la recorre al tocarla: objetivo táctil amplio, con nombre y foco visibles. */
function ZoneButton({ label, disabled, onPress }: Readonly<ZoneButtonProps>) {
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[styles.zone, { minHeight: touchTarget, minWidth: touchTarget }, focusRing.style]}
    />
  );
}

/** Sin fotos: el marcador reserva el espacio de la foto. */
function NoPhoto() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.noPhoto,
        { backgroundColor: theme.color.surfaceMuted, gap: theme.space[2] },
      ]}
    >
      <Ionicons
        accessible={false}
        name="home-outline"
        size={theme.space[7]}
        color={theme.color.primary}
      />
      <Text tone="textMuted">{t('homes.card.noPhotos')}</Text>
    </View>
  );
}

/**
 * La tarjeta de descubrimiento (`docs/style-guide.md` §0): la foto a sangre, el carrusel con los
 * toques laterales, y sobre el degradado inferior la zona, los datos y la compensación. Para
 * un lector de pantalla es un único botón con el resumen; los botones de las fotos van aparte.
 */
export function DiscoveryCardView({ card, onOpen, onDecide }: Readonly<DiscoveryCardViewProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const focusPanel = useFocusRing();
  const title = useHomeTitle(card);
  const photos = useMemo(() => photosOf(card), [card]);
  const [position, setPosition] = useState(0);
  const current = photos[position];
  const secondPhotoUrl = photos[1]?.url;

  useEffect(() => {
    prefetchImage(secondPhotoUrl);
  }, [secondPhotoUrl]);

  const go = (target: number) => {
    setPosition(target);
    prefetchImage(photos[target + 1]?.url);
  };

  return (
    <View
      testID="discovery-card"
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surfaceMuted,
          borderColor: theme.color.border,
          borderRadius: theme.radius.lg,
          borderWidth: borderWidth.thin,
        },
      ]}
    >
      {current ? (
        <Image
          testID="discovery-photo"
          source={{ uri: current.url }}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          recyclingKey={current.id}
          transition={reduceMotion ? 0 : motion.fast}
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <NoPhoto />
      )}
      <LinearGradient
        testID="photo-scrim"
        colors={[theme.color.photoScrimStart, theme.color.photoScrimEnd]}
        pointerEvents="none"
        style={[styles.scrim, { height: SCRIM_HEIGHT }]}
      />
      {photos.length > 1 ? (
        <PhotoIndicator photoIds={photos.map((photo) => photo.id)} position={position} />
      ) : null}

      <View style={styles.column}>
        <View style={styles.zones}>
          {photos.length > 1 ? (
            <>
              <ZoneButton
                label={t('discovery.photos.previous')}
                disabled={position === 0}
                onPress={() => {
                  go(position - 1);
                }}
              />
              <ZoneButton
                label={t('discovery.photos.next')}
                disabled={position === photos.length - 1}
                onPress={() => {
                  go(position + 1);
                }}
              />
            </>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cardSummary(t, card, position + 1)}
          accessibilityHint={t('discovery.card.openHint')}
          accessibilityActions={
            onDecide
              ? [
                  { name: 'like', label: t('discovery.actions.like') },
                  { name: 'dismiss', label: t('discovery.actions.dismiss') },
                ]
              : undefined
          }
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === 'like' || action === 'dismiss') onDecide?.(action);
          }}
          onPress={onOpen}
          onFocus={focusPanel.onFocus}
          onBlur={focusPanel.onBlur}
          style={[{ gap: theme.space[2], padding: theme.space[4] }, focusPanel.style]}
        >
          {card.compensation ? (
            <View style={[styles.pillRow, { gap: theme.space[2] }]}>
              <CompensationPill compensation={card.compensation} />
              <Text variant="caption" tone="textOnPhoto" accessible={false}>
                {t('discovery.compensation.disclaimer')}
              </Text>
            </View>
          ) : null}
          <Text variant="title" tone="textOnPhoto" accessible={false}>
            {title}
          </Text>
          <View style={[styles.facts, { columnGap: theme.space[4], rowGap: theme.space[1] }]}>
            {factsOf(t, card).map((fact) => (
              <View key={fact.key} style={[styles.fact, { gap: theme.space[1] }]}>
                <Ionicons
                  accessible={false}
                  name={FACT_ICONS[fact.key]}
                  size={theme.font.label.lineHeight}
                  color={theme.color.textOnPhoto}
                />
                <Text variant="bodyStrong" tone="textOnPhoto" accessible={false}>
                  {fact.text}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, overflow: 'hidden' },
  column: { flex: 1 },
  fact: { alignItems: 'center', flexDirection: 'row' },
  facts: { flexDirection: 'row', flexWrap: 'wrap' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  pillRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  scrim: { bottom: 0, left: 0, position: 'absolute', right: 0 },
  zone: { flex: 1 },
  zones: { flex: 1, flexDirection: 'row' },
});
