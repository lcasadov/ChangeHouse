import { motion } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '../../ui/useReduceMotion';
import type { DiscoveryCard } from './discovery-api';
import { DiscoveryCardView } from './DiscoveryCardView';

/** La tarjeta de debajo asoma algo más pequeña y apagada: al subir, crece hasta su sitio. */
const BEHIND_SCALE = 0.94;
const BEHIND_OPACITY = 0.6;

interface StackLayerProps {
  /** `true` para la tarjeta que se ve y recibe los toques; `false` para la precargada de debajo. */
  front: boolean;
  children: ReactNode;
}

/**
 * Una capa de la pila. Su posición (escala y opacidad) la mueve Reanimated desde valores
 * compartidos: es la base sobre la que `add-like-dismiss-undo` añadirá el arrastre. Con «reducir
 * movimiento» los cambios son inmediatos. La animación de salida va en un contenedor aparte: una
 * animación de salida sobre el mismo elemento pisaría la opacidad del estilo animado.
 */
function StackLayer({ front, children }: Readonly<StackLayerProps>) {
  const reduceMotion = useReduceMotion();
  const duration = reduceMotion ? 0 : motion.base;
  const position = useAnimatedStyle(() => ({
    opacity: withTiming(front ? 1 : BEHIND_OPACITY, { duration }),
    transform: [{ scale: withTiming(front ? 1 : BEHIND_SCALE, { duration }) }],
  }));

  return (
    <Animated.View
      exiting={reduceMotion ? undefined : FadeOut.duration(motion.base)}
      pointerEvents={front ? 'auto' : 'none'}
      accessibilityElementsHidden={!front}
      importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[styles.fill, position]}>{children}</Animated.View>
    </Animated.View>
  );
}

export interface CardStackProps {
  /** La tarjeta a la vista. */
  current: DiscoveryCard;
  /** La siguiente, ya montada debajo para que su foto esté lista cuando suba. */
  next: DiscoveryCard | undefined;
  onOpen: (card: DiscoveryCard) => void;
}

/** Una tarjeta a la vista y la siguiente precargada debajo; cada capa se identifica por su vivienda. */
export function CardStack({ current, next, onOpen }: Readonly<CardStackProps>) {
  return (
    <View style={styles.fill}>
      {next ? (
        <StackLayer key={next.id} front={false}>
          <DiscoveryCardView card={next} onOpen={() => undefined} />
        </StackLayer>
      ) : null}
      <StackLayer key={current.id} front>
        <DiscoveryCardView
          card={current}
          onOpen={() => {
            onOpen(current);
          }}
        />
      </StackLayer>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
