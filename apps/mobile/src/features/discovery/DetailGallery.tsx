import { contentMaxWidth, useTheme } from '@changehouse/ui';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions } from 'react-native';

import { useReduceMotion } from '../../ui/useReduceMotion';
import { photosOf } from '../homes/home-photos';
import { PhotoPlaceholder } from '../homes/HomeCover';
import type { PublicHome } from './discovery-api';

/** Cada foto ocupa casi todo el ancho: la siguiente asoma para invitar a deslizar. */
const PHOTO_WIDTH_RATIO = 0.88;
const PHOTO_ASPECT_RATIO = 4 / 3;

export interface DetailGalleryProps {
  home: PublicHome;
  title: string;
}

/** Todas las fotos de la vivienda, a sangre y deslizables, cada una con su texto alternativo. */
export function DetailGallery({ home, title }: Readonly<DetailGalleryProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const photos = photosOf(home);
  if (photos.length === 0) return <PhotoPlaceholder />;

  const photoWidth = Math.min(width, contentMaxWidth.reading) * PHOTO_WIDTH_RATIO;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={photoWidth + theme.space[2]}
      decelerationRate="fast"
      contentContainerStyle={{ gap: theme.space[2], paddingHorizontal: theme.space[4] }}
    >
      {photos.map((photo, index) => (
        <Image
          key={photo.id}
          source={{ uri: photo.url }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={reduceMotion ? 0 : theme.motion.fast}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('discovery.photos.alt', {
            position: index + 1,
            total: photos.length,
            title,
          })}
          style={{
            aspectRatio: PHOTO_ASPECT_RATIO,
            backgroundColor: theme.color.surfaceMuted,
            borderRadius: theme.radius.lg,
            width: photoWidth,
          }}
        />
      ))}
    </ScrollView>
  );
}
