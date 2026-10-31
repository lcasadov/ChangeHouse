import type { SuspensionInput } from '@changehouse/shared';

import { deriveRole, type Role } from '../../domain/account/role.js';
import { isSuspended, reactivateUser, suspendUser } from '../../domain/account/suspension.js';
import type { User } from '../../domain/account/user.js';
import { withdrawFromMatch } from '../../domain/matching/match.js';
import type { HomeOwnership } from '../account/home-ownership.js';
import type { Clock } from '../clock.js';
import type { MatchDecisionStore, MatchRecord } from '../matching/matching-repository.js';
import type { AuditLog } from './audit-log.js';
import { UserToModerateNotFoundError } from './errors.js';

/** Puerto de salida: el estado de suspensión de los usuarios, dentro de la transacción. */
export interface UserSuspensionStore {
  /** Lee el usuario bloqueando su fila hasta el final de la transacción; `null` si no existe. */
  findForUpdate(id: string): Promise<User | null>;
  /** Guarda `suspendedAt` y `suspensionReason` del usuario. */
  saveSuspension(user: User): Promise<void>;
}

/** Puerto de salida: los matches que la suspensión de un participante cierra. */
export interface SuspensionMatchStore extends Pick<MatchDecisionStore, 'saveState'> {
  /** Los matches `open` o `confirmed` en los que participa, bloqueados hasta el final. */
  findActiveForUpdate(userId: string): Promise<MatchRecord[]>;
}

/** Lo que una suspensión toca; todo ello dentro de la misma transacción. */
export interface SuspensionScope {
  users: UserSuspensionStore;
  matches: SuspensionMatchStore;
  audit: AuditLog;
}

/**
 * Puerto de salida: ejecuta el trabajo en una transacción. Si `work` falla, nada de lo que escribió
 * a través del `scope` queda confirmado.
 */
export interface SuspensionUnitOfWork {
  run<T>(work: (scope: SuspensionScope) => Promise<T>): Promise<T>;
}

export interface UserSuspensionDeps {
  units: SuspensionUnitOfWork;
  ownership: HomeOwnership;
  clock: Clock;
}

/** `AdminUser` del contrato: la cuenta tal como la ve el admin, sin el motivo de la suspensión. */
export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  suspended: boolean;
  createdAt: string;
}

async function toAdminUserView(ownership: HomeOwnership, user: User): Promise<AdminUserView> {
  // Los roles asignados prevalecen y no publican viviendas: no hace falta consultarlas
  const hasPublishedHome =
    user.assignedRole === null ? await ownership.hasPublishedHome(user.id) : false;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: [deriveRole(user.assignedRole, hasPublishedHome)],
    suspended: isSuspended(user),
    createdAt: user.createdAt.toISOString(),
  };
}

/** Cierra para todos los matches activos del usuario: él queda `withdrawn` y cada cierre, auditado. */
async function closeActiveMatches(
  { matches, audit }: SuspensionScope,
  userId: string,
  adminId: string,
  now: Date,
): Promise<void> {
  for (const match of await matches.findActiveForUpdate(userId)) {
    await matches.saveState(match.id, withdrawFromMatch(match, userId));
    await audit.record({
      actorId: adminId,
      action: 'match.close',
      entity: 'match',
      entityId: match.id,
      at: now,
    });
  }
}

/**
 * Suspende o reactiva a un usuario (RF-90, RF-93). La decisión, el cierre de sus matches activos y
 * sus entradas de auditoría se confirman juntos. Repetir la misma decisión no escribe nada. Al
 * reactivar, los matches cerrados no se reabren.
 */
async function adminSetUserSuspension(
  deps: UserSuspensionDeps,
  adminId: string,
  userId: string,
  input: SuspensionInput,
): Promise<AdminUserView> {
  const updated = await deps.units.run(async (scope) => {
    const user = await scope.users.findForUpdate(userId);
    if (user === null) throw new UserToModerateNotFoundError();
    const now = deps.clock.now();
    const decided = input.suspended
      ? suspendUser(user, { actorId: adminId, reason: input.reason, now })
      : reactivateUser(user);
    if (decided === user) return user;

    await scope.users.saveSuspension(decided);
    await scope.audit.record({
      actorId: adminId,
      action: input.suspended ? 'user.suspend' : 'user.reactivate',
      entity: 'user',
      entityId: userId,
      at: now,
    });
    if (input.suspended) await closeActiveMatches(scope, userId, adminId, now);
    return decided;
  });
  return toAdminUserView(deps.ownership, updated);
}

/** Los casos de uso de la suspensión con sus dependencias ya inyectadas, listos para el transporte. */
export function userSuspensionOperations(deps: UserSuspensionDeps) {
  return {
    adminSetUserSuspension: (adminId: string, userId: string, input: SuspensionInput) =>
      adminSetUserSuspension(deps, adminId, userId, input),
  };
}
