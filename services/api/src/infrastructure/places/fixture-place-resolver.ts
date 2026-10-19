import { FIXTURE_PLACES } from '@changehouse/shared';

import type { PlaceResolver } from '../../application/home/place-resolver.js';
import type { HomeLocation } from '../../domain/home/home.js';

/**
 * Resolutor de lugares de prueba, sin red ni clave: usa el catálogo `FIXTURE_PLACES` de
 * `@changehouse/shared`, el mismo que ofrece la app como sugerencias cuando no hay clave de
 * Google. Solo se usa en local y en las pruebas; en Cloud Run rige `GooglePlaceResolver`.
 */
export class FixturePlaceResolver implements PlaceResolver {
  resolve(placeId: string): Promise<HomeLocation | null> {
    const place = FIXTURE_PLACES.find((candidate) => candidate.placeId === placeId);
    return Promise.resolve(
      place ? { exact: place.exact, areaName: place.areaName, areaCenter: place.areaCenter } : null,
    );
  }
}
