import { CannotSuspendAdminError, CannotSuspendSelfError } from './errors.js';
import type { User } from './user.js';

/** Quién suspende, por qué y cuándo. */
export interface SuspensionOrder {
  readonly actorId: string;
  readonly reason: string;
  readonly now: Date;
}

export function isSuspended(user: User): boolean {
  return user.suspendedAt !== null;
}

/**
 * Suspende la cuenta (RF-90). Un admin no puede suspenderse a sí mismo ni a otro admin. Suspender
 * a quien ya lo está no cambia nada: se conservan el instante y el motivo originales.
 */
export function suspendUser(user: User, order: SuspensionOrder): User {
  if (user.id === order.actorId) throw new CannotSuspendSelfError();
  if (user.assignedRole === 'admin') throw new CannotSuspendAdminError();
  if (isSuspended(user)) return user;
  return { ...user, suspendedAt: order.now, suspensionReason: order.reason };
}

/** Reactiva la cuenta; si no estaba suspendida, no cambia nada. */
export function reactivateUser(user: User): User {
  if (!isSuspended(user)) return user;
  return { ...user, suspendedAt: null, suspensionReason: null };
}
