import { touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '../../ui';
import { photosOf } from './home-photos';
import type { Home } from './homes-api';

/** Marcador que reserva el espacio de la foto mientras la vivienda no tiene ninguna. */
export function PhotoPlaceholder() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.photo,
        {
          backgroundColor: theme.color.surfaceMuted,
          borderRadius: theme.radius.md,
          gap: theme.space[2],
        },
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

export interface HomeCoverProps {
  home: Home;
  /** Título de la vivienda, para el texto alternativo. */
  title: string;
  /** La portada ya la nombra el control que la contiene (la tarjeta): no se anuncia dos veces. */
  decorative?: boolean;
}

/** La portada de una vivienda (su primera foto) o, sin fotos, el marcador. */
export function HomeCover({ home, title, decorative = false }: Readonly<HomeCoverProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const cover = photosOf(home)[0];
  if (!cover) return <PhotoPlaceholder />;

  return (
    <Image
      testID="home-cover"
      source={{ uri: cover.url }}
      resizeMode="cover"
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : t('homes.photos.coverAlt', { title })}
      style={[
        styles.photo,
        { backgroundColor: theme.color.surfaceMuted, borderRadius: theme.radius.md },
      ]}
    />
  );
}

/** Las demás fotos de la vivienda, en una tira horizontal con texto alternativo. */
export function HomeGallery({ home, title }: Readonly<{ home: Home; title: string }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const photos = photosOf(home);
  const others = photos.slice(1);
  if (others.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
        {others.map((photo, index) => (
          <Image
            key={photo.id}
            source={{ uri: photo.url }}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('homes.photos.galleryAlt', {
              position: index + 2,
              total: photos.length,
              title,
            })}
            style={{
              aspectRatio: 4 / 3,
              backgroundColor: theme.color.surfaceMuted,
              borderRadius: theme.radius.md,
              width: touchTarget * 4,
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', aspectRatio: 16 / 9, justifyContent: 'center', width: '100%' },
});
