const HEX_COLOR = /^#([0-9a-f]{6})$/i;
const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.03928;

function linearize(channel: number): number {
  const c = channel / CHANNEL_MAX;
  return c <= LINEAR_THRESHOLD ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa según WCAG 2.2. Solo acepta colores `#RRGGBB`. */
export function relativeLuminance(hex: string): number {
  const match = HEX_COLOR.exec(hex);
  if (!match?.[1]) throw new Error(`Color no válido: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  const r = linearize((value >> 16) & CHANNEL_MAX);
  const g = linearize((value >> 8) & CHANNEL_MAX);
  const b = linearize(value & CHANNEL_MAX);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores `#RRGGBB` (de 1 a 21). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
