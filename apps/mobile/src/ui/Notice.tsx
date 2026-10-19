import type { ColorTokens } from '@changehouse/ui';
import { borderWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

export interface NoticeProps {
  tone: NoticeTone;
  children: string;
  action?: { label: string; onPress: () => void };
}

const TONES: Record<
  NoticeTone,
  { color: keyof ColorTokens; icon: ComponentProps<typeof Ionicons>['name'] }
> = {
  info: { color: 'secondary', icon: 'information-circle' },
  success: { color: 'success', icon: 'checkmark-circle' },
  warning: { color: 'warning', icon: 'warning' },
  danger: { color: 'danger', icon: 'alert-circle' },
};

/**
 * Aviso con icono (el color nunca va solo). El mensaje se anuncia al aparecer; la acción queda
 * fuera del grupo anunciado para seguir siendo un control alcanzable por sí mismo.
 */
export function Notice({ tone, children, action }: Readonly<NoticeProps>) {
  const theme = useTheme();
  const { color, icon } = TONES[tone];

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color[color],
        borderRadius: theme.radius.md,
        borderWidth: borderWidth.thin,
        gap: theme.space[3],
        padding: theme.space[3],
      }}
    >
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.row, { gap: theme.space[2] }]}
      >
        <Ionicons name={icon} size={theme.space[5]} color={theme.color[color]} />
        <Text style={styles.message}>{children}</Text>
      </View>
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  message: { flex: 1 },
  row: { alignItems: 'flex-start', flexDirection: 'row' },
});
