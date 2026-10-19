import { deriveRole, type Role } from '../../domain/account/role.js';
import type { User } from '../../domain/account/user.js';
import type { HomeOwnership } from './home-ownership.js';

/** Cuenta tal como la ve su dueño (`Me` en `docs/api/openapi.yaml`). */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  municipality: string | null;
  phone: string | null;
  meetsVppRequirements: boolean;
  isOver65: boolean;
  roles: Role[];
  hasPublishedHome: boolean;
}

/** Calcula el rol con las viviendas actuales y construye la vista de la cuenta. */
export async function buildMe(ownership: HomeOwnership, user: User): Promise<Me> {
  // Los roles asignados prevalecen y no publican viviendas: no hace falta consultarlas
  const hasPublishedHome =
    user.assignedRole === null ? await ownership.hasPublishedHome(user.id) : false;
  const role = deriveRole(user.assignedRole, hasPublishedHome);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    municipality: user.municipality,
    phone: user.phone,
    meetsVppRequirements: user.meetsVppRequirements,
    isOver65: user.isOver65,
    roles: [role],
    hasPublishedHome: role === 'owner',
  };
}
