import { describe, expect, it } from 'vitest';

import { makeUser } from '../../../test/fakes.js';
import { anonymizedEmail, anonymizeUser, DELETED_DISPLAY_NAME } from './account-deletion.js';

const AT = new Date('2026-10-30T10:00:00.000Z');

describe('anonymizeUser', () => {
  it('sustituye email y nombre, borra teléfono y municipio y marca la fecha de borrado', () => {
    const user = makeUser({
      id: 'u1',
      email: 'ana@example.com',
      displayName: 'Ana García',
      phone: '+34600111222',
      municipality: 'Getafe',
    });

    const anonymous = anonymizeUser(user, AT);

    expect(anonymous).toMatchObject({
      email: 'deleted+u1@changehouse.invalid',
      displayName: DELETED_DISPLAY_NAME,
      phone: null,
      municipality: null,
      deletedAt: AT,
    });
  });

  it('conserva la identidad interna: id, uid de Firebase, rol asignado y fecha de alta', () => {
    const user = makeUser({ id: 'u1', firebaseUid: 'uid-1', assignedRole: 'agency' });

    expect(anonymizeUser(user, AT)).toMatchObject({
      id: 'u1',
      firebaseUid: 'uid-1',
      assignedRole: 'agency',
      createdAt: user.createdAt,
    });
  });

  it('el email anonimizado es único por usuario y no reconocible', () => {
    expect(anonymizedEmail('a')).not.toBe(anonymizedEmail('b'));
    expect(anonymizedEmail('0199-abc')).toBe('deleted+0199-abc@changehouse.invalid');
  });

  it('no modifica el usuario original', () => {
    const user = makeUser({ phone: '+34600111222' });

    anonymizeUser(user, AT);

    expect(user.phone).toBe('+34600111222');
    expect(user.deletedAt).toBeNull();
  });
});
