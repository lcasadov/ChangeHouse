/** Acciones que se auditan (`audit_log.action`). */
export type AuditAction =
  | 'home.approve'
  | 'home.reject'
  | 'match.withdraw'
  /** Un match cerrado por la suspensión de uno de sus participantes; el actor es el admin. */
  | 'match.close'
  /** Un match cerrado porque uno de sus participantes bloqueó a otro; el actor es quien bloqueó. */
  | 'match.block_close'
  | 'user.suspend'
  | 'user.reactivate'
  | 'user.delete'
  | 'report.resolve'
  | 'report.dismiss'
  /** Purga programada de retención (chat o lista de espera); sin actor: la hace el sistema. */
  | 'retention.purge';

/**
 * Una entrada del registro de auditoría: quién, qué, sobre qué y cuándo. Nunca lleva datos de la
 * decisión (como el motivo de un rechazo): esos viven en la entidad.
 */
export interface AuditEntry {
  /** `null` cuando la hace el sistema (la purga de retención). */
  actorId: string | null;
  action: AuditAction;
  entity: 'home' | 'match' | 'user' | 'report' | 'chat' | 'waitlist';
  /** `null` cuando la acción no recae en una sola entidad (la purga de un conjunto). */
  entityId: string | null;
  /** Recuentos de la acción (p. ej. cuántos chats se purgaron); nunca datos personales. */
  detail?: Readonly<Record<string, number>>;
  at: Date;
}

/** Puerto de salida: registro de auditoría de solo inserción. */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}
