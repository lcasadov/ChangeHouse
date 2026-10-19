import type { AssignedRole } from '../../domain/account/role.js';
import type { User } from '../../domain/account/user.js';
import { UserHasActiveHomesError, UserNotFoundError } from './errors.js';

/** Puerto de salida: lo que hace falta para conceder el rol `admin`. */
export interface AdminGrantRepository {
  /** El usuario con ese email (sin distinguir mayúsculas), o `null`. */
  findByEmail(email: string): Promise<User | null>;
  /** Si tiene alguna vivienda que no esté cerrada. */
  hasActiveHomes(userId: string): Promise<boolean>;
  assignAdmin(userId: string): Promise<void>;
}

/** Registro estructurado de la concesión; no lleva el email (dato personal). */
export interface AdminGrantedEvent {
  event: 'admin.granted';
  userId: string;
  previousRole: AssignedRole | null;
}

export interface AdminGrantDeps {
  grants: AdminGrantRepository;
  log: (event: AdminGrantedEvent) => void;
}

/**
 * Asigna el rol `admin` a un usuario existente. Los roles asignados son excluyentes con publicar,
 * así que falla si tiene viviendas activas. No escribe en `audit_log` (exige un actor usuario): la
 * concesión la hace un operador con acceso a la base y queda en el registro del proceso.
 */
export async function grantAdmin(deps: AdminGrantDeps, email: string): Promise<{ userId: string }> {
  const user = await deps.grants.findByEmail(email);
  if (user === null) throw new UserNotFoundError();
  if (await deps.grants.hasActiveHomes(user.id)) throw new UserHasActiveHomesError();
  await deps.grants.assignAdmin(user.id);
  deps.log({ event: 'admin.granted', userId: user.id, previousRole: user.assignedRole });
  return { userId: user.id };
}
