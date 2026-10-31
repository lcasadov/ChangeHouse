import { contentMaxWidth, motion, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Text } from '../../ui';
import { useReduceMotion } from '../../ui/useReduceMotion';
import { CompensationPill } from '../discovery/CompensationPill';
import type { Compensation } from '../discovery/discovery-api';
import { type CelebrationHome, Tile } from './CelebrationTile';
import { ChainTiles } from './ChainStage';

export type { CelebrationHome } from './CelebrationTile';

/** Cuánto del ancho del escenario ocupa cada casa del cruce de dos; el resto es el recorrido. */
const TILE_WIDTH_RATIO = 0.42;
/** Cuánto se inclina y se agranda cada casa a mitad del cruce, para que no se solapen sin gracia. */
const SWAP_TILT_DEGREES = 6;
const SWAP_SCALE_GAIN = 0.08;
const HEART_POP_GAIN = 0.2;

interface SwapGeometry {
  progress: number;
  stageWidth: number;
  lift: number;
}

/**
 * Dónde está cada casa en un instante del cruce: `direction` 1 es la que va de izquierda a derecha y
 * -1 la que vuelve. Al empezar y al acabar no hay elevación, giro ni aumento; a mitad, el máximo.
 */
function swapTransform(direction: 1 | -1, { progress, stageWidth, lift }: SwapGeometry) {
  'worklet';
  const travel = stageWidth * (1 - TILE_WIDTH_RATIO);
  const arc = Math.sin(progress * Math.PI);
  return {
    transform: [
      { translateX: direction * progress * travel },
      { translateY: -direction * arc * lift },
      { rotate: `${String(-direction * arc * SWAP_TILT_DEGREES)}deg` },
      { scale: 1 + arc * SWAP_SCALE_GAIN },
    ],
  };
}

/** Lo que añade una cadena de tres al intercambio de dos. */
export interface CelebrationChain {
  /** La casa que recibe la de quien mira. */
  third: CelebrationHome;
  /** Quien entrega la casa que recibe quien mira. */
  fromName: string;
  /** Quien recibe la casa de quien mira. */
  toName: string;
}

export interface MatchCelebrationProps {
  visible: boolean;
  /** La casa que entrega quien mira. */
  mine: CelebrationHome;
  /** La casa que recibiría. */
  theirs: CelebrationHome;
  /** Solo en un match en cadena de tres: la tercera casa y quién entrega a quién. */
  chain?: CelebrationChain;
  /** Lo que paga o recibe quien mira (siempre una estimación orientativa); `null` si no se sabe cuál es su casa. */
  compensation: Compensation | null;
  /** «Ver match». */
  onView: () => void;
  /** «Seguir explorando»; también el gesto o botón de volver. */
  onContinue: () => void;
}

/**
 * La celebración del match (`docs/style-guide.md` §0 y §5): pantalla completa con el degradado de
 * match y las dos casas que se cruzan y se intercambian. Con «reducir movimiento» no hay recorrido:
 * aparecen ya intercambiadas con un fundido. Los textos van sobre una superficie, no sobre el
 * degradado, que no garantiza contraste (`color.matchGradient*` es no textual). El anuncio a los
 * lectores de pantalla y la vibración los lanza quien decide mostrarla.
 */
