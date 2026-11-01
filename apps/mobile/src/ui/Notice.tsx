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
  /** Varias acciones compactas en una fila, para avisos persistentes que no deben ocupar espacio. */
  actions?: readonly NoticeAction[];
  /** Una segunda línea anunciada (el resultado de la última acción), sin perder el mensaje. */
  detail?: string;
  testID?: string;
  actionsTestID?: string;
}

export interface NoticeAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
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
export function Notice({
  tone,
  children,
  action,
  actions,
  detail,
  testID,
  actionsTestID,
}: Readonly<NoticeProps>) {
  const theme = useTheme();
  const { color, icon } = TONES[tone];

  return (
    <View
      testID={testID}
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
        <View style={styles.message}>
          <Text>{children}</Text>
          {detail ? (
            <Text variant="caption" tone="textMuted">
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      {actions && actions.length > 0 ? (
        <View testID={actionsTestID} style={[styles.actions, { columnGap: theme.space[2] }]}>
          {actions.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              label={item.label}
              loading={item.loading}
              disabled={item.disabled}
              onPress={item.onPress}
            />
          ))}
        </View>
      ) : null}
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  message: { flex: 1 },
  row: { alignItems: 'flex-start', flexDirection: 'row' },
});
