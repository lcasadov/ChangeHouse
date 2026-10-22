import { describe, expect, it } from 'vitest';

import { validateHomeInput, validateHomePatch } from './home.js';
import type { Validation } from './validation.js';

const address = { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12, 28004 Madrid' };

function errorsOf(result: Validation<unknown>) {
  return result.success ? [] : result.errors;
}

describe('validateHomeInput', () => {
  it('Scenario: Alta de vivienda en borrador - basta el tipo y la dirección para abrir el borrador', () => {
    expect(validateHomeInput({ type: 'piso', address })).toEqual({
      success: true,
      data: { type: 'piso', address },
    });
  });

  it('acepta todos los campos del contrato', () => {
    const input = {
      type: 'atico',
      regime: 'VPPB',
      address,
      usefulM2: 82.5,
      builtM2: 95,
      bedrooms: 3,
      bathrooms: 2,
      floor: '4ª',
      hasLift: true,
      garage: false,
      storageRoom: true,
      features: { terrace: true, heating: 'central', condition: 'good' },
      locationVisibility: 'exact',
      energyRating: 'C',
      yearBuilt: 1998,
      valueMinCents: 25_000_000,
      valueMaxCents: 28_000_000,
      isPrimaryResidence: true,
      mortgageOutstandingCents: 0,
      vppQualificationDate: '2005-03-01',
      vppProtectionEnd: '2035-03-01',
      vppMaxLegalPriceCents: 19_000_000,
    };

    expect(validateHomeInput(input)).toEqual({ success: true, data: input });
  });

  it('exige el tipo y la dirección', () => {
    expect(errorsOf(validateHomeInput({}))).toEqual([
      { field: 'type', code: 'invalid' },
      { field: 'address', code: 'invalid' },
    ]);
  });

  it('rechaza una dirección sin placeId o demasiado larga', () => {
    expect(errorsOf(validateHomeInput({ type: 'piso', address: { formatted: 'x' } }))).toEqual([
      { field: 'address.placeId', code: 'invalid' },
    ]);
    expect(
      errorsOf(
        validateHomeInput({ type: 'piso', address: { ...address, formatted: 'x'.repeat(301) } }),
      ),
    ).toEqual([{ field: 'address.formatted', code: 'too_long' }]);
  });

  it('rechaza valores fuera de rango y listas cerradas', () => {
    const fields = errorsOf(
      validateHomeInput({
        type: 'castillo',
        address,
        usefulM2: 0,
        builtM2: 10_001,
        bedrooms: -1,
        bathrooms: 1.5,
        energyRating: 'H',
        yearBuilt: 1700,
        valueMinCents: -1,
        valueMaxCents: 1.5,
        locationVisibility: 'secret',
        vppQualificationDate: '01/03/2005',
        features: { heating: 'nuclear' },
      }),
    ).map((error) => error.field);

    expect([...fields].sort()).toEqual(
      [
        'type',
        'usefulM2',
        'builtM2',
        'bedrooms',
        'bathrooms',
        'energyRating',
        'yearBuilt',
        'valueMinCents',
        'valueMaxCents',
        'locationVisibility',
        'vppQualificationDate',
        'features.heating',
      ].sort(),
    );
  });

  it('Scenario: Alta de vivienda en borrador - el cliente no fija el estado, el propietario ni los campos desconocidos', () => {
    const fields = errorsOf(
      validateHomeInput({ type: 'piso', address, status: 'published', ownerId: 'x' }),
    ).map((error) => error.field);

    expect(fields).toEqual(['status', 'ownerId']);
  });
});

describe('validateHomePatch', () => {
  it('acepta cualquier subconjunto de campos', () => {
    expect(validateHomePatch({ bedrooms: 2 })).toEqual({ success: true, data: { bedrooms: 2 } });
    expect(validateHomePatch({ address })).toEqual({ success: true, data: { address } });
  });

  it('rechaza un cuerpo vacío', () => {
    expect(errorsOf(validateHomePatch({}))).toEqual([{ field: 'body', code: 'invalid' }]);
  });

  it('rechaza campos desconocidos y valores erróneos', () => {
    expect(errorsOf(validateHomePatch({ status: 'published', usefulM2: -3 }))).toEqual([
      { field: 'usefulM2', code: 'required' },
      { field: 'status', code: 'invalid' },
    ]);
  });
});