export function MatchCelebration({
  visible,
  mine,
  theirs,
  chain,
  compensation,
  onView,
  onContinue,
}: Readonly<MatchCelebrationProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const elevation = theme.elevation[3];
  const stageWidth = useSharedValue(0);
  const progress = useSharedValue(0);
  const lift = theme.space[5];

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      motion.fast,
      withTiming(1, { duration: motion.slow * 2, easing: Easing.inOut(Easing.cubic) }),
    );
  }, [reduceMotion, progress, visible]);

  const mineStyle = useAnimatedStyle(() =>
    swapTransform(1, { progress: progress.value, stageWidth: stageWidth.value, lift }),
  );
  const theirsStyle = useAnimatedStyle(() =>
    swapTransform(-1, { progress: progress.value, stageWidth: stageWidth.value, lift }),
  );
  const heartStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : Math.min(1, progress.value * 2),
    transform: [{ scale: 1 + Math.sin(progress.value * Math.PI) * HEART_POP_GAIN }],
  }));

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onContinue}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View testID="match-celebration" accessibilityViewIsModal style={styles.root}>
        <LinearGradient
          testID="match-gradient"
          colors={[theme.color.matchGradientStart, theme.color.matchGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Con el texto al 200 % o en horizontal el contenido no cabe: se desplaza, nunca se corta */}
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { gap: theme.space[5], padding: theme.space[4] },
            ]}
          >
            <View
              testID="swap-stage"
              onLayout={(event) => {
                stageWidth.set(event.nativeEvent.layout.width);
              }}
              style={[
                styles.stage,
                chain ? styles.triangleStage : styles.crossStage,
                { maxWidth: contentMaxWidth.card },
              ]}
            >
              {chain ? (
                <ChainTiles
                  mine={mine}
                  theirs={theirs}
                  third={chain.third}
                  progress={progress}
                  stageWidth={stageWidth}
                  reduceMotion={reduceMotion}
                />
              ) : (
                <>
                  <Tile
                    side="mine"
                    home={mine}
                    animatedStyle={mineStyle}
                    reduceMotion={reduceMotion}
                  />
                  <Tile
                    side="theirs"
                    home={theirs}
                    animatedStyle={theirsStyle}
                    reduceMotion={reduceMotion}
                  />
                </>
              )}
              <Animated.View
                testID="swap-heart"
                pointerEvents="none"
                accessible={false}
                style={[StyleSheet.absoluteFill, styles.heart, heartStyle]}
              >
                <View
                  style={{
                    backgroundColor: theme.color.surface,
                    borderRadius: theme.radius.full,
                    padding: theme.space[3],
                  }}
                >
                  <Ionicons
                    accessible={false}
                    name="heart"
                    size={theme.space[6]}
                    color={theme.color.primary}
                  />
                </View>
              </Animated.View>
            </View>

            <Animated.View
              entering={
                reduceMotion
                  ? FadeIn.duration(motion.fast)
                  : FadeInDown.delay(motion.base).duration(motion.slow)
              }
              style={[
                styles.panel,
                {
                  backgroundColor: elevation.surface,
                  borderColor: elevation.borderColor,
                  borderRadius: theme.radius.lg,
                  borderWidth: elevation.borderWidth,
                  elevation: elevation.androidElevation,
                  gap: theme.space[3],
                  maxWidth: contentMaxWidth.card,
                  padding: theme.space[5],
                  shadowColor: elevation.shadowColor,
                  shadowOffset: elevation.shadowOffset,
                  shadowOpacity: elevation.shadowOpacity,
                  shadowRadius: elevation.shadowRadius,
                },
              ]}
            >
              {chain ? (
                <View style={styles.compensation}>
                  <Badge tone="info" icon="triangle-outline" label={t('matches.chain.label')} />
                </View>
              ) : null}
              <Text variant="title" accessibilityRole="header" style={styles.centered}>
                {t('matches.celebration.title')}
              </Text>
              <Text tone="textMuted" style={styles.centered}>
                {t(chain ? 'matches.celebration.chain.subtitle' : 'matches.celebration.subtitle')}
              </Text>
              <Text variant="bodyStrong" style={styles.centered}>
                {chain
                  ? t('matches.celebration.chain.swap', { from: chain.fromName, to: chain.toName })
                  : t('matches.celebration.swap', { mine: mine.title, theirs: theirs.title })}
              </Text>
              {compensation ? (
                <View style={[styles.compensation, { gap: theme.space[1] }]}>
                  <CompensationPill compensation={compensation} />
                  <Text variant="caption" tone="textMuted">
                    {t('discovery.compensation.disclaimer')}
                  </Text>
                </View>
              ) : null}
              <View style={{ gap: theme.space[2], paddingTop: theme.space[2] }}>
                <Button label={t('matches.celebration.view')} onPress={onView} />
                <Button
                  variant="ghost"
                  label={t('matches.celebration.continue')}
                  onPress={onContinue}
                />
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  compensation: { alignItems: 'center' },
  heart: { alignItems: 'center', justifyContent: 'center' },
  panel: { width: '100%' },
  root: { flex: 1 },
  content: { alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  safe: { flex: 1 },
  stage: { width: '100%' },
  crossStage: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  triangleStage: { aspectRatio: 1 },
});
