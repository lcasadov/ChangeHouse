import { randomUUID } from 'expo-crypto';

import type { AddressSuggestion, AddressSuggestions } from './address-suggestions';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

interface PlacesResponse {
  suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[];
}

export interface GoogleAddressSuggestionsOptions {
  /** `EXPO_PUBLIC_GOOGLE_PLACES_KEY`: clave restringida por app, solo para el autocompletado. */
  apiKey: string;
  /** Solo para pruebas: la frontera HTTP simulada. Por defecto, el `fetch` global. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Solo para pruebas: genera el identificador de sesión de búsqueda. */
  newSessionToken?: () => string;
}

/**
 * Autocompletado con Places API (New). Todas las pulsaciones de una búsqueda comparten un
 * `sessionToken`, que se renueva al elegir una sugerencia: así Google las factura como una sola
 * sesión. Solo se piden direcciones de España y en español.
 */
export function createGoogleAddressSuggestions({
  apiKey,
  fetch = (url, init) => globalThis.fetch(url, init),
  newSessionToken = randomUUID,
}: Readonly<GoogleAddressSuggestionsOptions>): AddressSuggestions {
  let sessionToken = newSessionToken();

  return {
    async suggest(query): Promise<AddressSuggestion[]> {
      const response = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify({
          input: query,
          sessionToken,
          languageCode: 'es',
          includedRegionCodes: ['es'],
        }),
      });
      if (!response.ok) throw new Error(`Places respondió ${String(response.status)}`);

      const { suggestions = [] } = (await response.json()) as PlacesResponse;
      return suggestions.flatMap(({ placePrediction }) =>
        placePrediction
          ? [{ placeId: placePrediction.placeId, formatted: placePrediction.text.text }]
          : [],
      );
    },
    endSession() {
      sessionToken = newSessionToken();
    },
  };
}
