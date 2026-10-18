/**
 * Marcador de los tokens de diseño. Los valores reales (temas claro y oscuro)
 * se definen en la tarea de design system a partir de `docs/style-guide.md`.
 */
export const tokens = {
  themes: ['light', 'dark'],
} as const;

export type Tokens = typeof tokens;
