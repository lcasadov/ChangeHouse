/** Tokens de color de `docs/style-guide.md` §1. Los temas solo cambian valores, nunca nombres. */
export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  /** Texto sobre fotos, con el degradado `photoScrim*` debajo; blanco en los dos temas. */
  textOnPhoto: string;
  primary: string;
  primaryPressed: string;
  /** Logotipo e ilustración; nunca texto. */
  brand: string;
  secondary: string;
  border: string;
  /** Borde de controles (campos, casillas): ≥ 3:1 sobre `bg` y `surface` (WCAG 1.4.11). */
  borderStrong: string;
  focus: string;
  success: string;
  warning: string;
  danger: string;
  compensationReceive: string;
  compensationPay: string;
  compensationEven: string;
  /** Degradado de los momentos de match (no textual). */
  matchGradientStart: string;
  matchGradientEnd: string;
  /** Degradado inferior sobre fotos para texto blanco. */
  photoScrimStart: string;
  photoScrimEnd: string;
  overlay: string;
}

const BRAND = '#E8505B';
const TEXT_ON_PHOTO = '#FFFFFF';
const MATCH_GRADIENT_END = '#F472B6';
const PHOTO_SCRIM_START = 'rgba(0,0,0,0)';
const PHOTO_SCRIM_END = 'rgba(0,0,0,0.72)';

export const lightColors: ColorTokens = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#FDEEEF',
  text: '#3A3A3A',
  textMuted: '#5A6672',
  textOnPrimary: '#FFFFFF',
  textOnPhoto: TEXT_ON_PHOTO,
  primary: '#C8323E',
  primaryPressed: '#B42A35',
  brand: BRAND,
  secondary: '#1F2A44',
  border: '#D9DDE3',
  borderStrong: '#7A8594',
  focus: '#1D4ED8',
  success: '#1E7D4F',
  warning: '#B54708',
  danger: '#B42A35',
  compensationReceive: '#1E7D4F',
  compensationPay: '#C8323E',
  compensationEven: '#1D4ED8',
  matchGradientStart: BRAND,
  matchGradientEnd: MATCH_GRADIENT_END,
  photoScrimStart: PHOTO_SCRIM_START,
  photoScrimEnd: PHOTO_SCRIM_END,
  overlay: 'rgba(18,24,38,0.5)',
};

export const darkColors: ColorTokens = {
  bg: '#121826',
  surface: '#1A1F2B',
  surfaceMuted: '#232A38',
  text: '#E6E8EC',
  textMuted: '#8A94A3',
  textOnPrimary: '#121826',
  textOnPhoto: TEXT_ON_PHOTO,
  primary: '#FF7A84',
  primaryPressed: '#FF959D',
  brand: BRAND,
  secondary: '#A9B1BD',
  border: '#2E3646',
  borderStrong: '#8A94A3',
  focus: '#3B82F6',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#FF7A84',
  compensationReceive: '#4ADE80',
  compensationPay: '#FF7A84',
  compensationEven: '#3B82F6',
  matchGradientStart: BRAND,
  matchGradientEnd: MATCH_GRADIENT_END,
  photoScrimStart: PHOTO_SCRIM_START,
  photoScrimEnd: PHOTO_SCRIM_END,
  overlay: 'rgba(0,0,0,0.6)',
};
