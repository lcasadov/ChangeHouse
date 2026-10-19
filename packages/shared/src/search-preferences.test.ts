import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VALUE_REFERENCE_PCT,
  MAX_RADIUS_KM,
  validateSearchPreferences,
} from './search-preferences.js';

const BASE = { maxToPayCents: 30_000_00, minToReceiveCents: 0 };

function fields(input: unknown): string[] {
  const result = validateSearchPreferences(input);
  return result.success ? [] : result.errors.map((error) => error.field);
}

describe('validateSearchPreferences', () => {
  it('Scenario: Guardar preferencias - aplica el punto de referencia 50 si no se envía', () => {
    const result = validateSearchPreferences({
      ...BASE,
      municipalities: ['Getafe'],
      filters: { minBedrooms: 3 },
    });

    expect(DEFAULT_VALUE_REFERENCE_PCT).toBe(50);
    expect(result).toEqual({
      success: true,
      data: {
        ...BASE,
        municipalities: ['Getafe'],
        filters: { minBedrooms: 3 },
        valueReferencePct: 50,
      },
    });
  });

  it('acepta un punto con radio, recorta los municipios y respeta el punto de referencia enviado', () => {
    const result = validateSearchPreferences({
      ...BASE,
      center: { lat: 40.4, lng: -3.7 },
      radiusKm: MAX_RADIUS_KM,
      municipalities: ['  Alcobendas '],
      valueReferencePct: 0,
    });

    expect(result.success && result.data).toMatchObject({
      radiusKm: 200,
      municipalities: ['Alcobendas'],
      valueReferencePct: 0,
    });
  });

  it('acepta todos los filtros del contrato', () => {
    const filters = {
      types: ['piso', 'casa'],
      minUsefulM2: 60.5,
      minBedrooms: 2,
      minBathrooms: 1,
      garage: true,
      lift: false,
      exterior: true,
    };

    expect(
      validateSearchPreferences({ ...BASE, municipalities: ['Getafe'], filters }).success,
    ).toBe(true);
  });

  it('Scenario: Punto de referencia fuera de rango - señala valueReferencePct', () => {
    expect(fields({ ...BASE, municipalities: ['Getafe'], valueReferencePct: 120 })).toEqual([
      'valueReferencePct',
    ]);
    expect(fields({ ...BASE, municipalities: ['Getafe'], valueReferencePct: -1 })).toEqual([
      'valueReferencePct',
    ]);
    expect(fields({ ...BASE, municipalities: ['Getafe'], valueReferencePct: 50.5 })).toEqual([
      'valueReferencePct',
    ]);
  });

  it.each([
    [{ center: { lat: 40.4, lng: -3.7 } }, 'radiusKm'],
    [{ radiusKm: 5 }, 'center'],
    [{ center: { lat: 40.4, lng: -3.7 }, radiusKm: 0 }, 'radiusKm'],
    [{ center: { lat: 40.4, lng: -3.7 }, radiusKm: 200.1 }, 'radiusKm'],
    [{ center: { lat: 91, lng: -3.7 }, radiusKm: 5 }, 'center.lat'],
    [{ municipalities: [''] }, 'municipalities.0'],
    [{ municipalities: ['a'.repeat(121)] }, 'municipalities.0'],
    [{ municipalities: Array.from({ length: 51 }, (_, i) => `m${String(i)}`) }, 'municipalities'],
    [{ municipalities: ['Getafe'], filters: { types: ['castillo'] } }, 'filters.types.0'],
    [{ municipalities: ['Getafe'], filters: { minBedrooms: -1 } }, 'filters.minBedrooms'],
    [{ municipalities: ['Getafe'], filters: { wifi: true } }, 'filters.wifi'],
    [{ municipalities: ['Getafe'], home_id: 'x' }, 'home_id'],
  ])('rechaza %j señalando %s', (extra, field) => {
    expect(fields({ ...BASE, ...extra })).toEqual([field]);
  });

  it.each([
    [{ minToReceiveCents: 0 }, 'maxToPayCents'],
    [{ maxToPayCents: 1 }, 'minToReceiveCents'],
    [{ maxToPayCents: -1, minToReceiveCents: 0 }, 'maxToPayCents'],
    [{ maxToPayCents: 1.5, minToReceiveCents: 0 }, 'maxToPayCents'],
  ])('rechaza los importes %j señalando %s', (amounts, field) => {
    expect(fields({ municipalities: ['Getafe'], ...amounts })).toEqual([field]);
  });

  it('no exige zona: la ausencia de zona es una regla de negocio (422), no de forma', () => {
    expect(validateSearchPreferences(BASE).success).toBe(true);
    expect(validateSearchPreferences({ ...BASE, municipalities: [] }).success).toBe(true);
  });

  it('rechaza un cuerpo que no es un objeto', () => {
    expect(fields(null)).toEqual(['body']);
  });
});
