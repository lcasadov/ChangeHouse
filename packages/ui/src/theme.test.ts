import { describe, expect, it } from 'vitest';

import { resolveThemeName, themes } from './theme.js';
import { darkColors, lightColors } from './tokens/index.js';

const keysOf = (value: object): string[] => Object.keys(value).sort();

describe('themes', () => {
  it('claro y oscuro exponen exactamente las mismas claves en cada categoría', () => {
    expect(keysOf(themes.dark)).toEqual(keysOf(themes.light));
    expect(keysOf(themes.dark.color)).toEqual(keysOf(themes.light.color));
    expect(keysOf(themes.dark.font)).toEqual(keysOf(themes.light.font));
    expect(keysOf(themes.dark.space)).toEqual(keysOf(themes.light.space));
    expect(keysOf(themes.dark.radius)).toEqual(keysOf(themes.light.radius));
    expect(keysOf(themes.dark.elevation)).toEqual(keysOf(themes.light.elevation));
    expect(keysOf(themes.dark.motion)).toEqual(keysOf(themes.light.motion));
    expect(keysOf(themes.dark.elevation[1])).toEqual(keysOf(themes.light.elevation[1]));
  });

  it('declara todos los tokens de color de la guía de estilo', () => {
    expect(keysOf(lightColors)).toEqual(
      [
        'bg',
        'surface',
        'surfaceMuted',
        'text',
        'textMuted',
        'textOnPrimary',
        'textOnPhoto',
        'primary',
        'primaryPressed',
        'brand',
        'secondary',
        'border',
        'borderStrong',
        'focus',
        'success',
        'warning',
        'danger',
        'compensationReceive',
        'compensationPay',
        'compensationEven',
        'matchGradientStart',
        'matchGradientEnd',
        'photoScrimStart',
        'photoScrimEnd',
        'overlay',
      ].sort(),
    );
  });

  it('cada token de color es un hexadecimal o un rgb(a) válido', () => {
    for (const color of [
      ...(Object.values(lightColors) as string[]),
      ...(Object.values(darkColors) as string[]),
    ]) {
      expect(color).toMatch(/^(#[0-9A-F]{6}|rgba?\(.+\))$/);
    }
  });

  it('usa los valores de la guía en ambos temas', () => {
    expect(themes.light.color.primary).toBe('#C8323E');
    expect(themes.dark.color.primary).toBe('#FF7A84');
    expect(themes.light.color.bg).toBe('#FFFFFF');
    expect(themes.dark.color.bg).toBe('#121826');
    expect(themes.light.color.brand).toBe(themes.dark.color.brand);
    expect(themes.light.color.matchGradientEnd).toBe('#F472B6');
  });

  it('define tipografía, espaciado, radios y movimiento de la guía', () => {
    expect(themes.light.font.title).toMatchObject({ size: 24, lineHeight: 32, weight: 700 });
    expect(themes.light.font.body).toMatchObject({ size: 16, lineHeight: 24, weight: 400 });
    expect(themes.light.font.display.family).toBe('Inter_700Bold');
    expect(themes.light.space[1]).toBe(4);
    expect(themes.light.space[8]).toBe(64);
    expect(themes.light.radius).toEqual({ sm: 6, md: 12, lg: 20, full: 9999 });
    expect(themes.light.motion).toEqual({ fast: 120, base: 200, slow: 320 });
  });

  it('en claro la elevación usa sombra y en oscuro borde en su lugar', () => {
    const light = themes.light.elevation;
    const dark = themes.dark.elevation;
    expect(light[0].boxShadow).toBe('none');
    expect(light[1].shadowOpacity).toBeGreaterThan(0);
    expect(light[1].boxShadow).toMatch(/^0 \d+px \d+px rgba\(/);
    expect(light[3].androidElevation).toBeGreaterThan(light[1].androidElevation);
    expect(dark[1].shadowOpacity).toBe(0);
    expect(dark[1].borderWidth).toBe(1);
    expect(dark[1].borderColor).toBe(themes.dark.color.border);
    expect(dark[2].surface).toBe(themes.dark.color.surfaceMuted);
  });
});

describe('resolveThemeName', () => {
  it('sigue el esquema del sistema por defecto', () => {
    expect(resolveThemeName('dark')).toBe('dark');
    expect(resolveThemeName('light', 'system')).toBe('light');
  });

  it('cae al tema claro si el sistema no informa esquema', () => {
    expect(resolveThemeName(null)).toBe('light');
    expect(resolveThemeName(undefined, 'system')).toBe('light');
  });

  it('una preferencia explícita gana al sistema', () => {
    expect(resolveThemeName('dark', 'light')).toBe('light');
    expect(resolveThemeName('light', 'dark')).toBe('dark');
  });
});

describe('constantes de layout', () => {
  it('declara objetivo táctil, grosores, anchos máximos y opacidad de la guía', async () => {
    const tokens = await import('./tokens/index.js');
    expect(tokens.touchTarget).toBe(44);
    expect(tokens.borderWidth).toEqual({ thin: 1, thick: 2 });
    expect(tokens.contentMaxWidth).toEqual({ reading: 720, card: 480 });
    expect(tokens.breakpoints).toEqual({ medium: 600, expanded: 1024 });
    expect(tokens.disabledOpacity).toBe(0.5);
  });
});
