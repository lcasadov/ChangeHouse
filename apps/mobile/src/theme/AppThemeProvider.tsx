import type { ThemePreference } from '@changehouse/ui';
import { ThemeProvider } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export interface AppThemeProviderProps {
  /** Elección guardada del usuario; `system` sigue la preferencia del sistema. */
  override?: ThemePreference;
  children: ReactNode;
}

/** Enlaza el esquema de color del sistema (react-native) con el `ThemeProvider` de `@changehouse/ui`. */
export function AppThemeProvider({
  override = 'system',
  children,
}: Readonly<AppThemeProviderProps>) {
  const systemScheme = useColorScheme();
  const colorScheme = systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : null;
  return (
    <ThemeProvider colorScheme={colorScheme} override={override}>
      {children}
    </ThemeProvider>
  );
}
