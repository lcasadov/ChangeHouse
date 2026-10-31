import { eq } from 'drizzle-orm';

import type {
  SuspensionScope,
  SuspensionUnitOfWork,
  UserSuspensionStore,
} from '../../../application/moderation/user-suspension.js';
import type { User } from '../../../domain/account/user.js';
import type { Database, Executor } from './database.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { DrizzleMatchRepository } from './drizzle-match-repository.js';
import { users } from './schema.js';

/** El estado de suspensión de los usuarios en PostgreSQL, dentro de una transacción. */
export class DrizzleUserSuspensions implements UserSuspensionStore {
  constructor(private readonly db: Executor) {}

  async findForUpdate(id: string): Promise<User | null> {
    // Serializa dos decisiones simultáneas sobre el mismo usuario
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).for('update');
    return row ? { ...row } : null;
  }

  async saveSuspension(user: User): Promise<void> {
    await this.db
      .update(users)
      .set({ suspendedAt: user.suspendedAt, suspensionReason: user.suspensionReason })
      .where(eq(users.id, user.id));
  }
}

/**
 * Una transacción de PostgreSQL: la suspensión, el cierre de los matches y sus entradas de
 * auditoría comparten la misma conexión y se confirman juntos.
 */
export class DrizzleSuspensionUnitOfWork implements SuspensionUnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: (scope: SuspensionScope) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        users: new DrizzleUserSuspensions(tx),
        matches: new DrizzleMatchRepository(tx),
        audit: new DrizzleAuditLog(tx),
      }),
    );
  }
}
