import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';

import type {
  Exclusive,
  ExpiredChat,
  ExpiredChatStore,
  RetentionScope,
  RetentionUnitOfWork,
  WaitlistPurgeStore,
} from '../../../application/retention/retention-purge.js';
import type { Database, Executor } from './database.js';
import { DrizzleAuditLog } from './drizzle-audit-log.js';
import { matches, waitlist } from './schema.js';

/** Clave del bloqueo consultivo de la purga de retención: solo una instancia purga a la vez. */
export const RETENTION_LOCK_KEY = 7_203_011;

/** Los matches cerrados cuyo chat ha superado el plazo de conservación. */
export class DrizzleExpiredChats implements ExpiredChatStore {
  constructor(private readonly db: Executor) {}

  async findExpired(cutoff: Date, limit: number): Promise<ExpiredChat[]> {
    return this.db
      .select({ matchId: matches.id, chatId: matches.chatId })
      .from(matches)
      .where(
        and(
          eq(matches.status, 'closed'),
          isNull(matches.chatPurgedAt),
          lt(matches.closedAt, cutoff),
        ),
      )
      .orderBy(asc(matches.closedAt), asc(matches.id))
      .limit(limit);
  }

  async markPurged(matchId: string, at: Date): Promise<void> {
    await this.db.update(matches).set({ chatPurgedAt: at }).where(eq(matches.id, matchId));
  }
}

/** Borrado de la lista de espera por retención. */
export class DrizzleWaitlistPurge implements WaitlistPurgeStore {
  constructor(private readonly db: Executor) {}

  async deleteAll(): Promise<number> {
    const deleted = await this.db.delete(waitlist).returning({ id: waitlist.id });
    return deleted.length;
  }
}

/**
 * Una transacción de PostgreSQL con `pg_try_advisory_xact_lock`: el bloqueo vive lo que la
 * transacción (no queda colgado de una conexión del pool) y, si otra instancia lo tiene, no se
 * ejecuta nada. La purga y su entrada de auditoría se confirman juntas.
 */
export class DrizzleRetentionUnitOfWork implements RetentionUnitOfWork {
  constructor(private readonly db: Database) {}

  runExclusive<T>(work: (scope: RetentionScope) => Promise<T>): Promise<Exclusive<T>> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(${RETENTION_LOCK_KEY}) AS locked`,
      );
      if (rows[0]?.locked !== true) return { ran: false } as const;
      const value = await work({
        chats: new DrizzleExpiredChats(tx),
        waitlist: new DrizzleWaitlistPurge(tx),
        audit: new DrizzleAuditLog(tx),
      });
      return { ran: true, value } as const;
    });
  }
}
