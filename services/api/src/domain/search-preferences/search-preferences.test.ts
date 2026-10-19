import { describe, expect, it } from 'vitest';

import { SearchPreferencesIncompleteError } from './errors.js';
import {
  newSearchPreferences,
  normalizedMunicipalities,
  normalizeMunicipality,
} from './search-preferences.js';

const AMOUNTS = { maxToPayCents: 30_000_00, minToReceiveCents: 0, valueReferencePct: 50 };

describe('normalizeMunicipality', () => {
  it.each([
    ['Getafe', 'getafe'],
    ['  ALCOBENDAS ', 'alcobendas'],
    ['Alcalá de Henares', 'alcala de henares'],
    ['Alcalá   de\tHenares', 'alcala de henares'],
    ['Cádiz', 'cadiz'],
    ['A Coruña', 'a coruna'],
    ['Peñíscola', 'peniscola'],
  ])('compara %j como %j, sin tildes ni mayúsculas', (text, expected) => {
    expect(normalizeMunicipality(text)).toBe(expected);
  });
});

describe('newSearchPreferences', () => {
  it('conserva el texto elegido y completa los filtros vacíos', () => {
    const preferences = newSearchPreferences({ ...AMOUNTS, municipalities: ['Getafe'] });

    expect(preferences).toEqual({
      center: null,
      radiusKm: null,
      municipalities: ['Getafe'],
      filters: {},
      ...AMOUNTS,
    });
  });

  it('Scenario: Guardar preferencias - acepta un punto con radio como única zona', () => {
    const preferences = newSearchPreferences({
      ...AMOUNTS,
      center: { lat: 40.4, lng: -3.7 },
      radiusKm: 5,
      filters: { garage: true },
    });

    expect(preferences).toMatchObject({
      center: { lat: 40.4, lng: -3.7 },
      radiusKm: 5,
      municipalities: [],
      filters: { garage: true },
    });
  });

  it('elimina los municipios repetidos una vez normalizados y se queda con la primera forma', () => {
    const preferences = newSearchPreferences({
      ...AMOUNTS,
      municipalities: ['Alcalá de Henares', 'alcala de henares', 'Getafe'],
    });

    expect(preferences.municipalities).toEqual(['Alcalá de Henares', 'Getafe']);
    expect(normalizedMunicipalities(preferences)).toEqual(['alcala de henares', 'getafe']);
  });

  it('Scenario: Sin zona - sin municipio ni punto con radio no se guarda', () => {
    expect(() => newSearchPreferences(AMOUNTS)).toThrow(SearchPreferencesIncompleteError);
    expect(() => newSearchPreferences({ ...AMOUNTS, municipalities: [] })).toThrow(
      SearchPreferencesIncompleteError,
    );
  });

  it('el error de zona señala el campo y es una regla de negocio', () => {
    const error = new SearchPreferencesIncompleteError();

    expect(error.code).toBe('SEARCH_PREFERENCES_INCOMPLETE');
    expect(error.kind).toBe('rule');
    expect(error.fields).toEqual(['municipalities']);
  });
});
