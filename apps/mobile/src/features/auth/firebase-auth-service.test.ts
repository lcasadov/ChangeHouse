import type { Auth, User } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';

import { AuthError, type AuthUser } from './auth-service';
import { createFirebaseAuthService } from './firebase-auth-service';

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithCredential: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(),
  reload: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn((idToken: string) => ({ google: idToken })) },
  OAuthProvider: jest.fn().mockImplementation((providerId: string) => ({
    credential: (params: object) => ({ providerId, ...params }),
  })),
}));

const mocked = jest.mocked(firebaseAuth);

function firebaseUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'uid-1',
    email: 'ana@example.com',
    displayName: 'Ana',
    emailVerified: false,
    providerData: [{ providerId: 'password' }],
    getIdToken: jest.fn().mockResolvedValueOnce('id-token'),
    ...overrides,
  } as unknown as User;
}

function authWith(currentUser: User | null): Auth {
  return { currentUser } as unknown as Auth;
}

function failure(code: string): Error {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createFirebaseAuthService', () => {
  describe('sesión', () => {
    it('entrega la sesión restaurada como una persona de la interfaz, sin tipos de Firebase', () => {
      const listener = jest.fn<void, [AuthUser | null]>();
      const unsubscribe = jest.fn();
      mocked.onAuthStateChanged.mockImplementation(((
        _auth: Auth,
        next: (user: User | null) => void,
      ) => {
        next(firebaseUser({ emailVerified: true }));
        return unsubscribe;
      }) as never);

      const stop = createFirebaseAuthService(authWith(null)).subscribe(listener);

      expect(listener).toHaveBeenCalledWith({
        uid: 'uid-1',
        email: 'ana@example.com',
        displayName: 'Ana',
        emailVerified: true,
        hasPassword: true,
      });
      stop();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('quien entra con un proveedor externo no tiene contraseña y sin sesión llega null', () => {
      const listener = jest.fn<void, [AuthUser | null]>();
      let emit: (user: User | null) => void = () => undefined;
      mocked.onAuthStateChanged.mockImplementation(((
        _auth: Auth,
        next: (user: User | null) => void,
      ) => {
        emit = next;
        return jest.fn();
      }) as never);

      createFirebaseAuthService(authWith(null)).subscribe(listener);
      emit(firebaseUser({ providerData: [{ providerId: 'google.com' }] as User['providerData'] }));
      emit(null);

      expect(listener.mock.calls[0]?.[0]).toMatchObject({ hasPassword: false });
      expect(listener.mock.calls[1]?.[0]).toBeNull();
    });

    it('da el ID token vigente y null sin sesión', async () => {
      const user = firebaseUser();

      await expect(createFirebaseAuthService(authWith(user)).getIdToken()).resolves.toBe(
        'id-token',
      );
      await expect(createFirebaseAuthService(authWith(null)).getIdToken()).resolves.toBeNull();
    });

    it('cierra la sesión', async () => {
      const auth = authWith(firebaseUser());

      await createFirebaseAuthService(auth).signOut();

      expect(mocked.signOut).toHaveBeenCalledWith(auth);
    });
  });

  describe('email y contraseña', () => {
    it('al registrarse crea la cuenta y envía el enlace de verificación', async () => {
      const created = firebaseUser();
      mocked.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: created } as never);
      const auth = authWith(null);

      await createFirebaseAuthService(auth).signUpWithEmail('ana@example.com', 'una-clave-larga');

      expect(mocked.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        'ana@example.com',
        'una-clave-larga',
      );
      expect(mocked.sendEmailVerification).toHaveBeenCalledWith(created);
    });

    it('si falla el envío de la verificación el registro sigue siendo válido', async () => {
      mocked.createUserWithEmailAndPassword.mockResolvedValueOnce({
        user: firebaseUser(),
      } as never);
      mocked.sendEmailVerification.mockRejectedValueOnce(failure('auth/network-request-failed'));

      await expect(
        createFirebaseAuthService(authWith(null)).signUpWithEmail(
          'ana@example.com',
          'una-clave-larga',
        ),
      ).resolves.toBeUndefined();
    });

    it('inicia sesión con email y contraseña', async () => {
      const auth = authWith(null);

      await createFirebaseAuthService(auth).signInWithEmail('ana@example.com', 'una-clave-larga');

      expect(mocked.signInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        'ana@example.com',
        'una-clave-larga',
      );
    });

    it.each([
      ['auth/invalid-credential', 'invalid-credentials'],
      ['auth/wrong-password', 'invalid-credentials'],
      ['auth/user-not-found', 'invalid-credentials'],
      ['auth/invalid-login-credentials', 'invalid-credentials'],
      ['auth/email-already-in-use', 'email-in-use'],
      ['auth/weak-password', 'weak-password'],
      ['auth/invalid-email', 'invalid-email'],
      ['auth/too-many-requests', 'too-many-requests'],
      ['auth/network-request-failed', 'network'],
      ['auth/internal-error', 'unknown'],
    ])('traduce %s a %s sin dejar pasar el mensaje original', async (code, expected) => {
      mocked.signInWithEmailAndPassword.mockRejectedValueOnce(failure(code));

      const error = await createFirebaseAuthService(authWith(null))
        .signInWithEmail('ana@example.com', 'x')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AuthError);
      expect(error).toMatchObject({ code: expected, message: expected });
    });

    it('un fallo que no es de Firebase se trata como desconocido', async () => {
      mocked.signInWithEmailAndPassword.mockRejectedValueOnce('algo raro');

      await expect(
        createFirebaseAuthService(authWith(null)).signInWithEmail('ana@example.com', 'x'),
      ).rejects.toMatchObject({ code: 'unknown' });
    });
  });

  describe('proveedores externos', () => {
    it('canjea el ID token de Google por una sesión', async () => {
      const auth = authWith(null);

      await createFirebaseAuthService(auth).signInWithSocial({
        provider: 'google',
        idToken: 'google-id-token',
      });

      expect(mocked.signInWithCredential).toHaveBeenCalledWith(auth, { google: 'google-id-token' });
    });

    it('canjea el token de identidad de Apple con su nonce', async () => {
      const auth = authWith(null);

      await createFirebaseAuthService(auth).signInWithSocial({
        provider: 'apple',
        identityToken: 'apple-token',
        rawNonce: 'nonce',
      });

      expect(mocked.OAuthProvider).toHaveBeenCalledWith('apple.com');
      expect(mocked.signInWithCredential).toHaveBeenCalledWith(auth, {
        providerId: 'apple.com',
        idToken: 'apple-token',
        rawNonce: 'nonce',
      });
    });

    it('un rechazo del proveedor se traduce igual que el resto', async () => {
      mocked.signInWithCredential.mockRejectedValueOnce(failure('auth/network-request-failed'));

      await expect(
        createFirebaseAuthService(authWith(null)).signInWithSocial({
          provider: 'google',
          idToken: 'x',
        }),
      ).rejects.toMatchObject({ code: 'network' });
    });
  });

  describe('verificación y recuperación', () => {
    it('reenvía el enlace de verificación a la persona con sesión', async () => {
      const user = firebaseUser();

      await createFirebaseAuthService(authWith(user)).resendVerificationEmail();

      expect(mocked.sendEmailVerification).toHaveBeenCalledWith(user);
    });

    it('reenviar sin sesión no llama a Firebase', async () => {
      await createFirebaseAuthService(authWith(null)).resendVerificationEmail();

      expect(mocked.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('un fallo al reenviar se traduce', async () => {
      mocked.sendEmailVerification.mockRejectedValueOnce(failure('auth/too-many-requests'));

      await expect(
        createFirebaseAuthService(authWith(firebaseUser())).resendVerificationEmail(),
      ).rejects.toMatchObject({ code: 'too-many-requests' });
    });

    it('relee la cuenta y avisa a quien escucha del nuevo estado', async () => {
      const listener = jest.fn<void, [AuthUser | null]>();
      mocked.onAuthStateChanged.mockReturnValue(jest.fn());
      const user = firebaseUser({ emailVerified: false });
      const service = createFirebaseAuthService(authWith(user));
      service.subscribe(listener);
      mocked.reload.mockImplementation(async (reloaded: User) => {
        Object.assign(reloaded, { emailVerified: true });
        await Promise.resolve();
      });

      await service.refreshUser();

      expect(mocked.reload).toHaveBeenCalledWith(user);
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ emailVerified: true }));
    });

    it('refrescar sin sesión no hace nada', async () => {
      await createFirebaseAuthService(authWith(null)).refreshUser();

      expect(mocked.reload).not.toHaveBeenCalled();
    });

    it('pide el enlace de recuperación y es idéntico exista o no la cuenta', async () => {
      mocked.sendPasswordResetEmail.mockRejectedValueOnce(failure('auth/user-not-found'));
      const service = createFirebaseAuthService(authWith(null));

      await expect(service.sendPasswordReset('nadie@example.com')).resolves.toBeUndefined();
      await expect(service.sendPasswordReset('ana@example.com')).resolves.toBeUndefined();
    });

    it('otros fallos al recuperar la contraseña sí se comunican', async () => {
      mocked.sendPasswordResetEmail.mockRejectedValueOnce(failure('auth/network-request-failed'));

      await expect(
        createFirebaseAuthService(authWith(null)).sendPasswordReset('ana@example.com'),
      ).rejects.toMatchObject({ code: 'network' });
    });
  });
});
