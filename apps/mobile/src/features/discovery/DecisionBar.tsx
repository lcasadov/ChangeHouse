import { borderWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '../../ui';
import { useReduceMotion } from '../../ui/useReduceMotion';
import { type Decision, UNDO_WINDOW_MS } from './decision-model';

export interface DecisionBarProps {
  decision: Decision;
}

/**
 * La barra que confirma la última decisión mientras se puede deshacer. Una línea que se vacía
 * enseña cuánto queda; con «reducir movimiento» se queda quieta. La acción de deshacer es el botón
 * de siempre, bajo la tarjeta: la barra solo informa y desaparece con la ventana. Se monta de nuevo
 * (con otra `key`) en cada decisión para reiniciar la cuenta atrás.
 */
export function DecisionBar({ decision }: Readonly<DecisionBarProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const remaining = useSharedValue(1);
  const liked = decision === 'like';

  useEffect(() => {
    if (!reduceMotion) {
      remaining.value = withTiming(0, { duration: UNDO_WINDOW_MS, easing: Easing.linear });
    }
  }, [reduceMotion, remaining]);

  const line = useAnimatedStyle(() => ({ width: `${String(remaining.value * 100)}%` }));

  return (
    <View
      testID="decision-bar"
      style={{
        backgroundColor: theme.color.surfaceMuted,
        borderColor: theme.color.border,
        borderRadius: theme.radius.md,
        borderWidth: borderWidth.thin,
        overflow: 'hidden',
      }}
    >
      <View style={[styles.row, { gap: theme.space[2], padding: theme.space[3] }]}>
        <Ionicons
          accessible={false}
          name={liked ? 'heart' : 'close'}
          size={theme.space[5]}
          color={theme.color[liked ? 'primary' : 'secondary']}
        />
        <Text variant="label">
          {t(liked ? 'discovery.decision.liked' : 'discovery.decision.dismissed')}
        </Text>
      </View>
      <Animated.View
        accessible={false}
        style={[{ backgroundColor: theme.color.primary, height: theme.space[1] }, line]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
});
