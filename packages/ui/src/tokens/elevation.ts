import type { ColorTokens } from './color.js';

export type ElevationLevel = 0 | 1 | 2 | 3;

export interface ElevationToken {
  /** Color de superficie del nivel (en oscuro, más claro cuanto más alto). */
  surface: string;
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  /** `elevation` de Android. */
  androidElevation: number;
  /** `box-shadow` de la web, derivado de los mismos números. */
  boxShadow: string;
  borderWidth: number;
  borderColor: string;
}

const SHADOW_RGB = '0,0,0';
const NO_BORDER = 'transparent';

interface ShadowSpec {
  y: number;
  blur: number;
  opacity: number;
  android: number;
}

const lightShadows: Record<1 | 2 | 3, ShadowSpec> = {
  1: { y: 1, blur: 3, opacity: 0.08, android: 2 },
  2: { y: 4, blur: 12, opacity: 0.12, android: 6 },
  3: { y: 12, blur: 28, opacity: 0.18, android: 12 },
};

const flat = (surface: string, borderWidth: number, borderColor: string): ElevationToken => ({
  surface,
  shadowColor: `rgb(${SHADOW_RGB})`,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  androidElevation: 0,
  boxShadow: 'none',
  borderWidth,
  borderColor,
});

const shadowed = (surface: string, spec: ShadowSpec): ElevationToken => ({
  surface,
  shadowColor: `rgb(${SHADOW_RGB})`,
  shadowOffset: { width: 0, height: spec.y },
  shadowOpacity: spec.opacity,
  shadowRadius: spec.blur,
  androidElevation: spec.android,
  boxShadow: `0 ${spec.y}px ${spec.blur}px rgba(${SHADOW_RGB},${spec.opacity})`,
  borderWidth: 0,
  borderColor: NO_BORDER,
});

/** Claro: sombras. */
export const lightElevation = (color: ColorTokens): Record<ElevationLevel, ElevationToken> => ({
  0: flat(color.surface, 0, NO_BORDER),
  1: shadowed(color.surface, lightShadows[1]),
  2: shadowed(color.surface, lightShadows[2]),
  3: shadowed(color.surface, lightShadows[3]),
});

/** Oscuro: bordes y superficies más claras en lugar de sombras. */
export const darkElevation = (color: ColorTokens): Record<ElevationLevel, ElevationToken> => ({
  0: flat(color.surface, 0, NO_BORDER),
  1: flat(color.surface, 1, color.border),
  2: flat(color.surfaceMuted, 1, color.border),
  3: flat(color.border, 1, color.border),
});
