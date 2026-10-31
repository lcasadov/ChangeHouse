import { describe, expect, it } from 'vitest';

import {
  FixedHomeOwnership,
  InMemoryAuditLog,
  InMemoryMatchReader,
  InMemorySuspensionUnitOfWork,
  InMemoryUserRepository,
  makeUser,
} from '../../../test/fakes.js';
import { CannotSuspendAdminError, CannotSuspendSelfError } from '../../domain/account/errors.js';
import type { User } from '../../domain/account/user.js';
import type { MatchStatus } from '../../domain/matching/match.js';
import type { MatchRecord } from '../matching/matching-repository.js';
import { UserToModerateNotFoundError } from './errors.js';
import { userSuspensionOperations } from './user-suspension.js';

const NOW = new Date('2026-10-23T10:00:00.000Z');
const ADMIN = 'admin-1';
const TARGET = 'user-2';
const OTHER = 'user-3';

function match(id: string, status: MatchStatus, users: readonly string[] = [TARGET, OTHER]) {
  return {
    id,
    type: 2,
    status,
    createdAt: new Date('2026-10-10T09:00:00.000Z'),
    participants: users.map((userId, index) => ({
      homeId: `${id}-home-${String(index)}`,
      userId,
      displayName: userId,
      givesHomeId: `${id}-home-${String(index)}`,
      receivesHomeId: `${id}-home-${String((index + 1) % users.length)}`,
      compensationCents: 0,
      status: 'pending' as const,
    })),
  } satisfies MatchRecord;
}

function setup(options: { users?: User[]; matches?: MatchRecord[]; owners?: string[] } = {}) {
  const users = new InMemoryUserRepository(
    options.users ?? [
      makeUser({ id: ADMIN, firebaseUid: 'uid-admin', email: 'a@x.es', assignedRole: 'admin' }),
      makeUser({ id: TARGET, firebaseUid: 'uid-2', email: 'b@x.es', displayName: 'Beto' }),
    ],
  );
  const reader = new InMemoryMatchReader(options.matches ?? []);
  const audit = new InMemoryAuditLog();
  const units = new InMemorySuspensionUnitOfWork(users, reader, audit);
  const operations = userSuspensionOperations({
    units,
    ownership: new FixedHomeOwnership(new Set(options.owners ?? [])),
    clock: { now: () => NOW },
  });
  return { users, reader, audit, units, ...operations };
}

