import { useTheme } from '@changehouse/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';

import { Button, Text } from '../../ui';
import { photosOf } from '../homes/home-photos';
import type { Home } from '../homes/homes-api';

export interface PhotoCarouselProps {
  home: Home;
  /** Título de la vivienda, para el texto alternativo de cada foto. */
  title: string;
}

/**
 * Carrusel de las fotos de una vivienda: se desliza con el dedo y se maneja con «Foto anterior» y
 * «Foto siguiente» (teclado y lectores de pantalla). La foto actual se anuncia.
 */
export function PhotoCarousel({ home, title }: Readonly<PhotoCarouselProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const photos = photosOf(home);
  const scroller = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) return <Text tone="textMuted">{t('admin.detail.photos.none')}</Text>;

  const goTo = (target: number) => {
    setIndex(target);
    scroller.current?.scrollTo({ x: target * width, animated: true });
  };

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ gap: theme.space[2] }}>
      <ScrollView
        testID="photo-carousel"
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onMomentumScrollEnd={onScrollEnd}
      >
        {photos.map((photo, position) => (
          <Image
            key={photo.id}
            source={{ uri: photo.url }}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('admin.detail.photos.position', {
              position: position + 1,
              total: photos.length,
              title,
            })}
            style={[
              styles.photo,
              {
                backgroundColor: theme.color.surfaceMuted,
                borderRadius: theme.radius.md,
                width: width || '100%',
              },
            ]}
          />
        ))}
      </ScrollView>
      <View style={[styles.controls, { gap: theme.space[2] }]}>
        <Button
          variant="ghost"
          label={t('admin.detail.photos.previous')}
          disabled={index === 0}
          onPress={() => {
            goTo(index - 1);
          }}
        />
        <Text tone="textMuted" accessibilityLiveRegion="polite">
          {t('admin.detail.photos.counter', { position: index + 1, total: photos.length })}
        </Text>
        <Button
          variant="ghost"
          label={t('admin.detail.photos.next')}
          disabled={index === photos.length - 1}
          onPress={() => {
            goTo(index + 1);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  photo: { aspectRatio: 4 / 3 },
});
