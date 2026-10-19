import type { SearchPreferencesInput } from '@changehouse/shared';

import {
  newSearchPreferences,
  type SearchPreferences,
} from '../../domain/search-preferences/search-preferences.js';
import { HomeNotFoundError } from '../home/errors.js';
import type { HomeRepository } from '../home/home-repository.js';
import { ownHome } from '../home/own-home.js';
import type { IdGenerator } from '../id-generator.js';
import { SearchPreferencesNotFoundError } from './errors.js';
import type {
  PreferencesScope,
  SearchPreferencesRepository,
} from './search-preferences-repository.js';
import { type SearchPreferencesView, toSearchPreferencesView } from './search-preferences-views.js';

export interface SearchPreferencesDeps {
  homes: HomeRepository;
  preferences: SearchPreferencesRepository;
  ids: IdGenerator;
}

/** De dónde salen las preferencias que valen para una vivienda. */
export interface EffectivePreferences {
  scope: 'home' | 'user';
  preferences: SearchPreferences;
}

async function found(
  deps: SearchPreferencesDeps,
  scope: PreferencesScope,
): Promise<SearchPreferencesView> {
  const preferences = await deps.preferences.find(scope);
  if (!preferences) throw new SearchPreferencesNotFoundError();
  return toSearchPreferencesView(preferences);
}

/** Sustituye el documento entero del ámbito, tras comprobar la regla de la zona. */
async function replace(
  deps: SearchPreferencesDeps,
  scope: PreferencesScope,
  input: SearchPreferencesInput,
): Promise<SearchPreferencesView> {
  const saved = await deps.preferences.upsert(scope, deps.ids.next(), newSearchPreferences(input));
  return toSearchPreferencesView(saved);
}

/** Una vivienda propia como ámbito; la ajena y la inexistente son indistinguibles (404). */
async function homeScope(
  deps: SearchPreferencesDeps,
  userId: string,
  homeId: string,
): Promise<PreferencesScope & { homeId: string }> {
  const home = await ownHome(deps.homes, userId, homeId);
  return { userId, homeId: home.id };
}

/** Las de la vivienda si las tiene; si no, las de su propietario; si no hay ninguna, `null`. */
async function resolveEffectivePreferences(
  deps: SearchPreferencesDeps,
  homeId: string,
): Promise<EffectivePreferences | null> {
  const home = await deps.homes.findById(homeId);
  if (!home) throw new HomeNotFoundError();
  const own = await deps.preferences.find({ userId: home.ownerId, homeId });
  if (own) return { scope: 'home', preferences: own };
  const shared = await deps.preferences.find({ userId: home.ownerId, homeId: null });
  return shared ? { scope: 'user', preferences: shared } : null;
}

async function deleteHomePreferences(
  deps: SearchPreferencesDeps,
  userId: string,
  homeId: string,
): Promise<void> {
  const scope = await homeScope(deps, userId, homeId);
  if (!(await deps.preferences.deleteForHome(scope.homeId))) {
    throw new SearchPreferencesNotFoundError();
  }
}

/** Los casos de uso de las preferencias con sus dependencias ya inyectadas, listos para el transporte. */
export function searchPreferencesOperations(deps: SearchPreferencesDeps) {
  return {
    getMySearchPreferences: (userId: string) => found(deps, { userId, homeId: null }),
    putMySearchPreferences: (userId: string, input: SearchPreferencesInput) =>
      replace(deps, { userId, homeId: null }, input),
    getHomeSearchPreferences: async (userId: string, homeId: string) =>
      found(deps, await homeScope(deps, userId, homeId)),
    putHomeSearchPreferences: async (
      userId: string,
      homeId: string,
      input: SearchPreferencesInput,
    ) => replace(deps, await homeScope(deps, userId, homeId), input),
    deleteHomeSearchPreferences: (userId: string, homeId: string) =>
      deleteHomePreferences(deps, userId, homeId),
    resolveEffectivePreferences: (homeId: string) => resolveEffectivePreferences(deps, homeId),
  };
}
