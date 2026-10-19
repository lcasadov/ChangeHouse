import { FIXTURE_PLACES } from '@changehouse/shared';

import type { ZoneSuggestion, ZoneSuggestions } from './zone-suggestions';

/** Municipios de prueba (nombres, no datos de nadie): la Comunidad de Madrid y varias capitales. */
const FIXTURE_MUNICIPALITIES = [
  'Madrid',
  'Alcobendas',
  'Alcalá de Henares',
  'Getafe',
  'Leganés',
  'Móstoles',
  'Fuenlabrada',
  'Pozuelo de Alarcón',
  'Las Rozas de Madrid',
  'Valencia',
  'Barcelona',
  'Sevilla',
  'Málaga',
  'Alicante',
  'Bilbao',
  'Zaragoza',
] as const;

const MAX_SUGGESTIONS = 6;

/** Minúsculas y sin tildes: «Alcalá» y «alcala» son lo mismo al buscar. */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Sugerencias de zona de prueba para local y pruebas, sin clave: municipios y los barrios de los
 * lugares de prueba compartidos con la API. Los municipios van primero.
 */
export function createFixtureZoneSuggestions(): ZoneSuggestions {
  return {
    suggest: (query) => {
      const wanted = normalize(query.trim());
      const municipalities = FIXTURE_MUNICIPALITIES.filter((name) =>
        normalize(name).includes(wanted),
      ).map((name): ZoneSuggestion => ({
        kind: 'municipality',
        id: `municipality:${name}`,
        label: name,
      }));
      const places = FIXTURE_PLACES.filter((place) =>
        normalize(place.areaName).includes(wanted),
      ).map((place): ZoneSuggestion => ({
        kind: 'place',
        id: place.placeId,
        label: place.areaName,
        center: place.areaCenter,
      }));
      return Promise.resolve([...municipalities, ...places].slice(0, MAX_SUGGESTIONS));
    },
  };
}
