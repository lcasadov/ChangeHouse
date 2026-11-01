import type {
  BlockScope,
  BlockUnitOfWork,
} from '../../../application/moderation/block-repository.js';
import type { Database } from './database.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleBlockRepository } from './drizzle-block-repository.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';
import { DrizzleOutboxWriter } from './drizzle-outbox.js';

/**
 * Una transacción de PostgreSQL: el bloqueo, el cierre de los matches entre ambos, su auditoría y
 * sus avisos comparten la misma conexión y se confirman juntos.
 */
export class DrizzleBlockUnitOfWork implements BlockUnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: (scope: BlockScope) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        blocks: new DrizzleBlockRepository(tx),
        matches: new DrizzleMatchRepository(tx),
        audit: new DrizzleAuditLog(tx),
        outbox: new DrizzleOutboxWriter(tx),
      }),
    );
  }
}
