import { useEffect, useState } from 'react';

import { useServices } from '../session/services';
import type { AddressSuggestion } from './address-suggestions';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

export interface AddressSearch {
  /** `idle`: aún no se busca; `ready`: hay respuesta (puede estar vacía). */
  status: 'idle' | 'searching' | 'ready' | 'error';
  suggestions: readonly AddressSuggestion[];
}

const IDLE: AddressSearch = { status: 'idle', suggestions: [] };
const SEARCHING: AddressSearch = { status: 'searching', suggestions: [] };

interface Outcome extends AddressSearch {
  /** La búsqueda a la que responde: una respuesta de otro texto no vale. */
  query: string;
}

/**
 * Busca sugerencias para lo escrito tras una pausa breve (menos llamadas al servicio de
 * direcciones). El estado se deriva del texto actual y de la última respuesta: una que llega cuando
 * ya se escribió otra cosa se descarta.
 */
export function useAddressSearch(query: string, enabled: boolean): AddressSearch {
  const { addressSuggestions } = useServices();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const text = query.trim();
  const active = enabled && text.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!active) return undefined;

    let current = true;
    const timer = setTimeout(() => {
      addressSuggestions.suggest(text).then(
        (suggestions) => {
          if (current) setOutcome({ query: text, status: 'ready', suggestions });
        },
        () => {
          if (current) setOutcome({ query: text, status: 'error', suggestions: [] });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text, active, addressSuggestions]);

  if (!active) return IDLE;
  return outcome?.query === text ? outcome : SEARCHING;
}
