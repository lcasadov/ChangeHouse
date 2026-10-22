import type { ThemeName } from '@changehouse/ui';
import { render, type screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { type StyleProp, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getAnimatedStyle } from 'react-native-reanimated';

import { AppThemeProvider } from './theme/AppThemeProvider';

const styles = StyleSheet.create({ root: { flex: 1 } });

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark'];

/** Renderiza dentro del tema indicado, forzándolo con el override del proveedor. */
export function renderThemed(ui: ReactElement, theme: ThemeName = 'light') {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <GestureHandlerRootView style={styles.root}>
        <AppThemeProvider override={theme}>{children}</AppThemeProvider>
      </GestureHandlerRootView>
    ),
  });
}

type Rendered = ReturnType<typeof screen.getByText>;

/** Estilo plano de un elemento renderizado, tipado (las props del renderer son `any`). */
export function styleOf(element: Rendered): ViewStyle & TextStyle {
  return StyleSheet.flatten(element.props.style as StyleProp<ViewStyle & TextStyle>) ?? {};
}

type AnimatedStyleReader = (element: Rendered) => Record<string, unknown>;

/**
 * El estilo que Reanimated está aplicando a un elemento animado. Sus tipos solo declaran el
 * sustituto de la web (`() => void`), aunque en Jest la función lee el estilo vigente.
 */
export const animatedStyleOf = getAnimatedStyle as unknown as AnimatedStyleReader;
