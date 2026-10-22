import type { HomeStatus } from '@changehouse/shared';

import type { Money } from '../home/money.js';
import { referenceValue } from './compensation.js';

/** Un match une dos viviendas (directo) o tres (cadena); no se buscan ciclos más largos (README §11). */
export const MIN_CYCLE_LENGTH = 2;
export const MAX_CYCLE_LENGTH = 3;

/** Separador de la clave canónica: no aparece en un UUID. */
const KEY_SEPARATOR = ':';

/** Límites de compensación de las preferencias efectivas del propietario de una vivienda (RN-03). */
export interface CompensationTerms {
  readonly maxToPayCents: Money;
  readonly minToReceiveCents: Money;
  /** 0 = mínimo, 100 = máximo del rango de valor de la vivienda. */
  readonly valueReferencePct: number;
}

/** Una vivienda de un ciclo candidato, con su estado y sus límites leídos dentro de la transacción. */
export interface CycleHome {
  readonly homeId: string;
  readonly ownerId: string;
  readonly status: HomeStatus;
  readonly valueMinCents: Money | null;
  readonly valueMaxCents: Money | null;
  /** `null` si el propietario no tiene preferencias que valgan para esta vivienda. */
  readonly terms: CompensationTerms | null;
}

/** Lo que entrega y recibe cada participante, y su compensación: positiva, paga; negativa, recibe. */
export interface CycleParticipant {
  readonly homeId: string;
  readonly userId: string;
  readonly givesHomeId: string;
  readonly receivesHomeId: string;
  readonly compensationCents: number;
}

export type CycleType = 2 | 3;

/** Un ciclo aceptado, listo para guardarse como match. */
export interface AcceptedCycle {
  readonly type: CycleType;
  readonly cycleKey: string;
  readonly participants: readonly CycleParticipant[];
}

/** Por qué no se forma el match: ciclo mal formado, vivienda no publicada, sin valor o límites, o RN-03. */
export type CycleRejection = 'invalid_cycle' | 'not_published' | 'missing_terms' | 'incompatible';

export type CycleEvaluation =
  | { readonly accepted: true; readonly match: AcceptedCycle }
  | { readonly accepted: false; readonly reason: CycleRejection };

/** Una vivienda ya valorada con el punto de referencia de su propietario. */
interface ValuedHome {
  readonly home: CycleHome;
  readonly terms: CompensationTerms;
  readonly valueCents: Money;
}

/**
 * Clave canónica de un conjunto de viviendas: sus identificadores ordenados y unidos. Es la misma
 * para cualquier rotación u orden del ciclo, de modo que el mismo conjunto no forma dos matches.
 */
export function cycleKey(homeIds: readonly string[]): string {
  return [...homeIds].sort().join(KEY_SEPARATOR);
}

/** Las viviendas de una clave canónica, en su orden (el inverso de `cycleKey`). */
export function homeIdsOfKey(key: string): string[] {
  return key.split(KEY_SEPARATOR);
}

/** Entre 2 y 3 viviendas distintas, cada una de un propietario distinto: nadie ocupa dos eslabones. */
function isWellFormed(cycle: readonly CycleHome[]): boolean {
  const ids = new Set(cycle.map((home) => home.homeId));
  const owners = new Set(cycle.map((home) => home.ownerId));
  return (
    cycle.length >= MIN_CYCLE_LENGTH &&
    cycle.length <= MAX_CYCLE_LENGTH &&
    ids.size === cycle.length &&
    owners.size === cycle.length
  );
}

function valued(home: CycleHome): ValuedHome | null {
  const { terms, valueMinCents, valueMaxCents } = home;
  if (terms === null || valueMinCents === null || valueMaxCents === null) return null;
  const valueCents = referenceValue({
    valueMinCents,
    valueMaxCents,
    valueReferencePct: terms.valueReferencePct,
  });
  return { home, terms, valueCents };
}

/** RN-03 para un participante: quien paga no supera su máximo; quien recibe obtiene su mínimo. */
function withinLimits(compensationCents: number, terms: CompensationTerms): boolean {
  if (compensationCents > 0) return compensationCents <= terms.maxToPayCents;
  if (compensationCents < 0) return -compensationCents >= terms.minToReceiveCents;
  return true;
}

/**
 * Valida un ciclo candidato y calcula el match. El ciclo es una lista ordenada en la que cada
 * vivienda dio «Me gusta» a la siguiente y la última a la primera: cada propietario entrega su
 * vivienda y recibe la siguiente, con compensación = valor recibido − valor entregado (la suma es 0,
 * RN-04). Todas deben estar publicadas y la compensación ha de ser aceptable para todos (RN-03).
 */
export function evaluateCycle(cycle: readonly CycleHome[]): CycleEvaluation {
  if (!isWellFormed(cycle)) return { accepted: false, reason: 'invalid_cycle' };
  if (cycle.some((home) => home.status !== 'published')) {
    return { accepted: false, reason: 'not_published' };
  }
  const homes = cycle.map(valued);
  if (homes.some((home) => home === null)) return { accepted: false, reason: 'missing_terms' };
  const sides = homes as ValuedHome[];

  const participants = sides.map((gives, index): CycleParticipant => {
    const receives = sides[(index + 1) % sides.length] ?? gives;
    return {
      homeId: gives.home.homeId,
      userId: gives.home.ownerId,
      givesHomeId: gives.home.homeId,
      receivesHomeId: receives.home.homeId,
      compensationCents: receives.valueCents - gives.valueCents,
    };
  });
  const acceptable = participants.every((participant, index) => {
    const terms = sides[index]?.terms;
    return terms !== undefined && withinLimits(participant.compensationCents, terms);
  });
  if (!acceptable) return { accepted: false, reason: 'incompatible' };
  return {
    accepted: true,
    match: {
      type: cycle.length as CycleType,
      cycleKey: cycleKey(cycle.map((home) => home.homeId)),
      participants,
    },
  };
}
