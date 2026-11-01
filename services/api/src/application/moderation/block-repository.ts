import type { OutboxWriter } from '../outbox/outbox.js';
import type { AuditLog } from './audit-log.js';
import type { SuspensionMatchStore } from './user-suspension.js';

/** Puerto de salida: bloqueos entre usuarios (RF-63). */
export interface BlockRepository {
  /** Registra que `blockerId` bloquea a `blockedId`; si ya lo bloqueaba no hace nada. */
  add(blockerId: string, blockedId: string, at: Date): Promise<void>;
}

/** Lo que un bloqueo toca; todo ello dentro de la misma transacción. */
export interface BlockScope {
  blocks: BlockRepository;
  /** Los matches activos de quien bloquea, que el bloqueo cierra con los del bloqueado. */
  matches: SuspensionMatchStore;
  audit: AuditLog;
  /** El aviso de cada cierre, ya sin quien bloquea entre sus destinatarios. */
  outbox: OutboxWriter;
}

/**
 * Puerto de salida: ejecuta el trabajo en una transacción. Si `work` falla, nada de lo que escribió
 * a través del `scope` queda confirmado.
 */
export interface BlockUnitOfWork {
  run<T>(work: (scope: BlockScope) => Promise<T>): Promise<T>;
}
