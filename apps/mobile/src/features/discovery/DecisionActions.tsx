import type { ColorTokens } from '@changehouse/ui';
import { borderWidth, disabledOpacity, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ActionSize = 'large' | 'regular';

interface ActionStyle {
  background: keyof ColorTokens;
  pressedBackground: keyof ColorTokens;
  foreground: keyof ColorTokens;
  border: keyof ColorTokens;
}

const SECONDARY: ActionStyle = {
  background: 'surface',
  pressedBackground: 'surfaceMuted',
  foreground: 'secondary',
  border: 'borderStrong',
};

const PRIMARY: ActionStyle = {
  background: 'primary',
  pressedBackground: 'primaryPressed',
  foreground: 'textOnPrimary',
  border: 'primary',
};

interface ActionButtonProps {
  label: string;
  icon: IconName;
  look: ActionStyle;
  size: ActionSize;
  disabled: boolean;
  onPress: () => void;
}

/** Un botón de decisión: icono y etiqueta visibles dentro de la misma zona táctil, con foco visible. */
function ActionButton({ label, icon, look, size, disabled, onPress }: Readonly<ActionButtonProps>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  const large = size === 'large';
  // Descartar y Me gusta son los grandes, al alcance del pulgar; Deshacer, secundario, también supera 44
  const height = large ? theme.space[8] + theme.space[2] : theme.space[8];
  const width = large ? theme.space[8] + theme.space[5] : theme.space[8] + theme.space[2];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: theme.color[pressed ? look.pressedBackground : look.background],
          borderColor: theme.color[look.border],
          borderRadius: theme.radius.lg,
          borderWidth: borderWidth.thin,
          gap: theme.space[1],
          minHeight: height,
          minWidth: width,
          opacity: disabled ? disabledOpacity : 1,
          paddingHorizontal: theme.space[2],
          paddingVertical: theme.space[2],
        },
        focusRing.style,
      ]}
    >
      <Ionicons
        accessible={false}
        name={icon}
        size={theme.space[5]}
        color={theme.color[look.foreground]}
      />
      <Text variant="label" tone={look.foreground} accessible={false}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface DecisionActionsProps {
  /** Hay una decisión reciente que se puede deshacer. */
  canUndo: boolean;
  /** Hay una tarjeta sobre la que decidir; sin ella (final de la lista) solo queda deshacer. */
  canDecide?: boolean;
  onDismiss: () => void;
  onUndo: () => void;
  onLike: () => void;
}

/**
 * Los botones de decisión bajo la tarjeta, siempre a la vista: la alternativa sin gestos al
 * deslizamiento (WCAG 2.5.1 y 2.5.7) y, a la vez, la forma más rápida de decidir con un toque.
 */
export function DecisionActions({
  canUndo,
  canDecide = true,
  onDismiss,
  onUndo,
  onLike,
}: Readonly<DecisionActionsProps>) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.row, { columnGap: theme.space[3], rowGap: theme.space[2] }]}>
      <ActionButton
        label={t('discovery.actions.dismiss')}
        icon="close"
        look={SECONDARY}
        size="large"
        disabled={!canDecide}
        onPress={onDismiss}
      />
      <ActionButton
        label={t('discovery.actions.undo')}
        icon="arrow-undo"
        look={SECONDARY}
        size="regular"
        disabled={!canUndo}
        onPress={onUndo}
      />
      <ActionButton
        label={t('discovery.actions.like')}
        icon="heart"
        look={PRIMARY}
        size="large"
        disabled={!canDecide}
        onPress={onLike}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', justifyContent: 'center' },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
