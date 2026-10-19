import type { SearchPreferences } from '../../domain/search-preferences/search-preferences.js';

/** Ámbito de unas preferencias: las del usuario (`homeId` nulo) o las propias de una de sus viviendas. */
export interface PreferencesScope {
  readonly userId: string;
  readonly homeId: string | null;
}

/** Puerto de salida: almacén de las preferencias de búsqueda. */
export interface SearchPreferencesRepository {
  find(scope: PreferencesScope): Promise<SearchPreferences | null>;
  /** Crea o reemplaza por completo las del ámbito; `id` solo se usa si la fila es nueva. */
  upsert(
    scope: PreferencesScope,
    id: string,
    preferences: SearchPreferences,
  ): Promise<SearchPreferences>;
  /** `false` si la vivienda no tenía preferencias propias. */
  deleteForHome(homeId: string): Promise<boolean>;
}
