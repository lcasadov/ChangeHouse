import { FIXTURE_PLACES } from '@changehouse/shared';
import { describe, expect, it } from 'vitest';

import { FixturePlaceResolver } from './fixture-place-resolver.js';

describe('FixturePlaceResolver', () => {
  it.each(FIXTURE_PLACES.map((place) => [place.placeId, place] as const))(
    'resuelve %s a su punto exacto, su barrio o zona, el centro de esta y su municipio',
    async (placeId, place) => {
      const location = await new FixturePlaceResolver().resolve(placeId);

      expect(location).toEqual({
        exact: place.exact,
        areaName: place.areaName,
        areaCenter: place.areaCenter,
        municipality: place.municipality,
      });
    },
  );

  it('el centro del barrio nunca coincide con el punto exacto: así la ubicación por zona no revela la dirección', () => {
    for (const place of FIXTURE_PLACES) {
      expect(place.areaCenter).not.toEqual(place.exact);
    }
  });

  it('Scenario: Dirección no reconocida - un identificador que no está en el catálogo no se resuelve', async () => {
    await expect(new FixturePlaceResolver().resolve('fixture-desconocido')).resolves.toBeNull();
    await expect(new FixturePlaceResolver().resolve('')).resolves.toBeNull();
  });
});
