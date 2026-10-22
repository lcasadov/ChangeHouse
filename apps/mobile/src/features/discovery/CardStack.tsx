import { motion } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '../../ui/useReduceMotion';
import type { Decision } from './decision-model';
import { type ExitDirection, exitingFor } from './decision-motion';
import type { DiscoveryCard } from './discovery-api';
import { DiscoveryCardView } from './DiscoveryCardView';
import { SwipeableCard } from './SwipeableCard';

/** La tarjeta de debajo asoma algo más pequeña y apagada: al subir, crece hasta su sitio. */
const BEHIND_SCALE = 0.94;
const BEHIND_OPACITY = 0.6;

interface StackLayerProps {
  /** `true` para la tarjeta que se ve y recibe los toques y los gestos; `false` para la precargada de debajo. */
  front: boolean;
  /** La tarjeta de delante responde al dedo, salvo que no se pueda decidir (se está deshaciendo). */
  swipeable: boolean;
  canLike: boolean;
  /** Hacia dónde vuela al salir de la pila. */
  exitDirection: SharedValue<ExitDirection>;
  onDecide: (decision: Decision) => void;
  onBlockedLike: () => void;
  children: ReactNode;
}

/**
 * Una capa de la pila. Su posición (escala y opacidad) la mueve Reanimated desde valores
 * compartidos; la de delante, además, se arrastra con el dedo. Al salir vuela hacia el lado de la
 * decisión o, con «reducir movimiento», se desvanece. La animación de salida va en un contenedor
 * aparte: una animación de salida sobre el mismo elemento pisaría la opacidad del estilo animado.
 */
function StackLayer({
  front,
  swipeable,
  canLike,
  exitDirection,
  onDecide,
  onBlockedLike,
  children,
}: Readonly<StackLayerProps>) {
  const reduceMotion = useReduceMotion();
  const duration = reduceMotion ? 0 : motion.base;
  const position = useAnimatedStyle(() => ({
    opacity: withTiming(front ? 1 : BEHIND_OPACITY, { duration }),
    transform: [{ scale: withTiming(front ? 1 : BEHIND_SCALE, { duration }) }],
  }));

  return (
    <Animated.View
      exiting={exitingFor(exitDirection, reduceMotion)}
      pointerEvents={front ? 'auto' : 'none'}
      accessibilityElementsHidden={!front}
      importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[styles.fill, position]}>
        <SwipeableCard
          enabled={swipeable}
          canLike={canLike}
          onDecide={onDecide}
          onBlockedLike={onBlockedLike}
        >
          {children}
        </SwipeableCard>
      </Animated.View>
    </Animated.View>
  );
}

export interface CardStackProps {
  /** La tarjeta a la vista. */
  current: DiscoveryCard;
  /** La siguiente, ya montada debajo para que su foto esté lista cuando suba. */
  next: DiscoveryCard | undefined;
  /** Sin vivienda publicada no se da «me gusta». */
  canLike: boolean;
  /** Mientras no se pueda decidir (se está deshaciendo) la tarjeta no responde a los gestos. */
  canDecide: boolean;
  exitDirection: SharedValue<ExitDirection>;
  onOpen: (card: DiscoveryCard) => void;
  onDecide: (card: DiscoveryCard, decision: Decision) => void;
  /** Se intentó dar «me gusta» sin poder: hay que invitar a publicar la vivienda. */
  onBlockedLike: () => void;
}

/** Una tarjeta a la vista y la siguiente precargada debajo; cada capa se identifica por su vivienda. */
export function CardStack({
  current,
  next,
  canLike,
  canDecide,
  exitDirection,
  onOpen,
  onDecide,
  onBlockedLike,
}: Readonly<CardStackProps>) {
  const ignore = () => undefined;
  return (
    <View style={styles.fill}>
      {next ? (
        <StackLayer
          key={next.id}
          front={false}
          swipeable={false}
          canLike={canLike}
          exitDirection={exitDirection}
          onDecide={ignore}
          onBlockedLike={ignore}
        >
          <DiscoveryCardView card={next} onOpen={ignore} />
        </StackLayer>
      ) : null}
      <StackLayer
        key={current.id}
        front
        swipeable={canDecide}
        canLike={canLike}
        exitDirection={exitDirection}
        onDecide={(decision) => {
          onDecide(current, decision);
        }}
        onBlockedLike={onBlockedLike}
      >
        <DiscoveryCardView
          card={current}
          onOpen={() => {
            onOpen(current);
          }}
          onDecide={(decision) => {
            onDecide(current, decision);
          }}
        />
      </StackLayer>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
