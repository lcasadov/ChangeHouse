import type { DecodedIdToken } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';

import { InvalidTokenError } from '../../application/auth/identity-verifier.js';
import { FirebaseIdentityVerifier } from './firebase-identity-verifier.js';

function verifierThatReturns(decoded: Partial<DecodedIdToken>) {
  return new FirebaseIdentityVerifier({
    verifyIdToken: () => Promise.resolve(decoded as DecodedIdToken),
  });
}

function verifierThatFails(error: Error) {
  return new FirebaseIdentityVerifier({ verifyIdToken: () => Promise.reject(error) });
}

const firebaseError = (code: string) => Object.assign(new Error('detalle interno'), { code });

describe('FirebaseIdentityVerifier', () => {
  it('traduce el token verificado a una identidad', async () => {
    const verifier = verifierThatReturns({
      uid: 'uid-1',
      email: 'ana@example.com',
      email_verified: true,
    });

    await expect(verifier.verify('token')).resolves.toEqual({
      uid: 'uid-1',
      email: 'ana@example.com',
      emailVerified: true,
    });
  });

  it('una identidad sin email lo deja indefinido y sin verificar', async () => {
    const verifier = verifierThatReturns({ uid: 'uid-2' });

    await expect(verifier.verify('token')).resolves.toEqual({
      uid: 'uid-2',
      email: undefined,
      emailVerified: false,
    });
  });

  it.each([
    'auth/id-token-expired',
    'auth/argument-error',
    'auth/invalid-id-token',
    'auth/id-token-revoked',
    // El token de una cuenta ya dada de baja (el emulador lo comprueba; Firebase real, al revocar)
    'auth/user-not-found',
  ])('el error %s de Firebase es un token inválido, sin arrastrar su detalle', async (code) => {
    const failure = await verifierThatFails(firebaseError(code))
      .verify('token')
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InvalidTokenError);
    expect((failure as Error).message).not.toContain('detalle interno');
    expect((failure as Error).cause).toBeUndefined();
  });

  it.each([
    firebaseError('auth/internal-error'),
    new Error('sin código'),
    Object.assign(new Error('código que no es texto'), { code: 42 }),
  ])('un fallo técnico (%s) no se convierte en un token inválido', async (error) => {
    await expect(verifierThatFails(error).verify('token')).rejects.toBe(error);
  });
});
