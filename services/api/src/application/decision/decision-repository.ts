import type { MatchingTransaction } from '../matching/matching-repository.js';

/** Desde dónde se decide: una vivienda propia o, para un `seeker` sin vivienda, la cuenta. */
export type DecisionOrigin =
  | { readonly kind: 'home'; readonly homeId: string }
  | { readonly kind: 'account'; readonly userId: string };

/** La última decisión de un origen: un me gusta (solo desde una vivienda) o un descarte. */
export interface LastAction {
  readonly kind: 'like' | 'dismissal';
  readonly targetHomeId: string;
  readonly at: Date;
}

/**
 * Puerto de salida: las decisiones de un usuario, siempre dentro de la transacción que abre
 * `DecisionUnitOfWork`.
 */
export interface DecisionStore {
  /** Serializa hasta el final de la transacción las decisiones de este usuario (límite diario). */
  lockUser(userId: string): Promise<void>;
  /**
   * Serializa hasta el final de la transacción las decisiones sobre un par de viviendas (su clave
   * canónica): dos me gusta cruzados simultáneos no se pierden el uno al otro y un deshacer no se
   * cruza con el match que usa ese me gusta. Se toma siempre después de `lockUser`.
   */
  lockPair(pairKey: string): Promise<void>;
  /** Me gusta dados desde las viviendas del usuario en `[start, end)`. */
  countLikes(userId: string, start: Date, end: Date): Promise<number>;
  likeExists(fromHomeId: string, toHomeId: string): Promise<boolean>;
  insertLike(fromHomeId: string, toHomeId: string, at: Date): Promise<void>;
  deleteLike(fromHomeId: string, toHomeId: string): Promise<void>;
  /** Registra el descarte o, si ya existía, renueva su fecha (idempotente). */
  saveDismissal(origin: DecisionOrigin, targetHomeId: string, at: Date): Promise<void>;
  deleteDismissal(origin: DecisionOrigin, targetHomeId: string): Promise<void>;
  /** La más reciente entre los me gusta y los descartes del origen; `null` si no hay ninguna. */
  lastAction(origin: DecisionOrigin): Promise<LastAction | null>;
}

/**
 * Puerto de salida: ejecuta el trabajo en una transacción; si falla, nada queda confirmado. Las
 * decisiones y la detección y creación de matches comparten la misma transacción.
 */
export interface DecisionUnitOfWork {
  run<T>(work: (store: DecisionStore, matching: MatchingTransaction) => Promise<T>): Promise<T>;
}

/** Puerto de salida: ¿este me gusta forma parte de un match no cerrado? */
export interface MatchLookup {
  isLikeInMatch(fromHomeId: string, toHomeId: string): Promise<boolean>;
}
