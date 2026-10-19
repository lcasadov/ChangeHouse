import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ASSIGNED_ROLES, deriveRole } from './role.js';

describe('deriveRole', () => {
  it('un usuario sin rol asignado y sin vivienda publicada es seeker', () => {
    expect(deriveRole(null, false)).toBe('seeker');
  });

  it('un usuario sin rol asignado y con vivienda publicada es owner', () => {
    expect(deriveRole(null, true)).toBe('owner');
  });

  it('el rol asignado prevalece y es exclusivo: admin y agency nunca son owner', () => {
    expect(deriveRole('admin', true)).toBe('admin');
    expect(deriveRole('agency', true)).toBe('agency');
    expect(deriveRole('admin', false)).toBe('admin');
  });

  it('propiedad: el rol asignado siempre se conserva y, sin él, depende solo de la vivienda', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, ...ASSIGNED_ROLES),
        fc.boolean(),
        (assigned, hasPublishedHome) => {
          const expected = assigned ?? (hasPublishedHome ? 'owner' : 'seeker');
          expect(deriveRole(assigned, hasPublishedHome)).toBe(expected);
        },
      ),
    );
  });
});
