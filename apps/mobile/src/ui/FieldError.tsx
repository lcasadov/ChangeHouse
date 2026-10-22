import { useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';

/** Error de validación junto a su campo: icono y texto (nunca solo color), anunciado al aparecer. */
export function FieldError({ message }: Readonly<{ message: string }>) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.row, { gap: theme.space[1] }]}
    >
      <Ionicons
        name="alert-circle"
        size={theme.font.caption.lineHeight}
        color={theme.color.danger}
      />
      <Text variant="caption" tone="danger" style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  message: { flexShrink: 1 },
  row: { alignItems: 'center', flexDirection: 'row' },
});
