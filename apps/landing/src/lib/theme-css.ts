import { themes, themeToCssVariables } from '@changehouse/ui/core';

function declarations(vars: Record<string, string>, indent: string): string {
  return Object.entries(vars)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n');
}

/**
 * Hoja de estilos con las propiedades CSS personalizadas de los tokens de `@changehouse/ui`:
 * tema claro por defecto y oscuro con `prefers-color-scheme`. Es la única fuente de color,
 * espaciado, radio y tipografía de la landing.
 */
export function buildThemeStylesheet(): string {
  const light = themeToCssVariables(themes.light);
  const dark = themeToCssVariables(themes.dark);

  return [
    ':root {',
    '  color-scheme: light dark;',
    declarations(light, '  '),
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    declarations(dark, '    '),
    '  }',
    '}',
  ].join('\n');
}

/** Color de la barra del navegador (`theme-color`) para cada esquema. */
export function themeColors(): { light: string; dark: string } {
  return { light: themes.light.color.bg, dark: themes.dark.color.bg };
}
