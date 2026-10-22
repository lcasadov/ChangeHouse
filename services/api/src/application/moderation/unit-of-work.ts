import type { HomeRepository } from '../home/home-repository.js';
import type { AuditLog } from './audit-log.js';

/** Lo que una decisión de moderación toca; todo ello dentro de la misma transacción. */
export interface ModerationScope {
  homes: HomeRepository;
  audit: AuditLog;
}

/**
 * Puerto de salida: ejecuta el trabajo en una transacción. Si `work` falla, nada de lo que escribió
 * a través del `scope` queda confirmado.
 */
export interface UnitOfWork {
  run<T>(work: (scope: ModerationScope) => Promise<T>): Promise<T>;
}
