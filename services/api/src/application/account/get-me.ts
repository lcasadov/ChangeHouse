import type { HomeOwnership } from './home-ownership.js';
import { buildMe, type Me } from './me.js';
import type { UserRepository } from './user-repository.js';

export interface GetMeDeps {
  users: UserRepository;
  ownership: HomeOwnership;
}

/** La cuenta del propio usuario: datos, rol derivado o asignado y si tiene vivienda publicada. */
export async function getMe(deps: GetMeDeps, userId: string): Promise<Me> {
  const user = await deps.users.findById(userId);
  // La autorización ya comprobó que existe: que falte aquí es un fallo, no un resultado
  if (!user) throw new Error(`Cuenta inexistente: ${userId}`);
  return buildMe(deps.ownership, user);
}
