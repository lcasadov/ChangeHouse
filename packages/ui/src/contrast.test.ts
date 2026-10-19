import { describe, expect, it } from 'vitest';

import { contrastRatio, relativeLuminance } from './contrast.js';
import type { ThemeName } from './theme.js';
import { themes } from './theme.js';
import type { ColorTokens } from './tokens/index.js';

const MIN_TEXT_CONTRAST = 4.5;

type ColorKey = keyof ColorTokens;

/** Pares texto/fondo de `docs/style-guide.md` §1 (contraste calculado sobre `color.bg`). */
const PAIRS: ReadonlyArray<readonly [foreground: ColorKey, background: ColorKey]> = [
  ['text', 'bg'],
  ['textMuted', 'bg'],
  ['textOnPrimary', 'primary'],
  ['primary', 'bg'],
  ['primaryPressed', 'bg'],
  ['secondary', 'bg'],
  ['focus', 'bg'],
  ['success', 'bg'],
  ['warning', 'bg'],
  ['danger', 'bg'],
  ['compensationReceive', 'bg'],
  ['compensationPay', 'bg'],
  ['compensationEven', 'bg'],
  // Superficies sobre las que también se pinta texto
  ['text', 'surface'],
  ['textMuted', 'surface'],
  ['text', 'surfaceMuted'],
  ['primary', 'surface'],
];

describe('contraste WCAG 2.2', () => {
  describe.each<ThemeName>(['light', 'dark'])('tema %s', (name) => {
    const { color } = themes[name];

    it.each(PAIRS)('%s sobre %s alcanza 4,5:1', (foreground, background) => {
      expect(contrastRatio(color[foreground], color[background])).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
    });
  });

  it('reproduce el contraste calculado de la guía para el texto principal en claro', () => {
    expect(contrastRatio(themes.light.color.text, themes.light.color.bg)).toBeCloseTo(11.4, 0);
  });
});

describe('contrastRatio', () => {
  it('vale 21 entre negro y blanco y 1 entre iguales', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('es simétrico', () => {
    expect(contrastRatio('#C8323E', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#C8323E'),
      10,
    );
  });

  it('rechaza colores que no son #RRGGBB', () => {
    expect(() => relativeLuminance('rgba(0,0,0,0.5)')).toThrow('Color no válido');
    expect(() => relativeLuminance('#FFF')).toThrow('Color no válido');
  });
});

describe('contraste de los bordes de controles (WCAG 1.4.11)', () => {
  it.each(['light', 'dark'] as const)(
    'borderStrong alcanza 3:1 sobre bg y surface en %s',
    (name) => {
      const { color } = themes[name];
      expect(contrastRatio(color.borderStrong, color.bg)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color.borderStrong, color.surface)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe('texto sobre fotos', () => {
  it.each(['light', 'dark'] as const)(
    'textOnPhoto alcanza 4,5:1 sobre el tramo final del degradado aun con una foto blanca en %s',
    (name) => {
      const { color } = themes[name];
      // 0,72 de negro sobre blanco: el peor caso de fondo bajo el degradado
      const WHITE_PHOTO_UNDER_SCRIM = '#474747';
      expect(color.photoScrimEnd).toBe('rgba(0,0,0,0.72)');
      expect(contrastRatio(color.textOnPhoto, WHITE_PHOTO_UNDER_SCRIM)).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
    },
  );
});
