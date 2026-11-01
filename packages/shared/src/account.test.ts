import { describe, expect, it } from 'vitest';

import {
  CONSENT_TYPES,
  meInputSchema,
  profileSchema,
  validateConsentInput,
  validateMeInput,
  validateProfileForm,
} from './account.js';
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

  it('Scenario: Borrar el teléfono del perfil - acepta phone null para borrarlo', () => {
    expect(validateMeInput({ displayName: 'Ana', phone: null })).toEqual({
      success: true,
      data: { displayName: 'Ana', phone: null },
    });
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

describe('profileSchema', () => {
  it('es el esquema de perfil que comparten meInputSchema y el formulario: acepta solo los campos de perfil', () => {
    const profile = { displayName: 'Ana', municipality: 'Madrid', phone: '+34612345678' };

    expect(profileSchema.safeParse(profile).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, acceptedTermsVersion: '2026-10' }).success).toBe(
      false,
    );
    expect(meInputSchema.safeParse({ ...profile, acceptedTermsVersion: '2026-10' }).success).toBe(
      true,
    );
  });
});

describe('validateProfileForm', () => {
  const form = {
    displayName: 'Ana',
    municipality: 'Madrid',
    phone: '+34612345678',
    meetsVppRequirements: true,
    isOver65: false,
  };

  function formErrors(input: unknown) {
    const result = validateProfileForm(input);
    return result.success ? [] : result.errors;
  }

  it('Scenario: Guardar cambios del perfil - recorta los textos y quita espacios y guiones del teléfono', () => {
    const result = validateProfileForm({
      ...form,
      displayName: '  Ana García ',
      municipality: ' Getafe ',
      phone: '+34 612-345 678',
    });

    expect(result).toEqual({
      success: true,
      data: { ...form, displayName: 'Ana García', municipality: 'Getafe' },
    });
  });

  it('Scenario: Borrar el teléfono del perfil - un teléfono vacío se envía como null para borrarlo y un municipio vacío es válido', () => {
    const result = validateProfileForm({ ...form, phone: '   ', municipality: '' });

    expect(result).toEqual({
      success: true,
      data: { ...form, phone: null, municipality: '' },
    });
  });

  it('Scenario: Nombre visible vacío - señala el nombre vacío o de más de 60 caracteres', () => {
    expect(formErrors({ ...form, displayName: '   ' })).toEqual([
      { field: 'displayName', code: 'required' },
    ]);
    expect(formErrors({ ...form, displayName: 'x'.repeat(61) })).toEqual([
      { field: 'displayName', code: 'too_long' },
    ]);
  });

  it.each(['612345678', '+0612345678', '+34612', '+34612abc678', '0034612345678'])(
    'Scenario: Teléfono con formato no válido - rechaza %s',
    (phone) => {
      expect(formErrors({ ...form, phone })).toEqual([{ field: 'phone', code: 'invalid' }]);
    },
  );

  it('limita el municipio a 120 caracteres y devuelve un error por campo', () => {
    expect(
      formErrors({ ...form, displayName: '', municipality: 'x'.repeat(121), phone: '1' }),
    ).toEqual([
      { field: 'displayName', code: 'required' },
      { field: 'municipality', code: 'too_long' },
      { field: 'phone', code: 'invalid' },
    ]);
  });
});
