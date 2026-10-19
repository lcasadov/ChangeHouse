import type { ModerationScope, UnitOfWork } from '../../../application/moderation/unit-of-work.js';
import type { AddressCipher } from '../../crypto/address-cipher.js';
import type { Database } from './database.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';

/** Una transacción de PostgreSQL: los repositorios del `scope` comparten la misma conexión. */
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: Database,
    private readonly cipher: AddressCipher,
  ) {}

  run<T>(work: (scope: ModerationScope) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({ homes: new DrizzleHomeRepository(tx, this.cipher), audit: new DrizzleAuditLog(tx) }),
    );
  }
}
