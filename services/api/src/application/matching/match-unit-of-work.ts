import type { AuditLog } from '../moderation/audit-log.js';
import type { OutboxWriter } from '../outbox/outbox.js';
import type { MatchDecisionStore } from './matching-repository.js';

/** Lo que una decisión sobre un match toca; todo ello dentro de la misma transacción. */
export interface MatchScope {
  matches: MatchDecisionStore;
  audit: AuditLog;
  /** Hechos a propagar tras confirmar la transacción (avisos de confirmación y cierre). */
  outbox: OutboxWriter;
}

/**
 * Puerto de salida: ejecuta el trabajo en una transacción. Si `work` falla, nada de lo que escribió
 * a través del `scope` queda confirmado.
 */
export interface MatchUnitOfWork {
  run<T>(work: (scope: MatchScope) => Promise<T>): Promise<T>;
}
