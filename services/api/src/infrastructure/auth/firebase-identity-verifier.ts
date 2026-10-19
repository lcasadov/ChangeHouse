import { deleteApp, initializeApp } from 'firebase-admin/app';
import { type Auth, getAuth } from 'firebase-admin/auth';

import {
  type IdentityVerifier,
  InvalidTokenError,
  type VerifiedIdentity,
} from '../../application/auth/identity-verifier.js';

/** Códigos con los que `firebase-admin` dice que el token en sí no vale (caducado, malformado, revocado…). */
const INVALID_TOKEN_CODES = new Set([
  'auth/id-token-expired',
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/id-token-revoked',
]);

function isInvalidToken(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && INVALID_TOKEN_CODES.has(code);
}

/** Adaptador de `IdentityVerifier` sobre `firebase-admin`; con el emulador activo acepta sus tokens. */
export class FirebaseIdentityVerifier implements IdentityVerifier {
  constructor(private readonly auth: Pick<Auth, 'verifyIdToken'>) {}

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const decoded = await this.auth.verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified ?? false,
      };
    } catch (error) {
      // El detalle de Firebase no sale de aquí: ni al cliente ni a los registros
      if (isInvalidToken(error)) throw new InvalidTokenError();
      throw error;
    }
  }
}

export interface FirebaseIdentityOptions {
  projectId: string;
  /** `host:puerto` del emulador de Auth. Solo en local y en las pruebas. */
  authEmulatorHost?: string | undefined;
}

let instances = 0;

/** Crea el verificador con su propia aplicación de Firebase; `close` la libera. */
export function createFirebaseIdentityVerifier(options: FirebaseIdentityOptions) {
  // El SDK solo lee el emulador de esta variable de entorno, y lo hace al crear `Auth`
  if (options.authEmulatorHost) {
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = options.authEmulatorHost;
  }
  instances += 1;
  const app = initializeApp(
    { projectId: options.projectId },
    `changehouse-identity-${String(instances)}`,
  );
  return {
    verifier: new FirebaseIdentityVerifier(getAuth(app)),
    close: () => deleteApp(app),
  };
}
