import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type {
  NewOutboxEvent,
  OutboxProcessor,
  OutboxWriter,
  PendingOutboxEvent,
  ProcessSummary,
} from '../../../application/outbox/outbox.js';
import type { Database, Executor } from './database.js';
import { outbox } from './schema.js';

/** Registra un hecho en la transacción de negocio que lo origina (el `Executor` es esa transacción). */
export class DrizzleOutboxWriter implements OutboxWriter {
  constructor(private readonly db: Executor) {}

  async enqueue(event: NewOutboxEvent): Promise<void> {
    await this.db
      .insert(outbox)
      .values({
        id: event.id,
        type: event.type,
        aggregateId: event.aggregateId,
        payload: event.payload ?? null,
        createdAt: event.at,
      })
      .onConflictDoNothing({ target: [outbox.type, outbox.aggregateId] });
  }
}

/** Bandeja de salida en PostgreSQL: una transacción por lote, con `FOR UPDATE SKIP LOCKED`. */
export class DrizzleOutbox extends DrizzleOutboxWriter implements OutboxProcessor {
  constructor(private readonly database: Database) {
    super(database);
  }

  processPending(
    limit: number,
    handle: (event: PendingOutboxEvent) => Promise<void>,
    at: Date,
  ): Promise<ProcessSummary> {
    return this.database.transaction(async (tx) => {
      // Los pendientes quedan bloqueados hasta el final del lote: otro procesador salta estas filas
      const pending = await tx
        .select()
        .from(outbox)
        .where(isNull(outbox.processedAt))
        .orderBy(asc(outbox.createdAt), asc(outbox.id))
        .limit(limit)
        .for('update', { skipLocked: true });
      const summary = { processed: 0, failed: 0 };
      for (const row of pending) {
        try {
          await handle({
            id: row.id,
            type: row.type,
            aggregateId: row.aggregateId,
            payload: row.payload,
            attempts: row.attempts,
          });
          await tx.update(outbox).set({ processedAt: at }).where(eq(outbox.id, row.id));
          summary.processed += 1;
        } catch {
          await tx
            .update(outbox)
            .set({ attempts: sql`${outbox.attempts} + 1` })
            .where(and(eq(outbox.id, row.id), isNull(outbox.processedAt)));
          summary.failed += 1;
        }
      }
      return summary;
    });
  }
}
