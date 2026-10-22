import type { Money } from '../home/money.js';

/** Cómo se presenta la compensación al usuario: «Tú recibes», «Tú pagas» o «Cambio justo». */
export type CompensationKind = 'receive' | 'pay' | 'fair';

/** Compensación estimada desde el punto de vista del usuario; `amountCents` es siempre el importe exacto. */
export interface Compensation {
  readonly kind: CompensationKind;
  readonly amountCents: Money;
}

/** Rango de valor de una vivienda y el punto de ese rango con el que su propietario compensa (RN-03). */
export interface ValuedRange {
  readonly valueMinCents: Money;
  readonly valueMaxCents: Money;
  /** 0 = mínimo, 100 = máximo. */
  readonly valueReferencePct: number;
}

/** Un lado del intercambio: la vivienda valorada y los límites de compensación de su propietario. */
export interface ExchangeSide extends ValuedRange {
  readonly maxToPayCents: Money;
  readonly minToReceiveCents: Money;
}

const PERCENT = 100n;
const HALF_PERCENT = 50n;
/** Hasta este porcentaje del mayor de los dos valores, la diferencia se presenta como «Cambio justo». */
const FAIR_EXCHANGE_PCT = 1n;

/**
 * Valor de referencia de una vivienda: `min + pct · (max − min)`, en céntimos enteros con el medio
 * céntimo hacia arriba. Se calcula con enteros grandes para no perder precisión.
 */
export function referenceValue(range: ValuedRange): Money {
  const min = BigInt(range.valueMinCents);
  const spread = BigInt(range.valueMaxCents) - min;
  const offset = (spread * BigInt(range.valueReferencePct) + HALF_PERCENT) / PERCENT;
  return Number(min + offset);
}

/** Compensación del usuario: valor de la candidata menos el de la suya. Positiva, paga; negativa, recibe. */
export function compensationCents(mineCents: Money, theirsCents: Money): number {
  return theirsCents - mineCents;
}

/** «Cambio justo» si la diferencia no supera el 1 % del mayor valor; si no, quién paga y cuánto. */
export function classifyCompensation(mineCents: Money, theirsCents: Money): Compensation {
  const difference = compensationCents(mineCents, theirsCents);
  const amountCents = Math.abs(difference);
  const larger = BigInt(Math.max(mineCents, theirsCents));
  if (BigInt(amountCents) * PERCENT <= larger * FAIR_EXCHANGE_PCT) {
    return { kind: 'fair', amountCents };
  }
  return { kind: difference > 0 ? 'pay' : 'receive', amountCents };
}

/**
 * Aceptabilidad bilateral (RN-03): quien paga no supera su máximo a pagar y quien recibe obtiene al
 * menos su mínimo a recibir. Con el mismo valor no hay compensación y siempre es aceptable.
 */
export function isAcceptable(mine: ExchangeSide, theirs: ExchangeSide): boolean {
  const difference = compensationCents(referenceValue(mine), referenceValue(theirs));
  if (difference === 0) return true;
  const [payer, receiver] = difference > 0 ? [mine, theirs] : [theirs, mine];
  const amount = Math.abs(difference);
  return amount <= payer.maxToPayCents && amount >= receiver.minToReceiveCents;
}

/** La compensación del usuario si el intercambio es aceptable para los dos; si no, `null`. */
export function evaluateExchange(mine: ExchangeSide, theirs: ExchangeSide): Compensation | null {
  if (!isAcceptable(mine, theirs)) return null;
  return classifyCompensation(referenceValue(mine), referenceValue(theirs));
}
