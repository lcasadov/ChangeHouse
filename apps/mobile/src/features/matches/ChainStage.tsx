import { useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { type CelebrationHome, Tile, TILE_ASPECT } from './CelebrationTile';

/** Ancho de cada casa, en anchos del escenario; el escenario es un cuadrado. */
const TILE_RATIO = 0.32;
const TILE_HEIGHT_RATIO = TILE_RATIO / TILE_ASPECT;
const SCALE_GAIN = 0.08;
const ARROW_FADE = 0.8;
const ARROW_ICON_RATIO = 0.6;

interface Point {
  x: number;
  y: number;
}

/**
 * Los vértices del triángulo, en fracciones del escenario, en el sentido de las agujas del reloj y en
 * el orden en que entregan: la casa de quien mira (arriba), la tercera (abajo a la derecha) y la que
 * recibe quien mira (abajo a la izquierda). Cada casa viaja al vértice siguiente.
 */
const VERTICES: readonly [Point, Point, Point] = [
  { x: 0.5, y: 0.22 },
  { x: 0.8, y: 0.78 },
  { x: 0.2, y: 0.78 },
];

/** El vértice al que llega la casa que sale de cada uno. */
const NEXT = [1, 2, 0] as const;
const DEGREES_PER_RADIAN = 180 / Math.PI;

interface StageGeometry {
  progress: number;
  stageWidth: number;
}

/** Dónde está la casa que sale del vértice `index` y llega al siguiente, en un instante del giro. */
function tileTransform(index: 0 | 1 | 2, { progress, stageWidth }: StageGeometry) {
  'worklet';
  const from = VERTICES[index];
  const to = VERTICES[NEXT[index]];
  const arc = Math.sin(progress * Math.PI);
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;
  return {
    transform: [
      { translateX: (x - TILE_RATIO / 2) * stageWidth },
      { translateY: (y - TILE_HEIGHT_RATIO / 2) * stageWidth },
      { scale: 1 + arc * SCALE_GAIN },
    ],
  };
}

/** Dónde queda la flecha del lado `index` (del vértice `index` al siguiente), apuntando en su sentido. */
function arrowTransform(index: 0 | 1 | 2, size: number, { progress, stageWidth }: StageGeometry) {
  'worklet';
  const from = VERTICES[index];
  const to = VERTICES[NEXT[index]];
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * DEGREES_PER_RADIAN;
  return {
    // Se aparta mientras las casas pasan por encima y vuelve al acabar
    opacity: 1 - Math.sin(progress * Math.PI) * ARROW_FADE,
    transform: [
      { translateX: ((from.x + to.x) / 2) * stageWidth - size / 2 },
      { translateY: ((from.y + to.y) / 2) * stageWidth - size / 2 },
      { rotate: `${String(angle)}deg` },
    ],
  };
}

export interface ChainStageProps {
  mine: CelebrationHome;
  /** La casa que recibe quien mira. */
  theirs: CelebrationHome;
  /** La casa que recibe la de quien mira. */
  third: CelebrationHome;
  progress: SharedValue<number>;
  stageWidth: SharedValue<number>;
  reduceMotion: boolean;
}

interface ArrowProps {
  index: 0 | 1 | 2;
  progress: SharedValue<number>;
  stageWidth: SharedValue<number>;
}

/** Una flecha del lado del triángulo: decorativa, lo que dice quién entrega a quién lo dice el texto. */
function Arrow({ index, progress, stageWidth }: Readonly<ArrowProps>) {
  const theme = useTheme();
  const size = theme.space[6];
  const style = useAnimatedStyle(() =>
    arrowTransform(index, size, { progress: progress.value, stageWidth: stageWidth.value }),
  );
  return (
    <Animated.View
      testID={`chain-arrow-${String(index)}`}
      accessible={false}
      pointerEvents="none"
      style={[
        styles.arrow,
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.full,
          height: size,
          width: size,
        },
        style,
      ]}
    >
      <Ionicons
        accessible={false}
        name="arrow-forward"
        size={size * ARROW_ICON_RATIO}
        color={theme.color.primary}
      />
    </Animated.View>
  );
}

/**
 * Las tres casas de una cadena en triángulo con una flecha por lado en el sentido de las entregas.
 * Al girar, cada casa viaja al sitio de la siguiente; con «reducir movimiento» el progreso ya es 1 y
 * solo hay un fundido de entrada.
 */
export function ChainTiles({
  mine,
  theirs,
  third,
  progress,
  stageWidth,
  reduceMotion,
}: Readonly<ChainStageProps>) {
  const mineStyle = useAnimatedStyle(() =>
    tileTransform(0, { progress: progress.value, stageWidth: stageWidth.value }),
  );
  const thirdStyle = useAnimatedStyle(() =>
    tileTransform(1, { progress: progress.value, stageWidth: stageWidth.value }),
  );
  const theirsStyle = useAnimatedStyle(() =>
    tileTransform(2, { progress: progress.value, stageWidth: stageWidth.value }),
  );
  const width = `${String(TILE_RATIO * 100)}%` as const;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Tile
        side="mine"
        home={mine}
        animatedStyle={mineStyle}
        reduceMotion={reduceMotion}
        width={width}
        floating
      />
      <Tile
        side="third"
        home={third}
        animatedStyle={thirdStyle}
        reduceMotion={reduceMotion}
        width={width}
        floating
      />
      <Tile
        side="theirs"
        home={theirs}
        animatedStyle={theirsStyle}
        reduceMotion={reduceMotion}
        width={width}
        floating
      />
      {([0, 1, 2] as const).map((index) => (
        <Arrow key={index} index={index} progress={progress} stageWidth={stageWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: { alignItems: 'center', justifyContent: 'center', left: 0, position: 'absolute', top: 0 },
});
