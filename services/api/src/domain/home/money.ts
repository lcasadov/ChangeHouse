import { InvalidValueRangeError } from './errors.js';

/** Importe en céntimos de euro: entero, seguro y no negativo (`Money` del contrato). */
export type Money = number;

const isCents = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

const isPositiveCents = (value: Money | null): boolean =>
  value === null || (isCents(value) && value > 0);

/**
 * Comprueba el rango de valor de una vivienda: mínimo > 0 y mínimo <= máximo. Admite un rango a
 * medio rellenar (borrador): cada extremo ausente (`null`) se omite, pero uno presente ya ha de
 * ser un importe positivo.
 */
export function assertValueRange(min: Money | null, max: Money | null): void {
  const inverted = min !== null && max !== null && min > max;
  if (!isPositiveCents(min) || !isPositiveCents(max) || inverted) {
    throw new InvalidValueRangeError();
  }
}
