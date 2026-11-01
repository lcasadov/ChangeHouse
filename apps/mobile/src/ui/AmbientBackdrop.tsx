import { motion, useTheme } from '@changehouse/ui';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import type { AmbientSource } from './ambient';
import { useReduceMotion } from './useReduceMotion';

/** Cada foto se queda 7 s antes de fundirse con la siguiente. */
const INTERVAL_MS = 7000;
/** El fundido dura lo que tres transiciones lentas: perceptible pero sin prisa. */
const FADE_MS = motion.slow * 3;
/** Zoom lento mientras la foto está a la vista. */
const ZOOM = 1.08;

interface LayerProps {
  source: AmbientSource;
  index: number;
  active: boolean;
}

function Layer({ source, index, active }: Readonly<LayerProps>) {
  const style = useAnimatedStyle(
    () => ({
      opacity: withTiming(active ? 1 : 0, { duration: FADE_MS }),
      transform: [{ scale: withTiming(active ? ZOOM : 1, { duration: INTERVAL_MS + FADE_MS }) }],
    }),
    [active],
  );
  return (
    <Animated.View
      testID={`ambient-photo-${String(index)}`}
      style={[StyleSheet.absoluteFill, style]}
    >
      <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export interface AmbientBackdropProps {
  /** Fotos que se suceden; con «reducir movimiento» solo se muestra la primera, fija. */
  sources: readonly AmbientSource[];
}

/**
 * Fondo fotográfico decorativo: las fotos se suceden con un fundido lento bajo el velo
 * `photoVeil` y el degradado `photoScrim*`, que garantizan el contraste del texto blanco encima.
 */
export function AmbientBackdrop({ sources }: Readonly<AmbientBackdropProps>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [active, setActive] = useState(0);
  const animated = !reduceMotion && sources.length > 1;

  useEffect(() => {
    if (!animated) return undefined;
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % sources.length);
    }, INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [animated, sources.length]);

  const shown = animated ? sources : sources.slice(0, 1);

  return (
    <View
      testID="ambient-backdrop"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: theme.color.secondary }]}
    >
      {shown.map((source, index) =>
        animated ? (
          <Layer key={index} source={source} index={index} active={index === active} />
        ) : (
          <View
            key={index}
            testID={`ambient-photo-${String(index)}`}
            style={StyleSheet.absoluteFill}
          >
            <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
          </View>
        ),
      )}
      <View
        testID="ambient-veil"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.color.photoVeil }]}
      />
      <LinearGradient
        colors={[theme.color.photoScrimStart, theme.color.photoScrimEnd]}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
