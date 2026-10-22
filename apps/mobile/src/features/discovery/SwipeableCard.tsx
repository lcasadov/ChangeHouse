import { borderWidth, useTheme } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '../../ui';
import { haptics } from '../../ui/haptics';
import { useReduceMotion } from '../../ui/useReduceMotion';
import type { Decision } from './decision-model';
import { swipeOutcome, swipeProgress } from './swipe-outcome';

/** Identificador del gesto de la tarjeta de delante, para las pruebas. */
export const SWIPE_GESTURE_ID = 'card-swipe';

/** Inclinación (grados) de la tarjeta cuando se arrastra hasta el borde: ligera, no un giro. */
const MAX_TILT_DEGREES = 12;
/** Inclinación de los sellos, como estampados a mano sobre la foto. */
const STAMP_TILT_DEGREES = 12;
/** Cuánto hay que mover el dedo en horizontal para que sea un deslizamiento y no un toque. */
const ACTIVATE_AFTER_X = 12;
/** Si el dedo sube o baja tanto antes, es un desplazamiento vertical de la pantalla: no se roba. */
const FAIL_AFTER_Y = 24;

/** La vibración que confirma que, al soltar, se decidirá (función propia para poder pasarla al hilo de JS). */
function buzz(): void {
  void haptics.threshold();
}

export interface SwipeableCardProps {
  /** Solo la tarjeta de delante recibe gestos. */
  enabled: boolean;
  /** Sin vivienda publicada no se puede dar «me gusta»: deslizar a la derecha avisa en lugar de decidir. */
  canLike: boolean;
  onDecide: (decision: Decision) => void;
  onBlockedLike: () => void;
  children: ReactNode;
}

interface StampProps {
  decision: Decision;
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
}

/** El sello sobre la foto: decorativo, porque los botones y las acciones de accesibilidad ya dicen lo mismo. */
function Stamp({ decision, animatedStyle }: Readonly<StampProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const liked = decision === 'like';
  const tone = liked ? 'success' : 'danger';
  const tilt = `${String(liked ? -STAMP_TILT_DEGREES : STAMP_TILT_DEGREES)}deg`;

  return (
    <Animated.View
      testID={`stamp-${decision}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.stamp,
        liked ? styles.stampStart : styles.stampEnd,
        {
          backgroundColor: theme.color.surface,
          borderColor: theme.color[tone],
          borderRadius: theme.radius.md,
          borderWidth: borderWidth.thick,
          margin: theme.space[4],
          paddingHorizontal: theme.space[3],
          paddingVertical: theme.space[1],
          transform: [{ rotate: tilt }],
        },
        animatedStyle,
      ]}
    >
      <Text variant="title" tone={tone}>
        {t(liked ? 'discovery.stamps.like' : 'discovery.stamps.dismiss')}
      </Text>
    </Animated.View>
  );
}

/**
 * La tarjeta que se decide con el dedo: arrastrarla a la derecha es «me gusta» y a la izquierda
 * «descartar». Se inclina ligeramente, muestra el sello del lado con opacidad proporcional al
 * recorrido y vibra una vez al cruzar el umbral. Con «reducir movimiento» sigue al dedo, pero sin
 * inclinarse. Al soltar, o vuelve a su sitio o avisa de la decisión: quien la quita de la pila
 * (con su animación de salida) es el llamante.
 */
export function SwipeableCard({
  enabled,
  canLike,
  onDecide,
  onBlockedLike,
  children,
}: Readonly<SwipeableCardProps>) {
  const reduceMotion = useReduceMotion();
  const window = useWindowDimensions();
  const width = useSharedValue(window.width);
  const translateX = useSharedValue(0);
  const beyondThreshold = useSharedValue(false);

  const pan = usePanGesture({
    testID: enabled ? SWIPE_GESTURE_ID : undefined,
    enabled,
    activeOffsetX: [-ACTIVATE_AFTER_X, ACTIVATE_AFTER_X],
    failOffsetY: [-FAIL_AFTER_Y, FAIL_AFTER_Y],
    onUpdate: (event) => {
      'worklet';
      translateX.value = event.translationX;
      const beyond = Math.abs(swipeProgress(event.translationX, width.value)) >= 1;
      if (beyond !== beyondThreshold.value) {
        beyondThreshold.value = beyond;
        if (beyond) scheduleOnRN(buzz);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      beyondThreshold.value = false;
      const outcome = event.canceled
        ? null
        : swipeOutcome({
            translationX: event.translationX,
            velocityX: event.velocityX,
            width: width.value,
          });
      if (outcome === 'like' && !canLike) {
        translateX.value = reduceMotion ? 0 : withSpring(0);
        scheduleOnRN(onBlockedLike);
      } else if (outcome) {
        // La tarjeta se queda donde se soltó: la animación de salida sigue desde ahí
        scheduleOnRN(onDecide, outcome);
      } else {
        translateX.value = reduceMotion ? 0 : withSpring(0);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const tilt =
      reduceMotion || width.value <= 0
        ? 0
        : interpolate(
            translateX.value,
            [-width.value, 0, width.value],
            [-MAX_TILT_DEGREES, 0, MAX_TILT_DEGREES],
            Extrapolation.CLAMP,
          );
    return { transform: [{ translateX: translateX.value }, { rotate: `${String(tilt)}deg` }] };
  });
  const likeStamp = useAnimatedStyle(() => ({
    opacity: Math.max(0, swipeProgress(translateX.value, width.value)),
  }));
  const dismissStamp = useAnimatedStyle(() => ({
    opacity: Math.max(0, -swipeProgress(translateX.value, width.value)),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        {...(enabled ? { testID: 'swipeable-card' } : {})}
        onLayout={(event) => {
          width.set(event.nativeEvent.layout.width);
        }}
        style={[styles.card, cardStyle]}
      >
        {children}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Stamp decision="like" animatedStyle={likeStamp} />
          <Stamp decision="dismiss" animatedStyle={dismissStamp} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  stamp: { position: 'absolute', top: 0 },
  stampEnd: { right: 0 },
  stampStart: { left: 0 },
});
