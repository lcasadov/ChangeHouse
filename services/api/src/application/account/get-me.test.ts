import { describe, expect, it } from 'vitest';

import { FixedHomeOwnership, InMemoryUserRepository, makeUser } from '../../../test/fakes.js';
import { getMe } from './get-me.js';

function setup(owners: string[] = []) {
  const users = new InMemoryUserRepository([
    makeUser({ id: 'u1', phone: '+34600111222', municipality: 'Madrid' }),
    makeUser({
      id: 'u2',
      firebaseUid: 'uid-2',
      email: 'agencia@example.com',
      assignedRole: 'agency',
    }),
  ]);
  return {
    run: (userId: string) =>
      getMe({ users, ownership: new FixedHomeOwnership(new Set(owners)) }, userId),
  };
}

describe('getMe', () => {
  it('Scenario: Consultar la propia cuenta - un usuario sin viviendas recibe sus datos, el rol seeker y hasPublishedHome en falso', async () => {
    const { run } = setup();

    await expect(run('u1')).resolves.toEqual({
      id: 'u1',
      email: 'ana@example.com',
      displayName: 'Ana',
      municipality: 'Madrid',
      phone: '+34600111222',
      meetsVppRequirements: false,
      isOver65: false,
      roles: ['seeker'],
      hasPublishedHome: false,
    });
  });

  it('un usuario con vivienda publicada es owner y hasPublishedHome es verdadero', async () => {
    const { run } = setup(['u1']);

    await expect(run('u1')).resolves.toMatchObject({ roles: ['owner'], hasPublishedHome: true });
  });

  it('un rol asignado se muestra tal cual y nunca como propietario', async () => {
    const { run } = setup(['u2']);

    await expect(run('u2')).resolves.toMatchObject({ roles: ['agency'], hasPublishedHome: false });
  });

  it('una cuenta inexistente es un fallo técnico, no un resultado vacío', async () => {
    const { run } = setup();

    await expect(run('fantasma')).rejects.toThrow(/fantasma/);
  });
});
