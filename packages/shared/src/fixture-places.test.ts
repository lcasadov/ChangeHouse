import { describe, expect, it } from 'vitest';

import { FIXTURE_PLACES } from './fixture-places.js';

describe('FIXTURE_PLACES', () => {
  it('ofrece un catálogo pequeño con identificadores únicos y prefijo fixture-', () => {
    const ids = FIXTURE_PLACES.map((place) => place.placeId);

    expect(FIXTURE_PLACES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('fixture-'))).toBe(true);
  });

  it('cada lugar tiene dirección, barrio y coordenadas válidas, con el centro del barrio distinto del punto exacto', () => {
    for (const place of FIXTURE_PLACES) {
      expect(place.formatted.length).toBeGreaterThan(0);
      expect(place.areaName.length).toBeGreaterThan(0);
      for (const point of [place.exact, place.areaCenter]) {
        expect(point.lat).toBeGreaterThan(-90);
        expect(point.lat).toBeLessThan(90);
        expect(point.lng).toBeGreaterThan(-180);
        expect(point.lng).toBeLessThan(180);
      }
      expect(place.areaCenter).not.toEqual(place.exact);
    }
  });
});
