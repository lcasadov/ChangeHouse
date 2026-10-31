import { borderWidth, motion, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, type useAnimatedStyle } from 'react-native-reanimated';

export interface CelebrationHome {
  /** «Piso en Lavapiés»: el tipo y la zona, nunca la dirección. */
  title: string;
  /** La portada; sin ella se pinta un marcador. */
  coverUrl: string | undefined;
}

type AnimatedStyle = ReturnType<typeof useAnimatedStyle>;

export interface TileProps {
  side: 'mine' | 'theirs' | 'third';
  home: CelebrationHome;
  animatedStyle: AnimatedStyle;
  reduceMotion: boolean;
  /** Ancho de la casa dentro del escenario; por defecto, el del cruce de dos. */
  width?: DimensionValue;
  /** Colocada con posición absoluta en la esquina del escenario (el giro de tres). */
  floating?: boolean;
}

/** Una casa del intercambio: su portada (decorativa, el título del match ya nombra las casas) o un marcador. */
export function Tile({
  side,
  home,
  animatedStyle,
  reduceMotion,
  width = TILE_WIDTH,
  floating = false,
}: Readonly<TileProps>) {
  const theme = useTheme();
  const elevation = theme.elevation[3];

  return (
    <Animated.View
      testID={`swap-tile-${side}`}
      entering={reduceMotion ? FadeIn.duration(motion.fast) : undefined}
      style={[
        styles.tile,
        floating ? styles.floating : null,
        {
          backgroundColor: theme.color.surfaceMuted,
          borderColor: theme.color.surface,
          borderRadius: theme.radius.lg,
          borderWidth: borderWidth.thick,
          elevation: elevation.androidElevation,
          shadowColor: elevation.shadowColor,
          shadowOffset: elevation.shadowOffset,
          shadowOpacity: elevation.shadowOpacity,
          shadowRadius: elevation.shadowRadius,
        },
        { width },
        animatedStyle,
      ]}
    >
      {home.coverUrl ? (
        <Image
          testID={`match-cover-${side}`}
          source={{ uri: home.coverUrl }}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          testID={`match-cover-${side}-placeholder`}
          accessible={false}
          style={[StyleSheet.absoluteFill, styles.placeholder]}
        >
          <Ionicons
            accessible={false}
            name="home-outline"
            size={theme.space[7]}
            color={theme.color.primary}
          />
        </View>
      )}
    </Animated.View>
  );
}

const TILE_WIDTH = '42%';
/** La proporción de la foto de cada casa (ancho / alto), la de las tarjetas de descubrimiento. */
export const TILE_ASPECT = 4 / 5;

const styles = StyleSheet.create({
  floating: { left: 0, position: 'absolute', top: 0 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  tile: { aspectRatio: TILE_ASPECT, overflow: 'hidden' },
});
