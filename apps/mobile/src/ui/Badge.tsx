import type { ColorTokens } from '@changehouse/ui';
import { borderWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning';

export interface BadgeProps {
  tone: BadgeTone;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Estado en texto: el color y el icono nunca van solos. */
  label: string;
}

const TONE_COLORS: Record<BadgeTone, keyof ColorTokens> = {
  neutral: 'textMuted',
  info: 'secondary',
  success: 'success',
  warning: 'warning',
};

/** Etiqueta de estado (`docs/style-guide.md` §3): icono decorativo y texto, con el color del tono. */
export function Badge({ tone, icon, label }: Readonly<BadgeProps>) {
  const theme = useTheme();
  const color = TONE_COLORS[tone];

  return (
    <View
      style={[
        styles.root,
        {
          borderColor: theme.color[color],
          borderRadius: theme.radius.full,
          borderWidth: borderWidth.thin,
          gap: theme.space[1],
          paddingHorizontal: theme.space[2],
          paddingVertical: theme.space[1],
        },
      ]}
    >
      <Ionicons
        testID="badge-icon"
        accessible={false}
        name={icon}
        size={theme.font.label.lineHeight}
        color={theme.color[color]}
      />
      <Text variant="label" tone={color}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
});
