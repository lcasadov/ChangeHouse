import type { SearchPreferencesInput } from '@changehouse/shared';

import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import {
  type SearchPreferences,
  type SearchPreferencesApi,
  SearchPreferencesApiError,
} from './search-preferences-api';

type Problem = components['schemas']['Problem'];

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const UNPROCESSABLE = 422;
const INCOMPLETE = 'SEARCH_PREFERENCES_INCOMPLETE';

function failureOf(status: number, problem: Problem | undefined): SearchPreferencesApiError {
  if (status === UNAUTHORIZED) return new SearchPreferencesApiError('unauthorized');
  if (status === NOT_FOUND) return new SearchPreferencesApiError('not-found');
  if (status === BAD_REQUEST || status === UNPROCESSABLE) {
    const fields = (problem?.errors ?? []).map((error) => error.field);
    const incomplete = status === UNPROCESSABLE && problem?.code === INCOMPLETE;
    return new SearchPreferencesApiError(incomplete ? 'incomplete' : 'invalid', fields);
  }
  return new SearchPreferencesApiError('server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new SearchPreferencesApiError('network');
  }
}

/** Adaptador HTTP del puerto `SearchPreferencesApi` sobre el cliente tipado. */
export function createHttpSearchPreferencesApi(client: ApiClient): SearchPreferencesApi {
  const pathOf = (homeId: string) => ({ params: { path: { homeId } } });

  return {
    async getMine(): Promise<SearchPreferences | null> {
      const { data, error, response } = await request(() => client.GET('/me/search-preferences'));
      if (data) return data;
      // Autenticada pero sin preferencias: el contrato responde 404 hasta el primer guardado
      if (response.status === NOT_FOUND) return null;
      throw failureOf(response.status, error);
    },

    async putMine(input: SearchPreferencesInput): Promise<SearchPreferences> {
      const { data, error, response } = await request(() =>
        client.PUT('/me/search-preferences', { body: input }),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async getForHome(homeId: string): Promise<SearchPreferences | null> {
      const { data, error, response } = await request(() =>
        client.GET('/homes/{homeId}/search-preferences', pathOf(homeId)),
      );
      if (data) return data;
      // Sin propias (o vivienda ajena, que la API trata igual): se usan las del usuario
      if (response.status === NOT_FOUND) return null;
      throw failureOf(response.status, error);
    },

    async putForHome(homeId: string, input: SearchPreferencesInput): Promise<SearchPreferences> {
      const { data, error, response } = await request(() =>
        client.PUT('/homes/{homeId}/search-preferences', { ...pathOf(homeId), body: input }),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async deleteForHome(homeId: string): Promise<void> {
      const { error, response } = await request(() =>
        client.DELETE('/homes/{homeId}/search-preferences', pathOf(homeId)),
      );
      // 404: ya no tenía propias, que es el estado que se buscaba
      if (!response.ok && response.status !== NOT_FOUND) throw failureOf(response.status, error);
    },
  };
}
