import { describe, expect, it } from 'vitest';

import { InMemoryUserRepository, makeUser } from '../../../test/fakes.js';
import type { User } from '../../domain/account/user.js';
import type { HomeOwnership } from '../account/home-ownership.js';
import {
  type IdentityVerifier,
  InvalidTokenError,
  type VerifiedIdentity,
} from './identity-verifier.js';
import { resolvePrincipal } from './resolve-principal.js';

const identity: VerifiedIdentity = { uid: 'uid-1', email: 'ana@example.com', emailVerified: true };

function setup(options: { users?: User[]; owners?: string[]; failWith?: Error } = {}) {
  const users = new InMemoryUserRepository(options.users ?? []);
  const consulted: string[] = [];
  const verifier: IdentityVerifier = {
    verify: (token) => {
      if (options.failWith) return Promise.reject(options.failWith);
      return token === 'good' ? Promise.resolve(identity) : Promise.reject(new InvalidTokenError());
    },
  };
  const ownership: HomeOwnership = {
    hasPublishedHome: (userId) => {
      consulted.push(userId);
      return Promise.resolve((options.owners ?? []).includes(userId));
    },
  };
  return {
    consulted,
    run: (token: string) => resolvePrincipal({ verifier, users, ownership }, token),
  };
}

describe('resolvePrincipal', () => {
  it('una identidad sin alta en ChangeHouse no tiene cuenta', async () => {
    const { run, consulted } = setup();

    await expect(run('good')).resolves.toEqual({ identity, account: null });
    expect(consulted).toEqual([]);
  });

  it('un usuario sin viviendas publicadas es seeker', async () => {
    const { run } = setup({ users: [makeUser({ id: 'u1', firebaseUid: 'uid-1' })] });

    await expect(run('good')).resolves.toEqual({
      identity,
      account: { userId: 'u1', role: 'seeker' },
    });
  });

  it('un usuario con vivienda publicada es owner', async () => {
    const { run } = setup({
      users: [makeUser({ id: 'u1', firebaseUid: 'uid-1' })],
      owners: ['u1'],
    });

    await expect(run('good')).resolves.toMatchObject({ account: { userId: 'u1', role: 'owner' } });
  });

  it('un rol asignado se respeta y no se consultan las viviendas', async () => {
    const { run, consulted } = setup({
      users: [makeUser({ id: 'u1', firebaseUid: 'uid-1', assignedRole: 'admin' })],
      owners: ['u1'],
    });

    await expect(run('good')).resolves.toMatchObject({ account: { userId: 'u1', role: 'admin' } });
    expect(consulted).toEqual([]);
  });

  it('un token rechazado por el verificador se propaga como InvalidTokenError', async () => {
    const { run } = setup();

    await expect(run('bad')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('un fallo técnico del verificador no se confunde con un token inválido', async () => {
    const boom = new Error('red caída');
    const { run } = setup({ failWith: boom });

    await expect(run('good')).rejects.toBe(boom);
  });
});

describe('resolvePrincipal con una cuenta eliminada', () => {
  it('rechaza el token de una cuenta eliminada como no válido, sin consultar sus viviendas', async () => {
    const { run, consulted } = setup({
      users: [makeUser({ id: 'u1', firebaseUid: 'uid-1', deletedAt: new Date() })],
    });

    await expect(run('good')).rejects.toBeInstanceOf(InvalidTokenError);
    expect(consulted).toEqual([]);
  });
});
