import { describe, expect, it } from 'vitest';

import { HOME_TYPES } from './home-type.js';
import { validateWaitlistInput } from './waitlist.js';

const valid = {
  email: 'juan@example.com',
  municipality: 'Madrid',
  homeType: 'piso',
  lookingFor: 'Un ático con terraza',
  consent: true,
};

function errorsFor(input: unknown) {
  const result = validateWaitlistInput(input);
  return result.success ? [] : result.errors;
}

describe('validateWaitlistInput', () => {
  it('Scenario: Alta correcta - acepta datos válidos y recorta los espacios de los extremos', () => {
    const result = validateWaitlistInput({
      ...valid,
      email: '  juan@example.com ',
      municipality: ' Madrid ',
    });

    expect(result).toEqual({
      success: true,
      data: { ...valid },
    });
  });

  it.each(HOME_TYPES)('acepta el tipo de vivienda %s', (homeType) => {
    expect(validateWaitlistInput({ ...valid, homeType }).success).toBe(true);
  });

  it('Scenario: Email no válido - señala el campo email', () => {
    expect(errorsFor({ ...valid, email: 'juan@' })).toEqual([{ field: 'email', code: 'invalid' }]);
  });

  it('Scenario: Tipo de vivienda desconocido - señala homeType', () => {
    expect(errorsFor({ ...valid, homeType: 'castillo' })).toEqual([
      { field: 'homeType', code: 'invalid' },
    ]);
  });

  it('Scenario: Sin aceptar la privacidad - señala el campo consent', () => {
    expect(errorsFor({ ...valid, consent: false })).toEqual([
      { field: 'consent', code: 'invalid' },
    ]);
    expect(
      errorsFor({ email: valid.email, municipality: 'Madrid', homeType: 'piso', lookingFor: 'x' }),
    ).toEqual([{ field: 'consent', code: 'invalid' }]);
  });

  it('señala los campos vacíos o en blanco como obligatorios', () => {
    expect(errorsFor({ ...valid, municipality: '   ', lookingFor: '' })).toEqual([
      { field: 'municipality', code: 'required' },
      { field: 'lookingFor', code: 'required' },
    ]);
  });

  it('señala los textos demasiado largos', () => {
    expect(
      errorsFor({
        ...valid,
        email: `${'a'.repeat(250)}@example.com`,
        municipality: 'm'.repeat(121),
        lookingFor: 'l'.repeat(501),
      }),
    ).toEqual([
      { field: 'email', code: 'too_long' },
      { field: 'municipality', code: 'too_long' },
      { field: 'lookingFor', code: 'too_long' },
    ]);
  });

  it('acepta los textos en el límite exacto', () => {
    const result = validateWaitlistInput({
      ...valid,
      municipality: 'm'.repeat(120),
      lookingFor: 'l'.repeat(500),
    });

    expect(result.success).toBe(true);
  });

  it('devuelve un solo error por campo', () => {
    expect(errorsFor({ ...valid, email: 12, homeType: null })).toEqual([
      { field: 'email', code: 'invalid' },
      { field: 'homeType', code: 'invalid' },
    ]);
  });

  it('rechaza un cuerpo que no es un objeto', () => {
    for (const body of [null, undefined, 'texto', 42, []]) {
      expect(errorsFor(body)).toEqual([{ field: 'body', code: 'invalid' }]);
    }
  });

  it('ignora los campos que no están en el contrato', () => {
    const result = validateWaitlistInput({ ...valid, admin: true });

    expect(result).toEqual({ success: true, data: { ...valid } });
  });
});
