import type { Theme } from './theme.js';
import {
  borderWidth,
  contentMaxWidth,
  disabledOpacity,
  FONT_FALLBACK_STACK,
  touchTarget,
} from './tokens/index.js';

/** `Object.entries` con el tipo de valor del objeto (la firma estándar devuelve `any` para interfaces). */
const entries = <T extends object>(value: T): Array<[string, T[keyof T]]> =>
  Object.entries(value) as Array<[string, T[keyof T]]>;

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Propiedades CSS personalizadas de un tema (`--color-bg`, `--space-4`, `--font-title-size`…),
 * para la landing y cualquier superficie web. Solo cambian los valores entre temas.
 */
export function themeToCssVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of entries(theme.color)) {
    vars[`--color-${kebab(name)}`] = value;
  }
  for (const [role, token] of Object.entries(theme.font)) {
    const prefix = `--font-${kebab(role)}`;
    vars[`${prefix}-size`] = `${token.size}px`;
    vars[`${prefix}-line-height`] = `${token.lineHeight}px`;
    vars[`${prefix}-weight`] = String(token.weight);
  }
  vars['--touch-target'] = `${touchTarget}px`;
  vars['--disabled-opacity'] = String(disabledOpacity);
  for (const [name, value] of Object.entries(borderWidth)) vars[`--border-${name}`] = `${value}px`;
  for (const [name, value] of Object.entries(contentMaxWidth)) {
    vars[`--content-max-${name}`] = `${value}px`;
  }
  vars['--font-family'] = `Inter, ${FONT_FALLBACK_STACK}`;
  for (const [step, value] of Object.entries(theme.space)) vars[`--space-${step}`] = `${value}px`;
  for (const [name, value] of Object.entries(theme.radius)) vars[`--radius-${name}`] = `${value}px`;
  for (const [name, value] of Object.entries(theme.motion)) vars[`--motion-${name}`] = `${value}ms`;
  for (const [level, token] of Object.entries(theme.elevation)) {
    vars[`--elevation-${level}-shadow`] = token.boxShadow;
    vars[`--elevation-${level}-surface`] = token.surface;
    vars[`--elevation-${level}-border-width`] = `${token.borderWidth}px`;
    vars[`--elevation-${level}-border-color`] = token.borderColor;
  }
  return vars;
}
