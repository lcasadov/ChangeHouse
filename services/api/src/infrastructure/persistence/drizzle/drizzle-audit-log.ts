import type { AuditEntry, AuditLog } from '../../../application/moderation/audit-log.js';
import type { Executor } from './database.js';
import { auditLog } from './schema.js';

/** Registro de auditoría en PostgreSQL: solo inserta; la tabla rechaza cambiar o borrar entradas. */
export class DrizzleAuditLog implements AuditLog {
  constructor(private readonly db: Executor) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      ...(entry.detail ? { detail: entry.detail } : {}),
      at: entry.at,
    });
  }
}
