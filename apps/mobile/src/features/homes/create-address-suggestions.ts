import type { AddressSuggestions } from './address-suggestions';
import { createFixtureAddressSuggestions } from './fixture-address-suggestions';
import { createGoogleAddressSuggestions } from './google-address-suggestions';

export interface AddressSuggestionsEnv {
  /** Clave de Google Places restringida por app; sin ella se usan los lugares de prueba. */
  EXPO_PUBLIC_GOOGLE_PLACES_KEY?: string | undefined;
}

/** Google Places si hay clave; si no, las sugerencias de prueba que la API también sabe resolver. */
export function createAddressSuggestions(env: Readonly<AddressSuggestionsEnv>): AddressSuggestions {
  const apiKey = env.EXPO_PUBLIC_GOOGLE_PLACES_KEY?.trim();
  return apiKey ? createGoogleAddressSuggestions({ apiKey }) : createFixtureAddressSuggestions();
}
