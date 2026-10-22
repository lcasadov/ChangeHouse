/** Roles asignados por el equipo (`users.assigned_role`); no se derivan de nada. */
export const ASSIGNED_ROLES = ['agency', 'admin'] as const;

export type AssignedRole = (typeof ASSIGNED_ROLES)[number];

/** Roles técnicos de `docs/rbac-matrix.md` §1. Son exclusivos: una cuenta tiene exactamente uno. */
export type Role = 'seeker' | 'owner' | AssignedRole;

/**
 * Rol de una cuenta. `agency` y `admin` se asignan y prevalecen (no publican viviendas);
 * `owner` y `seeker` no se guardan: se derivan de si hay alguna vivienda publicada.
 */
export function deriveRole(assigned: AssignedRole | null, hasPublishedHome: boolean): Role {
  if (assigned !== null) return assigned;
  return hasPublishedHome ? 'owner' : 'seeker';
}
