import type {
  DecisionStore,
  DecisionUnitOfWork,
} from '../../../application/decision/decision-repository.js';
import type { Database } from './database.js';
import { DrizzleDecisionStore } from './drizzle-decision-store.js';

/** Una transacción de PostgreSQL: el almacén de decisiones comparte la misma conexión. */
export class DrizzleDecisionUnitOfWork implements DecisionUnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: (store: DecisionStore) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(new DrizzleDecisionStore(tx)));
  }
}
