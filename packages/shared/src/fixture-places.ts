/**
 * Lugares de prueba del autocompletado de direcciones, sin clave de Google. Los usa el
 * `FixturePlaceResolver` de la API (local y pruebas) y la app, que ofrece las mismas sugerencias
 * cuando no hay `EXPO_PUBLIC_GOOGLE_PLACES_KEY`: sugerencia y resolución coinciden por `placeId`.
 * Son lugares inventados de la Comunidad de Madrid; ninguno es una dirección real de nadie.
 */
export interface FixturePlace {
  readonly placeId: string;
  /** Dirección tal como la devuelve el autocompletado. */
  readonly formatted: string;
  /** Punto exacto (privado salvo que el propietario elija `exact`). */
  readonly exact: { readonly lat: number; readonly lng: number };
  /** Barrio o zona que se muestra a los demás. */
  readonly areaName: string;
  /** Centro del barrio o zona: el punto público por defecto. */
  readonly areaCenter: { readonly lat: number; readonly lng: number };
}

export const FIXTURE_PLACES: readonly FixturePlace[] = [
  {
    placeId: 'fixture-malasana',
    formatted: 'Calle del Pez, 12, 28004 Madrid, España',
    exact: { lat: 40.4254, lng: -3.7058 },
    areaName: 'Malasaña',
    areaCenter: { lat: 40.4265, lng: -3.7038 },
  },
  {
    placeId: 'fixture-chamberi',
    formatted: 'Calle de Santa Engracia, 45, 28010 Madrid, España',
    exact: { lat: 40.4338, lng: -3.6978 },
    areaName: 'Chamberí',
    areaCenter: { lat: 40.434, lng: -3.7 },
  },
  {
    placeId: 'fixture-retiro',
    formatted: 'Calle de Ibiza, 30, 28009 Madrid, España',
    exact: { lat: 40.4197, lng: -3.6706 },
    areaName: 'Retiro',
    areaCenter: { lat: 40.4153, lng: -3.6844 },
  },
  {
    placeId: 'fixture-lavapies',
    formatted: 'Calle de Argumosa, 5, 28012 Madrid, España',
    exact: { lat: 40.4087, lng: -3.7001 },
    areaName: 'Lavapiés',
    areaCenter: { lat: 40.4082, lng: -3.7035 },
  },
  {
    placeId: 'fixture-alcala',
    formatted: 'Calle Mayor, 20, 28801 Alcalá de Henares, Madrid, España',
    exact: { lat: 40.482, lng: -3.3635 },
    areaName: 'Centro histórico',
    areaCenter: { lat: 40.4818, lng: -3.3642 },
  },
  {
    placeId: 'fixture-getafe',
    formatted: 'Calle Madrid, 8, 28901 Getafe, Madrid, España',
    exact: { lat: 40.3056, lng: -3.7321 },
    areaName: 'Getafe Centro',
    areaCenter: { lat: 40.306, lng: -3.7325 },
  },
];
