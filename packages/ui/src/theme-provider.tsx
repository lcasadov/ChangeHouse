import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react';

import type { Theme, ThemeName, ThemePreference } from './theme.js';
import { resolveThemeName, themes } from './theme.js';

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  /** Esquema del sistema; la app lo obtiene con `useColorScheme` de react-native. */
  colorScheme?: ThemeName | null | undefined;
  /** `system` (predeterminado) sigue al sistema; `light` y `dark` lo fuerzan. */
  override?: ThemePreference;
  children: ReactNode;
}

export function ThemeProvider({
  colorScheme,
  override = 'system',
  children,
}: ThemeProviderProps): ReactElement {
  const theme = useMemo(
    () => themes[resolveThemeName(colorScheme, override)],
    [colorScheme, override],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme debe usarse dentro de un ThemeProvider');
  return theme;
}
