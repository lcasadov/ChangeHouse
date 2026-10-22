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

/** Puerto de salida: ejecuta el trabajo en una transacción; si falla, nada queda confirmado. */
export interface DecisionUnitOfWork {
  run<T>(work: (store: DecisionStore) => Promise<T>): Promise<T>;
}

/** Puerto de salida: ¿este me gusta forma parte de un match? Lo implementa `add-direct-match`. */
export interface MatchLookup {
  isLikeInMatch(fromHomeId: string, toHomeId: string): Promise<boolean>;
}
