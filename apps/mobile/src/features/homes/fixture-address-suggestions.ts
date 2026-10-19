import { FIXTURE_PLACES } from '@changehouse/shared';

import type { AddressSuggestions } from './address-suggestions';

/** Minúsculas y sin tildes: «Alcalá» y «alcala» son lo mismo al buscar. */
const normalize = (text: string) => text.normalize('NFD').replaceAll(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Sugerencias de prueba para local y pruebas, sin clave de Google: los mismos lugares que resuelve
 * el `FixturePlaceResolver` de la API, buscados por su dirección o por el nombre del barrio.
 */
export function createFixtureAddressSuggestions(): AddressSuggestions {
  return {
    suggest: (query) => {
      const wanted = normalize(query.trim());
      const matches = FIXTURE_PLACES.filter((place) =>
        normalize(`${place.formatted} ${place.areaName}`).includes(wanted),
      );
      return Promise.resolve(matches.map(({ placeId, formatted }) => ({ placeId, formatted })));
    },
    endSession: () => undefined,
  };
}
