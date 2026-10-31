import { describe, expect, it } from 'vitest';

import { makeUser } from '../../../test/fakes.js';
import { CannotSuspendAdminError, CannotSuspendSelfError } from './errors.js';
import { isSuspended, reactivateUser, suspendUser } from './suspension.js';

const NOW = new Date('2026-10-23T10:00:00.000Z');
const ADMIN_ID = 'admin-1';

describe('suspendUser', () => {
  it('guarda el instante y el motivo de la suspensión', () => {
    const user = makeUser({ id: 'user-1' });

    const suspended = suspendUser(user, {
      actorId: ADMIN_ID,
      reason: 'Fraude reiterado',
      now: NOW,
    });

    expect(suspended).toEqual({ ...user, suspendedAt: NOW, suspensionReason: 'Fraude reiterado' });
    expect(isSuspended(suspended)).toBe(true);
  });

  it('un admin no puede suspenderse a sí mismo (409)', () => {
    const self = makeUser({ id: ADMIN_ID, assignedRole: 'admin' });

    const act = () => suspendUser(self, { actorId: ADMIN_ID, reason: 'Prueba', now: NOW });

    expect(act).toThrow(CannotSuspendSelfError);
    expect(new CannotSuspendSelfError()).toMatchObject({
      code: 'CANNOT_SUSPEND_SELF',
      kind: 'conflict',
    });
  });

  it('no se suspende a otro admin sin quitarle antes el rol (409)', () => {
    const other = makeUser({ id: 'admin-2', assignedRole: 'admin' });

    const act = () => suspendUser(other, { actorId: ADMIN_ID, reason: 'Prueba', now: NOW });

    expect(act).toThrow(CannotSuspendAdminError);
    expect(new CannotSuspendAdminError()).toMatchObject({
      code: 'CANNOT_SUSPEND_ADMIN',
      kind: 'conflict',
    });
  });

  it('una gestoría sí puede suspenderse', () => {
    const agency = makeUser({ id: 'agency-1', assignedRole: 'agency' });

    expect(
      isSuspended(suspendUser(agency, { actorId: ADMIN_ID, reason: 'Fraude', now: NOW })),
    ).toBe(true);
  });

  it('suspender a quien ya lo está conserva la suspensión original', () => {
    const before = new Date('2026-10-01T09:00:00.000Z');
    const user = makeUser({ suspendedAt: before, suspensionReason: 'Primera' });

    expect(suspendUser(user, { actorId: ADMIN_ID, reason: 'Segunda', now: NOW })).toBe(user);
  });
});

describe('reactivateUser', () => {
  it('quita la suspensión y su motivo', () => {
    const user = makeUser({ suspendedAt: NOW, suspensionReason: 'Fraude' });

    const active = reactivateUser(user);

    expect(active).toEqual({ ...user, suspendedAt: null, suspensionReason: null });
    expect(isSuspended(active)).toBe(false);
  });

  it('reactivar a quien no está suspendido no cambia nada', () => {
    const user = makeUser();

    expect(reactivateUser(user)).toBe(user);
  });
});
