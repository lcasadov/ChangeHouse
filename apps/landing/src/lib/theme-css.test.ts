import { themes } from '@changehouse/ui/core';
import { describe, expect, it } from 'vitest';

import { buildThemeStylesheet, themeColors } from './theme-css';

describe('buildThemeStylesheet', () => {
  const css = buildThemeStylesheet();
  const [lightBlock, darkBlock] = css.split('@media (prefers-color-scheme: dark)');

  it('declara los dos esquemas y el tema claro como predeterminado', () => {
    expect(css).toContain('color-scheme: light dark;');
    expect(lightBlock).toContain(`--color-bg: ${themes.light.color.bg};`);
    expect(lightBlock).not.toContain(themes.dark.color.bg);
  });

  it('el tema oscuro solo se aplica con prefers-color-scheme: dark', () => {
    expect(darkBlock).toBeDefined();
    expect(darkBlock).toContain(`--color-bg: ${themes.dark.color.bg};`);
    expect(darkBlock).toContain(`--color-primary: ${themes.dark.color.primary};`);
  });

  it('expone las mismas variables en ambos esquemas', () => {
    const names = (block: string | undefined) =>
      [...(block ?? '').matchAll(/(--[\w-]+):/g)].map((match) => match[1]).sort();

    expect(names(darkBlock)).toEqual(names(lightBlock));
    expect(names(lightBlock).length).toBeGreaterThan(50);
  });
});

describe('themeColors', () => {
  it('devuelve el fondo de cada tema para theme-color', () => {
    expect(themeColors()).toEqual({ light: '#FFFFFF', dark: '#121826' });
  });
});