describe('adminSetUserSuspension', () => {
  it('Scenario: Suspender con motivo - el usuario queda suspendido y existe la entrada de auditoría', async () => {
    const { users, audit, adminSetUserSuspension } = setup({ owners: [TARGET] });

    const view = await adminSetUserSuspension(ADMIN, TARGET, {
      suspended: true,
      reason: 'Fraude reiterado',
    });

    expect(view).toEqual({
      id: TARGET,
      email: 'b@x.es',
      displayName: 'Beto',
      roles: ['owner'],
      suspended: true,
      createdAt: '2026-10-01T09:00:00.000Z',
    });
    expect(users.users.get(TARGET)).toMatchObject({
      suspendedAt: NOW,
      suspensionReason: 'Fraude reiterado',
    });
    expect(audit.entries).toEqual([
      { actorId: ADMIN, action: 'user.suspend', entity: 'user', entityId: TARGET, at: NOW },
    ]);
  });

  it('un admin no puede suspenderse a sí mismo y no se escribe nada', async () => {
    const { users, audit, adminSetUserSuspension } = setup();

    await expect(
      adminSetUserSuspension(ADMIN, ADMIN, { suspended: true, reason: 'Prueba' }),
    ).rejects.toBeInstanceOf(CannotSuspendSelfError);
    expect(users.users.get(ADMIN)?.suspendedAt).toBeNull();
    expect(audit.entries).toEqual([]);
  });

  it('no se puede suspender a otro admin', async () => {
    const { adminSetUserSuspension } = setup({
      users: [
        makeUser({ id: ADMIN, firebaseUid: 'uid-a', email: 'a@x.es', assignedRole: 'admin' }),
        makeUser({ id: TARGET, firebaseUid: 'uid-b', email: 'b@x.es', assignedRole: 'admin' }),
      ],
    });

    await expect(
      adminSetUserSuspension(ADMIN, TARGET, { suspended: true, reason: 'Prueba' }),
    ).rejects.toBeInstanceOf(CannotSuspendAdminError);
  });

  it('un usuario inexistente responde como no encontrado', async () => {
    const { adminSetUserSuspension } = setup();

    await expect(
      adminSetUserSuspension(ADMIN, 'nadie', { suspended: true, reason: 'Prueba' }),
    ).rejects.toBeInstanceOf(UserToModerateNotFoundError);
    expect(new UserToModerateNotFoundError()).toMatchObject({ kind: 'not_found' });
  });

  it('Scenario: Sus viviendas desaparecen - sus matches abiertos o confirmados se cierran para todos y quedan auditados', async () => {
    const { reader, audit, units, adminSetUserSuspension } = setup({
      matches: [
        match('m-open', 'open'),
        match('m-confirmed', 'confirmed'),
        match('m-closed', 'closed'),
        match('m-others', 'open', [OTHER, 'user-4']),
      ],
    });

    await adminSetUserSuspension(ADMIN, TARGET, { suspended: true, reason: 'Fraude reiterado' });

    const byId = (id: string) => reader.records.find((record) => record.id === id);
    for (const id of ['m-open', 'm-confirmed']) {
      expect(byId(id)?.status).toBe('closed');
      expect(byId(id)?.participants.map((p) => [p.userId, p.status])).toEqual([
        [TARGET, 'withdrawn'],
        [OTHER, 'pending'],
      ]);
    }
    expect(byId('m-others')?.status).toBe('open');
    expect(units.locked).toEqual([TARGET]);
    expect(audit.entries.map((entry) => [entry.action, entry.entity, entry.entityId])).toEqual([
      ['user.suspend', 'user', TARGET],
      ['match.close', 'match', 'm-open'],
      ['match.close', 'match', 'm-confirmed'],
    ]);
    expect(audit.entries.every((entry) => entry.actorId === ADMIN && entry.at === NOW)).toBe(true);
  });

  it('si la auditoría falla, ni el usuario queda suspendido ni se cierra ningún match', async () => {
    const { users, reader, audit, adminSetUserSuspension } = setup({
      matches: [match('m-open', 'open')],
    });
    audit.failWith = new Error('auditoría caída');

    await expect(
      adminSetUserSuspension(ADMIN, TARGET, { suspended: true, reason: 'Fraude' }),
    ).rejects.toThrow('auditoría caída');
    expect(users.users.get(TARGET)?.suspendedAt).toBeNull();
    expect(reader.records[0]?.status).toBe('open');
  });

  it('reactivar devuelve el acceso, queda auditado y no reabre los matches cerrados', async () => {
    const { users, reader, audit, adminSetUserSuspension } = setup({
      matches: [match('m-open', 'open')],
    });
    await adminSetUserSuspension(ADMIN, TARGET, { suspended: true, reason: 'Fraude' });

    const view = await adminSetUserSuspension(ADMIN, TARGET, {
      suspended: false,
      reason: 'Recurso estimado',
    });

    expect(view).toMatchObject({ id: TARGET, suspended: false, roles: ['seeker'] });
    expect(users.users.get(TARGET)).toMatchObject({ suspendedAt: null, suspensionReason: null });
    expect(reader.records[0]?.status).toBe('closed');
    expect(audit.entries.at(-1)).toEqual({
      actorId: ADMIN,
      action: 'user.reactivate',
      entity: 'user',
      entityId: TARGET,
      at: NOW,
    });
  });

  it('repetir la misma decisión no cambia nada ni deja otra entrada de auditoría', async () => {
    const { audit, adminSetUserSuspension } = setup();
    await adminSetUserSuspension(ADMIN, TARGET, { suspended: true, reason: 'Fraude' });

    const again = await adminSetUserSuspension(ADMIN, TARGET, { suspended: true, reason: 'Otra' });
    const activeAgain = await adminSetUserSuspension(ADMIN, ADMIN, {
      suspended: false,
      reason: 'Nada que hacer',
    });

    expect(again.suspended).toBe(true);
    expect(activeAgain).toMatchObject({ id: ADMIN, suspended: false, roles: ['admin'] });
    expect(audit.entries.map((entry) => entry.action)).toEqual(['user.suspend']);
  });
});
