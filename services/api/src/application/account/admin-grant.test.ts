import { describe, expect, it } from 'vitest';

import { InMemoryAdminGrants, InMemoryUserRepository, makeUser } from '../../../test/fakes.js';
import { type AdminGrantedEvent, grantAdmin } from './admin-grant.js';
import { UserHasActiveHomesError, UserNotFoundError } from './errors.js';

function setup() {
  const users = new InMemoryUserRepository([
    makeUser({ id: 'user-1', email: 'Ana@Example.com' }),
    makeUser({
      id: 'user-2',
      firebaseUid: 'uid-2',
      email: 'beto@example.com',
      assignedRole: 'agency',
    }),
  ]);
  const grants = new InMemoryAdminGrants(users);
  const events: AdminGrantedEvent[] = [];
  return {
    users,
    grants,
    events,
    run: (email: string) => grantAdmin({ grants, log: (event) => events.push(event) }, email),
  };
}

describe('grantAdmin', () => {
  it('Scenario: Asignar el rol de administración - un usuario existente pasa a admin sin importar mayúsculas del email', async () => {
    const { users, run } = setup();

    const result = await run('ana@example.com');

    expect(result).toEqual({ userId: 'user-1' });
    expect(users.users.get('user-1')?.assignedRole).toBe('admin');
  });

  it('deja un registro estructurado con el usuario y el rol anterior, sin el email', async () => {
    const { events, run } = setup();

    await run('beto@example.com');

    expect(events).toEqual([{ event: 'admin.granted', userId: 'user-2', previousRole: 'agency' }]);
    expect(JSON.stringify(events)).not.toContain('beto@example.com');
  });

  it('un usuario inexistente falla y no cambia nada', async () => {
    const { users, events, run } = setup();

    await expect(run('nadie@example.com')).rejects.toBeInstanceOf(UserNotFoundError);

    expect([...users.users.values()].map((user) => user.assignedRole)).toEqual([null, 'agency']);
    expect(events).toEqual([]);
  });

  it('un usuario con viviendas activas falla: los roles asignados son excluyentes con publicar', async () => {
    const { users, grants, events, run } = setup();
    grants.activeHomeOwners.add('user-1');

    await expect(run('ana@example.com')).rejects.toBeInstanceOf(UserHasActiveHomesError);

    expect(users.users.get('user-1')?.assignedRole).toBeNull();
    expect(events).toEqual([]);
  });
});
