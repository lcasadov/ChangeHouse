import { useEffect, useState } from 'react';

import { useServices } from '../session/services';
import type { ZoneSuggestion } from './zone-suggestions';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export interface ZoneSearch {
  /** `idle`: aún no se busca; `ready`: hay respuesta (puede estar vacía). */
  status: 'idle' | 'searching' | 'ready' | 'error';
  suggestions: readonly ZoneSuggestion[];
}

const IDLE: ZoneSearch = { status: 'idle', suggestions: [] };
const SEARCHING: ZoneSearch = { status: 'searching', suggestions: [] };

interface Outcome extends ZoneSearch {
  /** La búsqueda a la que responde: una respuesta de otro texto no vale. */
  query: string;
}

/**
 * Busca zonas para lo escrito tras una pausa breve. El estado se deriva del texto actual y de la
 * última respuesta: una que llega cuando ya se escribió otra cosa se descarta.
 */
export function useZoneSearch(query: string): ZoneSearch {
  const { zoneSuggestions } = useServices();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const text = query.trim();
  const active = text.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!active) return undefined;

    let current = true;
    const timer = setTimeout(() => {
      zoneSuggestions.suggest(text).then(
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
  }, [text, active, zoneSuggestions]);

  if (!active) return IDLE;
  return outcome?.query === text ? outcome : SEARCHING;
}
