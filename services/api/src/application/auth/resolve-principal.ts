import { deriveRole } from '../../domain/account/role.js';
import { isSuspended } from '../../domain/account/suspension.js';
import type { HomeOwnership } from '../account/home-ownership.js';
import type { UserRepository } from '../account/user-repository.js';
import type { IdentityVerifier } from './identity-verifier.js';
import type { Principal } from './principal.js';

export interface ResolvePrincipalDeps {
  verifier: IdentityVerifier;
  users: UserRepository;
  ownership: HomeOwnership;
}

/**
 * Del ID token al principal: verifica la identidad y calcula el rol a partir de la base de
 * datos (fuente de verdad), nunca de lo que afirme el cliente.
 */
export async function resolvePrincipal(
  deps: ResolvePrincipalDeps,
  token: string,
): Promise<Principal> {
  const identity = await deps.verifier.verify(token);
  const user = await deps.users.findByFirebaseUid(identity.uid);
  if (!user) return { identity, account: null };

  // Los roles asignados prevalecen: no hace falta consultar las viviendas
  const hasPublishedHome =
    user.assignedRole === null ? await deps.ownership.hasPublishedHome(user.id) : false;
  const role = deriveRole(user.assignedRole, hasPublishedHome);
  // La suspensión sale de la misma lectura por clave del usuario: no cuesta otra consulta
  return { identity, account: { userId: user.id, role, suspended: isSuspended(user) } };
}
