import type { Auth } from 'firebase-admin/auth';

import type { IdentityRemover } from '../../application/account/identity-remover.js';

/** Código con el que `firebase-admin` dice que la cuenta ya no existe. */
const USER_NOT_FOUND = 'auth/user-not-found';

function isUserNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === USER_NOT_FOUND;
}

/** Adaptador de `IdentityRemover` sobre `firebase-admin`; con el emulador activo borra del emulador. */
export class FirebaseIdentityRemover implements IdentityRemover {
  constructor(private readonly auth: Pick<Auth, 'deleteUser'>) {}

  async remove(uid: string): Promise<void> {
    try {
      await this.auth.deleteUser(uid);
    } catch (error) {
      // Un reintento tras una baja que sí llegó a hacerse: ya está hecho
      if (!isUserNotFound(error)) throw error;
    }
  }
}
