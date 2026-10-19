/** Persona con sesión iniciada, tal y como la ve la interfaz (sin tipos del proveedor). */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  /** Entra con email y contraseña: solo entonces tiene sentido pedir que verifique el email. */
  hasPassword: boolean;
}

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-in-use'
  | 'weak-password'
  | 'invalid-email'
  | 'too-many-requests'
  | 'network'
  | 'unknown';

/** Fallo de autenticación ya normalizado: la interfaz lo traduce a un mensaje, nunca muestra el original. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

/** Credencial que entrega un proveedor externo para canjearla por una sesión. */
export type SocialCredential =
  | { provider: 'google'; idToken: string }
  | { provider: 'apple'; identityToken: string; rawNonce: string };

export type SocialProviderId = SocialCredential['provider'];

/** Un proveedor externo configurado en este dispositivo. `start` devuelve `null` si la persona cancela. */
export interface SocialSignIn {
  id: SocialProviderId;
  start: () => Promise<SocialCredential | null>;
}

/** Puerto de salida de la autenticación; el adaptador de Firebase vive en `firebase-auth-service.ts`. */
export interface AuthService {
  /** Avisa de la sesión restaurada y de cada cambio posterior; devuelve la función para dejar de escuchar. */
  subscribe: (listener: (user: AuthUser | null) => void) => () => void;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithSocial: (credential: SocialCredential) => Promise<void>;
  /** Idéntico resultado exista o no la cuenta: no revela qué emails están registrados. */
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  /** Vuelve a leer la cuenta (p. ej. tras verificar el email en otro dispositivo). */
  refreshUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}
