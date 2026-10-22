import type { Decision } from './decision-model';

/** Basta arrastrar la tarjeta esta fracción de su ancho para decidir. */
export const SWIPE_DISTANCE_RATIO = 0.3;

/** O lanzarla más rápido que esto (puntos por segundo): un gesto corto pero decidido también vale. */
export const SWIPE_VELOCITY = 800;

export interface SwipeState {
  translationX: number;
  velocityX: number;
  /** Ancho de la tarjeta; 0 mientras no se conoce. */
  width: number;
}

/**
 * Qué decide un deslizamiento al soltar: «me gusta» a la derecha, «descartar» a la izquierda, o
 * nada si no llega al umbral. Un lanzamiento rápido hacia el lado contrario al desplazamiento es
 * un arrepentimiento, no una decisión. Se ejecuta en el hilo de la interfaz, de ahí el `worklet`.
 */
export function swipeOutcome({ translationX, velocityX, width }: SwipeState): Decision | null {
  'worklet';
  const far = width > 0 && Math.abs(translationX) >= width * SWIPE_DISTANCE_RATIO;
  const fast =
    Math.abs(velocityX) >= SWIPE_VELOCITY && translationX !== 0 && translationX * velocityX > 0;
  if (!far && !fast) return null;
  return translationX > 0 ? 'like' : 'dismiss';
}

/**
 * Cuánto falta para decidir, de -1 (descartar) a 1 (me gusta): 0 con la tarjeta quieta y 1 en el
 * umbral. Mueve los sellos y marca el instante de la háptica.
 */
export function swipeProgress(translationX: number, width: number): number {
  'worklet';
  if (width <= 0) return 0;
  return Math.max(-1, Math.min(1, translationX / (width * SWIPE_DISTANCE_RATIO)));
}
