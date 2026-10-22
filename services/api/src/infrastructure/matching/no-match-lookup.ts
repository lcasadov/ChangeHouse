import type { MatchLookup } from '../../application/decision/decision-repository.js';

/**
 * Consulta de matches provisional: todavía no se forman (llegan con `add-direct-match`, que la
 * sustituye), así que ningún me gusta forma parte de uno.
 */
export class NoMatchLookup implements MatchLookup {
  isLikeInMatch(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
