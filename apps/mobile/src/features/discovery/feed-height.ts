import { space } from '@changehouse/ui';

/** Por debajo de esto la foto y los datos de la tarjeta dejan de leerse bien. */
const MIN_LEGIBLE = space[8] * 4;
/** Por encima no gana nada: la tarjeta ya llega a su ancho máximo. */
const MAX_USEFUL = space[8] * 6;
/** La tarjeta toma como mínimo esta parte del alto de la ventana; el resto es para los controles. */
const SHARE_OF_WINDOW = 0.45;

/**
 * Alto mínimo de la zona de tarjetas en «Explorar». Con flex ocupa lo que quede libre; este mínimo
 * solo evita que se aplaste, sin empujar los botones de decisión fuera de la pantalla.
 */
export function feedMinHeight(windowHeight: number): number {
  return Math.min(MAX_USEFUL, Math.max(MIN_LEGIBLE, Math.round(windowHeight * SHARE_OF_WINDOW)));
}
