import { useEffect, useState } from 'react';

import { useServices } from '../session/services';
import { AutoSaver } from './autosave';
import { fromApi, hasZone, type Preferences } from './preferences';
import { useRememberMyPreferences } from './use-search-preferences';

/** Pausa sin cambios antes de guardar lo tocado en los chips y la barra (`design.md`). */
const SAVE_DELAY_MS = 600;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export interface AutosavedPreferences {
  /** Lo que ve la persona ahora, aunque aún no esté guardado. */
  preferences: Preferences;
  status: SaveStatus;
  /** Aplica un cambio y lo guarda tras una pausa; sin zona no se guarda (la API respondería 422). */
  change: (next: Preferences) => void;
  /** Guarda ya, tras la petición en vuelo; rechaza con el error de la API si falla. */
  saveNow: (next: Preferences) => Promise<void>;
}

/**
 * Las preferencias del usuario con guardado automático: una petición cada vez, gana el último
 * estado y, si la API falla, se deshace el cambio local y se avisa. Al salir de la pantalla se
 * guarda lo pendiente.
 */
export function useAutosavedPreferences(saved: Preferences): AutosavedPreferences {
  const { searchPreferencesApi } = useServices();
  const remember = useRememberMyPreferences();
  const [preferences, setPreferences] = useState(saved);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [saver] = useState(() => {
    // Lo último que la API confirmó: a lo que se vuelve si un guardado falla
    let confirmed = saved;
    return new AutoSaver<Preferences>({
      delayMs: SAVE_DELAY_MS,
      save: async (value) => fromApi(await searchPreferencesApi.putMine(value)),
      onSaved: (result, latest) => {
        confirmed = result;
        remember(result);
        if (latest) {
          setPreferences(result);
          setStatus('saved');
        }
      },
      onFailed: () => {
        setPreferences(confirmed);
        setStatus('failed');
      },
    });
  });

  useEffect(
    () => () => {
      saver.flush();
    },
    [saver],
  );

  return {
    preferences,
    status,
    change: (next) => {
      setPreferences(next);
      if (!hasZone(next)) {
        saver.cancel();
        setStatus('idle');
        return;
      }
      setStatus('saving');
      saver.schedule(next);
    },
    saveNow: async (next) => {
      const outcome = await saver.saveNow(next);
      if (outcome.status === 'failed') throw outcome.error;
    },
  };
}
