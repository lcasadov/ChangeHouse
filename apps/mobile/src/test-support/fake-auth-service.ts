import {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type AuthUser,
  type SocialCredential,
  type SocialSignIn,
} from '../features/auth/auth-service';

type Listener = (user: AuthUser | null) => void;

interface FakeAccount {
  password: string;
  user: AuthUser;
}

export interface FakeAuthOptions {
  /** Sesión que el dispositivo recuerda al abrir la app. */
  initialUser?: AuthUser | null;
  /** `false` deja la restauración pendiente hasta llamar a `finishRestore`. */
  restored?: boolean;
}

export function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: 'uid-ana',
    email: 'ana@example.com',
    displayName: null,
    emailVerified: true,
    hasPassword: true,
    ...overrides,
  };
}

/** Doble en memoria del puerto `AuthService`: mismas reglas que Firebase, sin red. */
export class FakeAuthService implements AuthService {
  readonly accounts = new Map<string, FakeAccount>();
  readonly passwordResets: string[] = [];
  verificationEmailsSent = 0;
  signOutCalls = 0;
  token: string | null = 'token-de-prueba';
  /** Si se fija, la siguiente operación que cambia el estado falla con este código. */
  failNextWith: AuthErrorCode | null = null;

  private remoteVerified = false;
  private current: AuthUser | null;
  private restored: boolean;
  private readonly listeners = new Set<Listener>();

  constructor({ initialUser = null, restored = true }: FakeAuthOptions = {}) {
    this.current = initialUser;
    this.restored = restored;
  }

  get user(): AuthUser | null {
    return this.current;
  }

  /** Cuenta que ya existe en el proveedor, para probar el inicio de sesión. */
  addAccount(email: string, password: string, overrides: Partial<AuthUser> = {}): AuthUser {
    const user = authUser({ uid: `uid-${email}`, email, ...overrides });
    this.accounts.set(email, { password, user });
    return user;
  }

  finishRestore(): void {
    this.restored = true;
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.restored) listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  signUpWithEmail(email: string, password: string): Promise<void> {
    return this.run(() => {
      if (this.accounts.has(email)) throw new AuthError('email-in-use');
      const user = this.addAccount(email, password, { emailVerified: false });
      this.verificationEmailsSent += 1;
      this.setUser(user);
    });
  }

  signInWithEmail(email: string, password: string): Promise<void> {
    return this.run(() => {
      const account = this.accounts.get(email);
      // Mismo error para «no existe» y «contraseña incorrecta»
      if (account?.password !== password) throw new AuthError('invalid-credentials');
      this.setUser(account.user);
    });
  }

  signInWithSocial(credential: SocialCredential): Promise<void> {
    return this.run(() => {
      this.setUser(
        authUser({
          uid: `uid-${credential.provider}`,
          email: `${credential.provider}@example.com`,
          displayName: 'Ana García',
          hasPassword: false,
        }),
      );
    });
  }

  sendPasswordReset(email: string): Promise<void> {
    return this.run(() => {
      this.passwordResets.push(email);
    });
  }

  resendVerificationEmail(): Promise<void> {
    return this.run(() => {
      this.verificationEmailsSent += 1;
    });
  }

  refreshUser(): Promise<void> {
    return this.run(() => {
      if (this.current) {
        const emailVerified = this.current.emailVerified || this.remoteVerified;
        this.setUser({ ...this.current, emailVerified });
      }
    });
  }

  getIdToken(): Promise<string | null> {
    return Promise.resolve(this.current ? this.token : null);
  }

  signOut(): Promise<void> {
    return this.run(() => {
      this.signOutCalls += 1;
      this.setUser(null);
    });
  }

  /** El proveedor confirma el email desde otro dispositivo; la sesión local no lo sabe hasta `refreshUser`. */
  verifyEmailRemotely(): void {
    this.remoteVerified = true;
  }

  private run(action: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const code = this.failNextWith;
      if (code) {
        this.failNextWith = null;
        reject(new AuthError(code));
        return;
      }
      try {
        action();
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private setUser(user: AuthUser | null): void {
    this.current = user;
    this.emit();
  }

  private emit(): void {
    if (!this.restored) return;
    for (const listener of this.listeners) listener(this.current);
  }
}

/** Proveedor externo simulado: `result` es lo que entrega al terminar (o `null` si se cancela). */
export function fakeSocialSignIn(
  provider: SocialCredential['provider'],
  result: SocialCredential | null = provider === 'google'
    ? { provider: 'google', idToken: 'google-id-token' }
    : { provider: 'apple', identityToken: 'apple-identity-token', rawNonce: 'nonce' },
): SocialSignIn & { started: number } {
  const fake = {
    id: provider,
    started: 0,
    start: () => {
      fake.started += 1;
      return Promise.resolve(result);
    },
  };
  return fake;
}
