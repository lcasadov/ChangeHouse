import { useTheme } from '@changehouse/ui';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';

export interface ProgressBarProps {
  /** Texto visible y nombre accesible, por ejemplo «Paso 2 de 5». */
  label: string;
  now: number;
  max: number;
}

/** Barra de progreso de un proceso por pasos: texto, valor accesible y relleno proporcional. */
export function ProgressBar({ label, now, max }: Readonly<ProgressBarProps>) {
  const theme = useTheme();
  const ratio = Math.min(Math.max(now / max, 0), 1);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now }}
      style={{ gap: theme.space[2] }}
    >
      <Text variant="label" tone="textMuted">
        {label}
      </Text>
      <View
        testID="progress-track"
        style={[
          styles.track,
          {
            backgroundColor: theme.color.surfaceMuted,
            borderRadius: theme.radius.full,
            height: theme.space[2],
          },
        ]}
      >
        <View
          testID="progress-fill"
          style={{
            backgroundColor: theme.color.primary,
            borderRadius: theme.radius.full,
            height: theme.space[2],
            width: `${String(ratio * 100)}%`,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ track: { overflow: 'hidden', width: '100%' } });
