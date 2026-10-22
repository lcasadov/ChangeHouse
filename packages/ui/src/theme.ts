import type { ColorTokens, ElevationLevel, ElevationToken } from './tokens/index.js';
import {
  darkColors,
  darkElevation,
  fonts,
  lightColors,
  lightElevation,
  motion,
  radius,
  space,
} from './tokens/index.js';

export type ThemeName = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeName;

export interface Theme {
  name: ThemeName;
  color: ColorTokens;
  font: typeof fonts;
  space: typeof space;
  radius: typeof radius;
  elevation: Record<ElevationLevel, ElevationToken>;
  motion: typeof motion;
}

export const themes: Record<ThemeName, Theme> = {
  light: {
    name: 'light',
    color: lightColors,
    font: fonts,
    space,
    radius,
    elevation: lightElevation(lightColors),
    motion,
  },
  dark: {
    name: 'dark',
    color: darkColors,
    font: fonts,
    space,
    radius,
    elevation: darkElevation(darkColors),
    motion,
  },
};

export const DEFAULT_THEME: ThemeName = 'light';

/**
 * Tema efectivo: la preferencia explícita manda; con `system` se sigue el esquema del
 * sistema y, si este no se conoce, el tema predeterminado (claro).
 */
export function resolveThemeName(
  systemScheme: ThemeName | null | undefined,
  preference: ThemePreference = 'system',
): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme ?? DEFAULT_THEME;
}
