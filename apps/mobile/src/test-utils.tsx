import type { ThemeName } from '@changehouse/ui';
import { render, type screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { type StyleProp, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { AppThemeProvider } from './theme/AppThemeProvider';

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark'];

/** Renderiza dentro del tema indicado, forzándolo con el override del proveedor. */
export function renderThemed(ui: ReactElement, theme: ThemeName = 'light') {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AppThemeProvider override={theme}>{children}</AppThemeProvider>
    ),
  });
}

type Rendered = ReturnType<typeof screen.getByText>;

/** Estilo plano de un elemento renderizado, tipado (las props del renderer son `any`). */
export function styleOf(element: Rendered): ViewStyle & TextStyle {
  return StyleSheet.flatten(element.props.style as StyleProp<ViewStyle & TextStyle>) ?? {};
}
