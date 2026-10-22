import type {
  DecisionStore,
  DecisionUnitOfWork,
} from '../../../application/decision/decision-repository.js';
import type { MatchingTransaction } from '../../../application/matching/matching-repository.js';
import type { Database } from './database.js';
import { DrizzleCycleCandidates } from './drizzle-cycle-candidates.js';
import { DrizzleDecisionStore } from './drizzle-decision-store.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';

/**
 * Una transacción de PostgreSQL (`READ COMMITTED`): el almacén de decisiones, la búsqueda de ciclos
 * y la creación de matches comparten la misma conexión.
 */
export class DrizzleDecisionUnitOfWork implements DecisionUnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: (store: DecisionStore, matching: MatchingTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work(new DrizzleDecisionStore(tx), {
        cycles: new DrizzleCycleCandidates(tx),
        matches: new DrizzleMatchRepository(tx),
      }),
    );
  }
}
