export type FontRole =
  'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption';

export type FontWeight = 400 | 600 | 700 | 800;

export interface FontToken {
  /** Nombre de la familia Inter cargada con `expo-font` para este peso. */
  family: string;
  weight: FontWeight;
  size: number;
  lineHeight: number;
}

/** Familia Inter por peso, tal y como la registra `@expo-google-fonts/inter`. */
export const INTER_FAMILY: Record<FontWeight, string> = {
  400: 'Inter_400Regular',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
};

/** Respaldo cuando Inter no está disponible: la fuente del sistema. */
export const FONT_FALLBACK_STACK =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const font = (weight: FontWeight, size: number, lineHeight: number): FontToken => ({
  family: INTER_FAMILY[weight],
  weight,
  size,
  lineHeight,
});

export const fonts: Record<FontRole, FontToken> = {
  display: font(700, 40, 48),
  title: font(700, 24, 32),
  heading: font(600, 20, 28),
  body: font(400, 16, 24),
  bodyStrong: font(600, 16, 24),
  label: font(600, 14, 20),
  caption: font(400, 12, 16),
};
