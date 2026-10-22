import { describe, expect, it } from 'vitest';

import { ConsentRequiredError, createWaitlistEntry, normalizeEmail } from './waitlist-entry.js';

const CONSENT_AT = new Date('2026-10-19T10:00:00.000Z');

const validData = {
  id: '01929f3e-0000-7000-8000-000000000001',
  email: 'juan@example.com',
  municipality: 'Madrid',
  homeType: 'piso',
  lookingFor: 'Una casa con jardín cerca de la sierra',
  consent: true,
  consentAt: CONSENT_AT,
} as const;

describe('normalizeEmail', () => {
  it('pasa a minúsculas y quita los espacios de los extremos', () => {
    expect(normalizeEmail('  Juan.Perez@Example.COM ')).toBe('juan.perez@example.com');
  });

  it('es idempotente', () => {
    const once = normalizeEmail(' A@B.es ');

    expect(normalizeEmail(once)).toBe(once);
  });
});

describe('createWaitlistEntry', () => {
  it('guarda el email normalizado y la fecha del consentimiento', () => {
    const entry = createWaitlistEntry({ ...validData, email: 'Juan@Example.com' });

    expect(entry).toEqual({
      id: validData.id,
      email: 'juan@example.com',
      municipality: 'Madrid',
      homeType: 'piso',
      lookingFor: validData.lookingFor,
      consentAt: CONSENT_AT,
    });
  });

  it('rechaza el alta sin consentimiento', () => {
    expect(() => createWaitlistEntry({ ...validData, consent: false as unknown as true })).toThrow(
      ConsentRequiredError,
    );
  });

  it('el error de consentimiento lleva un código estable', () => {
    const failure = (() => {
      try {
        createWaitlistEntry({ ...validData, consent: false as unknown as true });
      } catch (error) {
        return error as ConsentRequiredError;
      }
      return undefined;
    })();

    expect(failure?.code).toBe('CONSENT_REQUIRED');
  });
});
