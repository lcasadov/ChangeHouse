import type {
  AccountDeletionScope,
  AccountDeletionUnitOfWork,
} from '../../../application/account/account-deletion.js';
import type { AddressCipher } from '../../crypto/address-cipher.js';
import type { Database } from './database.js';
import { DrizzleAccountDeletionStore } from './drizzle-account-deletion.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';
import { DrizzleOutboxWriter } from './drizzle-outbox.js';

/**
 * Una transacción de PostgreSQL para eliminar la cuenta: usuario, viviendas, matches, auditoría y
 * outbox comparten conexión, de modo que o se confirma todo o no cambia nada.
 */
export class DrizzleAccountDeletionUnitOfWork implements AccountDeletionUnitOfWork {
  constructor(
    private readonly db: Database,
    private readonly cipher: AddressCipher,
  ) {}

  run<T>(work: (scope: AccountDeletionScope) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        accounts: new DrizzleAccountDeletionStore(tx),
        homes: new DrizzleHomeRepository(tx, this.cipher),
        matches: new DrizzleMatchRepository(tx),
        audit: new DrizzleAuditLog(tx),
        outbox: new DrizzleOutboxWriter(tx),
      }),
    );
  }
}
