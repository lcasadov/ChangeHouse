import type { Auth } from 'firebase-admin/auth';

import type {
  UserContact,
  UserContactDirectory,
} from '../../application/notifications/user-contact-directory.js';

/** Adaptador de `UserContactDirectory` sobre Firebase Auth Admin: email y verificación de la cuenta. */
export class FirebaseUserContactDirectory implements UserContactDirectory {
  constructor(private readonly auth: Pick<Auth, 'getUser'>) {}

  async findContact(firebaseUid: string): Promise<UserContact | null> {
    try {
      const user = await this.auth.getUser(firebaseUid);
      const email = user.email ?? null;
      return { email, emailVerified: email !== null && user.emailVerified };
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code === 'auth/user-not-found') return null;
      throw error;
    }
  }
}
