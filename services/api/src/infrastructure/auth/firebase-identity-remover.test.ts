import { describe, expect, it } from 'vitest';

import { FirebaseIdentityRemover } from './firebase-identity-remover.js';

function authThatFailsWith(code: string | undefined) {
  const deleted: string[] = [];
  return {
    deleted,
    auth: {
      deleteUser: (uid: string) => {
        deleted.push(uid);
        return code === undefined
          ? Promise.resolve()
          : Promise.reject(Object.assign(new Error('fallo'), { code }));
      },
    },
  };
}

describe('FirebaseIdentityRemover', () => {
  it('da de baja la cuenta con su uid', async () => {
    const { auth, deleted } = authThatFailsWith(undefined);

    await new FirebaseIdentityRemover(auth).remove('uid-1');

    expect(deleted).toEqual(['uid-1']);
  });

  it('GIVEN que la cuenta ya no existe en Firebase THEN cuenta como hecho', async () => {
    const { auth } = authThatFailsWith('auth/user-not-found');

    await expect(new FirebaseIdentityRemover(auth).remove('uid-1')).resolves.toBeUndefined();
  });

  it('cualquier otro fallo se propaga para que el despachador reintente', async () => {
    const { auth } = authThatFailsWith('auth/internal-error');

    await expect(new FirebaseIdentityRemover(auth).remove('uid-1')).rejects.toThrow('fallo');
  });

  it('un error sin código también se propaga', async () => {
    const auth = { deleteUser: () => Promise.reject(new Error('red caída')) };

    await expect(new FirebaseIdentityRemover(auth).remove('uid-1')).rejects.toThrow('red caída');
  });
});
