import {
  type Auth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type AuthUser,
  type SocialCredential,
} from './auth-service';

const PASSWORD_PROVIDER = 'password';
const APPLE_PROVIDER = 'apple.com';

const ERROR_CODES: Record<string, AuthErrorCode> = {
  // «No existe» y «contraseña incorrecta» son lo mismo para quien llama: no se revela qué emails existen
  'auth/invalid-credential': 'invalid-credentials',
  'auth/invalid-login-credentials': 'invalid-credentials',
  'auth/wrong-password': 'invalid-credentials',
  'auth/user-not-found': 'invalid-credentials',
  'auth/email-already-in-use': 'email-in-use',
  'auth/weak-password': 'weak-password',
  'auth/invalid-email': 'invalid-email',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network',
};

function codeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code);
  }
  return undefined;
}

/** Los fallos de Firebase nunca salen de este módulo: la interfaz solo ve `AuthError`. */
function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  return new AuthError(ERROR_CODES[codeOf(error) ?? ''] ?? 'unknown');
}

async function translating<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw toAuthError(error);
  }
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    hasPassword: user.providerData.some((provider) => provider.providerId === PASSWORD_PROVIDER),
  };
}

function credentialFor(credential: SocialCredential) {
  if (credential.provider === 'google') return GoogleAuthProvider.credential(credential.idToken);
  return new OAuthProvider(APPLE_PROVIDER).credential({
    idToken: credential.identityToken,
    rawNonce: credential.rawNonce,
  });
}

/** Adaptador de Firebase Auth (SDK web) al puerto `AuthService`. */
export function createFirebaseAuthService(auth: Auth): AuthService {
  const listeners = new Set<(user: AuthUser | null) => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      const stop = onAuthStateChanged(auth, (user) => {
        listener(user ? toAuthUser(user) : null);
      });
      return () => {
        listeners.delete(listener);
        stop();
      };
    },

    async signUpWithEmail(email, password) {
      const { user } = await translating(() =>
        createUserWithEmailAndPassword(auth, email, password),
      );
      // La cuenta ya existe: un fallo al enviar el enlace no debe deshacer el registro (se puede reenviar)
      try {
        await sendEmailVerification(user);
      } catch {
        // Se ofrece reenviarlo desde el aviso de la app
      }
    },

    async signInWithEmail(email, password) {
      await translating(() => signInWithEmailAndPassword(auth, email, password));
    },

    async signInWithSocial(credential) {
      await translating(() => signInWithCredential(auth, credentialFor(credential)));
    },

    async sendPasswordReset(email) {
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (error) {
        // Mismo resultado exista o no la cuenta
        if (codeOf(error) === 'auth/user-not-found') return;
        throw toAuthError(error);
      }
    },

    async resendVerificationEmail() {
      const { currentUser } = auth;
      if (!currentUser) return;
      await translating(() => sendEmailVerification(currentUser));
    },

    async refreshUser() {
      const { currentUser } = auth;
      if (!currentUser) return;
      await translating(() => reload(currentUser));
      // `reload` no dispara onAuthStateChanged: se avisa aquí del nuevo estado
      for (const listener of listeners) listener(toAuthUser(currentUser));
    },

    async getIdToken() {
      return (await auth.currentUser?.getIdToken()) ?? null;
    },

    async signOut() {
      await translating(() => signOut(auth));
    },
  };
}
