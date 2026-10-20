import type {
  MatchScope,
  MatchUnitOfWork,
} from '../../../application/matching/match-unit-of-work.js';
import type { Database } from './database.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';

/**
 * Una transacción de PostgreSQL: las decisiones sobre un match y su registro de auditoría comparten
 * la misma conexión, de modo que una retirada y su entrada de auditoría se confirman juntas.
 */
export class DrizzleMatchUnitOfWork implements MatchUnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: (scope: MatchScope) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({ matches: new DrizzleMatchRepository(tx), audit: new DrizzleAuditLog(tx) }),
    );
  }
}
