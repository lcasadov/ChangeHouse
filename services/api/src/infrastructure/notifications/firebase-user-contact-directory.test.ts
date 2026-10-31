import type { Auth } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';

import { FirebaseUserContactDirectory } from './firebase-user-contact-directory.js';

function directoryWith(getUser: (uid: string) => Promise<unknown>) {
  return new FirebaseUserContactDirectory({ getUser } as unknown as Auth);
}

describe('FirebaseUserContactDirectory', () => {
  it('devuelve el email y si está verificado', async () => {
    const directory = directoryWith(() =>
      Promise.resolve({ email: 'ana@example.com', emailVerified: true }),
    );

    await expect(directory.findContact('uid-ana')).resolves.toEqual({
      email: 'ana@example.com',
      emailVerified: true,
    });
  });

  it('una cuenta sin email se entrega con email null y sin verificar', async () => {
    const directory = directoryWith(() => Promise.resolve({ emailVerified: true }));

    await expect(directory.findContact('uid')).resolves.toEqual({
      email: null,
      emailVerified: false,
    });
  });

  it('un usuario que no existe en Firebase Auth devuelve null, no un error', async () => {
    const directory = directoryWith(() =>
      Promise.reject(Object.assign(new Error('no existe'), { code: 'auth/user-not-found' })),
    );

    await expect(directory.findContact('uid')).resolves.toBeNull();
  });

  it('cualquier otro fallo se propaga para que el despachador reintente', async () => {
    const directory = directoryWith(() =>
      Promise.reject(Object.assign(new Error('caído'), { code: 'auth/internal-error' })),
    );

    await expect(directory.findContact('uid')).rejects.toThrow('caído');
  });
});
