export type SpaceStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Escala de 4 px. */
export const space: Record<SpaceStep, number> = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
};

export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  full: number;
}

export const radius: RadiusTokens = { sm: 6, md: 12, lg: 20, full: 9999 };

export interface MotionTokens {
  fast: number;
  base: number;
  slow: number;
}

/** Duraciones en ms. Con «reducir movimiento» se sustituyen por fundidos. */
export const motion: MotionTokens = { fast: 120, base: 200, slow: 320 };

/** Puntos de corte de `docs/style-guide.md` §4. */
export const breakpoints = { medium: 600, expanded: 1024 } as const;

/** Objetivo táctil mínimo (pt) de `docs/style-guide.md` §4. */
export const touchTarget = 44;

/** Grosores de borde y de anillo de foco. */
export const borderWidth = { thin: 1, thick: 2 } as const;

/** Anchos máximos de contenido (px): lectura y tarjeta de descubrimiento. */
export const contentMaxWidth = { reading: 720, card: 480 } as const;

/** Opacidad de los controles deshabilitados. */
export const disabledOpacity = 0.5;
