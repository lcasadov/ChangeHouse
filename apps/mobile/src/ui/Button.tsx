import type { ColorTokens, Theme } from '@changehouse/ui';
import { borderWidth, disabledOpacity, touchTarget, useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onPhoto';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Mientras es `true` ignora las pulsaciones y mantiene el ancho del botón. */
  loading?: boolean;
  disabled?: boolean;
  /** Etiqueta accesible si debe diferir del texto visible. */
  accessibilityLabel?: string;
}

interface VariantColors {
  background: keyof ColorTokens | null;
  pressedBackground: keyof ColorTokens | null;
  foreground: keyof ColorTokens;
  border: keyof ColorTokens | null;
}

const VARIANTS: Record<ButtonVariant, VariantColors> = {
  primary: {
    background: 'primary',
    pressedBackground: 'primaryPressed',
    foreground: 'textOnPrimary',
    border: null,
  },
  secondary: {
    background: null,
    pressedBackground: 'surfaceMuted',
    foreground: 'primary',
    border: 'primary',
  },
  ghost: {
    background: null,
    pressedBackground: 'surfaceMuted',
    foreground: 'primary',
    border: null,
  },
  danger: {
    background: 'danger',
    pressedBackground: 'primaryPressed',
    foreground: 'textOnPrimary',
    border: null,
  },
  /** Sobre fotografía con el velo `photoVeil`: blanco y transparente, con el contraste del velo. */
  onPhoto: {
    background: null,
    pressedBackground: 'photoVeil',
    foreground: 'textOnPhoto',
    border: 'textOnPhoto',
  },
};

const colorOf = (theme: Theme, key: keyof ColorTokens | null): string =>
  key ? theme.color[key] : 'transparent';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
}: Readonly<ButtonProps>) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const colors = VARIANTS[variant];
  const inactive = disabled || loading;

  const handlePress = () => {
    if (!inactive) onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={handlePress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colorOf(theme, pressed ? colors.pressedBackground : colors.background),
          borderColor: colorOf(theme, colors.border),
          borderRadius: theme.radius.md,
          borderWidth: colors.border ? borderWidth.thin : 0,
          minHeight: touchTarget,
          minWidth: touchTarget,
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[2],
          opacity: disabled ? disabledOpacity : 1,
        },
        focused && {
          outlineColor: theme.color.focus,
          outlineOffset: borderWidth.thick,
          outlineStyle: 'solid',
          outlineWidth: borderWidth.thick,
        },
      ]}
    >
      {/* El texto se mantiene (invisible) al cargar para no cambiar el ancho del botón */}
      <Text
        variant="label"
        tone={colors.foreground}
        style={loading ? styles.hidden : undefined}
        accessible={false}
      >
        {label}
      </Text>
      {loading ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
          <View style={styles.spinner}>
            <ActivityIndicator color={theme.color[colors.foreground]} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  spinner: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
