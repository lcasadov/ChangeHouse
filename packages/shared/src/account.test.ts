import { describe, expect, it } from 'vitest';

import { CONSENT_TYPES, validateConsentInput, validateMeInput } from './account.js';
import { PRIVACY_VERSION, TERMS_VERSION } from './legal.js';

function meErrors(input: unknown) {
  const result = validateMeInput(input);
  return result.success ? [] : result.errors;
}

function consentErrors(input: unknown) {
  const result = validateConsentInput(input);
  return result.success ? [] : result.errors;
}

describe('validateMeInput', () => {
  it('Scenario: Primer acceso completo - acepta el nombre y las versiones aceptadas, recortando espacios', () => {
    const result = validateMeInput({
      displayName: '  Ana  ',
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
    });

    expect(result).toEqual({
      success: true,
      data: {
        displayName: 'Ana',
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
      },
    });
  });

  it('acepta todos los campos opcionales del contrato', () => {
    const input = {
      displayName: 'Ana',
      municipality: 'Madrid',
      phone: '+34600111222',
      meetsVppRequirements: true,
      isOver65: false,
    };

    expect(validateMeInput(input)).toEqual({ success: true, data: input });
  });

  it('exige el nombre visible', () => {
    expect(meErrors({})).toEqual([{ field: 'displayName', code: 'invalid' }]);
    expect(meErrors({ displayName: '   ' })).toEqual([{ field: 'displayName', code: 'required' }]);
  });

  it('limita el nombre visible a 60 caracteres y el municipio a 120', () => {
    expect(meErrors({ displayName: 'x'.repeat(61) })).toEqual([
      { field: 'displayName', code: 'too_long' },
    ]);
    expect(meErrors({ displayName: 'Ana', municipality: 'x'.repeat(121) })).toEqual([
      { field: 'municipality', code: 'too_long' },
    ]);
  });

  it.each(['600111222', '+0600111222', '+34 600 111 222', '+123456', '+1234567890123456'])(
    'rechaza el teléfono %s por no estar en formato E.164',
    (phone) => {
      expect(meErrors({ displayName: 'Ana', phone })).toEqual([
        { field: 'phone', code: 'invalid' },
      ]);
    },
  );

  it('Scenario: El cliente no fija roles - rechaza cualquier campo que no esté en el contrato, señalándolo', () => {
    expect(meErrors({ displayName: 'Ana', roles: ['admin'], assignedRole: 'admin' })).toEqual([
      { field: 'roles', code: 'invalid' },
      { field: 'assignedRole', code: 'invalid' },
    ]);
  });

  it.each([null, 'hola', 42, []])('rechaza un cuerpo que no es un objeto (%j)', (input) => {
    expect(meErrors(input)).toEqual([{ field: 'body', code: 'invalid' }]);
  });
});

describe('validateConsentInput', () => {
  it('acepta un tipo de consentimiento y su versión', () => {
    for (const type of CONSENT_TYPES) {
      expect(validateConsentInput({ type, version: '2026-10' }).success).toBe(true);
    }
  });

  it('el catálogo de tipos coincide con el contrato', () => {
    expect(CONSENT_TYPES).toEqual([
      'terms',
      'privacy',
      'analytics',
      'marketing',
      'third_party_referral',
    ]);
  });

  it('rechaza un tipo desconocido, una versión vacía o demasiado larga y campos extra', () => {
    expect(consentErrors({ type: 'cookies', version: '1' })).toEqual([
      { field: 'type', code: 'invalid' },
    ]);
    expect(consentErrors({ type: 'terms', version: '' })).toEqual([
      { field: 'version', code: 'required' },
    ]);
    expect(consentErrors({ type: 'terms', version: 'x'.repeat(41) })).toEqual([
      { field: 'version', code: 'too_long' },
    ]);
    expect(consentErrors({ type: 'terms', version: '1', userId: 'otro' })).toEqual([
      { field: 'userId', code: 'invalid' },
    ]);
  });
});
