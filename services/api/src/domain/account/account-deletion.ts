import type { User } from './user.js';

/** Nombre visible de una cuenta eliminada: el que ven los demás participantes de sus matches y chats. */
export const DELETED_DISPLAY_NAME = 'Usuario eliminado';

/** Email que sustituye al real: único por usuario, no entregable y libre el email original (RF-05). */
export function anonymizedEmail(userId: string): string {
  return `deleted+${userId}@changehouse.invalid`;
}

/**
 * La cuenta tal como queda al eliminarla: sin email, nombre, teléfono ni municipio reconocibles y
 * con la fecha del borrado lógico. Conserva la identidad interna (id, uid, rol, alta) que referencian
 * los consentimientos, la auditoría y los matches.
 */
export function anonymizeUser(user: User, at: Date): User {
  return {
    ...user,
    email: anonymizedEmail(user.id),
    displayName: DELETED_DISPLAY_NAME,
    phone: null,
    municipality: null,
    deletedAt: at,
  };
}
