/** Acciones administrativas que se auditan (`audit_log.action`). */
export type AuditAction = 'home.approve' | 'home.reject';

/**
 * Una entrada del registro de auditoría: quién, qué, sobre qué y cuándo. Nunca lleva datos de la
 * decisión (como el motivo de un rechazo): esos viven en la entidad.
 */
export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entity: 'home';
  entityId: string;
  at: Date;
}

/** Puerto de salida: registro de auditoría de solo inserción. */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}
