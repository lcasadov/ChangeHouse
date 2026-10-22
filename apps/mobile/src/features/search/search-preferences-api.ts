import type { SearchPreferencesInput } from '@changehouse/shared';

import type { components } from '../../api/schema';

/** Preferencias de búsqueda tal como las devuelve la API (`SearchPreferences` del contrato). */
export type SearchPreferences = components['schemas']['SearchPreferences'];

export type SearchPreferencesApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** La vivienda no existe o no es de esta persona (404 al guardar). */
  | 'not-found'
  /** El servidor rechaza la forma de los datos (400); `fields` los nombra. */
  | 'invalid'
  /** No hay ninguna zona (422 `SEARCH_PREFERENCES_INCOMPLETE`). */
  | 'incomplete'
  | 'server';

export class SearchPreferencesApiError extends Error {
  constructor(
    readonly kind: SearchPreferencesApiErrorKind,
    /** Campos señalados por la API (`errors[].field`), con los nombres de `SearchPreferences`. */
    readonly fields: readonly string[] = [],
  ) {
    super(kind);
    this.name = 'SearchPreferencesApiError';
  }
}

/** Puerto de salida de las preferencias de búsqueda; el adaptador HTTP vive en `http-search-preferences-api.ts`. */
export interface SearchPreferencesApi {
  /** Las del usuario, o `null` si aún no las ha guardado (`getMySearchPreferences`, 404). */
  getMine: () => Promise<SearchPreferences | null>;
  /** Guarda las del usuario, reemplazando el documento entero (`putMySearchPreferences`). */
  putMine: (input: SearchPreferencesInput) => Promise<SearchPreferences>;
  /** Las propias de una vivienda, o `null` si no las tiene (`getHomeSearchPreferences`, 404). */
  getForHome: (homeId: string) => Promise<SearchPreferences | null>;
  /** Define las propias de una vivienda (`putHomeSearchPreferences`). */
  putForHome: (homeId: string, input: SearchPreferencesInput) => Promise<SearchPreferences>;
  /** Vuelve a las del usuario (`deleteHomeSearchPreferences`); si no había propias, no hace nada. */
  deleteForHome: (homeId: string) => Promise<void>;
}
